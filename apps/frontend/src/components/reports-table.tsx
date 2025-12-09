'use client';

import {
  Button,
  Chip,
  LinkIcon,
  Pagination,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import type { ReadReportsHistory, ReportHistory } from '@playwright-reports/shared';
import { keepPreviousData } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import useQuery from '../hooks/useQuery';
import { defaultProjectName } from '../lib/constants';
import { withQueryParams } from '../lib/network';
import { withBase } from '../lib/url';
import FormattedDate from './date-format';
import DeleteReportButton from './delete-report-button';
import { BranchIcon, FolderIcon } from './icons';
import InlineStatsCircle from './inline-stats-circle';
import TablePaginationOptions from './table-pagination-options';

const columns = [
  { name: 'Title', uid: 'title' },
  { name: 'Project', uid: 'project' },
  { name: 'Pass Rate', uid: 'passRate' },
  { name: 'Created at', uid: 'createdAt' },
  { name: 'Size', uid: 'size' },
  { name: '', uid: 'actions' },
];

const coreFields = [
  'reportID',
  'title',
  'displayNumber',
  'project',
  'createdAt',
  'size',
  'sizeBytes',
  'options',
  'reportUrl',
  'metadata',
  'startTime',
  'duration',
  'files',
  'projectNames',
  'stats',
  'errors',
  'playwrightVersion',
];

const getMetadataItems = (item: ReportHistory) => {
  const metadata: Array<{ key: string; value: any; icon?: React.ReactNode }> = [];

  // Cast to any to access dynamic properties that come from resultDetails
  const itemWithMetadata = item as any;

  // Add specific fields in preferred order
  if (itemWithMetadata.environment) {
    metadata.push({ key: 'environment', value: itemWithMetadata.environment });
  }
  if (itemWithMetadata.workingDir) {
    const dirName = itemWithMetadata.workingDir.split('/').pop() || itemWithMetadata.workingDir;

    metadata.push({ key: 'workingDir', value: dirName, icon: <FolderIcon /> });
  }
  if (itemWithMetadata.branch) {
    metadata.push({
      key: 'branch',
      value: itemWithMetadata.branch,
      icon: <BranchIcon />,
    });
  }

  if (itemWithMetadata.playwrightVersion) {
    metadata.push({
      key: 'playwright',
      value: itemWithMetadata.playwrightVersion,
    });
  }

  metadata.push({
    key: 'workers',
    value: itemWithMetadata.metadata?.actualWorkers,
  });

  // Add any other metadata fields
  Object.entries(itemWithMetadata).forEach(([key, value]) => {
    if (!coreFields.includes(key) && !['environment', 'workingDir', 'branch'].includes(key)) {
      metadata.push({ key, value });
    }
  });

  return metadata;
};

interface ReportsTableProps {
  onChange: () => void;
}

export default function ReportsTable({ onChange }: Readonly<ReportsTableProps>) {
  const reportListEndpoint = '/api/report/list';
  const [project, setProject] = useState(defaultProjectName);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const getQueryParams = () => ({
    limit: rowsPerPage.toString(),
    offset: ((page - 1) * rowsPerPage).toString(),
    project,
    ...(search.trim() && { search: search.trim() }),
  });

  const {
    data: reportResponse,
    isFetching,
    isPending,
    error,
    refetch,
  } = useQuery<ReadReportsHistory>(withQueryParams(reportListEndpoint, getQueryParams()), {
    dependencies: [project, search, rowsPerPage, page],
    placeholderData: keepPreviousData,
  });

  const { reports } = reportResponse ?? {};
  const total = reportResponse?.pagination?.total || reportResponse?.total || 0;

  const onDeleted = () => {
    onChange?.();
    refetch();
  };

  const onPageChange = useCallback((page: number) => {
    setPage(page);
  }, []);

  const onProjectChange = useCallback((project: string) => {
    setProject(project);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((searchTerm: string) => {
    setSearch(searchTerm);
    setPage(1);
  }, []);

  const pages = useMemo(() => {
    return total ? Math.ceil(total / rowsPerPage) : 0;
  }, [total, rowsPerPage]);

  error && toast.error(error.message);

  return (
    <>
      <TablePaginationOptions
        entity="report"
        rowsPerPage={rowsPerPage}
        setPage={setPage}
        setRowsPerPage={setRowsPerPage}
        total={total}
        onProjectChange={onProjectChange}
        onSearchChange={onSearchChange}
      />
      <Table
        aria-label="Reports"
        bottomContent={
          pages > 1 ? (
            <div className="flex w-full justify-center">
              <Pagination
                isCompact
                showControls
                showShadow
                color="primary"
                page={page}
                total={pages}
                onChange={onPageChange}
              />
            </div>
          ) : null
        }
        classNames={{
          wrapper: 'p-0 border-none shadow-none',
          tr: 'border-b-1 rounded-0',
        }}
        radius="none"
      >
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn
              key={column.uid}
              className="px-3 py-6 text-md text-black dark:text-white font-medium"
            >
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          emptyContent="No reports."
          isLoading={isFetching || isPending}
          items={reports ?? []}
          loadingContent={<Spinner />}
        >
          {(item) => (
            <TableRow key={item.reportID}>
              <TableCell className="w-1/3">
                <div className="flex flex-col">
                  <Link to={withBase(`/report/${item.reportID}`)}>
                    <div className="flex flex-row items-center">
                      {item.title ??
                        (item.displayNumber ? `#${item.displayNumber}` : item.reportID)}
                      <LinkIcon />
                    </div>
                  </Link>

                  <div className="flex flex-wrap gap-1 mt-1">
                    {getMetadataItems(item).map(({ key, value, icon }) => (
                      <Chip
                        key={`${item.reportID}-${key}`}
                        className="text-xs h-5"
                        color="default"
                        size="sm"
                        startContent={icon}
                        title={`${key}: ${value}`}
                        variant="flat"
                      >
                        <span className="max-w-[150px] truncate">
                          {key === 'branch' || key === 'workingDir' ? value : `${key}: ${value}`}
                        </span>
                      </Chip>
                    ))}
                  </div>
                </div>
              </TableCell>
              <TableCell className="w-1/6">{item.project}</TableCell>
              <TableCell className="w-1/12">
                {
                  <InlineStatsCircle
                    stats={
                      item.stats || {
                        total: 0,
                        expected: 0,
                        unexpected: 0,
                        flaky: 0,
                        skipped: 0,
                        ok: false,
                      }
                    }
                  />
                }
              </TableCell>
              <TableCell className="w-1/6">
                <FormattedDate date={item.createdAt} />
              </TableCell>
              <TableCell className="w-1/12">{item.size}</TableCell>
              <TableCell className="w-1/6">
                <div className="flex gap-4 justify-end">
                  <Link to={withBase(item.reportUrl)} target="_blank">
                    <Button color="primary" size="md">
                      Open report
                    </Button>
                  </Link>
                  <DeleteReportButton reportId={item.reportID} onDeleted={onDeleted} />
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
