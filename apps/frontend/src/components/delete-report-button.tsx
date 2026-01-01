'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import useMutation from '../hooks/useMutation';
import { invalidateCache } from '../lib/query-cache';
import { DeleteIcon } from './icons';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Spinner } from './ui/spinner';

interface DeleteProjectButtonProps {
  reportId: string;
  onDeleted: () => void;
}

export default function DeleteReportButton({ reportId, onDeleted }: DeleteProjectButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const {
    mutate: deleteReport,
    isPending,
    error,
  } = useMutation('/api/report/delete', {
    method: 'DELETE',
    onSuccess: () => {
      invalidateCache(queryClient, {
        queryKeys: ['/api/info'],
        predicate: '/api/report',
      });
      toast.success(`report "${reportId}" deleted`);
      setOpen(false);
      onDeleted?.();
    },
  });

  const handleDelete = async () => {
    if (!reportId) {
      return;
    }

    deleteReport({ body: { reportsIds: [reportId] } });
  };

  error && toast.error(error.message);

  return (
    !!reportId && (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="p-0 min-w-10" size="icon" title="Delete report" variant="ghost">
            <DeleteIcon />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>This will permanently delete your report</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
              {isPending && <Spinner className="mr-2 h-4 w-4" />}
              Delete Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  );
}
