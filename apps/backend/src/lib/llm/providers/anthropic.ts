import type { LLMRequest, LLMResponse, LLMStreamChunk, StreamAccumulator } from '../types/index.js';
import { LLMProvider } from './base.js';
import type {
  AnthropicModelList,
  AnthropicRequest,
  AnthropicResponse,
  AnthropicStreamChunk,
} from './types.js';

export class AnthropicProvider extends LLMProvider {
  protected getApiEndpoint(): string {
    return `${this.config.baseUrl}/messages`;
  }

  protected getStreamApiEndpoint(): string {
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

  protected formatRequestBody(request: LLMRequest): AnthropicRequest {
    return request as AnthropicRequest;
  }

  protected formatStreamRequestBody(request: LLMRequest): AnthropicRequest {
    return {
      ...(request as AnthropicRequest),
      stream: true,
    };
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

  protected parseStreamLine(line: string, accumulator: StreamAccumulator): LLMStreamChunk | null {
    if (!line.startsWith('data: ')) {
      return null;
    }

    const data = line.slice(6); // Remove 'data: ' prefix

    try {
      const chunk = JSON.parse(data) as AnthropicStreamChunk;

      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const text = chunk.delta.text;
        if (text) {
          return {
            type: 'token',
            content: text,
          };
        }
      }

      if (chunk.type === 'message_stop' && chunk.message?.usage) {
        accumulator.usage = {
          inputTokens: chunk.message.usage.input_tokens || 0,
          outputTokens: chunk.message.usage.output_tokens || 0,
          totalTokens:
            (chunk.message.usage.input_tokens || 0) + (chunk.message.usage.output_tokens || 0),
        };
      }

      if (chunk.type === 'message_start' && chunk.message?.usage) {
        accumulator.usage = {
          inputTokens: chunk.message.usage.input_tokens || 0,
          outputTokens: chunk.message.usage.output_tokens || 0,
          totalTokens:
            (chunk.message.usage.input_tokens || 0) + (chunk.message.usage.output_tokens || 0),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  protected extractModelIds(data: AnthropicModelList): string[] {
    return data.data?.map((model) => model.id) || [];
  }
}
