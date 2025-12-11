import type { LLMResponse } from '../types/index.js';
import { LLMProvider } from './base.js';

export class ZAIProvider extends LLMProvider {
  protected getApiEndpoint(): string {
    return `${this.config.baseUrl}/api/paas/v4/chat/completions`;
  }

  protected getModelsEndpoint(): string {
    return `${this.config.baseUrl}/api/paas/v4/models`;
  }

  protected getDefaultHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  protected createRequest(prompt: string, systemPrompt?: string): any {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system' as const, content: systemPrompt });
    }

    messages.push({ role: 'user' as const, content: prompt });

    return {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
    };
  }

  protected formatRequestBody(request: any): any {
    return {
      ...request,
      max_tokens: request.maxTokens, // z.ai expects max_tokens instead of maxTokens
    };
  }

  protected async parseResponse(response: Response): Promise<LLMResponse> {
    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error(`Z.AI API error: No choices returned in response`);
    }

    const choice = data.choices[0];
    const content = choice.message?.reasoning_content || choice.message?.content || '';

    return {
      content,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens,
      },
      model: data.model || this.config.model,
      finishReason: choice.finish_reason,
    };
  }

  protected extractModelIds(data: any): string[] {
    return data.data?.map((model: any) => model.id) || [];
  }
}
