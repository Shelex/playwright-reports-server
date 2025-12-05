import type { ReportHistory } from "../types";

export const filterReportHistory = (
	report: ReportHistory,
	filters: {
		status?: string[];
		search?: string;
	},
): ReportHistory => {
	if (!report.stats) return report;

	let filteredTests = [...(report.tests || [])];

	if (filters.status && filters.status.length > 0) {
		filteredTests = filteredTests.filter((test) =>
			filters.status?.includes(test.outcome || "passed"),
		);
	}

	if (filters.search) {
		const searchLower = filters.search.toLowerCase();
		filteredTests = filteredTests.filter(
			(test) =>
				test.title?.toLowerCase().includes(searchLower) ||
				test.file?.toLowerCase().includes(searchLower),
		);
	}

	return {
		...report,
		tests: filteredTests,
	};
};

export const pluralize = (count: number, word: string): string => {
	return count === 1 ? word : `${word}s`;
};
