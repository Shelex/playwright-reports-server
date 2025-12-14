import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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

    try {
      const query = request.query as Record<string, string>;
      const contentLength = query['fileContentLength'] || '';

      // if there is fileContentLength query parameter we can use presigned URL for direct upload
      const presignedUrl = contentLength ? await service.getPresignedUrl(fileName) : '';

      const resultDetails: Record<string, string> = {};
      const parts = request.parts();

      const filePassThrough = new PassThrough({
        highWaterMark: DEFAULT_STREAM_CHUNK_SIZE,
      });

      let fileStream: any = null;
      let fileSize = 0;

      const uploadPromise = new Promise<void>((resolve, reject) => {
        let fileReceived = false;
        let isComplete = false;

        const onAborted = () => {
          if (!fileReceived) {
            console.log(`[upload] client disconnected before file received`);
            isComplete = true;
            reject(new Error('No file received'));
          }

          if (!isComplete) {
            console.log(`[upload] client disconnected, fileSize so far: ${fileSize} bytes`);
            if (!filePassThrough.destroyed) {
              filePassThrough.destroy(new Error('Client aborted connection'));
            }
            reject(new Error('Client aborted connection'));
          }
        };

        filePassThrough.on('error', (error) => {
          if (!isComplete) {
            reject(error);
          }
        });

        request.raw.on('aborted', onAborted);
        request.raw.on('close', onAborted);

        (async () => {
          try {
            for await (const part of parts) {
              if (part.type === 'field') {
                resultDetails[part.fieldname] = part.value as string;
              }

              if (part.type === 'file' && !fileReceived) {
                fileStream = part;
                fileReceived = true;

                fileStream.file.on('data', (chunk: Buffer) => {
                  fileSize += chunk.length;
                });
                const shouldStoreLocalCopy = resultDetails.triggerReportGeneration === 'true';
                const savePromise = service.saveResult(fileName, filePassThrough, {
                  presignedUrl,
                  contentLength,
                  shouldStoreLocalCopy,
                });

                pipeline(fileStream.file, filePassThrough).catch((pipelineError) => {
                  if (!filePassThrough.destroyed) {
                    filePassThrough.destroy();
                  }
                  reject(new Error(`Stream pipeline failed: ${pipelineError.message}`));
                });

                savePromise
                  .then(() => {
                    console.log(
                      `[upload] file saved successfully: ${fileName}, size: ${fileSize} bytes`
                    );
                  })
                  .catch((saveError) => {
                    console.error(`[upload] save error:`, saveError);
                    if (!filePassThrough.destroyed) {
                      filePassThrough.destroy();
                    }
                  });

                isComplete = true;
                resolve();
                break;
              }
            }

            if (!fileReceived) {
              isComplete = true;
              reject(new Error('upload result failed: No file received'));
            }
          } catch (error) {
            isComplete = true;
            reject(error);
          }
        })();
      });

      const { error } = await withError(uploadPromise);

      if (error) {
        return reply.status(400).send({ error: error.message });
      }

      const { result: uploadResult, error: uploadResultDetailsError } = await withError(
        service.saveResultDetails(resultID, resultDetails, fileSize)
      );

      if (uploadResultDetailsError) {
        await withError(service.deleteResults([resultID]));
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
          `[upload] found ${testRunResults?.length} results for test run ${resultDetails.testRun}`
        );

        if (testRunResults?.length === Number.parseInt(resultDetails.shardTotal, 10)) {
          const ids = testRunResults.map((result) => result.resultID);

          console.log(`[upload] triggering report generation for ${resultDetails.testRun}`);

          const { result, error } = await withError(
            service.generateReport(ids, {
              project: resultDetails.project,
              testRun: resultDetails.testRun,
              playwrightVersion: resultDetails.playwrightVersion,
            })
          );

          if (error) {
            return reply.status(500).send({
              error: `failed to generate report: ${error.message}`,
            });
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

      const { error: deleteError } = await withError(service.deleteResults([resultID]));
      if (deleteError) {
        console.error(`[upload] cleanup failed for result ${resultID}:`, deleteError);
      }

      return reply.status(500).send({
        error: `upload result failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  });
}
