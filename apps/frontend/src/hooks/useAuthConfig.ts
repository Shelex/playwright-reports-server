'use client';

import type { SiteWhiteLabelConfig } from '@playwright-reports/shared';
import { useQueryClient } from '@tanstack/react-query';
import { withBase } from '../lib/url';

const AUTH_CONFIG_QUERY_KEY = ['auth-config'];

export function useAuthConfig() {
  const queryClient = useQueryClient();

  const state = queryClient.getQueryState<SiteWhiteLabelConfig>(AUTH_CONFIG_QUERY_KEY);
  const config = state?.data;
  const isLoading = !config;

  return {
    authRequired: config?.authRequired ?? null,
    config: config ?? null,
    isLoading,
  };
}

export async function prefetchAuthConfig() {
  const res = await fetch(withBase('/api/config'));
  if (!res.ok) {
    throw new Error('Failed to fetch config');
  }
  const data = await res.json();
  return data;
}

export { AUTH_CONFIG_QUERY_KEY };
