import type {
  SiteWhiteLabelConfig,
  TestFilters,
  TestWithQuarantineInfo,
} from '@playwright-reports/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { parseMilliseconds } from '@/lib/time';
import useMutation from '../../hooks/useMutation';
import useQuery from '../../hooks/useQuery';
import { defaultProjectName } from '../../lib/constants';
import { invalidateCache } from '../../lib/query-cache';
import { TrendSparklineHistory } from '../analytics/TrendSparklineHistory';
import { exponentialMovingAverageDuration } from './calculations/ema';
import { TestFilters as TestFiltersComponent } from './TestFilters';

interface TestManagementWidgetProps {
  project?: string;
}

export default function TestManagementWidget({ project }: Readonly<TestManagementWidgetProps>) {
  const [filters, setFilters] = useState<TestFilters>({
    project: project ?? defaultProjectName,
    status: 'all',
    flakinessMin: 0,
    flakinessMax: 100,
  });
  const [quarantineTest, setQuarantineTest] = useState<TestWithQuarantineInfo | null>(null);
  const [quarantineReason, setQuarantineReason] = useState('');
  const [isQuarantineModalOpen, setIsQuarantineModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: config } = useQuery<SiteWhiteLabelConfig>('/api/config');

  const warningThreshold = config?.testManagement?.warningThresholdPercentage ?? 10;
  const quarantineThreshold = config?.testManagement?.quarantineThresholdPercentage ?? 50;

  const { data: testsResponse, isLoading: isLoadingTests } = useQuery<{
    data: TestWithQuarantineInfo[];
  }>(
    (() => {
      const params = new URLSearchParams();
      if (filters.project && filters.project !== defaultProjectName) {
        params.append('project', filters.project);
      }
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.flakinessMin !== undefined && filters.flakinessMin > 0) {
        params.append('flakinessMin', filters.flakinessMin.toString());
      }
      if (filters.flakinessMax !== undefined && filters.flakinessMax < 100) {
        params.append('flakinessMax', filters.flakinessMax.toString());
      }
      const stringifiedParams = params.toString() ?? '';
      return `/api/tests?${stringifiedParams}`;
    })(),
    { dependencies: [filters] }
  );

  const { mutate: updateQuarantineMutation, isPending: isUpdateQuarantinePending } = useMutation(
    '/api/test',
    {
      method: 'PATCH',
      onSuccess: (_, variables) => {
        invalidateCache(queryClient, { predicate: '/api/tests' });
        setIsQuarantineModalOpen(false);
        setQuarantineReason('');
        const test = (variables as { body: { test: TestWithQuarantineInfo } }).body.test;
        toast.success(
          test.isQuarantined ? 'Test removed from quarantine' : 'Test quarantined successfully'
        );
      },
    }
  );

  /**
   * Sorting priorities:
   * 1) Quarantined
   * 2) High flakiness score (high to low)
   * 3) Pass rate (low to high)
   */
  const tests = useMemo(() => {
    const data = testsResponse?.data || [];

    const getPassRate = (test: TestWithQuarantineInfo): number => {
      if (!test.runs || test.runs.length === 0) {
        return 1; // No data means 100% pass rate (lowest priority)
      }
      const passedRuns = test.runs.filter((run) => run.outcome === 'passed').length;
      return passedRuns / test.runs.length;
    };

    return [...data].sort((prev, next) => {
      if ((prev.isQuarantined ?? false) !== (next.isQuarantined ?? false)) {
        return (next.isQuarantined ?? false) ? 1 : -1;
      }

      const prevFlakiness = prev.flakinessScore ?? 0;
      const nextFlakiness = next.flakinessScore ?? 0;
      const flakinessDiff = Math.abs(prevFlakiness - nextFlakiness) > 0.01;
      if (flakinessDiff) {
        return nextFlakiness - prevFlakiness;
      }

      const aPassRate = getPassRate(prev);
      const bPassRate = getPassRate(next);
      return aPassRate - bPassRate;
    });
  }, [testsResponse]);

  const getStatusBadge = (test: TestWithQuarantineInfo) => {
    if (test.isQuarantined) {
      return (
        <Badge variant="destructive" className="gap-1">
          🔒 Quarantined
        </Badge>
      );
    }
    if (test.flakinessScore === undefined) {
      return <Badge variant="secondary">No Data</Badge>;
    }
    if (test.flakinessScore < warningThreshold) {
      return (
        <Badge variant="default" className="bg-green-600 gap-1">
          Stable
        </Badge>
      );
    }
    if (test.flakinessScore < quarantineThreshold) {
      return (
        <Badge variant="secondary" className="bg-yellow-600 text-white gap-1">
          ⚠️ Flaky
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        Critical
      </Badge>
    );
  };

  const handleQuarantineAction = (test: TestWithQuarantineInfo) => {
    setQuarantineTest(test);
    if (!test.isQuarantined) {
      setQuarantineReason('');
    }
    setIsQuarantineModalOpen(true);
  };

  const handleQuarantineSubmit = () => {
    if (!quarantineTest) return;

    const isQuarantined = !quarantineTest.isQuarantined;

    if (isQuarantined && !quarantineReason?.trim()) {
      toast.error('Please provide a reason for quarantine');
      return;
    }

    updateQuarantineMutation({
      body: {
        test: quarantineTest,
        isQuarantined,
        reason: quarantineReason,
      },
      path: `/api/test/${quarantineTest.fileId}/${quarantineTest.testId}?project=${quarantineTest.project}`,
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Test Management</h2>
        <p className="text-muted-foreground mt-1">
          Monitor test health and manage quarantine status
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <TestFiltersComponent filters={filters} onFiltersChange={setFilters} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Tests</h3>
        </CardHeader>
        <CardContent>
          {isLoadingTests ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test Name</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Outcome (latest)</TableHead>
                    <TableHead>Is Flaky</TableHead>
                    <TableHead>Flakiness Score</TableHead>
                    <TableHead>Total Runs</TableHead>
                    <TableHead>History (first to last)</TableHead>
                    <TableHead>Duration (Avg)</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((item) => (
                    <TableRow key={`${item.testId}-${item.fileId}-${item.project}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.filePath}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{item.project}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{item.runs?.at(0)?.outcome}</p>
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={item.flakinessScore || 0}
                            className="max-w-[100px] h-2"
                          />
                          <span className="text-sm">{item.flakinessScore?.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.totalRuns || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <TrendSparklineHistory runs={item.runs ?? []} />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {parseMilliseconds(exponentialMovingAverageDuration(item.runs))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.lastRunAt ? new Date(item.lastRunAt).toLocaleString() : 'Never'}
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() => handleQuarantineAction(item)}
                              className={item.isQuarantined ? 'text-green-600' : 'text-red-600'}
                            >
                              {item.isQuarantined ? 'Remove Quarantine' : 'Send Quarantine'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {tests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No tests found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4 text-xs text-muted-foreground border-t pt-3 w-full">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-green-500 rounded"></span>
                <span>Passed run</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-red-500 rounded"></span>
                <span>Failed run</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isQuarantineModalOpen} onOpenChange={setIsQuarantineModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {quarantineTest?.isQuarantined ? 'Remove from Quarantine' : 'Quarantine Test'}
            </DialogTitle>
            <DialogDescription>
              {quarantineTest?.isQuarantined
                ? 'This test will be removed from quarantine and allowed to run again.'
                : 'This test will be quarantined and skipped in future runs.'}
            </DialogDescription>
          </DialogHeader>
          {quarantineTest && (
            <div className="space-y-4">
              <div>
                <p className="mb-4">
                  <strong>Test:</strong> {quarantineTest.title}
                </p>
                {!quarantineTest.isQuarantined && (
                  <Textarea
                    placeholder="Enter reason for quarantine..."
                    value={quarantineReason}
                    onChange={(e) => setQuarantineReason(e.target.value)}
                    required
                    rows={3}
                  />
                )}
                {quarantineTest.isQuarantined && quarantineTest.quarantineReason && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-semibold mb-1">Current Reason:</p>
                    <p className="text-sm">{quarantineTest.quarantineReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsQuarantineModalOpen(false)}
              disabled={isUpdateQuarantinePending}
            >
              Cancel
            </Button>
            <Button
              variant={quarantineTest?.isQuarantined ? 'default' : 'destructive'}
              onClick={handleQuarantineSubmit}
              disabled={isUpdateQuarantinePending}
            >
              {isUpdateQuarantinePending
                ? 'Saving...'
                : quarantineTest?.isQuarantined
                  ? 'Remove Quarantine'
                  : 'Quarantine Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
