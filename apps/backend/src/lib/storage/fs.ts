import { randomUUID } from 'node:crypto';
import { createWriteStream, type Dirent, type Stats } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReportInfo, SiteWhiteLabelConfig } from '@playwright-reports/shared';
import getFolderSize from 'get-folder-size';
import { defaultConfig, isConfigValid, noConfigErr } from '../config.js';
import { serveReportRoute } from '../constants.js';
import { parse } from '../parser/index.js';
import { generatePlaywrightReport } from '../pw.js';
import { withError } from '../withError.js';
import { processBatch } from './batch.js';
import {
  APP_CONFIG,
  DATA_FOLDER,
  DEFAULT_STREAM_CHUNK_SIZE,
  REPORT_METADATA_FILE,
  REPORTS_FOLDER,
  RESULTS_FOLDER,
  TMP_FOLDER,
} from './constants.js';
import { createDirectory } from './folders.js';
import { bytesToString } from './format.js';
import type {
  ReadReportsOutput,
  ReportHistory,
  ReportMetadata,
  ReportPath,
  Result,
  ResultDetails,
  ServerDataInfo,
  Storage,
} from './types.js';
import { deepMergeReportInfo } from './utils/deepMerge.js';

async function createDirectoriesIfMissing() {
  await createDirectory(RESULTS_FOLDER);
  await createDirectory(REPORTS_FOLDER);
  await createDirectory(TMP_FOLDER);
}

const getSizeInMb = async (dir: string) => {
  const sizeBytes = await getFolderSize.loose(dir);

  return bytesToString(sizeBytes);
};

async function getAvailableSize(dir: string) {
  const stat = await fs.statfs(dir);

  const availableSize = stat.bsize * stat.bavail;

  return bytesToString(availableSize);
}

export async function getServerDataInfo(): Promise<ServerDataInfo> {
  await createDirectoriesIfMissing();
  const dataFolderSizeinMB = await getSizeInMb(DATA_FOLDER);
  const resultsCount = await getResultsCount();
  const resultsFolderSizeinMB = await getSizeInMb(RESULTS_FOLDER);
  const { total: reportsCount } = await readReports();
  const reportsFolderSizeinMB = await getSizeInMb(REPORTS_FOLDER);
  const availableSizeinMB = await getAvailableSize('./');

  return {
    dataFolderSizeinMB,
    numOfResults: resultsCount,
    resultsFolderSizeinMB,
    numOfReports: reportsCount,
    reportsFolderSizeinMB,
    availableSizeinMB,
  };
}

export async function readFile(targetPath: string, contentType: string | null) {
  return await fs.readFile(path.join(REPORTS_FOLDER, targetPath), {
    encoding: contentType === 'text/html' ? 'utf-8' : null,
  });
}

async function getResultsCount() {
  const files = await fs.readdir(RESULTS_FOLDER);
  const zipFilesCount = files.filter((file) => file.endsWith('.zip'));

  return zipFilesCount.length;
}

export async function readResults() {
  await createDirectoriesIfMissing();
  const files = await fs.readdir(RESULTS_FOLDER);

  const stats = await processBatch<
    string,
    Stats & { filePath: string; size: string; sizeBytes: number }
  >(
    {},
    files.filter((file) => file.endsWith('.json')),
    20,
    async (file) => {
      const filePath = path.join(RESULTS_FOLDER, file);

      const stat = await fs.stat(filePath);

      const sizeBytes = await getFolderSize.loose(filePath.replace('.json', '.zip'));

      const size = bytesToString(sizeBytes);

      return Object.assign(stat, { filePath, size, sizeBytes });
    }
  );

  const results = await processBatch<
    Stats & {
      filePath: string;
      size: string;
      sizeBytes: number;
    },
    Result
  >({}, stats, 10, async (entry) => {
    const content = await fs.readFile(entry.filePath, 'utf-8');

    return {
      size: entry.size,
      sizeBytes: entry.sizeBytes,
      ...JSON.parse(content),
    };
  });

  return {
    results,
    total: results.length,
  };
}

function isMissingFileError(error?: Error | null) {
  return error?.message.includes('ENOENT');
}

async function readOrParseReportMetadata(id: string): Promise<ReportMetadata> {
  const { result: metadataContent, error: metadataError } = await withError(
    readFile(path.join(id, REPORT_METADATA_FILE), 'utf-8')
  );

  if (metadataError) console.error(`failed to read metadata for ${id}: ${metadataError.message}`);

  const metadata = metadataContent && !metadataError ? JSON.parse(metadataContent.toString()) : {};

  if (!isMissingFileError(metadataError)) {
    return metadata;
  }

  console.log(`metadata file not found for ${id}, creating new metadata`);
  try {
    const reportPath = path.join(REPORTS_FOLDER, id);
    const parsed = await parseReportMetadata(id, reportPath, {
      reportID: id,
    });

    console.log(`parsed metadata for ${id}`);

    await saveReportMetadata(reportPath, parsed);

    Object.assign(metadata, parsed);
  } catch (e) {
    console.error(`failed to create metadata for ${id}: ${(e as Error).message}`);
  }

  return metadata;
}

export async function readReport(
  reportID: string,
  reportPath: string
): Promise<ReportHistory | null> {
  await createDirectoriesIfMissing();

  console.log(`[fs] reading report ${reportID} metadata from path: ${reportPath}`);

  // Convert reportPath to relative path from REPORTS_FOLDER
  const relativePath = path.relative(REPORTS_FOLDER, reportPath);
  console.log(`[fs] reading report ${reportID} relative path: ${relativePath}`);

  const { result: metadataContent, error: metadataError } = await withError(
    readFile(path.join(relativePath, REPORT_METADATA_FILE), 'utf-8')
  );

  if (metadataError) {
    console.error(`[fs] failed to read metadata for ${reportID}: ${metadataError.message}`);

    return null;
  }

  const metadata = metadataContent ? JSON.parse(metadataContent.toString()) : {};
  const { size: metaSize, sizeBytes: metaSizeBytes, ...cleanMetadata } = metadata;

  return {
    reportID,
    project: metadata.project || '',
    createdAt: new Date(metadata.createdAt),
    size: metaSize || '',
    sizeBytes: metaSizeBytes || 0,
    reportUrl: metadata.reportUrl || '',
    ...cleanMetadata,
  } as ReportHistory;
}

export async function readReports(): Promise<ReadReportsOutput> {
  await createDirectoriesIfMissing();
  const entries = await fs.readdir(REPORTS_FOLDER, {
    withFileTypes: true,
  });

  const reportEntries = entries.filter((entry) => entry.isDirectory());

  const stats = await processBatch<Dirent, Stats & { filePath: string; createdAt: Date }>(
    {},
    reportEntries,
    20,
    async (file) => {
      const filePath = path.join(REPORTS_FOLDER, file.name);
      const stat = await fs.stat(filePath);

      return Object.assign(stat, { filePath, createdAt: stat.birthtime });
    }
  );

  const reports = await processBatch<Stats & { filePath: string; createdAt: Date }, ReportHistory>(
    {},
    stats,
    10,
    async (file) => {
      const id = path.basename(file.filePath);
      const sizeBytes = await getFolderSize.loose(file.filePath);
      const size = bytesToString(sizeBytes);

      const metadata = await readOrParseReportMetadata(id);

      return {
        reportID: id,
        project: metadata.project || '',
        createdAt: file.birthtime,
        size,
        sizeBytes,
        reportUrl: `${serveReportRoute}/${id}/index.html`,
        ...metadata,
      } as ReportHistory;
    }
  );

  return { reports: reports, total: reports.length };
}

export async function deleteResults(resultsIds: string[]) {
  await Promise.allSettled(resultsIds.map((id) => deleteResult(id)));
}

export async function deleteResult(resultId: string) {
  const resultPath = path.join(RESULTS_FOLDER, resultId);

  await Promise.allSettled([fs.unlink(`${resultPath}.json`), fs.unlink(`${resultPath}.zip`)]);
}

export async function deleteReports(reports: ReportPath[]) {
  const paths = reports.map((report) => report.reportID);

  await processBatch<string, void>(undefined, paths, 10, async (path) => {
    await deleteReport(path);
  });
}

export async function deleteReport(reportId: string) {
  const reportPath = path.join(REPORTS_FOLDER, reportId);

  await fs.rm(reportPath, { recursive: true, force: true });
}

export async function saveResult(filename: string, stream: PassThrough) {
  await createDirectoriesIfMissing();
  const resultPath = path.join(RESULTS_FOLDER, filename);

  const writeable = createWriteStream(resultPath, {
    encoding: 'binary',
    highWaterMark: DEFAULT_STREAM_CHUNK_SIZE,
  });

  const { error: writeStreamError } = await withError(pipeline(stream, writeable));

  if (writeStreamError) {
    throw new Error(`failed stream pipeline: ${writeStreamError.message}`);
  }
}

export async function saveResultDetails(
  resultID: string,
  resultDetails: ResultDetails,
  size: number
): Promise<Result> {
  await createDirectoriesIfMissing();

  const metaData = {
    resultID,
    createdAt: new Date().toISOString(),
    project: resultDetails?.project ?? '',
    ...resultDetails,
    size: bytesToString(size),
    sizeBytes: size,
  };

  const { error: writeJsonError } = await withError(
    fs.writeFile(path.join(RESULTS_FOLDER, `${resultID}.json`), JSON.stringify(metaData, null, 2), {
      encoding: 'utf-8',
    })
  );

  if (writeJsonError) {
    throw new Error(`failed to save result ${resultID} json file: ${writeJsonError.message}`);
  }

  return metaData as Result;
}

export async function generateReport(resultsIds: string[], metadata?: ReportMetadata) {
  await createDirectoriesIfMissing();

  const reportId = randomUUID();
  const tempFolder = path.join(TMP_FOLDER, reportId);

  await fs.mkdir(tempFolder, { recursive: true });

  try {
    for (const id of resultsIds) {
      const sourceZipPath = path.join(RESULTS_FOLDER, `${id}.zip`);
      const targetZipPath = path.join(tempFolder, `${id}.zip`);

      console.log(`[fs] copying result ${id} to temp folder`);

      const { result: stats, error: statError } = await withError(fs.stat(sourceZipPath));

      if (statError || !stats) {
        throw new Error(
          `source zip file not found or inaccessible for result ${id}: ${statError?.message}`
        );
      }

      if (stats.size === 0) {
        throw new Error(`zip file for result ${id} is empty`);
      }

      console.log(`[fs] source zip file size: ${stats.size} bytes`);

      const { error: copyError } = await withError(fs.copyFile(sourceZipPath, targetZipPath));

      if (copyError) {
        throw new Error(`failed to copy zip file for result ${id}: ${copyError.message}`);
      }
    }

    console.log(`[fs] all zip files copied, calling playwright merge-reports`);
    const generated = await generatePlaywrightReport(reportId, metadata ?? {});
    const info = await parseReportMetadata(reportId, generated.reportPath, metadata);

    await saveReportMetadata(generated.reportPath, info);

    return { reportId, reportPath: generated.reportPath };
  } finally {
    await fs.rm(tempFolder, { recursive: true, force: true });
  }
}

async function parseReportMetadata(
  reportID: string,
  reportPath: string,
  metadata?: ReportMetadata
): Promise<ReportMetadata> {
  const html = await fs.readFile(path.join(reportPath, 'index.html'), 'utf-8');
  const info = await parse(html as string);

  const content = Object.assign(
    info,
    {
      reportID,
      createdAt: new Date().toISOString(),
    },
    metadata ?? {}
  );
  if (metadata?.displayNumber) content.displayNumber = metadata.displayNumber;

  return content;
}

async function saveReportMetadata(reportPath: string, info: ReportMetadata) {
  return fs.writeFile(path.join(reportPath, REPORT_METADATA_FILE), JSON.stringify(info, null, 2), {
    encoding: 'utf-8',
  });
}

async function updateMetadata(
  reportIdentifier: string,
  updates: Partial<ReportInfo>
): Promise<ReportInfo> {
  await createDirectoriesIfMissing();

  const reportPath = path.join(REPORTS_FOLDER, reportIdentifier);
  const metadataPath = path.join(reportPath, REPORT_METADATA_FILE);

  const { result: metadataContent, error: readError } = await withError(
    fs.readFile(metadataPath, 'utf-8')
  );

  if (readError) {
    throw new Error(
      `Failed to read metadata file: ${readError instanceof Error ? readError.message : readError}`
    );
  }

  const existing: ReportInfo = JSON.parse(metadataContent || '{}');
  const updated = deepMergeReportInfo(existing, updates);

  const { error: writeError } = await withError(
    fs.writeFile(metadataPath, JSON.stringify(updated, null, 2), {
      encoding: 'utf-8',
    })
  );

  if (writeError) {
    throw new Error(
      `Failed to write metadata file: ${writeError instanceof Error ? writeError.message : writeError}`
    );
  }

  return updated;
}

async function readConfigFile() {
  const { error: accessConfigError } = await withError(fs.access(APP_CONFIG));

  if (accessConfigError) {
    return { result: defaultConfig, error: new Error(noConfigErr) };
  }

  const { result, error } = await withError(fs.readFile(APP_CONFIG, 'utf-8'));

  if (error || !result) {
    return { error };
  }

  try {
    const parsed = JSON.parse(result);

    const isValid = isConfigValid(parsed);

    return isValid ? { result: parsed, error: null } : { error: new Error('invalid config') };
  } catch (e) {
    return {
      error: new Error(`failed to parse config: ${e instanceof Error ? e.message : e}`),
    };
  }
}

async function saveConfigFile(config: Partial<SiteWhiteLabelConfig>) {
  const { result: existingConfig, error: configError } = await readConfigFile();

  const isConfigFailed = !!configError && configError?.message !== noConfigErr && !existingConfig;

  if (isConfigFailed) {
    console.error(`failed to read existing config: ${configError.message}`);
  }

  const previousConfig = existingConfig ?? defaultConfig;
  const uploadConfig = { ...previousConfig, ...config };

  const { error } = await withError(
    fs.writeFile(APP_CONFIG, JSON.stringify(uploadConfig, null, 2), {
      flag: 'w+',
    })
  );

  return {
    result: uploadConfig,
    error,
  };
}

export const FS: Storage = {
  getServerDataInfo,
  readFile,
  readResults,
  readReports,
  readReport,
  deleteResults,
  deleteReports,
  saveResult,
  saveResultDetails,
  generateReport,
  readConfigFile,
  saveConfigFile,
  updateMetadata,
};
