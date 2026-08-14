/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AIProvider = 'gemini' | 'openrouter' | 'mistral' | 'groq' | 'huggingface' | 'ollama';

export interface ModelCapabilities {
  tools: boolean;
  structuredOutputs: boolean;
  vision: boolean;
  webSearch: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  capabilities: ModelCapabilities;
}

export interface GenerationPrompt {
  system?: string;
  user: string | any[];
  schema?: any;
}

export interface GenerationParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface ProviderAdapter {
  generate(
    prompt: GenerationPrompt,
    apiKey: string,
    modelId: string,
    params?: GenerationParams
  ): Promise<{ text: string; object?: any }>;
  
  stream(
    prompt: GenerationPrompt,
    apiKey: string,
    modelId: string,
    params?: GenerationParams
  ): AsyncGenerator<string>;
  
  fetchModels(apiKey: string): Promise<ModelInfo[]>;
  
  verifyKey(apiKey: string): Promise<{ valid: boolean; error?: string }>;
}

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  keyLabel: string;
  keyPlaceholder: string;
  isBaseUrl?: boolean;
  defaultBaseUrl?: string;
  docsUrl: string;
}

export interface ProviderSyncState {
  lastSynced?: number;
  models: ModelInfo[];
  isVerified: boolean;
  error?: string | null;
}

export interface Artifact {
  id: string;
  styleName: string;
  html: string;
  status: 'streaming' | 'complete' | 'error';
  error?: string;
  provider?: AIProvider;
  modelId?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  parts: any[];
  timestamp: number;
}

export interface Session {
  id: string;
  prompt: string;
  timestamp: number;
  artifacts: Artifact[];
  messages: Message[];
  activeArtifactId?: string;
  attachments?: FileAttachment[];
}

export interface ComponentVariation {
  name: string;
  html: string;
}

export interface LayoutOption {
  name: string;
  css: string;
  previewHtml: string;
}

export interface FileAttachment {
  id: string;
  file: File;
  name: string;
  base64: string;
  mimeType: string;
}

export interface UnifiedMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
