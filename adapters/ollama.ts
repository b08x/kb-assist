/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProviderAdapter, GenerationPrompt, GenerationParams, ModelInfo } from '../types';
import { normalizeMessages } from './common';

function sanitizeBaseUrl(baseUrl?: string): string {
  let url = (baseUrl || '').trim();
  if (!url) {
    url = typeof process !== 'undefined' && process.env.OLLAMA_BASE_URL 
      ? process.env.OLLAMA_BASE_URL 
      : 'http://localhost:11434';
  }
  return url.replace(/\/+$/, '');
}

export const ollamaAdapter: ProviderAdapter = {
  async fetchModels(baseUrl?: string): Promise<ModelInfo[]> {
    const root = sanitizeBaseUrl(baseUrl);
    const res = await fetch(`${root}/api/tags`);
    if (!res.ok) {
      throw new Error(`Failed to fetch Ollama models from ${root} (HTTP ${res.status})`);
    }

    const data = await res.json();
    const modelsList: any[] = data.models || [];

    if (modelsList.length === 0) {
      return [
        {
          id: 'llama3.2',
          name: 'Llama 3.2 (Local)',
          contextWindow: 131072,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        }
      ];
    }

    return modelsList.map((m: any): ModelInfo => {
      const name = m.name || m.model || '';
      const lower = name.toLowerCase();
      const details = m.details || {};
      const family = (details.family || '').toLowerCase();

      const hasTools = lower.includes('llama3') || lower.includes('mistral') || lower.includes('qwen') || family.includes('llama') || family.includes('qwen');
      const hasStructured = true; // Ollama supports `format: "json"` natively
      const hasVision = lower.includes('vision') || lower.includes('llava') || lower.includes('bakllava') || family.includes('clip');

      return {
        id: name,
        name,
        contextWindow: 8192,
        capabilities: {
          tools: hasTools,
          structuredOutputs: hasStructured,
          vision: hasVision,
          webSearch: false
        }
      };
    });
  },

  async verifyKey(baseUrl?: string): Promise<{ valid: boolean; error?: string }> {
    const root = sanitizeBaseUrl(baseUrl);
    try {
      const res = await fetch(`${root}/api/tags`);
      if (res.ok) {
        return { valid: true };
      }
      return { valid: false, error: `Ollama returned HTTP ${res.status}: ${res.statusText}` };
    } catch (e: any) {
      return { 
        valid: false, 
        error: `Could not connect to Ollama at ${root}. Make sure Ollama is running (e.g. 'ollama serve') and CORS allows web access.` 
      };
    }
  },

  async generate(
    prompt: GenerationPrompt,
    baseUrl: string,
    modelId: string,
    params?: GenerationParams
  ): Promise<{ text: string; object?: any }> {
    const root = sanitizeBaseUrl(baseUrl);
    const messages = normalizeMessages(prompt);

    const body: any = {
      model: modelId || 'llama3.2',
      messages,
      stream: false,
      options: {
        temperature: params?.temperature ?? 0.7,
        num_predict: params?.maxTokens ?? 4096,
        top_p: params?.topP ?? 0.95
      }
    };

    if (prompt.schema) {
      body.format = 'json';
    }

    const res = await fetch(`${root}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Ollama error HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.message?.content || '';
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
    baseUrl: string,
    modelId: string,
    params?: GenerationParams
  ): AsyncGenerator<string> {
    const root = sanitizeBaseUrl(baseUrl);
    const messages = normalizeMessages(prompt);

    const body: any = {
      model: modelId || 'llama3.2',
      messages,
      stream: true,
      options: {
        temperature: params?.temperature ?? 0.7,
        num_predict: params?.maxTokens ?? 4096,
        top_p: params?.topP ?? 0.95
      }
    };

    const res = await fetch(`${root}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Ollama stream error HTTP ${res.status}`);
    }

    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            const content = data.message?.content;
            if (content) {
              yield content;
            }
            if (data.done) return;
          } catch {
            // Partial chunk
          }
        }
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          const content = data.message?.content;
          if (content) yield content;
        } catch {
          // Ignore
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
};
