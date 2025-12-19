export interface LLMConfig {
  enabled: boolean;
  provider: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface LLMProvider {
  sendMessage(prompt: string): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
  }>;
  validateConfig(): Promise<boolean>;
  getAvailableModels(): Promise<string[]>;
}

export interface OverviewStats {
  totalTests: number;
  passRate: number;
  flakyTests: number;
  averageStepDuration: number;
  slowestSteps: Array<{ step: string; duration: number; testId: string }>;
  testExecutionTime: number;
  passRateTrend: 'up' | 'down' | 'stable';
  flakyTestsTrend: 'up' | 'down' | 'stable';
}

export interface RunHealthMetric {
  runId: string;
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  flaky: number;
  duration: number;
}

export interface TrendMetrics {
  durationTrend: Array<{ date: string; duration: number }>;
  flakyCountTrend: Array<{ date: string; count: number }>;
  slowCountTrend: Array<{ date: string; count: number }>;
}

export interface PerTestMetric {
  testId: string;
  testName: string;
  passRate: number;
  isFlaky: boolean;
  recentRuns: Array<{ date: string; passed: boolean }>;
  avgDuration: number;
  file: string;
  line: number;
  latestReportId: string;
}

export interface StepTimingTrend {
  stepId: string;
  stepName: string;
  runs: Array<{
    runId: string;
    runDate: Date;
    duration: number;
    isOutlier: boolean;
  }>;
  statistics: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
}

export interface AnalyticsData {
  overviewStats: OverviewStats;
  runHealthMetrics: RunHealthMetric[];
  trendMetrics: TrendMetrics;
  perTestMetrics: PerTestMetric[];
}
