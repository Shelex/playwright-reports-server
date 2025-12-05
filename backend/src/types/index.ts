import type { HeaderLinks } from "../config/site.js";

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export interface JiraConfig {
	baseUrl?: string;
	email?: string;
	apiToken?: string;
	projectKey?: string;
}

export interface SiteWhiteLabelConfig {
	title: string;
	headerLinks: HeaderLinks;
	logoPath: string;
	faviconPath: string;
	reporterPaths?: string[];
	authRequired?: boolean;
	database?: DatabaseStats;
	dataStorage?: string;
	s3Endpoint?: string;
	s3Bucket?: string;
	cron?: {
		resultExpireDays?: number;
		resultExpireCronSchedule?: string;
		reportExpireDays?: number;
		reportExpireCronSchedule?: string;
	};
	jira?: JiraConfig;
}

export interface DatabaseStats {
	sizeOnDisk: string;
	estimatedRAM: string;
	reports: number;
	results: number;
}

export interface EnvInfo {
	authRequired: boolean;
	database: DatabaseStats;
	dataStorage: string | undefined;
	s3Endpoint: string | undefined;
	s3Bucket: string | undefined;
}
