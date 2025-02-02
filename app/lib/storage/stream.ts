import { type IncomingHttpHeaders } from 'node:http2';
import { type ReadableStream } from 'node:stream/web';
import { Readable, type ReadableOptions } from 'node:stream';

import busboy from 'busboy';

import { type ResultDetails } from './types';

import { service } from '@/app/lib/service';

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

    bb.on('file', async (name: string, stream: Readable) => {
      if (name !== 'file') {
        stream.resume(); // drain unwanted streams

        return;
      }

      stream.on('error', (error) => {
        reject(new Error(`Error processing file stream: ${error.message}`));
      });

      const size = parseInt(request.headers.get('content-length') ?? '', 10);

      try {
        const result = await service.saveResult(stream, size, resultDetails);

        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to save result: ${error instanceof Error ? error.message : error}`));
      }
    });

    bb.on('error', (error) => {
      reject(new Error(`Failed to parse multipart form: ${error instanceof Error ? error.message : error}`));
    });

    // global ReadableStream is not compatible with node/web ReadableStream
    const stream = Readable.fromWeb(request.body as ReadableStream);

    stream.pipe(bb);
  });
