import type { ReportFile, ReportStats, ReportTest } from './parser';

export interface Result {
  resultID: string;
  createdAt: string;
  project: string;
  size: string;
  sizeBytes: number;
  stats: ReportStats;
  metadata?: Record<string, string | number | boolean>;
}

export interface ReportHistory {
  reportID: string;
  project: string;
  createdAt: Date;
  size: string;
  sizeBytes: number;
  reportUrl: string;
  files: ReportFile[];
  stats?: ReportStats;
  totalTestCount?: number;
  testCount?: number;
  title?: string;
  tests?: ReportTest[];
}

export interface ReportMetadata {
  reportID: string;
  project: string;
  createdAt: string;
  size?: string;
  sizeBytes?: number;
  reportUrl?: string;
  stats?: ReportStats;
}

export interface TestHistory {
  testId: string;
  outcome: string;
  duration: number;
  createdAt: Date;
  reportID: string;
  reportUrl: string;
}

export interface ServerDataInfo {
  dataFolderSizeinMB: string;
  numOfResults: number;
  resultsFolderSizeinMB: string;
  numOfReports: number;
  reportsFolderSizeinMB: string;
}

export interface ResultDetails {
  project?: string;
  title?: string;
  testRun?: string;
  playwrightVersion?: string;
  triggerReportGeneration?: string;
  shardCurrent?: string;
  shardTotal?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ReadReportsOutput {
  reports: ReportHistory[];
  total: number;
}

export interface ReadReportsHistory {
  reports: ReportHistory[];
  total: number;
}

export interface ReportPath {
  reportID: string;
  project?: string;
}

// Import ReportStats and ReportFile from parser types
export type { ReportFile, ReportStats } from './parser';
