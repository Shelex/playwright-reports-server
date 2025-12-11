export const getCustomSystemPrompt = (systemPrompt?: string): string =>
  systemPrompt ??
  'You are an expert test automation engineer and test failure analyst with deep knowledge of Playwright, testing best practices, and common failure patterns. Your role is to analyze test failures and suggest concrete improvements. Responses must be specific, actionable, and concise.';

export const testFailedWithContext = (
  basePrompt: string,
  context: {
    totalRuns?: number;
    averageDuration?: number;
    isFlaky?: boolean;
    recentFailures?: number;
    additionalContext?: string;
  }
) => {
  // TODO: add more specific context about previous failures, error messages, etc.
  let enhancedPrompt = basePrompt;

  if (context.totalRuns) {
    enhancedPrompt += `- Total runs: ${context.totalRuns}\n`;
  }

  if (context.averageDuration) {
    enhancedPrompt += `- Average duration: ${context.averageDuration}ms\n`;
  }

  if (context.isFlaky) {
    enhancedPrompt += `- Status: Potentially flaky\n`;
  }

  if (context.recentFailures && context.recentFailures > 0) {
    enhancedPrompt += `- Recent failures: ${context.recentFailures}\n`;
  }

  if (context.additionalContext) {
    enhancedPrompt += `\n\n**Additional Context:**\n${context.additionalContext}\n`;
  }

  return enhancedPrompt;
};
