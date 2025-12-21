import { ReportTestOutcomeEnum } from '@playwright-reports/shared';
import { env } from '../../config/env.js';
import { storage } from '../storage/index.js';
import type { ReportHistory } from '../storage/types.js';
import { convertTestRunToReportInfoUpdate } from '../storage/utils/deepMerge.js';
import { withError } from '../withError.js';
import type { Test, TestRun, TestWithQuarantineInfo } from './db/tests.sqlite.js';
import { testDb } from './db/tests.sqlite.js';

export class TestManagementService {
  async processReport(report: ReportHistory): Promise<void> {
    if (!report.files) return;

    const transaction = () => {
      for (const file of report.files!) {
        if (!file.tests) continue;

        for (const test of file.tests) {
          const testId = test.testId ?? '';
          const fileId = file.fileId ?? '';
          const filePath = file.fileName ?? 'unknown';

          testDb.createTest({
            testId,
            fileId,
            filePath,
            project: report.project,
            title: test.title || 'Unknown Test',
          });

          const latestTestRun = testDb.getLatestTestRun(testId, fileId, report.project);

          const testRun = {
            runId: undefined,
            testId,
            fileId,
            project: report.project,
            reportId: report.reportID,
            outcome: test.outcome || 'unknown',
            duration: test.duration,
            createdAt: new Date().toISOString(),
            quarantined: latestTestRun?.quarantined ?? false,
            quarantineReason: latestTestRun?.quarantineReason ?? '',
            flakinessScore: this.calculateFlakiness(testId, fileId, report.project),
          };

          if (
            env.TEST_FLAKINESS_AUTO_QUARANTINE === 'true' &&
            testRun.flakinessScore >= env.TEST_FLAKINESS_QUARANTINE_THRESHOLD
          ) {
            console.log(
              `[testManagement] Auto-quarantining testId=${testId} due to flakinessScore=${testRun.flakinessScore.toFixed(1)}%`
            );
            testRun.quarantined = true;
            testRun.quarantineReason = `Auto-quarantined due to ${testRun.flakinessScore.toFixed(1)}% flakiness over treshold ${env.TEST_FLAKINESS_QUARANTINE_THRESHOLD}%`;
          }

          testDb.createTestRun(testRun);
        }
      }
    };

    try {
      testDb.runTransaction(transaction);
    } catch (error) {
      console.error('[testManagement] Error processing report:', error);
      throw new Error(
        `Failed to process report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  calculateFlakiness(testId: string, fileId: string, project: string): number {
    const windowDays = env.TEST_FLAKINESS_EVALUATION_WINDOW_DAYS;
    const minRuns = env.TEST_FLAKINESS_MIN_RUNS;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowDays);

    const recentRuns = testDb.getRecentTestRunsForFlakiness(
      testId,
      fileId,
      project,
      cutoffDate.toISOString()
    );

    if (recentRuns.length < minRuns) return 0;

    const flakyOutcomes = recentRuns.filter(
      (r) => r.outcome === ReportTestOutcomeEnum.Flaky
    ).length;
    return (flakyOutcomes / recentRuns.length) * 100;
  }

  async updateQuarantineStatus(
    testId: string,
    fileId: string,
    project: string,
    isQuarantined: boolean,
    reason?: string
  ): Promise<void> {
    const latestRun = testDb.getLatestTestRun(testId, fileId, project);

    if (!latestRun) {
      throw new Error('No test run found for the specified test');
    }

    const updated = testDb.updateLatestTestRun(
      testId,
      fileId,
      project,
      isQuarantined,
      isQuarantined ? reason : undefined
    );

    if (!updated) {
      throw new Error('Failed to update test run quarantine status');
    }

    const updatedRun = testDb.getLatestTestRun(testId, fileId, project);

    if (!updatedRun) {
      throw new Error('Failed to retrieve updated test run');
    }

    const patchedMetadata = convertTestRunToReportInfoUpdate(updatedRun);
    const { error } = await withError(storage.updateMetadata(latestRun.reportId, patchedMetadata));
    if (error) {
      // optimistically revert update to sqlite
      testDb.updateLatestTestRun(
        testId,
        fileId,
        project,
        !isQuarantined, // reverse the input
        latestRun.quarantineReason // get back original value
      );
      throw new Error(`failed to update report metadata: ${error.message}`);
    }
  }

  async getTests(
    project?: string,
    options?: {
      status?: 'all' | 'quarantined' | 'not-quarantined';
      flakinessMin?: number;
      flakinessMax?: number;
    }
  ): Promise<TestWithQuarantineInfo[]> {
    let tests = testDb.getAllAndDerivedData(project);

    if (!options) {
      return tests;
    }

    const byStatusMaybe =
      options.status && options.status !== 'all'
        ? (test: TestWithQuarantineInfo) => {
            const shouldBeQuarantined = options.status === 'quarantined';
            return test.isQuarantined === shouldBeQuarantined;
          }
        : Boolean;

    tests = tests.filter(byStatusMaybe);

    const byFlakinessRangeMaybe =
      options.flakinessMin !== undefined || options.flakinessMax !== undefined
        ? (test: TestWithQuarantineInfo) => {
            const score = test.flakinessScore || 0;
            const min = Math.max(0, options.flakinessMin ?? 0);
            const max = Math.min(100, options.flakinessMax ?? 100);

            return score >= min && score <= max;
          }
        : Boolean;

    tests = tests.filter(byFlakinessRangeMaybe);

    return tests;
  }

  async getTest(
    testId: string,
    fileId: string,
    project: string
  ): Promise<(Test & { runs: TestRun[] }) | null> {
    const test = testDb.getTest(testId, fileId, project);
    if (!test) return null;

    const runs = testDb.getTestRuns(testId, fileId, project);

    return {
      ...test,
      runs,
    };
  }

  async getTestWithQuarantineInfo(
    testId: string,
    fileId: string,
    project: string
  ): Promise<TestWithQuarantineInfo | null> {
    return testDb.getTestWithDerivedData(testId, fileId, project) || null;
  }

  async deleteTest(testId: string, fileId: string, project: string): Promise<void> {
    testDb.deleteTest(testId, fileId, project);
    testDb.deleteTestRuns(testId, fileId, project);
  }
}

export const testManagementService = new TestManagementService();
