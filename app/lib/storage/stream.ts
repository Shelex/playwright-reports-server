import { type IncomingHttpHeaders } from 'node:http2';
import { type ReadableStream } from 'node:stream/web';
import { Readable, type ReadableOptions } from 'node:stream';

import busboy from 'busboy';

import { type ResultDetails } from './types';

import { storage } from '@/app/lib/storage';
import { service } from '@/app/lib/service';
import { withError } from '@/app/lib/withError';

export const defaultStreamingOptions: ReadableOptions = {
  encoding: 'binary',
  highWaterMark: 10 * 1024 * 1024, // 10MB
};

export const handleResultFileStream = async (request: Request) =>
  new Promise((resolve, reject) => {
    const bb = busboy({
      headers: {
        // convert types as global Request is not compatible with node http headers
        ...(request.headers as unknown as IncomingHttpHeaders),
        'content-type': request.headers.get('content-type') ?? 'application/zip',
      },
      highWaterMark: defaultStreamingOptions.highWaterMark,
      fileHwm: defaultStreamingOptions.highWaterMark,
      limits: {
        files: 1,
      },
    });

    const resultDetails: ResultDetails = {};

    bb.on('field', (fieldname, value) => {
      if (fieldname === 'file') {
        return;
      }
      resultDetails[fieldname] = value.toString();
    });

    bb.on('file', async (name: string, fileStream: Readable) => {
      if (name !== 'file') {
        fileStream.resume(); // drain unwanted streams

        return;
      }

      fileStream.on('error', (error) => {
        reject(new Error(`Error processing file stream: ${error.message}`));
      });

      const size = parseInt(request.headers.get('content-length') ?? '', 10);

      const { upload, resultID, stream } = await storage.getResultFileWriteStream(size);

      /**
       * additional backpressure handling
       * https://nodejs.org/en/learn/modules/backpressuring-in-streams
       */
      fileStream
        .on('data', (chunk) => {
          if (!stream.write(chunk)) {
            fileStream.pause();
          }
        })
        .on('error', (error) => {
          console.log(`readable stream error: ${error.message}`);
        });

      stream
        .on('drain', () => {
          fileStream.resume();
        })
        .on('error', (error) => {
          console.log(`writeable stream error: ${error.message}`);
        })
        .on('close', () => {
          fileStream.destroy();
        });

      fileStream.pipe(stream);
      upload && (await upload);

      const { result, error } = await withError(storage.saveResultFileMetadata(resultID, size, resultDetails));

      if (error) {
        reject(new Error(`Failed to save result: ${error instanceof Error ? error.message : error}`));
      }

      await service.onSave(result!);

      resolve(result);
    });

    bb.on('error', (error) => {
      reject(new Error(`Failed to parse multipart form: ${error instanceof Error ? error.message : error}`));
    });

    // global ReadableStream is not compatible with node/web ReadableStream
    const stream = Readable.fromWeb(request.body as ReadableStream);

    stream.pipe(bb);
  });
