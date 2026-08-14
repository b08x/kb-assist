/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AIProvider, ProviderAdapter, ProviderConfig } from '../types';
import { geminiAdapter } from './gemini';
import { openrouterAdapter } from './openrouter';
import { mistralAdapter } from './mistral';
import { groqAdapter } from './groq';
import { huggingfaceAdapter } from './huggingface';
import { ollamaAdapter } from './ollama';

export const adapters: Record<AIProvider, ProviderAdapter> = {
  gemini: geminiAdapter,
  openrouter: openrouterAdapter,
  mistral: mistralAdapter,
  groq: groqAdapter,
  huggingface: huggingfaceAdapter,
  ollama: ollamaAdapter,
};

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'State-of-the-art multimodal reasoning with Gemini 3.7 Flash, Pro, and Flash Lite.',
    keyLabel: 'Gemini API Key',
    keyPlaceholder: 'AI Studio Key (Managed Server-Side)',
    docsUrl: 'https://aistudio.google.com'
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified gateway to Claude 3.5, GPT-4o, DeepSeek, and hundreds of top LLMs.',
    keyLabel: 'OpenRouter API Key',
    keyPlaceholder: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys'
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Frontier European models including Mistral Large, Codestral, and Pixtral.',
    keyLabel: 'Mistral API Key',
    keyPlaceholder: 'Enter Mistral API Key',
    docsUrl: 'https://console.mistral.ai/api-keys'
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-low latency LPU inference for Llama 3.3, Mixtral, and Gemma.',
    keyLabel: 'Groq API Key',
    keyPlaceholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys'
  },
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Inference Providers & Router for open weights (Llama, Mistral, Qwen, DeepSeek).',
    keyLabel: 'HF User Access Token',
    keyPlaceholder: 'hf_...',
    docsUrl: 'https://huggingface.co/settings/tokens'
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run open-source models completely locally on your hardware.',
    keyLabel: 'Ollama Base URL',
    keyPlaceholder: 'http://localhost:11434',
    isBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    docsUrl: 'https://ollama.com'
  }
};

export {
  geminiAdapter,
  openrouterAdapter,
  mistralAdapter,
  groqAdapter,
  huggingfaceAdapter,
  ollamaAdapter
};
