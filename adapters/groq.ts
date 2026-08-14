/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProviderAdapter, GenerationPrompt, GenerationParams, ModelInfo } from '../types';
import { normalizeMessages, parseOpenAISSEStream } from './common';

export const groqAdapter: ProviderAdapter = {
  async fetchModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey) {
      throw new Error('Groq API key is required to fetch models.');
    }

    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!res.ok) {
      throw new Error(`Groq models API returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const modelsList: any[] = data.data || [];

    return modelsList
      .filter((m: any) => m.active !== false && !m.id?.includes('whisper'))
      .map((m: any): ModelInfo => {
        const id = m.id || '';
        const hasTools = id.includes('llama-3') || id.includes('tool-use') || id.includes('mixtral') || id.includes('qwen') || id.includes('gemma');
        const hasStructured = id.includes('llama-3') || id.includes('mixtral') || id.includes('qwen');
        const hasVision = id.includes('vision');
        const hasWebSearch = false; // Groq does not have built-in web search

        return {
          id: m.id,
          name: m.id,
          contextWindow: m.context_window || 8192,
          capabilities: {
            tools: hasTools,
            structuredOutputs: hasStructured,
            vision: hasVision,
            webSearch: hasWebSearch
          }
        };
      });
  },

  async verifyKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    if (!apiKey) {
      return { valid: false, error: 'Groq API key is required.' };
    }
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (res.ok) {
        return { valid: true };
      }
      const err = await res.json().catch(() => ({}));
      return { valid: false, error: err.error?.message || `HTTP ${res.status}: ${res.statusText}` };
    } catch (e: any) {
      return { valid: false, error: e.message || 'Failed to connect to Groq API.' };
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
      model: modelId || 'llama-3.3-70b-versatile',
      messages,
      temperature: params?.temperature ?? 0.7,
      max_tokens: params?.maxTokens ?? 4096,
      top_p: params?.topP ?? 0.95
    };

    if (prompt.schema) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Groq error HTTP ${res.status}`);
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
      model: modelId || 'llama-3.3-70b-versatile',
      messages,
      stream: true,
      temperature: params?.temperature ?? 0.7,
      max_tokens: params?.maxTokens ?? 4096,
      top_p: params?.topP ?? 0.95
    };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Groq stream error HTTP ${res.status}`);
    }

    yield* parseOpenAISSEStream(res);
  }
};
