import type { LLMRequest, LLMResponse } from '../types/index.js';
import { LLMProvider } from './base.js';
import type { AnthropicModelList, AnthropicRequest, AnthropicResponse } from './types.js';

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

  protected createRequest(prompt: string, systemPrompt?: string, _model?: string): LLMRequest {
    const messages = [{ role: 'user' as const, content: prompt }];

    return {
      model: this.config.model,
      max_tokens: 8000,
      messages,
      system: systemPrompt,
      temperature: this.config.temperature,
    } as AnthropicRequest;
  }

  protected formatRequestBody(request: AnthropicRequest): AnthropicRequest {
    return request;
  }

  protected async parseResponse(response: Response): Promise<LLMResponse> {
    const data = (await response.json()) as AnthropicResponse;

    return {
      content: data.content?.[0]?.text || '',
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      model: data.model || this.config.model,
      finishReason: data.stop_reason || undefined,
    };
  }

  protected extractModelIds(data: AnthropicModelList): string[] {
    return data.data?.map((model) => model.id) || [];
  }
}
