import type { LLMConfig } from '@playwright-reports/shared';
import type { FastifyInstance } from 'fastify';
import { withError } from '@/lib/withError.js';
import { analyticsService } from '../lib/service/analytics.js';
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

  fastify.post('/api/llm/analyze-failed-test', async (request, reply) => {
    try {
      const { testId, reportId, prompt } = request.body as {
        testId: string;
        reportId: string;
        prompt: string;
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

      console.log(`[llm] Fetching historical data for testId: ${testId}, reportId: ${reportId}`);
      const trends = await analyticsService.getTestTrends(reportId, testId);
      console.log(
        `[llm] Historical data result:`,
        trends ? `Found ${trends.runs.length} runs` : 'No historical data found'
      );

      let enhancedPrompt = prompt;
      if (trends && trends.runs.length > 0) {
        const recentFailures = trends.runs
          .filter((run) => run.isOutlier)
          .slice(-3)
          .map((run) => ({
            date: run.runDate.toISOString(),
            error: 'Test failure detected with outlier timing',
          }));

        const testContext = {
          totalRuns: trends.runs.length,
          recentFailures,
          averageDuration: trends.statistics?.mean || 0,
          isFlaky:
            trends.runs.length > 5 && trends.statistics.stdDev > trends.statistics.mean * 0.3,
        };

        enhancedPrompt += `\n\n**Historical Context:**\n`;
        enhancedPrompt += `- Total runs: ${testContext.totalRuns}\n`;
        enhancedPrompt += `- Average duration: ${testContext.averageDuration}ms\n`;
        enhancedPrompt += `- Status: ${testContext.isFlaky ? 'Potentially flaky' : 'Stable'}\n`;

        if (testContext.recentFailures.length > 0) {
          enhancedPrompt += `- Recent failures: ${testContext.recentFailures.length}\n`;
        }
      }

      const { result: response, error } = await withError(llmProvider.sendMessage(enhancedPrompt));
      if (error || !response) {
        reply.status(400);
        return { success: false, error: 'Failed to get response from LLM service' };
      }

      return {
        success: true,
        data: {
          content: response.content,
          usage: response.usage,
          model: response.model,
          testId,
          reportId,
        },
      };
    } catch (error) {
      fastify.log.error({
        error: 'LLM analysis error',
        message: error instanceof Error ? error.message : String(error),
      });
      reply.status(500);
      return { success: false, error: 'Failed to analyze test with LLM' };
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
