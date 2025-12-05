import type { ReportTestOutcome } from '@playwright-reports/shared';

export interface TestStatusColor {
  title: string;
  color: string;
  colorName: 'success' | 'danger' | 'warning' | 'default';
}

export function testStatusToColor(outcome: ReportTestOutcome): TestStatusColor {
  switch (outcome) {
    case 'passed':
    case 'expected':
      return {
        title: '✅ Passed',
        color: 'text-success',
        colorName: 'success',
      };
    case 'failed':
    case 'unexpected':
      return {
        title: '❌ Failed',
        color: 'text-danger',
        colorName: 'danger',
      };
    case 'skipped':
      return {
        title: '⏭️ Skipped',
        color: 'text-warning',
        colorName: 'warning',
      };
    case 'flaky':
      return {
        title: '🔄 Flaky',
        color: 'text-warning',
        colorName: 'warning',
      };
    default:
      return {
        title: '❓ Unknown',
        color: 'text-default',
        colorName: 'default',
      };
  }
}
