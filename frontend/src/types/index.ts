import type { SVGProps } from "react";

import type { ReportTest } from "./parser";
import type { ReportHistory } from "./storage";

// re-export
export type { ReportTest } from "./parser";
export type { ReportHistory } from "./storage";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
	size?: number;
};

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export type HeaderLinks = Record<string, string>;

export interface JiraConfig {
	baseUrl?: string;
	email?: string;
	apiToken?: string;
	projectKey?: string;
	configured?: boolean;
	defaultProjectKey?: string;
	issueTypes?: Array<{
		name: string;
		description?: string;
	}>;
	message?: string;
}

export interface JiraApiResponse {
	configured: boolean;
	defaultProjectKey?: string;
	issueTypes?: Array<{
		name: string;
		description?: string;
	}>;
	message?: string;
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

export type Report = {
	reportID: string;
	title?: string;
	project: string;
	reportUrl: string;
	createdAt: Date;
	size: string;
	sizeBytes: number;
};

export type ReportInfo = {
	stats?: {
		total?: number;
		expected?: number;
		unexpected?: number;
		flaky?: number;
		skipped?: number;
	};
};


export type Result = {
	resultID: string;
	project: string;
	title?: string;
	createdAt: Date;
	size: string;
	sizeBytes: number;
	stats?: {
		total?: number;
		expected?: number;
		unexpected?: number;
		flaky?: number;
		skipped?: number;
	};
};

export interface ReadResultsOutput {
	results: Result[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
	total: number;
}

export interface ReadReportsHistory {
	reports: ReportHistory[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
	total?: number;
}

export interface TestHistory extends ReportTest {
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

export function getUniqueProjectsList(items: { project: string }[]): string[] {
	const projects = new Set<string>();
	items.forEach((item) => {
		if (item.project) {
			projects.add(item.project);
		}
	});
	return Array.from(projects).sort();
}
