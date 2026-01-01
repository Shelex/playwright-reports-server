'use client';

import type { ReportStats } from '@playwright-reports/shared';
import type { FC } from 'react';
import { CircularProgress } from './ui/progress';

type ReportFiltersProps = {
  stats: ReportStats;
};

const InlineStatsCircle: FC<ReportFiltersProps> = ({ stats }) => {
  if (!stats.total) return null;

  const passedPercentage = ((stats.expected || 0) / (stats.total - (stats.skipped || 0))) * 100;

  return (
    <CircularProgress
      aria-label="Passed Percentage"
      showValueLabel={true}
      size={48}
      strokeWidth={3}
      value={Math.round(passedPercentage)}
    />
  );
};

export default InlineStatsCircle;
