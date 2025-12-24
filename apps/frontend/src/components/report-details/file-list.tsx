'use client';

import { Accordion, AccordionItem, Alert, Spinner } from '@heroui/react';
import type { ReportHistory, ReportStats } from '@playwright-reports/shared';
import { type FC, useEffect, useState } from 'react';
import { toast } from 'sonner';
import InlineStatsCircle from '@/components/inline-stats-circle';
import { subtitle } from '@/components/primitives';
import { StatChart } from '@/components/stat-chart';
import useQuery from '@/hooks/useQuery';
import { pluralize } from '@/lib/transformers';
import FileSuitesTree from './suite-tree';
import ReportFilters from './tests-filters';

interface FileListProps {
  report?: ReportHistory | null;
  highlightTestId?: string;
}

const FileList: FC<FileListProps> = ({ report, highlightTestId }) => {
  const {
    data: history,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useQuery<ReportHistory[]>(`/api/report/list?limit=10&project=${report?.project ?? ''}`, {
    callback: `/report/${report?.reportID}`,
    dependencies: [report?.reportID],
  });

  const [filteredTests, setFilteredTests] = useState<ReportHistory | undefined>(
    report ?? undefined
  );
  const [defaultExpandedKeys, setDefaultExpandedKeys] = useState<string[] | undefined>();

  useEffect(() => {
    if (historyError) {
      toast.error(historyError.message);
    }
  }, [historyError]);

  useEffect(() => {
    if (highlightTestId && filteredTests?.files) {
      const fileWithTest = filteredTests.files.find((file) =>
        file.tests?.some((test) => test.testId === highlightTestId)
      );
      if (fileWithTest?.fileId) {
        setDefaultExpandedKeys([fileWithTest.fileId]);
      }
    }
  }, [highlightTestId, filteredTests]);

  if (!report) {
    return <Spinner color="primary" label="Loading..." />;
  }

  return isHistoryLoading ? (
    <Spinner color="primary" label="Loading test history..." />
  ) : (
    <div>
      <div className="flex flex-row justify-between">
        <h2 className={subtitle()}>File list</h2>
        <ReportFilters report={report} onChangeFilters={setFilteredTests} />
      </div>
      {filteredTests?.files?.length ? (
        <Accordion
          isCompact={true}
          variant="bordered"
          defaultExpandedKeys={defaultExpandedKeys}
          selectedKeys={defaultExpandedKeys}
        >
          {(filteredTests?.files ?? []).map((file) => (
            <AccordionItem
              key={file.fileId}
              aria-label={file.fileName}
              startContent={<InlineStatsCircle stats={file.stats} />}
              title={
                <p className="flex flex-row gap-5">
                  {file.fileName}
                  <span className="text-gray-500">
                    {file.tests.length} {pluralize(file.tests.length, 'test')}
                  </span>
                </p>
              }
            >
              <div className="file-details">
                <StatChart stats={file.stats} />
                <div className="file-tests">
                  <h4 className={subtitle()}>Tests</h4>
                  <FileSuitesTree file={file} history={history ?? []} reportId={report?.reportID} />
                </div>
              </div>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <Alert color="warning" title={`No files found`} />
      )}
    </div>
  );
};

export default FileList;
