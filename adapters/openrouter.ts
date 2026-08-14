/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProviderAdapter, GenerationPrompt, GenerationParams, ModelInfo } from '../types';
import { normalizeMessages, parseOpenAISSEStream } from './common';

export const openrouterAdapter: ProviderAdapter = {
  async fetchModels(apiKey: string): Promise<ModelInfo[]> {
    const headers: Record<string, string> = {
      'HTTP-Referer': 'https://supportdocs.ai',
      'X-Title': 'SupportDocs AI'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
    if (!res.ok) {
      throw new Error(`OpenRouter models API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const modelsList: any[] = data.data || [];

    return modelsList.map((m: any): ModelInfo => {
      const supportedParams = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
      const modality = m.architecture?.modality || '';
      const desc = (m.description || '').toLowerCase();
      const id = m.id || '';

      const hasTools = supportedParams.includes('tools') || supportedParams.includes('function_calling');
      const hasStructured = supportedParams.includes('structured_outputs') || supportedParams.includes('response_format');
      const hasVision = modality.includes('image') || desc.includes('multimodal') || desc.includes('vision') || id.includes('vision') || id.includes('vl');
      const hasWebSearch = id.includes(':online') || desc.includes('web search') || desc.includes('online browsing');

      return {
        id: m.id,
        name: m.name || m.id,
        contextWindow: m.context_length || 8192,
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
      return { valid: false, error: 'OpenRouter API key is required.' };
    }
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://supportdocs.ai',
          'X-Title': 'SupportDocs AI'
        }
      });
      if (res.ok) {
        return { valid: true };
      }
      const err = await res.json().catch(() => ({}));
      return { valid: false, error: err.error?.message || `HTTP ${res.status}: ${res.statusText}` };
    } catch (e: any) {
      return { valid: false, error: e.message || 'Failed to connect to OpenRouter.' };
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
      model: modelId || 'anthropic/claude-3.5-sonnet',
      messages,
      temperature: params?.temperature ?? 0.7,
      max_tokens: params?.maxTokens ?? 4096,
      top_p: params?.topP ?? 0.95
    };

    if (prompt.schema) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://supportdocs.ai',
        'X-Title': 'SupportDocs AI'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenRouter error HTTP ${res.status}`);
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
      model: modelId || 'anthropic/claude-3.5-sonnet',
      messages,
      stream: true,
      temperature: params?.temperature ?? 0.7,
      max_tokens: params?.maxTokens ?? 4096,
      top_p: params?.topP ?? 0.95
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://supportdocs.ai',
        'X-Title': 'SupportDocs AI'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenRouter stream error HTTP ${res.status}`);
    }

    yield* parseOpenAISSEStream(res);
  }
};
