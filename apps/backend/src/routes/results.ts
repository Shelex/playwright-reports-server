import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { DeleteResultsRequestSchema, ListResultsQuerySchema } from '../lib/schemas/index.js';
import { service } from '../lib/service/index.js';
import { DEFAULT_STREAM_CHUNK_SIZE } from '../lib/storage/constants.js';
import { parseFromRequest } from '../lib/storage/pagination.js';
import { validateSchema } from '../lib/validation/index.js';
import { withError } from '../lib/withError.js';
import { type AuthRequest, authenticate } from './auth.js';

export async function registerResultRoutes(fastify: FastifyInstance) {
  fastify.get('/api/result/list', async (request, reply) => {
    try {
      const query = validateSchema(ListResultsQuerySchema, request.query);
      const params = new URLSearchParams();
      if (query.limit !== undefined) {
        params.append('limit', query.limit.toString());
      }
      if (query.offset !== undefined) {
        params.append('offset', query.offset.toString());
      }
      const pagination = parseFromRequest(params);
      const tags = query.tags ? query.tags.split(',').filter(Boolean) : [];

      const { result, error } = await withError(
        service.getResults({
          pagination,
          project: query.project,
          tags,
          search: query.search,
        })
      );

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      return result;
    } catch (error) {
      console.error('[routes] list results error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/api/result/projects', async (_, reply) => {
    const { result: projects, error } = await withError(service.getResultsProjects());

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    return projects;
  });

  fastify.get('/api/result/tags', async (_, reply) => {
    const { result: tags, error } = await withError(service.getResultsTags());

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    return tags;
  });

  fastify.delete(
    '/api/result/delete',
    {
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      try {
        const body = (request.body as { resultsIds?: unknown }) || { resultsIds: [] };

        if (!body.resultsIds || !Array.isArray(body.resultsIds)) {
          return reply.status(400).send({ error: 'resultsIds array is required' });
        }

        if (body.resultsIds.length === 0) {
          return reply.status(400).send({ error: 'At least one result ID must be provided' });
        }

        const validatedBody = validateSchema(DeleteResultsRequestSchema, body);
        console.log(`[routes] delete results:`, validatedBody.resultsIds);

        const { error } = await withError(service.deleteResults(validatedBody.resultsIds));

        if (error) {
          console.error(`[routes] delete results error:`, error);
          return reply.status(404).send({ error: error.message });
        }

        console.log(`[routes] delete results - deletion successful`);
        return reply.status(200).send({
          message: 'Results files deleted successfully',
          resultsIds: validatedBody.resultsIds,
        });
      } catch (error) {
        console.error('[routes] delete results validation error:', error);
        return reply.status(400).send({ error: 'Invalid request format' });
      }
    }
  );

  fastify.put('/api/result/upload', async (request, reply) => {
    const authResult = await authenticate(request as AuthRequest, reply);
    if (authResult) return authResult;

    const resultID = randomUUID();
    const fileName = `${resultID}.zip`;

    const query = request.query as Record<string, string>;
    const contentLength = query['fileContentLength'] || '';

    if (contentLength || Number.parseInt(contentLength, 10)) {
      console.log(
        `[upload] fileContentLength query parameter is provided for result ${resultID}, using presigned URL flow`
      );
    }

    // if there is fileContentLength query parameter we can use presigned URL for direct upload
    const presignedUrl = contentLength ? await service.getPresignedUrl(fileName) : '';

    const resultDetails: Record<string, string> = {};
    let fileSize = 0;

    const filePassThrough = new PassThrough({
      highWaterMark: DEFAULT_STREAM_CHUNK_SIZE,
    });

    try {
      const data = await request.file({
        limits: { files: 1, fileSize: 100 * 1024 * 1024 },
      });

      if (!data) {
        return reply.status(400).send({ error: 'upload result failed: No file received' });
      }

      for (const [key, prop] of Object.entries(data.fields)) {
        if (key === 'file') continue;

        if (prop && typeof prop === 'object' && 'value' in prop) {
          resultDetails[key] = String(prop.value);
        } else {
          resultDetails[key] = typeof prop === 'string' ? prop : String(prop);
        }
      }

      if (data.file && !Array.isArray(data.file)) {
        const saveResultPromise = service.saveResult(
          fileName,
          filePassThrough,
          presignedUrl,
          contentLength
        );

        let isPaused = false;

        data.file.on('data', (chunk: Buffer) => {
          fileSize += chunk.length;

          const canContinue = filePassThrough.write(chunk);

          if (!canContinue && !isPaused) {
            isPaused = true;
            data.file?.pause();
          }
        });

        filePassThrough.on('drain', () => {
          if (isPaused) {
            isPaused = false;
            data.file?.resume();
          }
        });

        data.file.on('end', () => {
          console.log('[upload] file ended');
          filePassThrough.end();
        });

        data.file.on('error', (error) => {
          console.error('[upload] file error:', error);
          filePassThrough.destroy();
          throw error;
        });

        data.file.pipe(filePassThrough);
        await saveResultPromise;

        if (contentLength) {
          const expected = Number.parseInt(contentLength, 10);
          if (Number.isFinite(expected) && expected > 0 && fileSize !== expected) {
            return reply.status(400).send({
              error: `Size mismatch: received ${fileSize} bytes, expected ${expected} bytes`,
            });
          }
        }
      }

      const { result: uploadResult, error: uploadResultDetailsError } = await withError(
        service.saveResultDetails(resultID, resultDetails, fileSize)
      );

      if (uploadResultDetailsError) {
        return reply.status(400).send({
          error: `upload result details failed: ${uploadResultDetailsError.message}`,
        });
      }

      let generatedReport = null;

      if (
        resultDetails.shardCurrent &&
        resultDetails.shardTotal &&
        resultDetails.triggerReportGeneration === 'true'
      ) {
        const { result: results, error: resultsError } = await withError(
          service.getResults({
            testRun: resultDetails.testRun,
          })
        );

        if (resultsError) {
          return reply.status(500).send({
            error: `failed to generate report: ${resultsError.message}`,
          });
        }

        const testRunResults = results?.results.filter(
          (result) =>
            result.testRun === resultDetails.testRun &&
            (resultDetails.project ? result.project === resultDetails.project : true)
        );

        console.log(
          `found ${testRunResults?.length} results for the test run ${resultDetails.testRun}`
        );

        if (testRunResults?.length === Number.parseInt(resultDetails.shardTotal)) {
          const ids = testRunResults.map((result) => result.resultID);

          console.log('triggerReportGeneration for', resultDetails.testRun, ids);
          const { result, error } = await withError(
            service.generateReport(ids, {
              project: resultDetails.project,
              testRun: resultDetails.testRun,
              playwrightVersion: resultDetails.playwrightVersion,
            })
          );

          if (error) {
            return reply.status(500).send({ error: `failed to generate report: ${error.message}` });
          }

          generatedReport = result;
        }
      }

      return reply.status(200).send({
        message: 'Success',
        data: {
          ...uploadResult,
          generatedReport,
        },
      });
    } catch (error) {
      console.error('[upload] error:', error);

      if (!filePassThrough.destroyed) {
        filePassThrough.destroy();
      }

      const { error: deleteError } = await withError(service.deleteResults([resultID]));
      if (deleteError) {
        console.error(`[upload] cleanup failed for result ${resultID}:`, deleteError);
        reply.status(400).send({
          error: `upload result failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        return;
      }

      return reply.status(400).send({
        error: `upload result failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });
}
