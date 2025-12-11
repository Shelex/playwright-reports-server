import type { LLMProviderConfig, LLMResponse } from '../types/index.js';
import { LLMProvider } from './base.js';

export class OpenAIProvider extends LLMProvider {
  protected getApiEndpoint(): string {
    return `${this.config.baseUrl}/chat/completions`;
  }

  protected getModelsEndpoint(): string {
    return `${this.config.baseUrl}/models`;
  }

  protected getDefaultHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  protected formatRequestBody(request: any): any {
    return {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
    };
  }

  protected async parseResponse(response: Response): Promise<LLMResponse> {
    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens,
      },
      model: data.model || this.config.model,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }

  protected extractModelIds(data: any): string[] {
    return data.data?.map((model: any) => model.id) || [];
  }
}
