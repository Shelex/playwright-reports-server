'use client';

import { FC, useEffect, useState } from 'react';
import { Accordion, AccordionItem, Alert, Spinner } from '@heroui/react';
import { toast } from 'sonner';

import { subtitle } from '../primitives';
import { StatChart } from '../stat-chart';
import InlineStatsCircle from '../inline-stats-circle';

import FileSuitesTree from './suite-tree';
import ReportFilters from './tests-filters';

import { type ReportHistory } from '@/app/lib/storage';
import useQuery from '@/app/hooks/useQuery';
import { pluralize } from '@/app/lib/transformers';
import { parseMilliseconds } from '@/app/lib/time';

interface FileListProps {
  report?: ReportHistory | null;
  jiraIntegrationEnabled?: boolean;
}

const FileList: FC<FileListProps> = ({ report, jiraIntegrationEnabled }) => {
  const {
    data: history,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useQuery<ReportHistory[]>(`/api/report/trend?limit=10&project=${report?.project ?? ''}`, {
    callback: `/report/${report?.reportID}`,
    dependencies: [report?.reportID],
  });

  const [filteredTests, setFilteredTests] = useState<ReportHistory | undefined>(report!);

  useEffect(() => {
    if (historyError) {
      toast.error(historyError.message);
    }
  }, [historyError]);

  if (!report) {
    return <Spinner color="primary" label="Loading..." />;
  }

  return isHistoryLoading ? (
    <Spinner color="primary" label="Loading test history..." />
  ) : (
    <div>
      <div className="flex flex-row justify-between">
        <h2 className={subtitle()}>File list</h2>
        <ReportFilters report={report!} onChangeFilters={setFilteredTests} />
      </div>
      {!filteredTests?.files?.length ? (
        <Alert color="warning" title={`No files found`} />
      ) : (
        <Accordion isCompact={true} variant="bordered">
          {(filteredTests?.files ?? []).map((file) => {
            const fileDurationMs = file.tests.reduce((total, test) => total + (test.duration || 0), 0);
            const fileDurationText = parseMilliseconds(fileDurationMs);

            return (
              <AccordionItem
                key={file.fileId}
                aria-label={file.fileName}
                startContent={<InlineStatsCircle stats={file.stats} />}
                title={
                  <p className="flex flex-row gap-5">
                    {file.fileName}
                    <span className="text-gray-500">
                      {file.tests.length} {pluralize(file.tests.length, 'test', 'tests')} | {fileDurationText}
                    </span>
                  </p>
                }
              >
                <div className="file-details">
                  <StatChart stats={file.stats} />
                  <div className="file-tests">
                    <h4 className={subtitle()}>Tests</h4>
                    <FileSuitesTree
                      file={file}
                      history={history ?? []}
                      jiraIntegrationEnabled={jiraIntegrationEnabled}
                      reportId={report?.reportID}
                    />
                  </div>
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};

export default FileList;
