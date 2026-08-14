/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider, GenerationPrompt, GenerationParams, ModelInfo, ProviderSyncState } from '../types';
import { ollamaAdapter } from '../adapters/ollama';

const SYNC_CACHE_KEY = 'supportdocs_ai_models_cache_v2';
const PARAMS_STORAGE_KEY = 'supportdocs_ai_gen_params_v1';

export function loadModelCache(): Record<AIProvider, ProviderSyncState> {
  const defaults: Record<AIProvider, ProviderSyncState> = {
    gemini: {
      models: [
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          contextWindow: 1048576,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: true }
        },
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          contextWindow: 1048576,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: true }
        },
        {
          id: 'gemini-3.7-flash',
          name: 'Gemini 3.7 Flash',
          contextWindow: 1048576,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: true }
        },
        {
          id: 'gemini-3.1-pro-preview',
          name: 'Gemini 3.1 Pro Preview',
          contextWindow: 2097152,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: true }
        },
        {
          id: 'gemini-3.1-flash-lite',
          name: 'Gemini 3.1 Flash Lite',
          contextWindow: 1048576,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: true }
        }
      ],
      isVerified: true
    },
    openrouter: {
      models: [
        {
          id: 'anthropic/claude-3.7-sonnet',
          name: 'Claude 3.7 Sonnet',
          contextWindow: 200000,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: false }
        },
        {
          id: 'anthropic/claude-3.5-sonnet',
          name: 'Claude 3.5 Sonnet',
          contextWindow: 200000,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: false }
        },
        {
          id: 'openai/gpt-4o',
          name: 'OpenAI: GPT-4o',
          contextWindow: 128000,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: false }
        },
        {
          id: 'openai/gpt-4o-mini',
          name: 'OpenAI: GPT-4o Mini',
          contextWindow: 128000,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: false }
        },
        {
          id: 'deepseek/deepseek-r1',
          name: 'DeepSeek: R1',
          contextWindow: 64000,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'deepseek/deepseek-chat',
          name: 'DeepSeek: V3',
          contextWindow: 64000,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'meta-llama/llama-3.3-70b-instruct',
          name: 'Meta: Llama 3.3 70B Instruct',
          contextWindow: 131072,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'google/gemini-2.5-flash',
          name: 'Google: Gemini 2.5 Flash',
          contextWindow: 1048576,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: true }
        }
      ],
      isVerified: false
    },
    mistral: {
      models: [
        {
          id: 'mistral-large-latest',
          name: 'Mistral Large',
          contextWindow: 128000,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: false }
        },
        {
          id: 'codestral-latest',
          name: 'Codestral',
          contextWindow: 256000,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'mistral-small-latest',
          name: 'Mistral Small',
          contextWindow: 128000,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'pixtral-large-latest',
          name: 'Pixtral Large',
          contextWindow: 128000,
          capabilities: { tools: true, structuredOutputs: true, vision: true, webSearch: false }
        }
      ],
      isVerified: false
    },
    groq: {
      models: [
        {
          id: 'llama-3.3-70b-versatile',
          name: 'Llama 3.3 70B Versatile',
          contextWindow: 128000,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'llama-3.1-8b-instant',
          name: 'Llama 3.1 8B Instant',
          contextWindow: 128000,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'mixtral-8x7b-32768',
          name: 'Mixtral 8x7B (32k)',
          contextWindow: 32768,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'gemma2-9b-it',
          name: 'Gemma 2 9B IT',
          contextWindow: 8192,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        }
      ],
      isVerified: false
    },
    huggingface: {
      models: [
        {
          id: 'meta-llama/Llama-3.3-70B-Instruct',
          name: 'Llama 3.3 70B Instruct',
          contextWindow: 128000,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
          name: 'Qwen 2.5 Coder 32B',
          contextWindow: 32768,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'deepseek-ai/DeepSeek-R1',
          name: 'DeepSeek R1',
          contextWindow: 64000,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'mistralai/Mistral-7B-Instruct-v0.3',
          name: 'Mistral 7B Instruct v0.3',
          contextWindow: 32768,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        }
      ],
      isVerified: false
    },
    ollama: {
      models: [
        {
          id: 'llama3.2',
          name: 'Llama 3.2 (Local)',
          contextWindow: 131072,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'llama3.3',
          name: 'Llama 3.3 (Local)',
          contextWindow: 131072,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'mistral',
          name: 'Mistral 7B (Local)',
          contextWindow: 32768,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'qwen2.5-coder',
          name: 'Qwen 2.5 Coder (Local)',
          contextWindow: 32768,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        },
        {
          id: 'deepseek-r1',
          name: 'DeepSeek R1 (Local)',
          contextWindow: 64000,
          capabilities: { tools: true, structuredOutputs: true, vision: false, webSearch: false }
        }
      ],
      isVerified: false
    }
  };

  try {
    const raw = localStorage.getItem(SYNC_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged: Record<AIProvider, ProviderSyncState> = { ...defaults };
      (Object.keys(defaults) as AIProvider[]).forEach(provider => {
        if (parsed[provider]) {
          merged[provider] = {
            ...parsed[provider],
            models: (parsed[provider].models && parsed[provider].models.length > 0)
              ? parsed[provider].models
              : defaults[provider].models
          };
        }
      });
      return merged;
    }
  } catch {
    // Ignore
  }
  return defaults;
}

export function saveModelCache(cache: Record<AIProvider, ProviderSyncState>): void {
  try {
    localStorage.setItem(SYNC_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore
  }
}

export function loadGenerationParams(): GenerationParams {
  const defaults: GenerationParams = {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.95
  };
  try {
    const raw = localStorage.getItem(PARAMS_STORAGE_KEY);
    if (raw) {
      return { ...defaults, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore
  }
  return defaults;
}

export function saveGenerationParams(params: GenerationParams): void {
  try {
    localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Ignore
  }
}

export async function fetchSecretsStatus(): Promise<Record<AIProvider, { hasServerKey: boolean; isBaseUrl?: boolean }>> {
  try {
    const res = await fetch('/api/providers/status');
    if (res.ok) {
      const data = await res.json();
      return data.status;
    }
  } catch (e) {
    console.warn('Could not reach secrets status endpoint, running in offline/client mode', e);
  }
  return {
    gemini: { hasServerKey: false },
    openrouter: { hasServerKey: false },
    mistral: { hasServerKey: false },
    groq: { hasServerKey: false },
    huggingface: { hasServerKey: false },
    ollama: { hasServerKey: true, isBaseUrl: true }
  };
}

export async function verifyProviderKey(
  provider: AIProvider,
  apiKey?: string
): Promise<{ valid: boolean; error?: string }> {
  // If Ollama, try direct browser call first (as supported by user requirement)
  if (provider === 'ollama') {
    try {
      const result = await ollamaAdapter.verifyKey(apiKey);
      if (result.valid) return result;
    } catch {
      // Fallback to server verification
    }
  }

  const res = await fetch('/api/providers/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey: apiKey?.trim() || undefined })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { valid: false, error: data.error || `HTTP error ${res.status}` };
  }

  return res.json();
}

export async function syncProviderModels(
  provider: AIProvider,
  apiKey?: string
): Promise<ModelInfo[]> {
  // If Ollama, try direct browser call first
  if (provider === 'ollama') {
    try {
      const models = await ollamaAdapter.fetchModels(apiKey);
      if (models && models.length > 0) return models;
    } catch {
      // Fallback to server
    }
  }

  const res = await fetch('/api/providers/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey: apiKey?.trim() || undefined })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch models (HTTP ${res.status})`);
  }

  const data = await res.json();
  return data.models || [];
}

export async function streamGeneration(
  provider: AIProvider,
  modelId: string,
  prompt: GenerationPrompt,
  params: GenerationParams,
  apiKey?: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  let accumulated = '';

  // Direct browser stream for Ollama if available
  if (provider === 'ollama') {
    try {
      const streamGen = ollamaAdapter.stream(prompt, apiKey || '', modelId, params);
      for await (const chunk of streamGen) {
        accumulated += chunk;
        if (onChunk) onChunk(chunk);
      }
      return accumulated;
    } catch (e: any) {
      console.warn('Direct Ollama stream failed, falling back to server stream', e);
      accumulated = '';
    }
  }

  const res = await fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      modelId,
      prompt,
      params,
      apiKey: apiKey?.trim() || undefined
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Generation stream error HTTP ${res.status}`);
  }

  if (!res.body) {
    throw new Error('No response body received from stream.');
  }

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
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') break;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.substring(6));
            if (data.error) {
              throw new Error(data.error);
            }
            if (data.text) {
              accumulated += data.text;
              if (onChunk) onChunk(data.text);
            }
          } catch (e: any) {
            if (e.message && e.message !== 'Unexpected end of JSON input') {
              throw e;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}

export async function nonStreamGeneration(
  provider: AIProvider,
  modelId: string,
  prompt: GenerationPrompt,
  params: GenerationParams,
  apiKey?: string
): Promise<{ text: string; object?: any }> {
  // Direct browser call for Ollama if available
  if (provider === 'ollama') {
    try {
      return await ollamaAdapter.generate(prompt, apiKey || '', modelId, params);
    } catch {
      // Fallback
    }
  }

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      modelId,
      prompt,
      params,
      apiKey: apiKey?.trim() || undefined
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Generation error HTTP ${res.status}`);
  }

  return res.json();
}
