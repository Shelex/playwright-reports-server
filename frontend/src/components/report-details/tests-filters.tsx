"use client";

import {
	Accordion,
	AccordionItem,
	Checkbox,
	CheckboxGroup,
	Input,
} from "@heroui/react";
import { type FC, useCallback, useEffect, useState } from "react";
import { testStatusToColor } from "@/lib/tailwind";
import { filterReportHistory, pluralize } from "@/lib/transformers";
import type { ReportHistory as IndexReportHistory } from "@/types/index";
import { type ReportTestOutcome, ReportTestOutcomeEnum } from "@/types/parser";

type ReportFiltersProps = {
	report: IndexReportHistory;
	onChangeFilters: (report: IndexReportHistory) => void;
};

const testOutcomes = [
	ReportTestOutcomeEnum.Expected,
	ReportTestOutcomeEnum.Unexpected,
	ReportTestOutcomeEnum.Skipped,
	ReportTestOutcomeEnum.Flaky,
];

const ReportFilters: FC<ReportFiltersProps> = ({ report, onChangeFilters }) => {
	const [byName, setByName] = useState("");
	const [byOutcomes, setByOutcomes] = useState<ReportTestOutcome[] | undefined>(
		testOutcomes,
	);

	const onNameChange = (name: string) => {
		setByName(name);
	};

	const onOutcomeChange = (outcomes?: ReportTestOutcome[]) => {
		setByOutcomes(!outcomes ? [] : outcomes);
	};

	useEffect(() => {
		onChangeFilters(currentFilterState());
	}, [byOutcomes, byName]);

	const currentFilterState = useCallback(() => {
		const filtered = filterReportHistory(report, {
			search: byName,
			status: byOutcomes,
		});

		return filtered;
	}, [byName, byOutcomes]);

	const currentState = currentFilterState();

	return (
		<Accordion className="mb-5">
			<AccordionItem
				key="filter"
				aria-label="Test Filters"
				title={
					<div className="flex flex-row gap-2 justify-between">
						<p>Showing</p>
						<span className="text-gray-500">
							{currentState.testCount}/{currentState.totalTestCount}{" "}
							{pluralize(currentState.testCount || 0, "test")}
						</span>
					</div>
				}
			>
				<CheckboxGroup
					color="secondary"
					defaultValue={testOutcomes}
					label="Status"
					orientation="horizontal"
					onValueChange={(values) =>
						onOutcomeChange(values as ReportTestOutcome[])
					}
				>
					{testOutcomes.map((outcome) => {
						const status = testStatusToColor(outcome);

						return (
							<Checkbox
								key={outcome}
								className="p-4"
								color={status.colorName}
								value={outcome}
							>
								{status.title}
							</Checkbox>
						);
					})}
				</CheckboxGroup>
				<Input
					className="mb-3"
					label="Title"
					onChange={(e) => onNameChange(e.target.value)}
				/>
			</AccordionItem>
		</Accordion>
	);
};

export default ReportFilters;
