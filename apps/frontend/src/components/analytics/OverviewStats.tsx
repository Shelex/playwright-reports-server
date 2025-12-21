'use client';

import { Card, CardBody, CardHeader } from '@heroui/react';
import type { OverviewStats } from '@playwright-reports/shared';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { parseMilliseconds } from '@/lib/time';

interface OverviewStatsProps {
  stats: OverviewStats;
}

export function OverviewStatsCard({ stats }: Readonly<OverviewStatsProps>) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {new Array({ length: 5 }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: that is just a placeholder for 5 elements
          <Card key={index} className="shadow-sm">
            <CardHeader className="pb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Loading...</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-300 dark:text-gray-600">--</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No data</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-red-600 dark:text-red-400';
      case 'down':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const {
    totalTests = 0,
    passRate = 0,
    flakyTests = 0,
    averageTestDuration = 0,
    averageTestRunDuration = 0,
    passRateTrend = 'stable' as const,
    flakyTestsTrend = 'stable' as const,
  } = stats;

  const statsCards = [
    {
      //TODO: calculate properly based on tests table
      title: 'Total Tests (TBD)',
      value: totalTests.toLocaleString(),
      subtitle: 'Across all runs',
    },
    {
      title: 'Pass Rate',
      value: `${passRate.toFixed(2)}%`,
      subtitle: '7-day/30-day comparison',
      icon: getTrendIcon(passRateTrend),
      iconColor: getTrendColor(passRateTrend),
    },
    {
      //TODO: calculate properly based on tests table
      title: 'Flaky Tests (TBD)',
      value: flakyTests.toString(),
      subtitle: 'Failing intermittently',
      icon: getTrendIcon(flakyTestsTrend),
      iconColor: getTrendColor(flakyTestsTrend),
    },
    {
      title: 'Avg Test Duration',
      value: parseMilliseconds(averageTestDuration),
      subtitle: 'Mean execution time',
    },
    {
      title: 'Average Run Time',
      value: parseMilliseconds(averageTestRunDuration),
      subtitle: 'Average for latest runs',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {statsCards.map((card) => (
        <Card key={card.title} className="shadow-sm">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</h3>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.subtitle}</p>
              </div>
              {card.icon && <div className={card.iconColor}>{card.icon}</div>}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
