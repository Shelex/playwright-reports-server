import type { NextApiRequest, NextApiResponse } from 'next';

import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';

import Busboy from 'busboy';

import { service } from '@/app/lib/service';
import { DEFAULT_STREAM_CHUNK_SIZE } from '@/app/lib/storage/constants';
import { withError } from '@/app/lib/withError';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');

    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const resultID = randomUUID();
  const fileName = `${resultID}.zip`;

  const contentLength = (req.query['fileContentLength'] as string) ?? '';

  if (contentLength && Number.parseInt(contentLength, 10)) {
    console.log(
      `[upload] fileContentLength query parameter is provided for result ${resultID}, using presigned URL flow`,
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
    headers: req.headers,
    limits: {
      files: 1,
    },
    highWaterMark: DEFAULT_STREAM_CHUNK_SIZE,
    fileHwm: DEFAULT_STREAM_CHUNK_SIZE,
  });

  let saveResultPromise: Promise<void> | null = null;

  const uploadPromise = new Promise<void>((resolve, reject) => {
    let fileReceived = false;
    let cleanupDone = false;
    let isPaused = false;

    const cleanup = () => {
      if (cleanupDone) return;
      cleanupDone = true;

      console.log('[upload] cleaning up streams');

      // remove all listeners to prevent memory leaks
      req.removeAllListeners('aborted');
      req.removeAllListeners('close');

      // explicitly destroy streams
      if (!filePassThrough.destroyed) {
        filePassThrough.destroy();
      }
    };

    const onAborted = () => {
      console.log('[upload] request aborted or closed');
      cleanup();
      reject(new Error('Client aborted connection'));
    };

    req.on('aborted', onAborted);
    req.on('close', onAborted);

    bb.on('file', (_, fileStream) => {
      fileReceived = true;

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
          req.pause();
        }
      });

      filePassThrough.on('drain', () => {
        if (!isPaused) {
          return;
        }
        isPaused = false;
        fileStream.resume();
        req.resume();
      });

      fileStream.on('end', () => {
        console.log('[upload] fileStream ended');
        filePassThrough.end();
      });

      fileStream.on('error', (e) => {
        console.error('[upload] fileStream error:', e);
        cleanup();
        reject(e);
      });
    });

    bb.on('field', (name, val) => {
      resultDetails[name] = val;
    });

    bb.on('error', (error: Error) => {
      console.error('[upload] busboy error:', error);
      cleanup();
      reject(error);
    });

    bb.on('finish', async () => {
      if (!fileReceived) {
        cleanup();
        reject(new Error('No file received'));

        return;
      }

      if (!saveResultPromise) {
        cleanup();
        reject(new Error('Upload was not initiated'));

        return;
      }

      console.log('[upload] incoming stream finished, waiting for storage upload to complete...');

      const { error } = await withError(saveResultPromise);

      if (error) {
        cleanup();
        reject(error);

        return;
      }

      if (contentLength) {
        const expected = Number.parseInt(contentLength, 10);

        if (Number.isFinite(expected) && expected > 0 && fileSize !== expected) {
          cleanup();
          reject(new Error(`Size mismatch: received ${fileSize} bytes, expected ${expected} bytes`));

          return;
        }
      }

      cleanup();
      resolve();
    });
  });

  req.pipe(bb);

  const { error: uploadError } = await withError(uploadPromise);

  if (uploadError) {
    if (!filePassThrough.destroyed) {
      filePassThrough.destroy();
    }

    return res.status(400).json({ error: `upload result failed: ${uploadError.message}` });
  }

  const { result: uploadResult, error: uploadResultDetailsError } = await withError(
    service.saveResultDetails(resultID, resultDetails, fileSize),
  );

  if (uploadResultDetailsError) {
    res.status(400).json({ error: `upload result details failed: ${uploadResultDetailsError.message}` });
    await service.deleteResults([resultID]);

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
        return Response.json({ error: `failed to generate report: ${error.message}` }, { status: 500 });
      }

      generatedReport = result;
    }
  }

  return res.status(200).json({
    message: 'Success',
    data: { ...uploadResult, generatedReport },
  });
}
