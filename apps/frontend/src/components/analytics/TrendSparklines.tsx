'use client';

import type { TrendMetrics } from '@playwright-reports/shared';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

interface TrendSparklinesProps {
  metrics: TrendMetrics;
}

const durationColor = 'hsl(217, 91%, 60%)'; // blue
const flakyColor = 'hsl(38, 92%, 50%)'; // orange
const slowColor = 'hsl(0, 84%, 60%)'; // red

export function TrendSparklines({ metrics }: Readonly<TrendSparklinesProps>) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {new Array({ length: 3 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder until real data is loaded
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Loading...
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Loading trend data</p>
            <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const { durationTrend = [], flakyCountTrend = [], slowCountTrend = [] } = metrics;

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; dataKey: string }>;
    label?: string;
  }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-2 rounded shadow-lg border text-xs">
          <p className="font-medium">{new Date(label ?? '').toLocaleDateString()}</p>
          <p>
            {payload[0].name}:{' '}
            {payload[0].dataKey === 'duration'
              ? formatDuration(payload[0].value)
              : payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Duration Trend
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Average test execution time (ms)
        </p>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={durationTrend.slice(-30).reverse()}>
              <XAxis dataKey="date" hide tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="duration"
                stroke={durationColor}
                fill={durationColor}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Flaky Count Trend
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Number of intermittently failing tests
        </p>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={flakyCountTrend.slice(-30).reverse()}>
              <XAxis dataKey="date" hide tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={flakyColor}
                fill={flakyColor}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
        <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Slow Count Trend
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Tests slower than 95th percentile
        </p>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={slowCountTrend.slice(-30).reverse()}>
              <XAxis dataKey="date" hide tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={slowColor}
                fill={slowColor}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
