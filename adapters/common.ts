/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerationPrompt, GenerationParams, UnifiedMessage } from '../types';

export function normalizeMessages(prompt: GenerationPrompt, prefill?: string): any[] {
  const messages: any[] = [];

  if (prompt.system) {
    messages.push({ role: 'system', content: prompt.system });
  }

  if (typeof prompt.user === 'string') {
    messages.push({ role: 'user', content: prompt.user });
  } else if (Array.isArray(prompt.user)) {
    // Array of parts (text / inlineData)
    const contentParts: any[] = [];
    let accumulatedText = '';

    for (const part of prompt.user) {
      if (typeof part === 'string') {
        accumulatedText += part + '\n';
      } else if (part.text) {
        accumulatedText += part.text + '\n';
      } else if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        const base64Data = part.inlineData.data;
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`
          }
        });
      }
    }

    if (accumulatedText.trim()) {
      if (contentParts.length > 0) {
        contentParts.unshift({ type: 'text', text: accumulatedText.trim() });
        messages.push({ role: 'user', content: contentParts });
      } else {
        messages.push({ role: 'user', content: accumulatedText.trim() });
      }
    } else if (contentParts.length > 0) {
      messages.push({ role: 'user', content: contentParts });
    }
  }

  return messages;
}

export async function* parseOpenAISSEStream(response: Response): AsyncGenerator<string> {
  if (!response.body) return;
  const reader = response.body.getReader();
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
        if (trimmed === 'data: [DONE]') return;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.substring(6));
            if (data.error) {
              const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
              throw new Error(errMsg);
            }
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
          } catch (err: any) {
            if (err?.message && !err.message.includes('JSON')) {
              throw err;
            }
          }
        }
      }
    }

    if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
      try {
        const data = JSON.parse(buffer.trim().substring(6));
        const delta = data.choices?.[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      } catch {
        // Ignore
      }
    }
  } finally {
    reader.releaseLock();
  }
}
