import crypto from 'node:crypto';
import type { FailureAnalysisRequest, LLMConfig } from '@playwright-reports/shared';
import type { FastifyInstance } from 'fastify';
import { analyticsService } from '../lib/service/analytics.js';
import { getDatabase } from '../lib/service/db/index.js';
import { createLLMProvider } from '../lib/service/llm.js';

export async function registerAnalyticsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/analytics/:reportId?', async (request, reply) => {
    try {
      const { reportId } = request.params as { reportId?: string };
      const { project } = request.query as { project?: string };

      const analyticsData = reportId
        ? await analyticsService.getAnalyticsForReport(reportId)
        : await analyticsService.getAnalyticsData(project);

      return { success: true, data: analyticsData };
    } catch (error) {
      fastify.log.error({
        error: 'Analytics error',
        message: error instanceof Error ? error.message : String(error),
      });
      reply.status(500);
      return { success: false, error: 'Failed to fetch analytics data' };
    }
  });

  fastify.get('/api/analytics/:reportId/tests/:testId/timings', async (request, reply) => {
    try {
      const { reportId, testId } = request.params as { reportId: string; testId: string };

      const trends = await analyticsService.getTestStepTimingTrends(reportId, testId);

      if (!trends) {
        reply.status(404);
        return { success: false, error: 'Test timing trends not found' };
      }

      return { success: true, data: trends };
    } catch (error) {
      fastify.log.error({
        error: 'Test timing trends error',
        message: error instanceof Error ? error.message : String(error),
      });
      reply.status(500);
      return { success: false, error: 'Failed to fetch test timing trends' };
    }
  });

  fastify.post('/api/llm/analyze-failure', async (request, reply) => {
    try {
      const {
        prompt,
        testId,
        reportId,
        request: analysisRequest,
      } = request.body as {
        prompt: string;
        testId: string;
        reportId: string;
        request?: FailureAnalysisRequest;
      };

      let llmConfig: LLMConfig;
      try {
        llmConfig = await getLLMConfig();
      } catch (configError) {
        reply.status(400);
        return {
          success: false,
          error: `LLM configuration error: ${configError instanceof Error ? configError.message : 'Unknown configuration error'}`,
        };
      }

      if (!llmConfig.enabled) {
        reply.status(400);
        return {
          success: false,
          error: 'LLM service is not enabled. Set LLM_ENABLED=true to enable',
        };
      }

      const llmProvider = createLLMProvider(llmConfig);

      const isValid = await llmProvider.validateConfig();
      if (!isValid) {
        reply.status(400);
        return { success: false, error: 'LLM configuration is invalid' };
      }

      const response = await llmProvider.sendMessage(prompt);

      if (analysisRequest) {
        await storeFailureAnalysis({
          reportId: analysisRequest.reportId,
          testId: analysisRequest.testId,
          testTitle: analysisRequest.testId,
          failedStepIndex: analysisRequest.failedStepIndex,
          rootCause: response.content,
          confidence: 'unknown', // determined from llm
          debuggingSteps: [], // determined from llm
          codeFix: '', // determined from llm
          preventionStrategy: '', // determined from llm
          model: response.model,
          generatedAt: new Date(),
        });
      }

      return {
        success: true,
        data: {
          content: response.content,
          usage: response.usage,
          model: response.model,
        },
      };
    } catch (error) {
      fastify.log.error({
        error: 'LLM analysis error',
        message: error instanceof Error ? error.message : String(error),
      });
      reply.status(500);
      return { success: false, error: 'Failed to analyze failure with AI' };
    }
  });
}

async function getLLMConfig(): Promise<LLMConfig> {
  const enabled = process.env.LLM_ENABLED === 'true';
  const provider = (process.env.LLM_PROVIDER as 'openai' | 'anthropic' | 'zai') || 'openai';
  const apiKey = process.env.LLM_API_KEY || '';
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const temperature = process.env.LLM_TEMPERATURE;
  const maxTokens = process.env.LLM_MAX_TOKENS;

  if (!enabled) {
    return {
      enabled: false,
      provider: 'openai',
      baseUrl: '',
      apiKey: '',
      model: '',
      temperature: 0,
      maxTokens: 0,
    };
  }

  if (!apiKey) {
    throw new Error('LLM_API_KEY environment variable is required when LLM_ENABLED is true');
  }

  const validProviders = ['openai', 'anthropic', 'zai'];
  if (!validProviders.includes(provider)) {
    throw new Error(
      `Invalid LLM provider: ${provider}. Must be one of: ${validProviders.join(', ')}`
    );
  }

  let defaultBaseUrl: string;
  let defaultModel: string;
  let defaultTemperature: number;
  let defaultMaxTokens: number;

  switch (provider) {
    case 'openai':
      defaultBaseUrl = 'https://api.openai.com/v1';
      defaultModel = 'gpt-4';
      defaultTemperature = 0.3;
      defaultMaxTokens = 2000;
      break;
    case 'anthropic':
      defaultBaseUrl = 'https://api.anthropic.com';
      defaultModel = 'claude-3-5-sonnet-20241022';
      defaultTemperature = 0.3;
      defaultMaxTokens = 2000;
      break;
    case 'zai':
      defaultBaseUrl = 'https://api.z.ai';
      defaultModel = 'glm-4.6';
      defaultTemperature = 0.3;
      defaultMaxTokens = 2000;
      break;
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  let parsedTemperature: number;
  try {
    parsedTemperature =
      temperature === undefined ? defaultTemperature : Number.parseFloat(temperature);
    if (Number.isNaN(parsedTemperature) || parsedTemperature < 0 || parsedTemperature > 2) {
      throw new Error('Temperature must be a number between 0 and 2');
    }
  } catch {
    throw new Error('Invalid LLM_TEMPERATURE value. Must be a number between 0 and 2');
  }

  let parsedMaxTokens: number;
  try {
    parsedMaxTokens = maxTokens === undefined ? defaultMaxTokens : Number.parseInt(maxTokens, 10);
    if (Number.isNaN(parsedMaxTokens) || parsedMaxTokens <= 0 || parsedMaxTokens > 100000) {
      throw new Error('Max tokens must be a positive number less than 100000');
    }
  } catch {
    throw new Error('Invalid LLM_MAX_TOKENS value. Must be a positive integer');
  }

  return {
    enabled: true,
    provider,
    baseUrl: baseUrl || defaultBaseUrl,
    apiKey,
    model: model || defaultModel,
    temperature: parsedTemperature,
    maxTokens: parsedMaxTokens,
  };
}

async function storeFailureAnalysis(analysis: {
  reportId: string;
  testId: string;
  testTitle: string;
  failedStepIndex: number;
  rootCause: string;
  confidence: string;
  debuggingSteps: string[];
  codeFix: string;
  preventionStrategy: string;
  model: string;
  generatedAt: Date;
}): Promise<void> {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO failure_analyses
    (id, report_id, test_id, test_title, failed_step_index, root_cause, confidence, debugging_steps, code_fix, prevention_strategy, model, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const id = crypto.randomUUID();
  const debuggingSteps = JSON.stringify(analysis.debuggingSteps || []);

  stmt.run(
    id,
    analysis.reportId,
    analysis.testId,
    analysis.testTitle,
    analysis.failedStepIndex,
    analysis.rootCause,
    analysis.confidence,
    debuggingSteps,
    analysis.codeFix,
    analysis.preventionStrategy,
    analysis.model,
    analysis.generatedAt.toISOString()
  );
}
