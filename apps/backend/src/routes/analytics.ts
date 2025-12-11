import type { FastifyInstance } from 'fastify';
import { withError } from '../lib/withError.js';
import { llmService } from '../lib/llm/index.js';
import { analyticsService } from '../lib/service/analytics.js';

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

      if (!llmService.isConfigured()) {
        reply.status(400);
        return {
          success: false,
          error: 'LLM service is not enabled. Set LLM_BASE_URL and LLM_API_TOKEN to enable',
        };
      }

      try {
        await llmService.initialize();
      } catch (configError) {
        reply.status(400);
        return {
          success: false,
          error: `LLM configuration error: ${configError instanceof Error ? configError.message : 'Unknown configuration error'}`,
        };
      }

      console.log(`[llm] Fetching historical data for testId: ${testId}, reportId: ${reportId}`);
      const trends = await analyticsService.getTestTrends(reportId, testId);
      console.log(
        `[llm] Historical data result:`,
        trends ? `Found ${trends.runs.length} runs` : 'No historical data found'
      );

      const context: any = {};
      if (trends && trends.runs.length > 0) {
        const recentFailures = trends.runs.filter((run) => run.isOutlier).slice(-3).length;

        context.totalRuns = trends.runs.length;
        context.averageDuration = trends.statistics?.mean || 0;
        context.isFlaky =
          trends.runs.length > 5 && trends.statistics.stdDev > trends.statistics.mean * 0.3;
        context.recentFailures = recentFailures;
      }

      const { result: response, error } = await withError(
        llmService.sendMessage(prompt, undefined, context)
      );
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
