import type { FastifyInstance } from 'fastify';
import {
  DeleteReportsRequestSchema,
  GenerateReportRequestSchema,
  GetReportParamsSchema,
  ListReportsQuerySchema,
} from '../lib/schemas/index.js';
import { service } from '../lib/service/index.js';
import { parseFromRequest } from '../lib/storage/pagination.js';
import { validateSchema } from '../lib/validation/index.js';
import { withError } from '../lib/withError.js';

export async function registerReportRoutes(fastify: FastifyInstance) {
  fastify.get('/api/report/list', async (request, reply) => {
    try {
      const query = validateSchema(ListReportsQuerySchema, request.query);
      const params = new URLSearchParams();
      if (query.limit !== undefined) {
        params.append('limit', query.limit.toString());
      }
      if (query.offset !== undefined) {
        params.append('offset', query.offset.toString());
      }
      const pagination = parseFromRequest(params);

      const { result: reports, error } = await withError(
        service.getReports({
          pagination,
          project: query.project,
          search: query.search,
        })
      );

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return reports;
    } catch (error) {
      console.error('[routes] list reports error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/api/report/:id', async (request, reply) => {
    try {
      const params = validateSchema(GetReportParamsSchema, request.params);
      const { result: report, error } = await withError(service.getReport(params.id));

      if (error) {
        return reply.status(404).send({ error: error.message });
      }

      return report;
    } catch (error) {
      console.error('[routes] get report error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/api/report/projects', async (_request, reply) => {
    try {
      const { result: projects, error } = await withError(service.getReportsProjects());

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return projects;
    } catch (error) {
      console.error('[routes] get projects error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/api/report/generate', async (request, reply) => {
    try {
      const body = (request.body as { resultsIds?: unknown; [key: string]: unknown }) || {};

      if (!body.resultsIds || !Array.isArray(body.resultsIds)) {
        return reply.status(400).send({ error: 'resultsIds array is required' });
      }

      if (body.resultsIds.length === 0) {
        return reply.status(400).send({ error: 'At least one result ID must be provided' });
      }

      const validatedBody = validateSchema(GenerateReportRequestSchema, body);
      console.log(`[routes] generate report request:`, validatedBody);

      const metadata: Record<string, string> = {
        ...(validatedBody.project && { project: validatedBody.project }),
        ...(validatedBody.playwrightVersion && {
          playwrightVersion: validatedBody.playwrightVersion,
        }),
        ...(validatedBody.title && { title: validatedBody.title }),
        ...Object.fromEntries(
          Object.entries(validatedBody)
            .filter(
              ([key]) =>
                !['resultsIds', 'project', 'playwrightVersion', 'title'].includes(key) &&
                typeof validatedBody[key as keyof typeof validatedBody] === 'string'
            )
            .map(([key, value]) => [key, String(value)])
        ),
      };

      const { result, error } = await withError(
        service.generateReport(validatedBody.resultsIds, metadata)
      );

      if (error) {
        console.error(`[routes] generate report error:`, error.message);

        if (error instanceof Error && error.message.includes('ENOENT: no such file or directory')) {
          return reply.status(404).send({
            error: `ResultID not found: ${error.message}`,
          });
        }

        return reply.status(400).send({ error: error.message });
      }

      console.log(`[routes] generate report success:`, result);
      return result;
    } catch (error) {
      console.error('[routes] generate report validation error:', error);
      return reply.status(400).send({ error: 'Invalid request format' });
    }
  });

  fastify.delete('/api/report/delete', async (request, reply) => {
    try {
      const body = (request.body as { reportsIds?: unknown }) || { reportsIds: [] };

      if (!body.reportsIds || !Array.isArray(body.reportsIds)) {
        return reply.status(400).send({ error: 'reportsIds array is required' });
      }

      if (body.reportsIds.length === 0) {
        return reply.status(400).send({ error: 'At least one report ID must be provided' });
      }

      const validatedBody = validateSchema(DeleteReportsRequestSchema, body);
      console.log(`[routes] delete reports:`, validatedBody.reportsIds);

      const { error } = await withError(service.deleteReports(validatedBody.reportsIds));

      if (error) {
        console.error(`[routes] delete reports error:`, error);
        return reply.status(404).send({ error: error.message });
      }

      return reply.status(200).send({
        message: 'Reports deleted successfully',
        reportsIds: validatedBody.reportsIds,
      });
    } catch (error) {
      console.error('[routes] delete reports validation error:', error);
      return reply.status(400).send({ error: 'Invalid request format' });
    }
  });
}

