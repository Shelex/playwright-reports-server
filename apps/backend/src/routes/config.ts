import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SiteWhiteLabelConfig } from '@playwright-reports/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { llmService } from '../lib/llm/index.js';
import { CronService, cronService } from '../lib/service/cron.js';
import { getDatabaseStats } from '../lib/service/db/index.js';
import { service } from '../lib/service/index.js';
import { JiraService } from '../lib/service/jira.js';
import { DATA_FOLDER } from '../lib/storage/constants.js';
import { withError } from '../lib/withError.js';
import { type AuthRequest, authenticate } from './auth.js';

interface MultipartFile {
  fieldname: string;
  filename?: string;
  toBuffer(): Promise<Buffer>;
}

interface ConfigFormData {
  title?: string;
  logoPath?: string;
  faviconPath?: string;
  reporterPaths?: string;
  headerLinks?: string;
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  jiraProjectKey?: string;
  resultExpireDays?: string;
  resultExpireCronSchedule?: string;
  reportExpireDays?: string;
  reportExpireCronSchedule?: string;
  llmProvider?: string;
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmTemperature?: string;
}

export async function registerConfigRoutes(fastify: FastifyInstance) {
  fastify.get('/api/config', async (_request, reply) => {
    const { result: config, error } = await withError(service.getConfig());

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    const envInfo = {
      authRequired: !!env.API_TOKEN,
      database: getDatabaseStats(),
      dataStorage: env.DATA_STORAGE,
      s3Endpoint: env.S3_ENDPOINT,
      s3Bucket: env.S3_BUCKET,
    };

    const llmInfo = {
      provider: env.LLM_PROVIDER,
      baseUrl: env.LLM_BASE_URL,
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
      temperature: env.LLM_TEMPERATURE,
    };

    const testManagement = {
      quarantineThresholdPercentage: env.TEST_FLAKINESS_QUARANTINE_THRESHOLD,
      warningThresholdPercentage: env.TEST_FLAKINESS_WARNING_THRESHOLD,
      autoQuarantineEnabled: env.TEST_FLAKINESS_AUTO_QUARANTINE === 'true',
      flakinessMinRuns: env.TEST_FLAKINESS_MIN_RUNS,
      flakinessEvaluationWindowDays: env.TEST_FLAKINESS_EVALUATION_WINDOW_DAYS,
    };

    return { ...config, ...envInfo, llm: llmInfo, testManagement };
  });

  fastify.patch('/api/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authResult = await authenticate(request as AuthRequest, reply);
      if (authResult) return authResult;

      const data = await request.file({
        limits: { files: 2 },
      });

      if (!data) {
        return reply.status(400).send({ error: 'No data received' });
      }

      let logoFile: MultipartFile | null = null;
      let faviconFile: MultipartFile | null = null;
      const formData: ConfigFormData = {};

      for await (const part of data.file) {
        if (part.type === 'file') {
          const filePart = part as MultipartFile;
          if (part.fieldname === 'logo') {
            logoFile = filePart;
          } else if (part.fieldname === 'favicon') {
            faviconFile = filePart;
          }
        } else if (part.type === 'field') {
          const fieldName = part.fieldname as keyof ConfigFormData;
          formData[fieldName] = part.value as string;
        }
      }

      const config = await service.getConfig();

      if (!config) {
        return reply.status(500).send({ error: 'failed to get config' });
      }

      if (logoFile) {
        const { error: logoError } = await withError(
          writeFile(join(DATA_FOLDER, logoFile.filename!), Buffer.from(await logoFile.toBuffer()))
        );

        if (logoError) {
          return reply.status(500).send({ error: `failed to save logo: ${logoError?.message}` });
        }
        config.logoPath = `/${logoFile.filename}`;
      }

      if (faviconFile) {
        const { error: faviconError } = await withError(
          writeFile(
            join(DATA_FOLDER, faviconFile.filename!),
            Buffer.from(await faviconFile.toBuffer())
          )
        );

        if (faviconError) {
          return reply.status(500).send({
            error: `failed to save favicon: ${faviconError?.message}`,
          });
        }
        config.faviconPath = `/${faviconFile.filename}`;
      }

      if (formData.title !== undefined) {
        config.title = formData.title;
      }

      if (formData.logoPath !== undefined && !logoFile) {
        config.logoPath = formData.logoPath;
      }

      if (formData.faviconPath !== undefined && !faviconFile) {
        config.faviconPath = formData.faviconPath;
      }

      if (formData.reporterPaths !== undefined) {
        try {
          config.reporterPaths = JSON.parse(formData.reporterPaths);
        } catch {
          config.reporterPaths = [formData.reporterPaths];
        }
      }

      if (formData.headerLinks !== undefined) {
        try {
          const parsedHeaderLinks = JSON.parse(formData.headerLinks);
          if (parsedHeaderLinks) config.headerLinks = parsedHeaderLinks;
        } catch (error) {
          return reply.status(400).send({
            error: `failed to parse header links: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
          });
        }
      }

      config.jira ??= {};

      if (formData.jiraBaseUrl !== undefined) config.jira.baseUrl = formData.jiraBaseUrl;
      if (formData.jiraEmail !== undefined) config.jira.email = formData.jiraEmail;
      if (formData.jiraApiToken !== undefined) config.jira.apiToken = formData.jiraApiToken;
      if (formData.jiraProjectKey !== undefined) config.jira.projectKey = formData.jiraProjectKey;

      if (
        formData.jiraBaseUrl ||
        formData.jiraEmail ||
        formData.jiraApiToken ||
        formData.jiraProjectKey
      ) {
        JiraService.resetInstance();
      }

      config.llm ??= {};

      if (formData.llmProvider !== undefined) {
        const provider = formData.llmProvider;
        config.llm.provider = provider as any;
      }
      if (formData.llmBaseUrl !== undefined) config.llm.baseUrl = formData.llmBaseUrl;
      if (formData.llmApiKey !== undefined) config.llm.apiKey = formData.llmApiKey;
      if (formData.llmModel !== undefined) config.llm.model = formData.llmModel;
      if (formData.llmTemperature !== undefined) {
        const temperature = Number.parseFloat(formData.llmTemperature);
        if (Number.isNaN(temperature)) {
          return reply.status(400).send({
            error: 'LLM temperature must be a number between 0 and 2',
          });
        }
        config.llm.temperature = temperature;
      }

      const llmConfigChanged = !!(
        formData.llmProvider ||
        formData.llmBaseUrl ||
        formData.llmApiKey ||
        formData.llmModel ||
        formData.llmTemperature !== undefined
      );

      if (llmConfigChanged) {
        await llmService.restart(config.llm);
      }

      config.cron ??= {};

      if (formData.resultExpireDays !== undefined) {
        config.cron.resultExpireDays = Number.parseInt(formData.resultExpireDays, 10);
      }
      if (formData.resultExpireCronSchedule !== undefined) {
        config.cron.resultExpireCronSchedule = formData.resultExpireCronSchedule;
      }
      if (formData.reportExpireDays !== undefined) {
        config.cron.reportExpireDays = Number.parseInt(formData.reportExpireDays, 10);
      }
      if (formData.reportExpireCronSchedule !== undefined) {
        config.cron.reportExpireCronSchedule = formData.reportExpireCronSchedule;
      }

      if (
        formData.resultExpireDays ||
        formData.resultExpireCronSchedule ||
        formData.reportExpireDays ||
        formData.reportExpireCronSchedule
      ) {
        const instance = CronService.getInstance();
        await instance.restart();
      }

      const { error: saveConfigError } = await withError(service.updateConfig(config));

      if (saveConfigError) {
        return reply.status(500).send({
          error: `failed to save config: ${saveConfigError.message}`,
        });
      }

      if (
        config.cron?.resultExpireDays ||
        config.cron?.resultExpireCronSchedule ||
        config.cron?.reportExpireDays ||
        config.cron?.reportExpireCronSchedule
      ) {
        await cronService.restart();
      }

      return reply.send({ message: 'config saved' });
    } catch (error) {
      fastify.log.error({ error }, 'Config update error');
      return reply.status(400).send({
        error: `config update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });

  fastify.get('/api/info', async (_request, reply) => {
    const { result: info, error } = await withError(service.getServerInfo());

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    return info;
  });

  fastify.post(
    '/api/cache/refresh',
    {
      schema: {
        response: {
          200: { type: 'object' },
          400: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (_request, reply) => {
      const { result, error } = await withError(service.refreshCache());

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return result;
    }
  );
}
