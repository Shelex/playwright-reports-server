export interface ParsedTestUrl {
  reportId: string;
  testId?: string;
  projectId?: string;
  isPlaywrightReport: boolean;
  isTestPage: boolean;
}

export function extractTestIdFromUrl(url: string): string | undefined {
  try {
    // handle relative url, need to prepend with a base to work with URL
    const urlObj = new URL(url, 'http://localhost:3001');

    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.slice(1));
      const testId = hashParams.get('testId');
      if (testId) {
        return testId;
      }
    }

    const testId = urlObj.searchParams.get('testId');
    if (testId) {
      return testId;
    }

    return;
  } catch {
    return;
  }
}

export function extractReportIdFromPath(filePath: string): string | undefined {
  const pathParts = filePath.split('/');
  const index = pathParts.indexOf('index.html');

  if (index > 0) {
    return pathParts[index - 1];
  }

  return undefined;
}

export function extractProjectFromPath(filePath: string): string | undefined {
  const pathParts = filePath.split('/');
  const index = pathParts.indexOf('index.html');

  if (index > 1) {
    return pathParts[index - 2];
  }

  return undefined;
}

export function parsePlaywrightTestUrl(url: string, filePath: string): ParsedTestUrl {
  const reportId = extractReportIdFromPath(filePath);
  const testId = extractTestIdFromUrl(url);
  const projectId = extractProjectFromPath(filePath);

  return {
    reportId: reportId || '',
    testId,
    projectId,
    isPlaywrightReport: filePath.includes('/index.html') && !!reportId,
    isTestPage: !!testId && !!reportId,
  };
}

/**
 * Check if a file path represents a Playwright report index.html
 */
export function isPlaywrightReport(filePath: string): boolean {
  return filePath.includes('/index.html') && extractReportIdFromPath(filePath) !== undefined;
}

/**
 * Check if a URL represents a Playwright test page with testId
 */
export function isPlaywrightTestPage(url: string, filePath: string): boolean {
  console.log(`[url-parser] Checking if Playwright test page: url=${url}, filePath=${filePath}`);

  const parsed = parsePlaywrightTestUrl(url, filePath);
  console.log(`[url-parser] Parsed result:`, parsed);

  const result = parsed.isPlaywrightReport && parsed.isTestPage;
  console.log(
    `[url-parser] isPlaywrightReport=${parsed.isPlaywrightReport}, isTestPage=${parsed.isTestPage}, result=${result}`
  );

  return result;
}

/**
 * Generate analysis prompt for a specific test based on historical data
 */
export function generateTestAnalysisPrompt(
  testId: string,
  testName: string,
  failureMessage: string,
  stackTrace?: string,
  historicalData?: {
    passRate: number;
    totalRuns: number;
    recentFailures: Array<{
      date: string;
      error: string;
    }>;
    flakyPattern: boolean;
  }
): string {
  let prompt = `Please analyze this test failure for me:\n\n`;

  prompt += `**Test Details:**\n`;
  prompt += `- Test ID: ${testId}\n`;
  prompt += `- Test Name: ${testName}\n`;
  prompt += `- Failure Message: ${failureMessage}\n`;

  if (stackTrace) {
    prompt += `- Stack Trace: ${stackTrace}\n`;
  }

  if (historicalData) {
    prompt += `\n**Historical Context:**\n`;
    prompt += `- Pass Rate: ${historicalData.passRate.toFixed(1)}%\n`;
    prompt += `- Total Runs: ${historicalData.totalRuns}\n`;

    if (historicalData.flakyPattern) {
      prompt += `- Pattern: This test appears to be flaky (intermittent failures)\n`;
    }

    if (historicalData.recentFailures.length > 0) {
      prompt += `- Recent Failures: ${historicalData.recentFailures.length}\n`;
      historicalData.recentFailures.forEach((failure, index) => {
        prompt += `  ${index + 1}. ${failure.date}: ${failure.error}\n`;
      });
    }
  }

  prompt += `\n**Please provide:**\n`;
  prompt += `1. **Root Cause Analysis**: What's the most likely cause of this failure?\n`;
  prompt += `2. **Debugging Steps**: What should I investigate first?\n`;
  prompt += `3. **Code Fix Suggestions**: Specific code changes that might resolve this issue\n`;
  prompt += `4. **Prevention Strategy**: How to prevent similar failures in the future\n`;

  if (historicalData?.flakyPattern) {
    prompt += `5. **Flaky Test Analysis**: Why is this test intermittent and how to make it more stable\n`;
  }

  return prompt;
}
