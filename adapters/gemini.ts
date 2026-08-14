/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { ProviderAdapter, GenerationPrompt, GenerationParams, ModelInfo } from '../types';

export const geminiAdapter: ProviderAdapter = {
  async fetchModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      const key = apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY || process.env.API_KEY : '');
      if (key) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=50`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            const valid = data.models
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any): ModelInfo => {
                const modelId = m.name.replace(/^models\//, '');
                const isVision = m.supportedGenerationMethods?.includes('generateContent') && 
                  (modelId.includes('flash') || modelId.includes('pro') || modelId.includes('gemini-1.5') || modelId.includes('gemini-2') || modelId.includes('gemini-3'));
                return {
                  id: modelId,
                  name: m.displayName || modelId,
                  contextWindow: m.inputTokenLimit || 1048576,
                  capabilities: {
                    tools: true,
                    structuredOutputs: true,
                    vision: isVision,
                    webSearch: true,
                  }
                };
              });

            if (valid.length > 0) {
              return valid;
            }
          }
        }
      }
    } catch {
      // Fallback to recommended models if network or key issue
    }

    // Default conservative models
    return [
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
    ];
  },

  async verifyKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY || process.env.API_KEY : '');
    if (!key) {
      return { valid: false, error: 'No Gemini API key provided.' };
    }
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1`);
      if (res.ok) {
        return { valid: true };
      }
      const data = await res.json().catch(() => ({}));
      return { valid: false, error: data.error?.message || `HTTP ${res.status}: ${res.statusText}` };
    } catch (e: any) {
      return { valid: false, error: e.message || 'Failed to reach Gemini API.' };
    }
  },

  async generate(
    prompt: GenerationPrompt,
    apiKey: string,
    modelId: string,
    params?: GenerationParams
  ): Promise<{ text: string; object?: any }> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY || process.env.API_KEY : '');
    const ai = new GoogleGenAI({ apiKey: key });

    const contents: any[] = [];
    if (typeof prompt.user === 'string') {
      contents.push({ role: 'user', parts: [{ text: prompt.user }] });
    } else if (Array.isArray(prompt.user)) {
      const parts: any[] = [];
      for (const item of prompt.user) {
        if (typeof item === 'string') {
          parts.push({ text: item });
        } else if (item.text) {
          parts.push({ text: item.text });
        } else if (item.inlineData) {
          parts.push({ inlineData: item.inlineData });
        }
      }
      contents.push({ role: 'user', parts });
    }

    const config: any = {};
    if (prompt.system) config.systemInstruction = prompt.system;
    if (params?.temperature !== undefined) config.temperature = params.temperature;
    if (params?.maxTokens !== undefined) config.maxOutputTokens = params.maxTokens;
    if (params?.topP !== undefined) config.topP = params.topP;
    if (prompt.schema) {
      config.responseMimeType = 'application/json';
      config.responseSchema = prompt.schema;
    }

    const primaryModel = modelId || 'gemini-2.5-flash';
    const candidateModels = [primaryModel];
    if (primaryModel !== 'gemini-2.5-flash') {
      candidateModels.push('gemini-2.5-flash');
    }

    let lastError: any = null;
    for (const m of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: m,
            contents,
            config
          });

          const text = response.text || '';
          let object: any = undefined;
          if (prompt.schema && text) {
            try {
              object = JSON.parse(text);
            } catch {
              // Fallback
            }
          }

          return { text, object };
        } catch (e: any) {
          lastError = e;
          const isRetryable = e?.message?.includes('503') || e?.message?.includes('429') || e?.message?.includes('demand') || e?.message?.includes('UNAVAILABLE');
          if (isRetryable && attempt === 0) {
            await new Promise(r => setTimeout(r, 600));
            continue;
          }
          break;
        }
      }
    }

    const cleanErr = lastError?.message?.replace(/got status: \d+ /, '') || lastError?.message || 'Gemini generation failed';
    throw new Error(cleanErr);
  },

  async *stream(
    prompt: GenerationPrompt,
    apiKey: string,
    modelId: string,
    params?: GenerationParams
  ): AsyncGenerator<string> {
    const key = apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY || process.env.API_KEY : '');
    const ai = new GoogleGenAI({ apiKey: key });

    const contents: any[] = [];
    if (typeof prompt.user === 'string') {
      contents.push({ role: 'user', parts: [{ text: prompt.user }] });
    } else if (Array.isArray(prompt.user)) {
      const parts: any[] = [];
      for (const item of prompt.user) {
        if (typeof item === 'string') {
          parts.push({ text: item });
        } else if (item.text) {
          parts.push({ text: item.text });
        } else if (item.inlineData) {
          parts.push({ inlineData: item.inlineData });
        }
      }
      contents.push({ role: 'user', parts });
    }

    const config: any = {};
    if (prompt.system) config.systemInstruction = prompt.system;
    if (params?.temperature !== undefined) config.temperature = params.temperature;
    if (params?.maxTokens !== undefined) config.maxOutputTokens = params.maxTokens;
    if (params?.topP !== undefined) config.topP = params.topP;

    const primaryModel = modelId || 'gemini-2.5-flash';
    const candidateModels = [primaryModel];
    if (primaryModel !== 'gemini-2.5-flash') {
      candidateModels.push('gemini-2.5-flash');
    }

    let lastError: any = null;
    for (const m of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const responseStream = await ai.models.generateContentStream({
            model: m,
            contents,
            config
          });

          for await (const chunk of responseStream) {
            if (chunk.text) {
              yield chunk.text;
            }
          }
          return;
        } catch (e: any) {
          lastError = e;
          const isRetryable = e?.message?.includes('503') || e?.message?.includes('429') || e?.message?.includes('demand') || e?.message?.includes('UNAVAILABLE');
          if (isRetryable && attempt === 0) {
            await new Promise(r => setTimeout(r, 600));
            continue;
          }
          break;
        }
      }
    }

    const cleanErr = lastError?.message?.replace(/got status: \d+ /, '') || lastError?.message || 'Gemini streaming failed';
    throw new Error(cleanErr);
  }
};
