import type { Request, Response } from 'express';

import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';

import Busboy from 'busboy';

import { service } from '@/app/lib/service';
import { DEFAULT_STREAM_CHUNK_SIZE } from '@/app/lib/storage/constants';
import { withError } from '@/app/lib/withError';

async function waitForBufferDrain(stream: PassThrough, maxWaitMs = 30 * 1000): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkBuffer = () => {
      const buffered = stream.readableLength || 0;

      if (buffered === 0) {
        resolve();

        return;
      }

      if (Date.now() - startTime > maxWaitMs) {
        reject(new Error(`Timeout waiting for buffer to drain (${buffered} bytes remaining)`));

        return;
      }

      setTimeout(checkBuffer, 250);
    };

    checkBuffer();
  });
}

export async function handleUpload(req: Request, res: Response) {
  const resultID = randomUUID();
  const fileName = `${resultID}.zip`;

  const contentLength = (req.query['fileContentLength'] as string) ?? '';

  if (contentLength || parseInt(contentLength, 10)) {
    console.log(
      `[express] fileContentLength query parameter is provided for result ${resultID}, using presigned URL flow`,
    );
  }

  // if there is fileContentLength query parameter we can use presigned URL for direct upload
  const presignedUrl = contentLength ? await service.getPresignedUrl(fileName) : '';

  const resultDetails: Record<string, string> = {};
  let fileSize = 0;

  const filePassThrough = new PassThrough({
    highWaterMark: DEFAULT_STREAM_CHUNK_SIZE,
  });

  const bb = Busboy({
    headers: req.headers as Record<string, string>,
    limits: {
      files: 1,
    },
    highWaterMark: DEFAULT_STREAM_CHUNK_SIZE,
    fileHwm: DEFAULT_STREAM_CHUNK_SIZE,
  });

  let saveResultPromise: Promise<void>;

  const uploadPromise = new Promise<void>((resolve, reject) => {
    let fileReceived = false;
    let cleanupDone = false;
    let uploadCompleted = false;

    const cleanup = () => {
      if (cleanupDone) return;
      cleanupDone = true;

      console.log('[express] cleaning up streams');

      // stop reading from req
      req.unpipe(bb);

      // remove all listeners to prevent memory leaks
      req.removeAllListeners('aborted');
      req.removeAllListeners('close');

      // explicitly destroy streams
      if (!filePassThrough.destroyed) {
        filePassThrough.destroy();
      }
    };

    const onAborted = () => {
      // only treat as error if upload hasn't completed successfully
      if (!uploadCompleted) {
        console.log('[express] request aborted or closed prematurely');
        cleanup();
        reject(new Error('Client aborted connection'));
      }
    };

    req.on('aborted', onAborted);
    req.on('close', onAborted);

    bb.on('file', (_, fileStream) => {
      fileReceived = true;
      let isPaused = false;

      saveResultPromise = service
        .saveResult(fileName, filePassThrough, presignedUrl, contentLength)
        .catch((error: Error) => {
          cleanup();
          reject(error);
        });

      fileStream.on('data', (chunk: Buffer) => {
        fileSize += chunk.length;

        const canContinue = filePassThrough.write(chunk);

        if (!canContinue && !isPaused) {
          isPaused = true;
          fileStream.pause();
          req.unpipe(bb);
        }
      });

      filePassThrough.on('drain', async () => {
        if (isPaused) {
          await waitForBufferDrain(filePassThrough);
          isPaused = false;
          req.pipe(bb);
          fileStream.resume();
        }
      });

      fileStream.on('end', () => {
        console.log('[express] fileStream ended');
        filePassThrough.end();
      });

      fileStream.on('error', (e) => {
        console.error('[express] fileStream error:', e);
        cleanup();
        reject(e);
      });
    });

    bb.on('field', (name, val) => {
      resultDetails[name] = val;
    });

    bb.on('error', (error: Error) => {
      console.error('[express] busboy error:', error);
      cleanup();
      reject(error);
    });

    bb.on('finish', async () => {
      console.log('[express] busboy finished');

      req.removeAllListeners('aborted');
      req.removeAllListeners('close');

      if (!fileReceived) {
        cleanup();
        reject(new Error('No file received'));

        return;
      }

      if (saveResultPromise) {
        const { error } = await withError(saveResultPromise);

        if (error) {
          cleanup();
          reject(error);

          return;
        }

        if (contentLength) {
          const expected = parseInt(contentLength, 10);

          if (Number.isFinite(expected) && expected > 0 && fileSize !== expected) {
            cleanup();
            reject(new Error(`Size mismatch: received ${fileSize} bytes, expected ${expected} bytes`));

            return;
          }
        }

        // Mark upload as completed before cleanup to prevent false abort errors
        uploadCompleted = true;
        cleanup();
        resolve();
      }
    });
  });

  req.pipe(bb);

  const { error: uploadError } = await withError(uploadPromise);

  if (uploadError) {
    if (!filePassThrough.destroyed) {
      filePassThrough.destroy();
    }

    res.status(400).json({ error: `upload result failed: ${uploadError.message}` });

    return;
  }

  const { result: uploadResult, error: uploadResultDetailsError } = await withError(
    service.saveResultDetails(resultID!, resultDetails, fileSize),
  );

  if (uploadResultDetailsError) {
    res.status(400).json({ error: `upload result details failed: ${uploadResultDetailsError.message}` });
    await service.deleteResults([resultID!]);

    return;
  }

  let generatedReport = null;

  if (resultDetails.shardCurrent && resultDetails.shardTotal && resultDetails.triggerReportGeneration === 'true') {
    const { result: results, error: resultsError } = await withError(
      service.getResults({
        testRun: resultDetails.testRun,
      }),
    );

    if (resultsError) {
      return res.status(500).json({ error: `failed to generate report: ${resultsError.message}` });
    }

    const testRunResults = results?.results.filter(
      (result) =>
        result.testRun === resultDetails.testRun &&
        (resultDetails.project ? result.project === resultDetails.project : true),
    );

    console.log(`found ${testRunResults?.length} results for the test run ${resultDetails.testRun}`);

    // Checking if all shards are uploaded
    if (testRunResults?.length === parseInt(resultDetails.shardTotal)) {
      const ids = testRunResults.map((result) => result.resultID);

      console.log('triggerReportGeneration for', resultDetails.testRun, ids);
      const { result, error } = await withError(
        service.generateReport(ids, {
          project: resultDetails.project,
          testRun: resultDetails.testRun,
          playwrightVersion: resultDetails.playwrightVersion,
        }),
      );

      if (error) {
        return res.status(500).json({ error: `failed to generate report: ${error.message}` });
      }

      generatedReport = result;
    }
  }

  return res.status(200).json({
    message: 'Success',
    data: { ...uploadResult, generatedReport },
  });
}
