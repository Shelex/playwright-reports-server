'use client';

import { Button } from '@heroui/react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import useMutation from '@/app/hooks/useMutation';
import { invalidateCache } from '@/app/lib/query-cache';
import { DatabaseStats } from '@/app/types';

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
      invalidateCache(queryClient, { queryKeys: ['/api'] });
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
