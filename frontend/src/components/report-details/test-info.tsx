import {
	Link,
	LinkIcon,
	Table,
	TableBody,
	TableCell,
	TableColumn,
	TableHeader,
	TableRow,
} from "@heroui/react";
import type { FC } from "react";

import FormattedDate from "@/components/date-format";

import { subtitle } from "@/components/primitives";
import { testStatusToColor } from "@/lib/tailwind";
import { parseMilliseconds } from "@/lib/time";
import { withBase } from "@/lib/url";
import type { ReportTest, ReportTestOutcome } from "@/types/parser";
import type { ReportHistory, TestHistory } from "@/types/storage";

interface TestInfoProps {
	history: ReportHistory[];
	test: ReportTest;
}

const getTestHistory = (testId: string, history: ReportHistory[]) => {
	return history
		.map((report) => {
			const file = report?.files?.find((file: any) =>
				file.tests?.some((test: any) => test.testId === testId),
			);

			if (!file) {
				return;
			}

			const test = file.tests?.find((test: any) => test.testId === testId);

			if (!test) {
				return;
			}

			return {
				...test,
				createdAt: report.createdAt,
				reportID: report.reportID,
				reportUrl: report.reportUrl,
			};
		})
		.filter(Boolean) as unknown as TestHistory[];
};

const TestInfo: FC<TestInfoProps> = ({ test, history }: TestInfoProps) => {
	const formatted = testStatusToColor(test.outcome || "passed");

	const testHistory = getTestHistory(test.testId || "unknown", history);

	return (
		<div className="shadow-md rounded-lg p-6">
			<div className="mb-4">
				<p>
					Outcome: <span className={formatted.color}>{formatted.title}</span>
				</p>
				<p>
					Location:{" "}
					{`${test.location?.file || "unknown"}:${test.location?.line || 0}:${test.location?.column || 0}`}
				</p>
				<p>Duration: {parseMilliseconds(test.duration || 0)}</p>
				{test.annotations && test.annotations.length > 0 && (
					<p>
						Annotations:{" "}
						{test.annotations.map((a) => JSON.stringify(a)).join(", ")}
					</p>
				)}
				{test.tags && test.tags.length > 0 && (
					<p>Tags: {test.tags.join(", ")}</p>
				)}
			</div>
			{!!testHistory?.length && (
				<div>
					<h3 className={subtitle()}>Results:</h3>
					<Table aria-label="Test History">
						<TableHeader>
							<TableColumn>Created At</TableColumn>
							<TableColumn>Status</TableColumn>
							<TableColumn>Duration</TableColumn>
							<TableColumn>Actions</TableColumn>
						</TableHeader>
						<TableBody items={testHistory}>
							{(item) => {
								const itemOutcome = testStatusToColor(
									(item?.outcome as ReportTestOutcome) || "passed",
								);

								return (
									<TableRow key={`${item.reportID}-${item.testId}`}>
										<TableCell className="w-3/8">
											<FormattedDate date={item?.createdAt} />
										</TableCell>
										<TableCell className="w-2/8">
											<span className={itemOutcome.color}>
												{itemOutcome.title}
											</span>
										</TableCell>
										<TableCell className="w-2/8">
											{parseMilliseconds(item.duration)}
										</TableCell>
										<TableCell className="w-1/8">
											<Link
												href={`${withBase(item.reportUrl)}#?testId=${item.testId}`}
												target="_blank"
											>
												<LinkIcon />
											</Link>
										</TableCell>
									</TableRow>
								);
							}}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
};

export default TestInfo;
