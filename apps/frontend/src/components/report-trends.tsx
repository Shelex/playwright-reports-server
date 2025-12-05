'use client';

import { Spinner } from '@heroui/react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import useQuery from '../hooks/useQuery';
import { defaultProjectName } from '../lib/constants';
import { withQueryParams } from '../lib/network';
import type { ReportHistory } from '@playwright-reports/shared';
import { title } from './primitives';
import ProjectSelect from './project-select';
import { TrendChart } from './trend-chart';

export default function ReportTrends() {
  const [project, setProject] = useState(defaultProjectName);

  const {
    data: response,
    error,
    isFetching,
    isPending,
  } = useQuery<{ reports: ReportHistory[] }>(
    withQueryParams('/api/report/list', {
      project,
      limit: '20',
    }),
    { dependencies: [project] }
  );

  const reports = response?.reports || [];

  const onProjectChange = useCallback((project: string) => {
    setProject(project);
  }, []);

  error && toast.error(error.message);

  return (
    <div className="w-[min(100%,1000px)] mx-auto">
      <div>
        <h1 className={title()}>Trends</h1>
      </div>

      <div>
        {(isFetching || isPending) && <Spinner className="flex justify-center items-center" />}
        <div className="flex justify-end my-2">
          <ProjectSelect entity="report" onSelect={onProjectChange} />
        </div>
        {!isFetching && !isPending && (!reports || reports.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-gray-500 dark:text-gray-400 text-lg">No trend data available.</div>
            <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              Generate some reports first to see trend analysis.
            </div>
          </div>
        )}
        {!!reports?.length && <TrendChart reportHistory={reports} />}
      </div>
    </div>
  );
}
