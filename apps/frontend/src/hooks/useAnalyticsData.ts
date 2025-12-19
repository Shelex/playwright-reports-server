import type { AnalyticsData } from '@playwright-reports/shared';
import { withQueryParams } from '../lib/network';
import useQuery from './useQuery';

export function useAnalyticsData(project?: string) {
  const baseUrl = '/api/analytics';
  const params: Record<string, string> = project ? { project } : {};
  const url = withQueryParams(baseUrl, params) ?? baseUrl;

  return useQuery<AnalyticsData>(url, {
    dependencies: [project],
    staleTime: 5 * 60 * 1000,
    select: (response: unknown) => {
      if (
        response &&
        typeof response === 'object' &&
        'success' in response &&
        response.success === true
      ) {
        return (response as { success: true; data: AnalyticsData }).data;
      }
      return response as AnalyticsData;
    },
  });
}
