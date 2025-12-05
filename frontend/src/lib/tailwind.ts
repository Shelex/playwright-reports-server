import { type ReportTestOutcome, ReportTestOutcomeEnum } from "@/types/parser";

export interface TestStatusColor {
	title: string;
	color: string;
	colorName: "success" | "danger" | "warning" | "default";
}

export function testStatusToColor(outcome: ReportTestOutcome): TestStatusColor {
	switch (outcome) {
		case ReportTestOutcomeEnum.Expected:
		case "passed":
			return {
				title: "✅ Passed",
				color: "text-success",
				colorName: "success",
			};
		case ReportTestOutcomeEnum.Unexpected:
		case "failed":
			return {
				title: "❌ Failed",
				color: "text-danger",
				colorName: "danger",
			};
		case ReportTestOutcomeEnum.Skipped:
		case "skipped":
			return {
				title: "⏭️ Skipped",
				color: "text-warning",
				colorName: "warning",
			};
		case ReportTestOutcomeEnum.Flaky:
		case "flaky":
			return {
				title: "🔄 Flaky",
				color: "text-warning",
				colorName: "warning",
			};
		default:
			return {
				title: "❓ Unknown",
				color: "text-default",
				colorName: "default",
			};
	}
}
