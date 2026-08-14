/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProviderAdapter, GenerationPrompt, GenerationParams, ModelInfo } from '../types';
import { normalizeMessages, parseOpenAISSEStream } from './common';

export const huggingfaceAdapter: ProviderAdapter = {
  async fetchModels(apiKey: string): Promise<ModelInfo[]> {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
      const res = await fetch('https://huggingface.co/api/models?pipeline_tag=text-generation&sort=trending&limit=40', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((m: any): ModelInfo => {
            const id = m.id || '';
            const lowerId = id.toLowerCase();
            const hasTools = lowerId.includes('instruct') || lowerId.includes('hermes') || lowerId.includes('qwen') || lowerId.includes('tool');
            const hasStructured = lowerId.includes('instruct') || lowerId.includes('json');
            const hasVision = lowerId.includes('vision') || lowerId.includes('vl') || m.pipeline_tag === 'image-text-to-text';

            return {
              id,
              name: id,
              contextWindow: 32768,
              capabilities: {
                tools: hasTools,
                structuredOutputs: hasStructured,
                vision: hasVision,
                webSearch: false
              }
            };
          });
        }
      }
    } catch {
      // Fallback
    }

    // Default curated router models
    return [
      {
        id: 'meta-llama/Llama-3.3-70B-Instruct',
        name: 'Meta Llama 3.3 70B Instruct',
        contextWindow: 131072,
        capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
      },
      {
        id: 'mistralai/Mistral-7B-Instruct-v0.3',
        name: 'Mistral 7B Instruct v0.3',
        contextWindow: 32768,
        capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
      },
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'Qwen 2.5 72B Instruct',
        contextWindow: 131072,
        capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
      },
      {
        id: 'deepseek-ai/DeepSeek-R1',
        name: 'DeepSeek R1',
        contextWindow: 65536,
        capabilities: { tools: false, structuredOutputs: true, vision: false, webSearch: false }
      }
    ];
  },

  async verifyKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey) {
      return { valid: false, error: 'Hugging Face API token is required.' };
    }
    try {
      const res = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (res.ok) {
        return { valid: true };
      }
      const err = await res.json().catch(() => ({}));
      return { valid: false, error: err.error || `HTTP ${res.status}: ${res.statusText}` };
    } catch (e: any) {
      return { valid: false, error: e.message || 'Failed to connect to Hugging Face.' };
    }
  },

  async generate(
    prompt: GenerationPrompt,
    apiKey: string,
    modelId: string,
    params?: GenerationParams
  ): Promise<{ text: string; object?: any }> {
    const messages = normalizeMessages(prompt);
    const body: any = {
      model: modelId || 'meta-llama/Llama-3.3-70B-Instruct',
      messages,
      temperature: params?.temperature ?? 0.7,
      max_tokens: params?.maxTokens ?? 4096,
      top_p: params?.topP ?? 0.95
    };

    if (prompt.schema) {
      body.response_format = { type: 'json_object' };
    }

    // Try modern HF Router first, then fallback to standard inference endpoint
    const url = 'https://router.huggingface.co/hf-inference/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || `Hugging Face error HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    let object: any = undefined;
    if (prompt.schema && text) {
      try {
        object = JSON.parse(text);
      } catch {
        // Fallback
      }
    }
    return { text, object };
  },

  async *stream(
    prompt: GenerationPrompt,
    apiKey: string,
    modelId: string,
    params?: GenerationParams
  ): AsyncGenerator<string> {
    const messages = normalizeMessages(prompt);

    const body: any = {
      model: modelId || 'meta-llama/Llama-3.3-70B-Instruct',
      messages,
      stream: true,
      temperature: params?.temperature ?? 0.7,
      max_tokens: params?.maxTokens ?? 4096,
      top_p: params?.topP ?? 0.95
    };

    const url = 'https://router.huggingface.co/hf-inference/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || `Hugging Face stream error HTTP ${res.status}`);
    }

    yield* parseOpenAISSEStream(res);
  }
};
