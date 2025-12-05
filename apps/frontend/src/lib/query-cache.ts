import type { QueryClient } from '@tanstack/react-query';
import { withBase } from './url';

export const invalidateCache = async (
  queryClient: QueryClient,
  options?: { queryKeys?: string[]; predicate?: string }
) => {
  try {
    // Invalidate client-side cache
    if (queryClient) {
      if (options?.queryKeys) {
        for (const key of options.queryKeys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }

      if (options?.predicate) {
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey.some(
              (key) => typeof key === 'string' && key.includes(options.predicate!)
            ),
        });
      }
    }

    // Call server-side cache refresh
    await fetch(withBase('/api/cache/refresh'), { method: 'POST' });
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
  }
};
