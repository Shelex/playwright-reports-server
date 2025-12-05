'use client';

import { Accordion, AccordionItem, Checkbox, CheckboxGroup, Input } from '@heroui/react';
import type { ReportHistory, ReportTestOutcome } from '@playwright-reports/shared';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { testStatusToColor } from '@/lib/tailwind';
import { filterReportHistory, pluralize } from '@/lib/transformers';

type ReportFiltersProps = {
  report: ReportHistory;
  onChangeFilters: (report: ReportHistory) => void;
};

const testOutcomes: ReportTestOutcome[] = ['expected', 'unexpected', 'skipped', 'flaky'];

const ReportFilters: FC<ReportFiltersProps> = ({ report, onChangeFilters }) => {
  const [byName, setByName] = useState('');
  const [byOutcomes, setByOutcomes] = useState<ReportTestOutcome[] | undefined>(testOutcomes);
  const previousStateRef = useRef<{ testCount: number; totalTestCount: number } | null>(null);

  const onNameChange = (name: string) => {
    setByName(name);
  };

  const onOutcomeChange = (outcomes?: ReportTestOutcome[]) => {
    setByOutcomes(outcomes?.length ? outcomes : []);
  };

  const currentState = useMemo(() => {
    return filterReportHistory(report, {
      search: byName,
      status: byOutcomes,
    });
  }, [byName, byOutcomes, report]);

  useEffect(() => {
    const currentCounts = {
      testCount: currentState.testCount,
      totalTestCount: currentState.totalTestCount,
    };

    if (
      !previousStateRef.current ||
      previousStateRef.current.testCount !== currentCounts.testCount ||
      previousStateRef.current.totalTestCount !== currentCounts.totalTestCount
    ) {
      previousStateRef.current = currentCounts;
      onChangeFilters(currentState);
    }
  }, [currentState.testCount, currentState.totalTestCount, currentState, onChangeFilters]);

  return (
    <Accordion className="mb-5">
      <AccordionItem
        key="filter"
        aria-label="Test Filters"
        title={
          <div className="flex flex-row gap-2 justify-between">
            <p>Showing</p>
            <span className="text-gray-500">
              {currentState.testCount}/{currentState.totalTestCount}{' '}
              {pluralize(currentState.testCount || 0, 'test')}
            </span>
          </div>
        }
      >
        <CheckboxGroup
          color="secondary"
          defaultValue={testOutcomes}
          label="Status"
          orientation="horizontal"
          onValueChange={(values) => onOutcomeChange(values as ReportTestOutcome[])}
        >
          {testOutcomes.map((outcome) => {
            const status = testStatusToColor(outcome);

            return (
              <Checkbox key={outcome} className="p-4" color={status.colorName} value={outcome}>
                {status.title}
              </Checkbox>
            );
          })}
        </CheckboxGroup>
        <Input className="mb-3" label="Title" onChange={(e) => onNameChange(e.target.value)} />
      </AccordionItem>
    </Accordion>
  );
};

export default ReportFilters;
