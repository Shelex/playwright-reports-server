'use client';

import { Button } from '@heroui/react';
import type { DatabaseStats } from '@playwright-reports/shared';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import useMutation from '../../../hooks/useMutation';
import { invalidateCache } from '../../../lib/query-cache';

interface DatabaseInfoProps {
  stats?: DatabaseStats;
}

export default function DatabaseInfo({ stats }: Readonly<DatabaseInfoProps>) {
  const queryClient = useQueryClient();
  const {
    mutate: cacheRefresh,
    isPending,
    error,
  } = useMutation('/api/cache/refresh', {
    method: 'POST',
    onSuccess: () => {
      invalidateCache(queryClient, { queryKeys: ['/api', '/api/info'] });
      toast.success(`db refreshed successfully`);
    },
  });

  return (
    <div>
      <p className="text-sm text-gray-600">Size: {stats?.sizeOnDisk ?? 'n/a'}</p>
      <p className="text-sm text-gray-600">RAM: {stats?.estimatedRAM}</p>
      <p className="text-sm text-gray-600">Results: {stats?.results}</p>
      <p className="text-sm text-gray-600">Reports: {stats?.reports}</p>
      <Button
        color="warning"
        isLoading={isPending}
        size="sm"
        onPress={() => {
          cacheRefresh({});
        }}
      >
        Force Refresh
      </Button>
      {error && toast.error(error.message)}
    </div>
  );
}
