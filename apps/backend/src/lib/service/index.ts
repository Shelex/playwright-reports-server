import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import type { SiteWhiteLabelConfig } from '@playwright-reports/shared';
import { env } from '../../config/env.js';
import { defaultConfig } from '../config.js';
import { serveReportRoute } from '../constants.js';
import { isValidPlaywrightVersion } from '../pw.js';
import { DEFAULT_STREAM_CHUNK_SIZE, TMP_FOLDER } from '../storage/constants.js';
import { getUniqueProjectsList } from '../storage/format.js';
import {
  type ReadReportsInput,
  type ReadResultsInput,
  type ReadResultsOutput,
  type ReportMetadata,
  type ReportPath,
  type ResultDetails,
  type ServerDataInfo,
  storage,
} from '../storage/index.js';
import type { S3 } from '../storage/s3.js';
import { withError } from '../withError.js';
import { configCache } from './cache/config.js';
import { reportDb, resultDb } from './db/index.js';
import { lifecycle } from './lifecycle.js';

class Service {
  private static instance: Service | null = null;

  public static getInstance(): Service {
    Service.instance ??= new Service();
    return Service.instance;
  }

  public async getReports(input?: ReadReportsInput) {
    console.log(`[service] getReports`);

    return reportDb.query(input);
  }

  public async getReport(id: string, path?: string) {
    console.log(`[service] getReport ${id}`);

    const report = reportDb.getByID(id);

    if (!report && path) {
      console.warn(`[service] getReport ${id} - not found in db, fetching from storage`);
      const { result: reportFromStorage, error } = await withError(storage.readReport(id, path));

      if (error) {
        console.error(`[service] getReport ${id} - error fetching from storage: ${error.message}`);
        throw error;
      }

      if (!reportFromStorage) {
        throw new Error(`report ${id} not found`);
      }

      return reportFromStorage;
    }

    if (!report) {
      throw new Error(`report ${id} not found`);
    }

    return report;
  }

  private async findLatestPlaywrightVersionFromResults(resultIds: string[]) {
    for (const resultId of resultIds) {
      const { result: results, error } = await withError(this.getResults({ search: resultId }));

      if (error || !results) {
        continue;
      }

      const [latestResult] = results.results;

      if (!latestResult) {
        continue;
      }

      const latestVersion = latestResult?.playwrightVersion;

      if (latestVersion) {
        return latestVersion;
      }
    }
  }

  private async findLatestPlaywrightVersion(resultIds: string[]) {
    const versionFromResults = await this.findLatestPlaywrightVersionFromResults(resultIds);

    if (versionFromResults) {
      return versionFromResults;
    }

    // just in case version not found in results, we can try to get it from latest reports
    const { result: reportsArray, error } = await withError(
      this.getReports({ pagination: { limit: 10, offset: 0 } })
    );

    if (error || !reportsArray) {
      return '';
    }

    const reportWithVersion = reportsArray.reports.find(
      (report) => !!report.metadata?.playwrightVersion
    );

    if (!reportWithVersion) {
      return '';
    }

    return reportWithVersion.metadata.playwrightVersion;
  }

  public async generateReport(
    resultsIds: string[],
    metadata?: ReportMetadata
  ): Promise<{
    reportId: string;
    reportUrl: string;
    metadata: ReportMetadata;
  }> {
    const version = isValidPlaywrightVersion(metadata?.playwrightVersion)
      ? metadata?.playwrightVersion
      : await this.findLatestPlaywrightVersion(resultsIds);

    const metadataWithVersion = {
      ...(metadata ?? {}),
      playwrightVersion: version ?? '',
    };

    const { reportId, reportPath } = await storage.generateReport(resultsIds, metadataWithVersion);

    console.log(`[service] reading report ${reportId} from path: ${reportPath}`);
    const { result: report, error } = await withError(storage.readReport(reportId, reportPath));

    if (error) {
      throw new Error(`Failed to read generated report: ${error.message}`);
    }

    if (!report) {
      throw new Error(`Generated report ${reportId} not found`);
    }

    reportDb.onCreated(report);

    const reportUrl = `${serveReportRoute}/${reportId}/index.html`;

    return { reportId, reportUrl, metadata: metadataWithVersion };
  }

  public async deleteReports(reportIDs: string[]) {
    const entries: ReportPath[] = [];

    for (const id of reportIDs) {
      const report = await this.getReport(id);

      entries.push({ reportID: id, project: report.project });
    }

    const { error } = await withError(storage.deleteReports(entries));

    if (error) {
      throw error;
    }

    reportDb.onDeleted(reportIDs);
  }

  public async getReportsProjects(): Promise<string[]> {
    const { reports } = await this.getReports();
    const projects = getUniqueProjectsList(reports);

    return projects;
  }

  public async getResults(input?: ReadResultsInput): Promise<ReadResultsOutput> {
    console.log(`[results service] getResults`);
    console.log(`querying results:`);
    console.log(JSON.stringify(input, null, 2));

    return resultDb.query(input);
  }

  public async deleteResults(resultIDs: string[]): Promise<void> {
    console.log(`[service] deleteResults`);
    console.log(`deleting results:`, resultIDs);

    const { error } = await withError(storage.deleteResults(resultIDs));

    if (error) {
      console.error(`[service] deleteResults - storage deletion failed:`, error);
      throw error;
    }

    console.log(
      `[service] deleteResults - storage deletion successful, removing from database cache`
    );
    resultDb.onDeleted(resultIDs);
    console.log(`[service] deleteResults - database cache cleanup completed`);
  }

  public async getPresignedUrl(fileName: string): Promise<string | undefined> {
    console.log(`[service] getPresignedUrl for ${fileName}`);

    if (env.DATA_STORAGE !== 's3') {
      console.log(`[service] fs storage detected, no presigned URL needed`);

      return '';
    }

    console.log(`[service] s3 detected, generating presigned URL`);

    const { result: presignedUrl, error } = await withError(
      (storage as S3).generatePresignedUploadUrl(fileName)
    );

    if (error) {
      console.error(`[service] getPresignedUrl | error: ${error.message}`);

      return '';
    }

    if (!presignedUrl) {
      console.error(`[service] getPresignedUrl | presigned URL is null or undefined`);

      return '';
    }

    return presignedUrl;
  }

  public async saveResult(
    filename: string,
    stream: PassThrough,
    options?: {
      presignedUrl?: string;
      contentLength?: string;
      shouldStoreLocalCopy?: boolean;
    }
  ) {
    // redirect stream to other PassThrough just in case
    // we need to store local copy as well as upload to S3
    const uploadStream = new PassThrough({ highWaterMark: DEFAULT_STREAM_CHUNK_SIZE });

    if (options?.shouldStoreLocalCopy && env.DATA_STORAGE === 's3') {
      const localCopyStream = new PassThrough({ highWaterMark: DEFAULT_STREAM_CHUNK_SIZE });
      stream.pipe(localCopyStream);
      const localCopyPath = path.join(TMP_FOLDER, 'results', filename);
      const writeStream = createWriteStream(localCopyPath);
      localCopyStream.pipe(writeStream);

      writeStream.on('finish', () => {
        console.log(`[service] local copy saved: ${localCopyPath}`);
      });

      writeStream.on('error', (error) => {
        console.error(`[service] local write error: ${error.message}`);
      });
    }

    stream.pipe(uploadStream);

    if (!options?.presignedUrl) {
      console.log(`[service] saving result`);

      return await storage.saveResult(filename, uploadStream);
    }

    console.log(`[service] using direct upload via presigned URL`, options?.presignedUrl);

    const { error } = await withError(
      fetch(options?.presignedUrl, {
        method: 'PUT',
        body: Readable.toWeb(uploadStream, {
          strategy: {
            highWaterMark: DEFAULT_STREAM_CHUNK_SIZE,
          },
        }),
        headers: {
          'Content-Type': 'application/zip',
          'Content-Length': options?.contentLength,
        },
        duplex: 'half',
      } as RequestInit)
    );

    if (error) {
      console.error(`[s3] saveResult | error: ${error.message}`);
      throw error;
    }
  }

  public async saveResultDetails(resultID: string, resultDetails: ResultDetails, size: number) {
    const result = await storage.saveResultDetails(resultID, resultDetails, size);

    resultDb.onCreated(result);

    return result;
  }

  public async getResultsProjects(): Promise<string[]> {
    const { results } = await this.getResults();
    const projects = getUniqueProjectsList(results);

    const reportProjects = await this.getReportsProjects();

    return Array.from(new Set([...projects, ...reportProjects]));
  }

  public async getResultsTags(project?: string): Promise<string[]> {
    const { results } = await this.getResults(project ? { project } : undefined);

    const notMetadataKeys = ['resultID', 'title', 'createdAt', 'size', 'sizeBytes', 'project'];
    const allTags = new Set<string>();

    results.forEach((result) => {
      Object.entries(result).forEach(([key, value]) => {
        if (!notMetadataKeys.includes(key) && value !== undefined && value !== null) {
          allTags.add(`${key}: ${value}`);
        }
      });
    });

    return Array.from(allTags).sort();
  }

  public async getServerInfo(): Promise<ServerDataInfo> {
    console.log(`[service] getServerInfo`);
    const canCalculateFromCache =
      lifecycle.isInitialized() && reportDb.initialized && resultDb.initialized;

    if (!canCalculateFromCache) {
      return await storage.getServerDataInfo();
    }

    return storage.getServerDataInfo();
  }

  public async getConfig() {
    if (lifecycle.isInitialized() && configCache.initialized) {
      const cached = configCache.config;

      if (cached) {
        console.log(`[service] using cached config`);

        return cached;
      }
    }

    const { result, error } = await storage.readConfigFile();

    if (error) console.warn(`[service] getConfig | error: ${error.message}`);

    return { ...defaultConfig, ...(result ?? {}) };
  }

  public async updateConfig(config: Partial<SiteWhiteLabelConfig>) {
    console.log(`[service] updateConfig`, config);
    const { result, error } = await storage.saveConfigFile(config);

    if (error) {
      throw error;
    }

    configCache.onChanged(result);

    return result;
  }

  public async refreshCache() {
    console.log(`[service] refreshCache`);

    await reportDb.refresh();
    await resultDb.refresh();
    configCache.refresh();

    return { message: 'cache refreshed successfully' };
  }
}

export const service = Service.getInstance();
