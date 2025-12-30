import type { FastifyInstance } from 'fastify';
import { llmService } from '../lib/llm/index.js';
import { analyticsService } from '../lib/service/analytics.js';
import { withError } from '../lib/withError.js';

export async function registerAnalyticsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/analytics', async (request, reply) => {
    try {
      const { project = 'all' } = request.query as { project?: string };
      const analyticsData = await analyticsService.getAnalyticsData(project);

      return { success: true, data: analyticsData };
    } catch (error) {
      reply.status(500);
      return {
        success: false,
        error: `Failed to fetch analytics data: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  });

  fastify.post('/api/llm/analyze-failed-test', async (request, reply) => {
    try {
      const { testId, reportId, prompt } = request.body as {
        testId: string;
        reportId: string;
        prompt: string;
      };

      if (!testId || !reportId || !prompt) {
        reply.status(400);
        reply.send({
          success: false,
          error: 'Missing some of required parameters: testId, reportId, prompt',
        });
        return;
      }

      if (!llmService.isConfigured()) {
        reply.status(400);
        reply.send({
          success: false,
          error: 'LLM service is not enabled. Set LLM_BASE_URL and LLM_API_TOKEN to enable',
        });
        return;
      }

      const { error: llmInitError } = await withError(llmService.initialize());
      if (llmInitError) {
        reply.status(400);
        reply.send({
          success: false,
          error: `LLM initialization error: ${llmInitError instanceof Error ? llmInitError.message : 'Unknown initialization error'}`,
        });
        return;
      }

      console.log(`[llm] Fetching historical data for testId: ${testId}, reportId: ${reportId}`);
      const { result: trends, error: testHistoryError } = await withError(
        analyticsService.getTestTrends(testId)
      );

      if (testHistoryError) {
        console.log(
          `[llm] Failed to fetch historical data: ${testHistoryError instanceof Error ? testHistoryError.message : String(testHistoryError)}`
        );
      }

      console.log(
        `[llm] Historical data result:`,
        trends ? `Found ${trends?.runs?.length} runs` : 'No historical data found'
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

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sendChunk = (chunk: {
        type: string;
        content?: string;
        model?: string;
        usage?: any;
        finishReason?: string;
        error?: string;
      }) => {
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      };

      try {
        await llmService.sendMessageStream(prompt, sendChunk, {
          context,
        });
      } catch (streamError) {
        sendChunk({
          type: 'error',
          error: streamError instanceof Error ? streamError.message : 'Stream error occurred',
        });
      }

      reply.raw.end();
    } catch (error) {
      fastify.log.error({
        error: 'LLM streaming analysis error',
        message: error instanceof Error ? error.message : String(error),
      });
      if (!reply.sent) {
        reply.status(500);
        reply.send({ success: false, error: 'Failed to analyze test with LLM' });
      }
    }
  });
}
