import type { LLMResponse } from '../types/index.js';
import { LLMProvider } from './base.js';

export class AnthropicProvider extends LLMProvider {
  protected getApiEndpoint(): string {
    return `${this.config.baseUrl}/messages`;
  }

  protected getModelsEndpoint(): string {
    return `${this.config.baseUrl}/models`;
  }

  protected getDefaultHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
    };
  }

  protected createRequest(prompt: string, systemPrompt?: string): any {
    const messages = [{ role: 'user' as const, content: prompt }];

    return {
      model: this.config.model,
      messages,
      system: systemPrompt,
      temperature: this.config.temperature,
    };
  }

  protected formatRequestBody(request: any): any {
    return request;
  }

  protected async parseResponse(response: Response): Promise<LLMResponse> {
    const data = await response.json();

    return {
      content: data.content?.[0]?.text || '',
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: data.usage?.input_tokens + data.usage?.output_tokens,
      },
      model: data.model || this.config.model,
      finishReason: data.stop_reason,
    };
  }

  protected extractModelIds(data: any): string[] {
    return data.data?.map((model: any) => model.id) || [];
  }
}
