'use client';

import type { DatabaseStats } from '@playwright-reports/shared';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import useMutation from '@/hooks/useMutation';
import { invalidateCache } from '@/lib/query-cache';

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
      <p className="text-sm text-muted-foreground">Size: {stats?.sizeOnDisk ?? 'n/a'}</p>
      <p className="text-sm text-muted-foreground">RAM: {stats?.estimatedRAM}</p>
      <p className="text-sm text-muted-foreground">Results: {stats?.results}</p>
      <p className="text-sm text-muted-foreground">Reports: {stats?.reports}</p>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          cacheRefresh({});
        }}
      >
        {isPending ? 'Refreshing...' : 'Force Refresh'}
      </Button>
      {error && toast.error(error.message)}
    </div>
  );
}
