import type {
  AnalyticsData,
  OverviewStats,
  PerTestMetric,
  RunHealthMetric,
  StepTimingTrend,
  TrendMetrics,
} from '@playwright-reports/shared';
import { type ReportFile, type ReportTest, ReportTestOutcome } from '../parser/types.js';
import type { ReportHistory as BackendReportHistory } from '../storage/types.js';
import { reportDb } from './db/reports.sqlite.js';

export class AnalyticsService {
  async getAnalyticsData(project?: string): Promise<AnalyticsData> {
    const reports = await this.getRecentReports(project);

    return {
      overviewStats: await this.calculateOverviewStats(reports),
      runHealthMetrics: await this.calculateRunHealthMetrics(reports),
      trendMetrics: await this.calculateTrendMetrics(reports),
      perTestMetrics: await this.calculatePerTestMetrics(reports),
    };
  }

  private async getRecentReports(project?: string): Promise<BackendReportHistory[]> {
    if (project) {
      return reportDb.getByProject(project);
    }
    return reportDb.getAll();
  }

  private async calculateOverviewStats(reports: BackendReportHistory[]): Promise<OverviewStats> {
    const recentReports = reports.slice(0, 30); // Last 30 runs
    const olderReports = reports.slice(30, 60); // Previous 30 runs for comparison

    const totalTests = recentReports.reduce((sum, report) => sum + (report.stats?.total || 0), 0);

    const totalPassed = recentReports.reduce(
      (sum, report) => sum + (report.stats?.expected || 0),
      0
    );
    const passRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    const flakyTests = await this.identifyFlakyTests(recentReports);

    const stepDurations = await this.extractStepDurations(recentReports);
    const averageStepDuration =
      stepDurations.length > 0
        ? stepDurations.reduce((sum, duration) => sum + duration, 0) / stepDurations.length
        : 0;

    const slowestSteps = await this.findSlowestSteps(recentReports, 10);

    const testExecutionTime = recentReports.reduce(
      (sum, report) => sum + (report.duration || 0),
      0
    );

    const currentPassRate = passRate;
    const olderPassRate = await this.calculatePreviousPassRate(olderReports);
    const currentFlakyCount = flakyTests.length;
    const olderFlakyCount = await this.calculatePreviousFlakyCount(olderReports);

    const passRateTrend = this.calculateTrend(currentPassRate, olderPassRate, 2); // 2% threshold
    const flakyTestsTrend = this.calculateTrend(currentFlakyCount, olderFlakyCount, 1); // 1 test threshold

    return {
      totalTests,
      passRate: Math.round(passRate * 100) / 100,
      flakyTests: flakyTests.length,
      averageStepDuration: Math.round(averageStepDuration),
      slowestSteps,
      testExecutionTime,
      passRateTrend,
      flakyTestsTrend,
    };
  }

  private async calculateRunHealthMetrics(
    reports: BackendReportHistory[]
  ): Promise<RunHealthMetric[]> {
    return reports.slice(0, 20).map((report) => {
      const stats = report.stats;
      const totalTests = stats?.total || 0;
      const passed = stats?.expected || 0;
      const failed = stats?.unexpected || 0;
      const flaky = stats?.flaky || 0;

      return {
        runId: report.reportID,
        timestamp: new Date(report.createdAt),
        totalTests,
        passed,
        failed,
        flaky,
        duration: report.duration || 0,
      };
    });
  }

  private async calculateTrendMetrics(reports: BackendReportHistory[]): Promise<TrendMetrics> {
    const recentReports = reports.slice(0, 30);

    const durationTrend = recentReports.map((report) => ({
      date: new Date(report.createdAt).toISOString(),
      duration: report.duration || 0,
    }));

    const flakyCounts = await Promise.all(
      recentReports.map(async (report) => ({
        date: new Date(report.createdAt).toISOString(),
        count: report.stats?.flaky || 0,
      }))
    );

    const slowThreshold = await this.calculateSlowThreshold(recentReports);
    const slowCounts = await Promise.all(
      recentReports.map(async (report) => {
        const slowCount = await this.countSlowTests(report, slowThreshold);
        return {
          date: new Date(report.createdAt).toISOString(),
          count: slowCount,
        };
      })
    );

    return {
      durationTrend,
      flakyCountTrend: flakyCounts,
      slowCountTrend: slowCounts,
    };
  }

  private async calculatePerTestMetrics(reports: BackendReportHistory[]): Promise<PerTestMetric[]> {
    const testMetrics = new Map<string, PerTestMetric>();

    for (const report of reports.slice(0, 30)) {
      if (!report.files) continue;

      for (const file of report.files) {
        if (!file.tests) continue;

        for (const test of file.tests) {
          const testId = test.testId || `${file.fileName}:${test.title}`;
          const existing = testMetrics.get(testId) || {
            testId,
            testName: test.title || 'Unknown Test',
            passRate: 0,
            isFlaky: false,
            recentRuns: [],
            avgDuration: 0,
            file: test.location?.file || file.fileName || 'unknown',
            line: test.location?.line || 0,
            latestReportId: report.reportID,
          };

          existing.latestReportId = report.reportID;

          const newRun = {
            date: new Date(report.createdAt).toISOString(),
            passed: test.outcome === ReportTestOutcome.Expected,
          };
          (existing.recentRuns as Array<{ date: string; passed: boolean }>).unshift(newRun);

          existing.recentRuns = existing.recentRuns.slice(0, 30);

          if (test.duration) {
            existing.avgDuration =
              existing.recentRuns.reduce((sum: number, run: any, index: number) => {
                const duration = index === 0 ? test.duration : existing.avgDuration;
                return sum + duration;
              }, 0) / existing.recentRuns.length;
          }

          testMetrics.set(testId, existing);
        }
      }
    }

    const result: PerTestMetric[] = [];
    for (const [testId, metric] of testMetrics.entries()) {
      const passedCount = metric.recentRuns.filter((run) => run.passed).length;
      const totalCount = metric.recentRuns.length;

      if (totalCount > 0) {
        metric.passRate = (passedCount / totalCount) * 100;
        // flaky if it fails in 20-80% of runs and has at least 5 runs
        metric.isFlaky = totalCount >= 5 && metric.passRate >= 20 && metric.passRate <= 80;

        result.push(metric);
      }
    }

    return result.sort((a, b) => b.passRate - a.passRate);
  }

  private async identifyFlakyTests(reports: BackendReportHistory[]): Promise<string[]> {
    const testResults = new Map<string, { passed: number; failed: number }>();

    for (const report of reports) {
      if (!report.files) continue;

      for (const file of report.files) {
        if (!file.tests) continue;

        for (const test of file.tests) {
          const testId = test.testId || `${file.fileName}:${test.title}`;
          const results = testResults.get(testId) || { passed: 0, failed: 0 };

          const isPassed = test.outcome === ReportTestOutcome.Expected;
          if (isPassed) {
            results.passed++;
          } else {
            results.failed++;
          }

          testResults.set(testId, results);
        }
      }
    }

    return Array.from(testResults.entries())
      .filter(([_, results]) => {
        const total = results.passed + results.failed;
        const failRate = total > 0 ? results.failed / total : 0;
        return total >= 5 && failRate > 0 && failRate <= 0.8;
      })
      .map(([testId]) => testId);
  }

  private async extractStepDurations(reports: BackendReportHistory[]): Promise<number[]> {
    const durations: number[] = [];

    for (const report of reports) {
      if (!report.files) continue;

      for (const file of report.files) {
        if (!file.tests) continue;

        for (const test of file.tests) {
          if (test.duration) {
            durations.push(test.duration);
          }
        }
      }
    }

    return durations;
  }

  private async findSlowestSteps(
    reports: BackendReportHistory[],
    limit: number
  ): Promise<Array<{ step: string; duration: number; testId: string }>> {
    const steps: Array<{ step: string; duration: number; testId: string }> = [];

    for (const report of reports) {
      if (!report.files) continue;

      for (const file of report.files) {
        if (!file.tests) continue;

        for (const test of file.tests) {
          if (test.duration && test.title) {
            steps.push({
              step: test.title,
              duration: test.duration,
              testId: test.testId || file.fileName || 'unknown',
            });
          }
        }
      }
    }

    return steps.sort((a, b) => b.duration - a.duration).slice(0, limit);
  }

  private async calculatePreviousPassRate(reports: BackendReportHistory[]): Promise<number> {
    if (reports.length === 0) return 0;

    const totalTests = reports.reduce((sum, report) => sum + (report.stats?.total || 0), 0);
    const totalPassed = reports.reduce((sum, report) => sum + (report.stats?.expected || 0), 0);

    return totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
  }

  private async calculatePreviousFlakyCount(reports: BackendReportHistory[]): Promise<number> {
    const flakyTests = await this.identifyFlakyTests(reports);
    return flakyTests.length;
  }

  private calculateTrend(
    current: number,
    previous: number,
    threshold: number
  ): 'up' | 'down' | 'stable' {
    const difference = current - previous;
    const percentChange = previous > 0 ? (difference / previous) * 100 : 0;

    if (Math.abs(percentChange) < threshold || Math.abs(difference) < threshold) {
      return 'stable';
    }
    return percentChange > 0 ? 'up' : 'down';
  }

  private async calculateSlowThreshold(reports: BackendReportHistory[]): Promise<number> {
    const durations = await this.extractStepDurations(reports);
    if (durations.length === 0) return 1000; // Default 1 second

    durations.sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    return durations[p95Index] || 1000;
  }

  private async countSlowTests(report: BackendReportHistory, threshold: number): Promise<number> {
    if (!report.files) return 0;

    let count = 0;
    for (const file of report.files) {
      if (!file.tests) continue;

      for (const test of file.tests) {
        if (test.duration && test.duration > threshold) {
          count++;
        }
      }
    }

    return count;
  }

  async getAnalyticsForReport(reportId: string): Promise<AnalyticsData> {
    const report = await this.getReportById(reportId);
    if (!report) {
      throw new Error(`Report with ID ${reportId} not found`);
    }

    const reports = [report];
    const allReports = await this.getRecentReports();

    return {
      overviewStats: await this.calculateOverviewStatsForSingleReport(report),
      runHealthMetrics: await this.calculateRunHealthMetrics(reports),
      trendMetrics: await this.calculateTrendMetricsForSingleReport(report, allReports),
      perTestMetrics: await this.calculatePerTestMetricsForSingleReport(report),
    };
  }

  async getTestTrends(reportId: string, testId: string): Promise<StepTimingTrend | null> {
    const allReports = await this.getRecentReports();
    const testReports = allReports.filter((report: BackendReportHistory) => {
      const hasMatchingTest = report.files?.some((file: ReportFile) =>
        file.tests?.some((test: ReportTest) => {
          const currentTestId = test.testId || `${file.fileName}:${test.title}`;
          const matches = currentTestId === testId;
          return matches;
        })
      );
      return hasMatchingTest;
    });

    if (!testReports.length) {
      console.log(`[analytics] No historical data found for testId: ${testId}`);
      return null;
    }

    const runs: Array<{ runId: string; runDate: Date; duration: number; isOutlier: boolean }> = [];
    const durations: number[] = [];

    for (const report of testReports) {
      for (const file of report.files || []) {
        for (const test of file.tests || []) {
          const currentTestId = test.testId || `${file.fileName}:${test.title}`;

          if (currentTestId === testId && test.duration) {
            durations.push(test.duration);
            runs.push({
              runId: report.reportID,
              runDate: new Date(report.createdAt),
              duration: test.duration,
              isOutlier: false, // to be determined
            });
          }
        }
      }
    }

    if (durations.length === 0) {
      return null;
    }

    durations.sort((a, b) => a - b);
    const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const median =
      durations.length % 2 === 0
        ? (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
        : durations[Math.floor(durations.length / 2)];

    const variance = durations.reduce((sum, d) => sum + (d - mean) ** 2, 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    // define outliers
    for (const run of runs) {
      run.isOutlier = Math.abs(run.duration - mean) > 2 * stdDev;
    }

    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    let testName = 'Unknown Test';
    for (const report of testReports) {
      for (const file of report.files || []) {
        for (const test of file.tests || []) {
          const currentTestId = test.testId || `${file.fileName}:${test.title}`;
          if (currentTestId === testId && test.title) {
            testName = test.title;
            break;
          }
        }
        if (testName !== 'Unknown Test') break;
      }
      if (testName !== 'Unknown Test') break;
    }

    return {
      stepId: testId,
      stepName: testName,
      runs: runs.sort((a, b) => a.runDate.getTime() - b.runDate.getTime()),
      statistics: {
        mean: Math.round(mean),
        median: Math.round(median),
        stdDev: Math.round(stdDev),
        min: Math.min(...durations),
        max: Math.max(...durations),
        p95: durations[p95Index] || 0,
        p99: durations[p99Index] || 0,
      },
    };
  }

  private async getReportById(reportId: string): Promise<BackendReportHistory | undefined> {
    try {
      return reportDb.getByID(reportId);
    } catch (error) {
      console.error(`Failed to get report ${reportId}:`, error);
      return undefined;
    }
  }

  private async calculateOverviewStatsForSingleReport(
    report: BackendReportHistory
  ): Promise<OverviewStats> {
    const stats = report.stats;
    const totalTests = stats?.total || 0;
    const passed = stats?.expected || 0;
    const passRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    const flakyTests = stats?.flaky || 0;

    const stepDurations = await this.extractStepDurations([report]);
    const averageStepDuration =
      stepDurations.length > 0
        ? stepDurations.reduce((sum, duration) => sum + duration, 0) / stepDurations.length
        : 0;

    const slowestSteps = await this.findSlowestSteps([report], 10);

    const testExecutionTime = report.duration || 0;

    return {
      totalTests,
      passRate: Math.round(passRate * 100) / 100,
      flakyTests,
      averageStepDuration: Math.round(averageStepDuration),
      slowestSteps,
      testExecutionTime,
      passRateTrend: 'stable',
      flakyTestsTrend: 'stable',
    };
  }

  private async calculateTrendMetricsForSingleReport(
    report: BackendReportHistory,
    allReports: BackendReportHistory[]
  ): Promise<TrendMetrics> {
    const reportDate = new Date(report.createdAt).toISOString();
    const durationTrend = [
      {
        date: reportDate,
        duration: report.duration || 0,
      },
    ];

    const flakyCountTrend = [
      {
        date: reportDate,
        count: report.stats?.flaky || 0,
      },
    ];

    const slowThreshold = await this.calculateSlowThreshold(allReports);
    const slowCount = await this.countSlowTests(report, slowThreshold);

    const slowCountTrend = [
      {
        date: reportDate,
        count: slowCount,
      },
    ];

    return {
      durationTrend,
      flakyCountTrend,
      slowCountTrend,
    };
  }

  private async calculatePerTestMetricsForSingleReport(
    report: BackendReportHistory
  ): Promise<PerTestMetric[]> {
    const testMetrics: PerTestMetric[] = [];

    if (!report.files) return testMetrics;

    for (const file of report.files) {
      if (!file.tests) continue;

      for (const test of file.tests) {
        const testId = test.testId || `${file.fileName}:${test.title}`;
        const passed = test.outcome === ReportTestOutcome.Expected;

        testMetrics.push({
          testId,
          testName: test.title || 'Unknown Test',
          passRate: passed ? 100 : 0,
          isFlaky: test.outcome === 'flaky',
          recentRuns: [
            {
              date: new Date(report.createdAt).toISOString(),
              passed,
            },
          ],
          avgDuration: test.duration || 0,
          file: test.location?.file || file.fileName || 'unknown',
          line: test.location?.line || 0,
          latestReportId: report.reportID,
        });
      }
    }

    return testMetrics.sort((a, b) => b.passRate - a.passRate);
  }
}

export const analyticsService = new AnalyticsService();
