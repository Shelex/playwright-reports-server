export interface ReportTest {
	title?: string;
	file?: string;
	path?: string[];
	line?: number;
	column?: number;
	outcome?: "passed" | "failed" | "skipped" | "flaky";
	duration?: number;
	project?: string;
	projectName?: string;
	testId?: string;
	location?: {
		file: string;
		line: number;
		column: number;
	};
	attachments?: Array<{
		name: string;
		path: string;
		contentType: string;
	}>;
	results?: Array<{
		status?: string;
		message?: string;
	}>;
	tags?: string[];
	annotations?: Array<{
		type?: string;
		description?: string;
	}>;
}

export type ReportTestOutcome = "passed" | "failed" | "skipped" | "flaky";

export enum ReportTestOutcomeEnum {
	Expected = "passed",
	Unexpected = "failed",
	Skipped = "skipped",
	Flaky = "flaky",
}

export interface ReportFile {
	name: string;
	path?: string;
	fileId?: string;
	fileName?: string;
	stats?: ReportStats;
	tests?: ReportTest[];
}

export interface ReportStats {
	total?: number;
	expected?: number;
	unexpected?: number;
	flaky?: number;
	skipped?: number;
	ok?: boolean;
}
