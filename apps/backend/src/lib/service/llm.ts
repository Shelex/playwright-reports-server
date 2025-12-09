import type { LLMConfig, LLMProvider } from '@playwright-reports/shared';
import { withError } from '../withError.js';

export class OpenAIProvider implements LLMProvider {
  private readonly config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async sendMessage(prompt: string): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
  }> {
    const { result, error } = await withError(
      fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        }),
      })
    );

    if (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }

    if (!result?.ok) {
      throw new Error(`OpenAI API error: ${result?.status} ${result?.statusText}`);
    }

    const response = (await result.json()) as any;

    return {
      content: response.choices?.[0]?.message?.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      model: response.model || this.config.model,
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.log(
        `[llm] validation failed for ${this.config.provider}:`,
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as any;
      return data.data?.map((model: any) => model.id) || [];
    } catch {
      // fallback to returning the configured model if available
      return this.config.model ? [this.config.model] : [];
    }
  }
}

export class AnthropicProvider implements LLMProvider {
  private readonly config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async sendMessage(prompt: string): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
  }> {
    const { result, error } = await withError(
      fetch(`${this.config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system:
            'You are an expert test automation engineer and test failure analyst with deep knowledge of Playwright, testing best practices, and common failure patterns. Your role is to analyze test failures and suggest concrete improvements. Responses must be specific, actionable, and concise.',
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    );

    if (error) {
      throw new Error(`Anthropic API error: ${error.message}`);
    }

    if (!result?.ok) {
      throw new Error(`Anthropic API error: ${result?.status} ${result?.statusText}`);
    }

    const response = (await result.json()) as any;

    return {
      content: response.content?.[0]?.text || '',
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
      model: response.model || this.config.model,
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          'x-api-key': this.config.apiKey,
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.log(
        `[llm] validation failed for ${this.config.provider}:`,
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'x-api-key': this.config.apiKey,
        },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as any;
      return data.data?.map((model: any) => model.id) || [];
    } catch {
      // fallback to returning the configured model if available
      return this.config.model ? [this.config.model] : [];
    }
  }
}

export class ZAIProvider implements LLMProvider {
  private readonly config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async sendMessage(prompt: string): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
  }> {
    let modelToUse = this.config.model;
    if (!modelToUse) {
      const availableModels = await this.getAvailableModels();
      if (availableModels.length === 0) {
        throw new Error('No model configured and no available models found from Z.AI API');
      }
      modelToUse = availableModels[0];
    }

    const requestBody = {
      model: modelToUse,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert test automation engineer and test failure analyst with deep knowledge of Playwright, testing best practices, and common failure patterns. Your role is to analyze test failures and suggest concrete improvements. Responses must be specific, actionable, and concise.',
        },
        { role: 'user', content: prompt },
      ],
    };

    const { result, error } = await withError(
      fetch(`${this.config.baseUrl}/api/paas/v4/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })
    );

    if (error) {
      throw new Error(`Z.AI API error: ${error.message}`);
    }

    if (!result?.ok) {
      const responseText = await result?.text();
      throw new Error(`Z.AI API error: ${result?.status} ${result?.statusText} - ${responseText}`);
    }

    const response = (await result.json()) as any;

    if (!response.choices || response.choices.length === 0) {
      throw new Error(`Z.AI API error: No choices returned in response`);
    }

    const choice = response.choices[0];
    const content = choice.message?.reasoning_content || choice.message?.content || '';

    return {
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      model: response.model || modelToUse,
    };
  }

  async validateConfig(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/paas/v4/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.error(`[Z.AI] validation failed:`, error instanceof Error ? error.message : error);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/paas/v4/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as any;
      return data.data?.map((model: any) => model.id) || [];
    } catch {
      // fallback to returning the configured model if available
      return this.config.model ? [this.config.model] : [];
    }
  }
}

export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'zai':
      return new ZAIProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

export function generateFailureAnalysisPrompt(testData: {
  testName: string;
  steps: any[];
  failedStep: any;
  errorMessage: string;
  recentHistory: Array<{ date: string; passed: boolean }>;
  averageStepDuration: number;
  actualStepDuration: number;
}): string {
  return `
Analyze this failing test and suggest root causes:

Test: ${testData.testName}
Failed at step: ${testData.failedStep.title}
Error: ${testData.errorMessage}

Step details:
${testData.failedStep.actions?.map((a: any) => `- ${a.action}: ${a.selector || 'N/A'}`).join('\n') || 'No step actions available'}

Historical data (last 10 runs):
${testData.recentHistory.map((r) => `${r.date}: ${r.passed ? '✓ PASS' : '✗ FAIL'}`).join('\n')}

Performance:
- Expected duration: ${testData.averageStepDuration}ms
- Actual duration: ${testData.actualStepDuration}ms
- Variance: ${((testData.actualStepDuration / testData.averageStepDuration - 1) * 100).toFixed(0)}%

Provide:
1. Most likely root cause (consider flakiness pattern, timing issues, selector changes, environment state)
2. Specific debugging steps
3. Code fix recommendation (if applicable)
4. Prevention strategy for similar issues
`;
}

export function generatePerformanceAnalysisPrompt(testData: {
  testName: string;
  stepTimings: Array<{ step: string; duration: number; percentile: number }>;
  historicalTrend: Array<{ date: string; duration: number }>;
  threshold: number;
}): string {
  return `
Analyze performance regression in this test:

Test: ${testData.testName}
Current slowest steps:
${testData.stepTimings
  .sort((a, b) => b.duration - a.duration)
  .slice(0, 5)
  .map((s) => `- ${s.step}: ${s.duration}ms (${s.percentile}th percentile)`)
  .join('\n')}

7-day trend: ${testData.historicalTrend.map((t) => `${t.date}: ${t.duration}ms`).join(', ')}
Performance regression threshold: ${testData.threshold}ms

Identify:
1. Which steps are bottlenecks?
2. Is degradation consistent or intermittent?
3. What might have changed recently (code, infrastructure, resources)?
4. Optimization recommendations (waits, selectors, parallelization)
`;
}
