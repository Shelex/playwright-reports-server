'use client';

import { Spinner } from '@heroui/react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAnalyticsData } from '../../hooks/useAnalyticsData';
import { defaultProjectName } from '../../lib/constants';
import ProjectSelect from '../project-select';
import { HealthGrid } from './HealthGrid';
import { OverviewStatsCard } from './OverviewStats';
import { PerTestSparklines } from './PerTestSparklines';
import { TrendSparklines } from './TrendSparklines';

export default function AnalyticsDashboard() {
  const [project, setProject] = useState(defaultProjectName);
  const [testFilter, setTestFilter] = useState<'all' | 'flaky' | 'failed'>('all');

  const { data: analyticsData, error, isFetching, isPending } = useAnalyticsData(project);

  const onProjectChange = useCallback((project: string) => {
    setProject(project);
  }, []);

  const onFilterChange = useCallback((filter: 'all' | 'flaky' | 'failed') => {
    setTestFilter(filter);
  }, []);

  error && toast.error(error.message);

  if (isPending || isFetching) {
    return (
      <div className="w-[min(100%, 1200px)] mx-auto">
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="w-[min(100%, 1200px)] mx-auto">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-gray-500 dark:text-gray-400 text-lg">
            No analytics data available.
          </div>
          <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            Generate some reports first to see analytics.
          </div>
        </div>
      </div>
    );
  }

  const { overviewStats, runHealthMetrics = [], trendMetrics, perTestMetrics = [] } = analyticsData;

  return (
    <div className="w-[min(100%, 1200px)] mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive insights into test performance and health
          </p>
        </div>
        <div className="flex justify-end">
          <ProjectSelect entity="report" onSelect={onProjectChange} />
        </div>
      </div>

      <OverviewStatsCard stats={overviewStats} />
      <TrendSparklines metrics={trendMetrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HealthGrid metrics={runHealthMetrics} />
        <PerTestSparklines
          metrics={perTestMetrics}
          onFilter={onFilterChange}
          currentFilter={testFilter}
        />
      </div>

      {(runHealthMetrics.length === 0 || perTestMetrics.length === 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="text-center">
            <div className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
              Limited Data Available
            </div>
            <div className="text-yellow-600 dark:text-yellow-400 text-sm">
              Analytics insights become more meaningful with at least 5-10 test runs. Continue
              generating reports to see detailed trends and patterns.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
