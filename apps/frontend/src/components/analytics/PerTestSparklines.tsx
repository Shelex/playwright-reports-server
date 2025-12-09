'use client';

import { Badge, Button } from '@heroui/react';
import type { PerTestMetric } from '@playwright-reports/shared';
import { AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseMilliseconds } from '@/lib/time';

interface PerTestSparklinesProps {
  metrics: PerTestMetric[];
  onFilter?: (filter: 'all' | 'flaky' | 'failed') => void;
  currentFilter?: 'all' | 'flaky' | 'failed';
}

export function PerTestSparklines({
  metrics,
  onFilter,
  currentFilter = 'all',
}: Readonly<PerTestSparklinesProps>) {
  const filteredMetrics = metrics.filter((metric) => {
    switch (currentFilter) {
      case 'flaky':
        return metric.isFlaky;
      case 'failed':
        return metric.passRate < 100;
      default:
        return true;
    }
  });

  const SparklineChart = ({
    recentRuns,
  }: {
    recentRuns: Array<{ date: string; passed: boolean }>;
  }) => {
    const maxRuns = Math.min(recentRuns.length, 30);
    const recentRunsSlice = recentRuns.slice(-maxRuns);

    return (
      <div className="flex items-end gap-px h-4">
        {recentRunsSlice.reverse().map((run, index) => (
          <div
            key={index}
            className={`w-1 rounded-sm ${run.passed ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ height: `${Math.max(2, (run.passed ? 0.8 : 1.0) * 16)}px` }}
            title={`${run.passed ? 'PASS' : 'FAIL'} - ${new Date(run.date).toLocaleDateString()}`}
          />
        ))}
        {recentRunsSlice.length === 0 && <div className="text-xs text-gray-400">No data</div>}
      </div>
    );
  };

  const getPassRateColor = (passRate: number) => {
    if (passRate === 100) return 'text-green-600';
    if (passRate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPassRateBadge = (passRate: number, isFlaky: boolean) => {
    if (isFlaky) {
      return (
        <Badge color="warning" size="sm">
          FLAKY
        </Badge>
      );
    }
    if (passRate === 100) {
      return (
        <Badge color="success" size="sm">
          STABLE
        </Badge>
      );
    }
    return (
      <Badge color="danger" size="sm">
        UNSTABLE
      </Badge>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Per-Test Performance</h3>

        {onFilter && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={currentFilter === 'all' ? 'solid' : 'flat'}
              color={currentFilter === 'all' ? 'primary' : 'default'}
              onPress={() => onFilter('all')}
            >
              Show All
            </Button>
            <Button
              size="sm"
              variant={currentFilter === 'flaky' ? 'solid' : 'flat'}
              color={currentFilter === 'flaky' ? 'warning' : 'default'}
              onPress={() => onFilter('flaky')}
            >
              Show Flaky
            </Button>
            <Button
              size="sm"
              variant={currentFilter === 'failed' ? 'solid' : 'flat'}
              color={currentFilter === 'failed' ? 'danger' : 'default'}
              onPress={() => onFilter('failed')}
            >
              Show Failed
            </Button>
          </div>
        )}
      </div>

      {filteredMetrics.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No tests found matching the current filter
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredMetrics.map((metric) => (
            <Link
              key={metric.testId}
              to={`/report/${metric.latestReportId}/${metric.testId}`}
              state={{ highlightTestId: metric.testId }}
              className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm truncate">{metric.testName}</span>
                    {getPassRateBadge(metric.passRate, metric.isFlaky)}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {parseMilliseconds(Math.round(metric.avgDuration))}
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {metric.file}:{metric.line}
                    </div>
                  </div>
                </div>

                <div className="text-right ml-4">
                  <div className="font-mono text-sm mb-1">
                    <span className={getPassRateColor(metric.passRate)}>
                      {metric.passRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center">
                    <SparklineChart recentRuns={metric.recentRuns.slice(-30)} />
                  </div>
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {metric.recentRuns.length} recent runs • Pass rate: {metric.passRate.toFixed(2)}%
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400 dark:text-gray-500 border-t pt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-green-500 rounded"></span>
            <span>Passed run</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-red-500 rounded"></span>
            <span>Failed run</span>
          </div>
        </div>
      </div>
    </div>
  );
}
