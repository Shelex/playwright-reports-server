import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
  useDisclosure,
} from '@heroui/react';
import type {
  SiteWhiteLabelConfig,
  TestFilters,
  TestWithQuarantineInfo,
} from '@playwright-reports/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
  const {
    isOpen: isQuarantineModalOpen,
    onOpen: onQuarantineModalOpen,
    onOpenChange: onQuarantineModalOpenChange,
  } = useDisclosure();

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
        onQuarantineModalOpenChange();
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

  const getFlakinessColor = (score?: number) => {
    if (!score) return 'default';
    if (score < warningThreshold) return 'success';
    if (score < quarantineThreshold) return 'warning';
    return 'danger';
  };

  const getStatusBadge = (test: TestWithQuarantineInfo) => {
    if (test.isQuarantined) {
      return (
        <Badge color="danger" variant="flat">
          🔒 Quarantined
        </Badge>
      );
    }
    if (test.flakinessScore === undefined) {
      return (
        <Badge color="default" variant="flat">
          No Data
        </Badge>
      );
    }
    if (test.flakinessScore < warningThreshold) {
      return (
        <Badge color="success" variant="flat">
          ✅ Stable
        </Badge>
      );
    }
    if (test.flakinessScore < quarantineThreshold) {
      return (
        <Badge color="warning" variant="flat">
          ⚠️ Flaky
        </Badge>
      );
    }
    return (
      <Badge color="danger" variant="flat">
        🚫 Critical
      </Badge>
    );
  };

  const handleQuarantineAction = (test: TestWithQuarantineInfo) => {
    setQuarantineTest(test);
    if (!test.isQuarantined) {
      setQuarantineReason('');
    }
    onQuarantineModalOpen();
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Test Management</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Monitor test health and manage quarantine status
        </p>
      </div>

      <Card className="mb-4">
        <CardBody>
          <TestFiltersComponent filters={filters} onFiltersChange={setFilters} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Tests</h3>
        </CardHeader>
        <CardBody>
          {isLoadingTests ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <Table aria-label="Test management table">
              <TableHeader>
                <TableColumn>Test Name</TableColumn>
                <TableColumn>Project</TableColumn>
                <TableColumn>Outcome (latest)</TableColumn>
                <TableColumn>Is Flaky</TableColumn>
                <TableColumn>Flakiness Score</TableColumn>
                <TableColumn>Total Runs</TableColumn>
                <TableColumn>History (first to last)</TableColumn>
                <TableColumn>Duration (Avg)</TableColumn>
                <TableColumn>Last Run</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody items={tests} emptyContent="No tests found">
                {(item: TestWithQuarantineInfo) => (
                  <TableRow key={`${item.testId}-${item.fileId}-${item.project}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-small text-default-500">{item.filePath}</p>
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
                          color={getFlakinessColor(item.flakinessScore)}
                          size="sm"
                          className="max-w-[100px]"
                        />
                        <span className="text-sm">{item.flakinessScore?.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip variant="flat" size="sm">
                        {item.totalRuns || 0}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <TrendSparklineHistory runs={item.runs ?? []} />
                    </TableCell>
                    <TableCell>
                      <span className="flex">
                        <Clock className="h-5 w-5 mr-1" />
                        {parseMilliseconds(exponentialMovingAverageDuration(item.runs))}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.lastRunAt ? new Date(item.lastRunAt).toLocaleString() : 'Never'}
                    </TableCell>

                    <TableCell>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button variant="light" size="sm">
                            Actions
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Actions">
                          <DropdownItem
                            key={`quarantine-${item.testId}-${item.fileId}`}
                            onPress={() => handleQuarantineAction(item)}
                            color={item.isQuarantined ? 'success' : 'danger'}
                          >
                            {item.isQuarantined ? 'Remove Quarantine' : 'Send Quarantine'}
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 text-xs text-gray-400 dark:text-gray-500 border-t pt-3 w-full">
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
        </CardBody>
      </Card>

      <Modal isOpen={isQuarantineModalOpen} onOpenChange={onQuarantineModalOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                {quarantineTest?.isQuarantined ? 'Remove from Quarantine' : 'Quarantine Test'}
              </ModalHeader>
              <ModalBody>
                {quarantineTest && (
                  <div>
                    <p className="mb-4">
                      <strong>Test:</strong> {quarantineTest.title}
                    </p>
                    {!quarantineTest.isQuarantined && (
                      <Textarea
                        label="Quarantine Reason"
                        placeholder="Enter reason for quarantine..."
                        value={quarantineReason}
                        onChange={(e) => setQuarantineReason(e.target.value)}
                        isRequired
                        minRows={3}
                      />
                    )}
                    {quarantineTest.isQuarantined && quarantineTest.quarantineReason && (
                      <div className="bg-content2 p-3 rounded-lg">
                        <p className="text-sm font-semibold mb-1">Current Reason:</p>
                        <p className="text-sm">{quarantineTest.quarantineReason}</p>
                      </div>
                    )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button
                  color="default"
                  variant="light"
                  onPress={onClose}
                  isDisabled={isUpdateQuarantinePending}
                >
                  Cancel
                </Button>
                <Button
                  color={quarantineTest?.isQuarantined ? 'success' : 'danger'}
                  onPress={handleQuarantineSubmit}
                  isLoading={isUpdateQuarantinePending}
                >
                  {quarantineTest?.isQuarantined ? 'Remove Quarantine' : 'Quarantine Test'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
