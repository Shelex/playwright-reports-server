import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { withError } from '../lib/withError.js';
import { testManagementService } from '../lib/service/testManagement.js';

export async function registerTestsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/tests', async (request: FastifyRequest, reply: FastifyReply) => {
    const { project, status, flakinessMin, flakinessMax } = request.query as {
      project?: string;
      status?: string;
      flakinessMin?: string;
      flakinessMax?: string;
    };

    try {
      const options = {
        project: project,
        status: status as 'all' | 'quarantined' | 'not-quarantined' | undefined,
        flakinessMin: flakinessMin ? Number.parseInt(flakinessMin, 10) : undefined,
        flakinessMax: flakinessMax ? Number.parseInt(flakinessMax, 10) : undefined,
      };

      const tests = await testManagementService.getTests(options.project, options);
      return reply.send({ success: true, data: tests });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch tests',
      });
    }
  });

  fastify.get('/api/test/:fileId/:testId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { fileId, testId } = request.params as { fileId: string; testId: string };
    const { project } = request.query as { project: string };

    const { result: test, error } = await withError(
      testManagementService.getTest(testId, fileId, project)
    );

    if (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch test details',
      });
    }

    if (!test) {
      return reply.status(404).send({
        success: false,
        error: 'Test not found',
      });
    }

    return reply.send({ success: true, data: test });
  });

  fastify.patch(
    '/api/test/:fileId/:testId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { fileId, testId } = request.params as { fileId: string; testId: string };
      const { project } = request.query as { project: string };
      const body = request.body as {
        isQuarantined: boolean;
        reason?: string;
      };

      if (body.isQuarantined && (!body.reason || body.reason.trim().length === 0)) {
        return reply.status(400).send({
          success: false,
          error: 'Reason is required when quarantining a test',
        });
      }

      if (body.reason && body.reason.length > 500) {
        return reply.status(400).send({
          success: false,
          error: 'Reason must be less than 500 characters',
        });
      }

      const { error } = await withError(
        testManagementService.updateQuarantineStatus(
          testId,
          fileId,
          project,
          body.isQuarantined,
          body.reason
        )
      );

      if (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: 'Failed to update quarantine status',
        });
      }

      return reply.send({
        success: true,
        data: {
          testId,
          fileId,
          isQuarantined: body.isQuarantined,
          reason: body.reason,
        },
      });
    }
  );
}
