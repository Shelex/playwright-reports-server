import type { UUID } from 'node:crypto';
import type { Stats } from 'node:fs';
import fsp from 'node:fs/promises';
import { makeBoundary, multipartStream } from './stream.js';

export type ReportServerClientOptions = {
  url: string;
  token?: string;
  requestTimeout?: number;
  blobUploadTimeout?: number;
};

export type ReportGenerationOptions = {
  resultId: UUID;
  details: Record<string, string>;
  playwrightVersion: string;
};

export class ReportServerClient {
  private readonly options: ReportServerClientOptions;

  constructor(options: ReportServerClientOptions) {
    this.options = options;
  }

  async uploadBlob(
    blobPath: string,
    { fileName = 'blob.zip', fields = {}, logProgress = false }
  ): Promise<{
    resultID: UUID;
    createdAt: string;
    size: string;
    sizeBytes: number;
    generatedReport?: {
      reportId: string;
      reportUrl: string;
      metadata: {
        title: string;
        project: string;
      };
    };
    username?: string;
  }> {
    let stat: Stats;
    try {
      stat = await fsp.stat(blobPath);
    } catch (err) {
      console.error(err);
      throw new Error(
        '[ReportServerClient] Blob file not found or cannot be loaded. Results cannot be uploaded'
      );
    }

    const zipSize = stat.size;
    const boundary = makeBoundary();
    const body = multipartStream({
      boundary,
      fields,
      filePath: blobPath,
      fileName,
      fileType: 'application/zip',
      totalBytes: zipSize,
      logProgress,
    });

    const baseUrl = this.options.url.endsWith('/')
      ? this.options.url.slice(0, -1)
      : this.options.url;
    const uploadUrl = `${baseUrl}/api/result/upload?fileContentLength=${zipSize}`;

    const headers: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };
    if (this.options.token) {
      headers['Authorization'] = this.options.token;
    }

    const totalTimeout =
      this.options.blobUploadTimeout ?? this.options.requestTimeout ?? 10 * 60_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), totalTimeout);

    try {
      const fetchAny: any = fetch;

      const resp = await fetchAny(uploadUrl, {
        method: 'PUT',
        headers,
        body: body as any,
        signal: controller.signal,
        duplex: 'half',
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`[ReportServerClient] Upload failed ${resp.status}: ${text.slice(0, 500)}`);
      }

      const json = (await resp.json()) as { data: any };
      return json.data;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async generateReport(options: ReportGenerationOptions): Promise<{ reportUrl?: string }> {
    const { resultId, details, playwrightVersion } = options;

    const baseUrl = this.options.url.endsWith('/')
      ? this.options.url.slice(0, -1)
      : this.options.url;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.options.token) {
      headers['Authorization'] = this.options.token;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.requestTimeout ?? 60_000);

    try {
      const resp = await fetch(`${baseUrl}/api/report/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          resultsIds: [resultId],
          ...details,
          playwrightVersion,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(
          `[ReportServerClient] Report generation failed ${resp.status}: ${text.slice(0, 500)}`
        );
      }

      return (await resp.json()) as { reportUrl?: string };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}
