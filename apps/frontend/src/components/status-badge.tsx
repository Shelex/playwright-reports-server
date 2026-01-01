import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'flaky' | 'running' | 'unknown';

interface StatusBadgeProps {
  status: TestStatus;
  count?: number;
  showIcon?: boolean;
  className?: string;
}

const statusConfig = {
  passed: {
    variant: 'success' as const,
    label: 'Passed',
    icon: CheckCircle2,
  },
  failed: {
    variant: 'failure' as const,
    label: 'Failed',
    icon: XCircle,
  },
  skipped: {
    variant: 'skipped' as const,
    label: 'Skipped',
    icon: MinusCircle,
  },
  flaky: {
    variant: 'flaky' as const,
    label: 'Flaky',
    icon: AlertTriangle,
  },
  running: {
    variant: 'running' as const,
    label: 'Running',
    icon: Loader2,
  },
  unknown: {
    variant: 'outline' as const,
    label: 'Unknown',
    icon: MinusCircle,
  },
};

export function StatusBadge({ status, count, showIcon = true, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.unknown;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all',
        {
          'bg-success/10 text-success border border-success/20': status === 'passed',
          'bg-failure/10 text-failure border border-failure/20': status === 'failed',
          'bg-muted text-muted-foreground border border-border': status === 'skipped',
          'bg-flaky/10 text-flaky border border-flaky/20': status === 'flaky',
          'bg-running/10 text-running border border-running/20': status === 'running',
        },
        className
      )}
    >
      {showIcon && <Icon className={cn('h-3.5 w-3.5', status === 'running' && 'animate-spin')} />}
      <span>{config.label}</span>
      {count !== undefined && <span className="ml-0.5 opacity-70">({count})</span>}
    </div>
  );
}
