import { PassThrough, Readable } from 'node:stream';

import { withError } from '../withError';
import { bytesToString, getUniqueProjectsList } from '../storage/format';
import { serveReportRoute } from '../constants';
import { DEFAULT_STREAM_CHUNK_SIZE } from '../storage/constants';

import { lifecycle } from '@/app/lib/service/lifecycle';
import { configCache } from '@/app/lib/service/cache/config';
import { reportDb, resultDb } from '@/app/lib/service/db';
import {
  type ReadReportsInput,
  ReadResultsInput,
  ReadResultsOutput,
  ReportMetadata,
  ReportPath,
  ResultDetails,
  ServerDataInfo,
  storage,
} from '@/app/lib/storage';
import { SiteWhiteLabelConfig } from '@/app/types';
import { defaultConfig } from '@/app/lib/config';
import { env } from '@/app/config/env';
import { type S3 } from '@/app/lib/storage/s3';
import { isValidPlaywrightVersion } from '@/app/lib/pw';

const runningService = Symbol.for('playwright.reports.service');
const instance = globalThis as typeof globalThis & { [runningService]?: Service };

class Service {
  public static getInstance() {
    console.log(`[service] get instance`);
    instance[runningService] ??= new Service();

    return instance[runningService];
  }

  public async getReports(input?: ReadReportsInput) {
    console.log(`[service] getReports`);

    return reportDb.query(input);
  }

  public async getReport(id: string) {
    console.log(`[service] getReport ${id}`);

    const report = reportDb.getByID(id);

    return report!;
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
    const { result: reportsArray, error } = await withError(this.getReports({ pagination: { limit: 10, offset: 0 } }));

    if (error || !reportsArray) {
      return '';
    }

    const reportWithVersion = reportsArray.reports.find((report) => !!report.metadata?.playwrightVersion);

    if (!reportWithVersion) {
      return '';
    }

    return reportWithVersion.metadata.playwrightVersion;
  }

  public async generateReport(
    resultsIds: string[],
    metadata?: ReportMetadata,
  ): Promise<{ reportId: string; reportUrl: string; metadata: ReportMetadata }> {
    const version = isValidPlaywrightVersion(metadata?.playwrightVersion)
      ? metadata?.playwrightVersion
      : await this.findLatestPlaywrightVersion(resultsIds);

    const metadataWithVersion = { ...(metadata ?? {}), playwrightVersion: version ?? '' };

    const reportId = await storage.generateReport(resultsIds, metadataWithVersion);

    const report = await this.getReport(reportId);

    reportDb.onCreated(report);

    const projectPath = metadata?.project ? `${encodeURI(metadata.project)}/` : '';
    const reportUrl = `${serveReportRoute}/${projectPath}${reportId}/index.html`;

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

    return resultDb.query(input);
  }

  public async deleteResults(resultIDs: string[]): Promise<void> {
    const { error } = await withError(storage.deleteResults(resultIDs));

    if (error) {
      throw error;
    }

    resultDb.onDeleted(resultIDs);
  }

  public async getPresignedUrl(fileName: string): Promise<string | undefined> {
    console.log(`[service] getPresignedUrl for ${fileName}`);

    if (env.DATA_STORAGE !== 's3') {
      console.log(`[service] fs storage detected, no presigned URL needed`);

      return '';
    }

    console.log(`[service] s3 detected, generating presigned URL`);

    const { result: presignedUrl, error } = await withError((storage as S3).generatePresignedUploadUrl(fileName));

    if (error) {
      console.error(`[service] getPresignedUrl | error: ${error.message}`);

      return '';
    }

    return presignedUrl!;
  }

  public async saveResult(filename: string, stream: PassThrough, presignedUrl?: string, contentLength?: string) {
    if (!presignedUrl) {
      console.log(`[service] saving result`);

      return await storage.saveResult(filename, stream);
    }

    console.log(`[service] using direct upload via presigned URL`, presignedUrl);

    const { error } = await withError(
      fetch(presignedUrl, {
        method: 'PUT',
        body: Readable.toWeb(stream, {
          strategy: {
            highWaterMark: DEFAULT_STREAM_CHUNK_SIZE,
          },
        }),
        headers: {
          'Content-Type': 'application/zip',
          'Content-Length': contentLength,
        },
        duplex: 'half',
      } as RequestInit),
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
    const canCalculateFromCache = lifecycle.isInitialized() && reportDb.initialized && resultDb.initialized;

    if (!canCalculateFromCache) {
      return await storage.getServerDataInfo();
    }

    const reports = reportDb.getAll();
    const results = resultDb.getAll();

    const getTotalSizeBytes = <T extends { sizeBytes: number }[]>(entity: T) =>
      entity.reduce((total, item) => total + item.sizeBytes, 0);

    const reportsFolderSize = getTotalSizeBytes(reports);
    const resultsFolderSize = getTotalSizeBytes(results);
    const dataFolderSize = reportsFolderSize + resultsFolderSize;

    return {
      dataFolderSizeinMB: bytesToString(dataFolderSize),
      numOfResults: results.length,
      resultsFolderSizeinMB: bytesToString(resultsFolderSize),
      numOfReports: reports.length,
      reportsFolderSizeinMB: bytesToString(reportsFolderSize),
    };
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

    if (error) console.error(`[service] getConfig | error: ${error.message}`);

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
}

export const service = Service.getInstance();
