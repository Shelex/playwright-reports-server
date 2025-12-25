import type {
  ReportFile,
  ReportInfo,
  ReportStats,
  ReportTest,
  TestRun,
} from '@playwright-reports/shared';

export function deepMergeReportInfo(
  existing: ReportInfo,
  updates: Partial<ReportInfo>
): ReportInfo {
  const result = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'files' && Array.isArray(value)) {
      result.files = mergeFilesArray(existing.files || [], value as ReportFile[]);
    } else if (key === 'metadata' && value && typeof value === 'object') {
      result.metadata = { ...existing.metadata, ...value };
    } else if (key === 'stats' && value && typeof value === 'object') {
      result.stats = { ...existing.stats, ...(value as ReportStats) };
    } else if (value !== undefined) {
      (result as any)[key] = value;
    }
  }

  return result;
}

function mergeFilesArray(existing: ReportFile[], updates: ReportFile[]): ReportFile[] {
  const fileMap = new Map<string, ReportFile>();

  existing.forEach((file) => {
    fileMap.set(file.fileId, { ...file });
  });

  updates.forEach((updateFile) => {
    const existingFile = fileMap.get(updateFile.fileId);

    if (existingFile) {
      fileMap.set(updateFile.fileId, mergeFileObjects(existingFile, updateFile));
    } else {
      fileMap.set(updateFile.fileId, { ...updateFile });
    }
  });

  return Array.from(fileMap.values());
}

function mergeFileObjects(existing: ReportFile, update: Partial<ReportFile>): ReportFile {
  const result = { ...existing };

  for (const [key, value] of Object.entries(update)) {
    if (key === 'tests' && Array.isArray(value)) {
      result.tests = mergeTestsArray(existing.tests || [], value);
    } else if (key === 'stats' && value && typeof value === 'object') {
      result.stats = { ...existing.stats, ...(value as ReportStats) };
    } else if (value !== undefined) {
      (result as any)[key] = value;
    }
  }

  return result;
}

function mergeTestsArray(existing: ReportTest[], updates: ReportTest[]): ReportTest[] {
  const testMap = new Map<string, ReportTest>();

  existing.forEach((test) => {
    testMap.set(test.testId, { ...test });
  });

  updates.forEach((updateTest) => {
    const existingTest = testMap.get(updateTest.testId);

    if (existingTest) {
      const mergedTest = { ...existingTest, ...updateTest };
      testMap.set(updateTest.testId, mergedTest);
    } else {
      testMap.set(updateTest.testId, { ...updateTest });
    }
  });

  return Array.from(testMap.values());
}

export function createTestUpdate(
  fileId: string,
  testId: string,
  testUpdates: Partial<ReportTest>
): Partial<ReportInfo> {
  return {
    files: [
      {
        fileId,
        name: '',
        fileName: '',
        path: '',
        stats: {
          total: 0,
          ok: true,
        },
        tests: [
          {
            testId,
            title: '',
            duration: 0,
            outcome: 'passed' as const,
            ok: true,
            ...testUpdates,
          },
        ],
      } as ReportFile,
    ],
  };
}

interface ExtendedReportFile extends Omit<ReportFile, 'stats'> {
  stats?: Partial<ReportStats>;
}

export function createFileUpdate(
  fileId: string,
  fileUpdates: Partial<ExtendedReportFile>
): Partial<ReportInfo> {
  return {
    files: [
      {
        fileId,
        name: '',
        fileName: '',
        path: '',
        stats: {
          total: 0,
          ok: true,
          ...fileUpdates.stats,
        },
        ...fileUpdates,
      } as ReportFile,
    ],
  };
}

export function convertTestRunToReportInfoUpdate(testRun: TestRun): Partial<ReportInfo> {
  return {
    files: [
      {
        fileId: testRun.fileId,
        name: '',
        fileName: '',
        path: '',
        stats: {
          total: 0,
          ok: true,
        },
        tests: [
          {
            testId: testRun.testId,
            title: '',
            duration: testRun.duration || 0,
            outcome: testRun.outcome as ReportTest['outcome'],
            ok: testRun.outcome === 'passed' || testRun.outcome === 'skipped',
            flakinessScore: testRun.flakinessScore,
            quarantined: testRun.quarantined,
            quarantineReason: testRun.quarantineReason,
            createdAt: testRun.createdAt,
          },
        ],
      } as ReportFile,
    ],
  };
}
