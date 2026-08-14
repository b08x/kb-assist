/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { adapters } from './adapters';
import { AIProvider, GenerationPrompt, GenerationParams } from './types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Helper to resolve secret server-side
function resolveApiKey(provider: AIProvider, clientKey?: string): string {
  if (clientKey && clientKey.trim()) {
    return clientKey.trim();
  }

  switch (provider) {
    case 'gemini':
      return process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY || '';
    case 'mistral':
      return process.env.MISTRAL_API_KEY || '';
    case 'groq':
      return process.env.GROQ_API_KEY || '';
    case 'huggingface':
      return process.env.HUGGINGFACE_API_KEY || '';
    case 'ollama':
      return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    default:
      return '';
  }
}

// 1. Secrets status endpoint: Reports configuration without echoing secrets
app.get('/api/providers/status', (_req, res) => {
  const status: Record<AIProvider, { hasServerKey: boolean; isBaseUrl?: boolean }> = {
    gemini: { hasServerKey: Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY) },
    openrouter: { hasServerKey: Boolean(process.env.OPENROUTER_API_KEY) },
    mistral: { hasServerKey: Boolean(process.env.MISTRAL_API_KEY) },
    groq: { hasServerKey: Boolean(process.env.GROQ_API_KEY) },
    huggingface: { hasServerKey: Boolean(process.env.HUGGINGFACE_API_KEY) },
    ollama: { hasServerKey: true, isBaseUrl: true }
  };
  res.json({ status });
});

// 2. Verify Key endpoint
app.post('/api/providers/verify', async (req, res) => {
  try {
    const { provider, apiKey } = req.body as { provider: AIProvider; apiKey?: string };
    if (!provider || !adapters[provider]) {
      res.status(400).json({ valid: false, error: `Invalid provider: ${provider}` });
      return;
    }

    const key = resolveApiKey(provider, apiKey);
    if (!key && provider !== 'ollama') {
      res.json({ valid: false, error: `No API key configured for ${provider}.` });
      return;
    }

    const result = await adapters[provider].verifyKey(key);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ valid: false, error: error.message || 'Verification failed.' });
  }
});

// 3. Models Fetch endpoint
app.post('/api/providers/models', async (req, res) => {
  try {
    const { provider, apiKey } = req.body as { provider: AIProvider; apiKey?: string };
    if (!provider || !adapters[provider]) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const key = resolveApiKey(provider, apiKey);
    const models = await adapters[provider].fetchModels(key);
    res.json({ models });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch models.' });
  }
});

// 4. Generate endpoint (non-streaming)
app.post('/api/generate', async (req, res) => {
  try {
    const { provider, modelId, prompt, params, apiKey } = req.body as {
      provider: AIProvider;
      modelId: string;
      prompt: GenerationPrompt;
      params?: GenerationParams;
      apiKey?: string;
    };

    if (!provider || !adapters[provider]) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const key = resolveApiKey(provider, apiKey);
    if (!key && provider !== 'ollama') {
      res.status(400).json({ error: `No API key configured for ${provider}. Please enter your key in Settings or switch to Google Gemini.` });
      return;
    }

    const result = await adapters[provider].generate(prompt, key, modelId, params);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Generation failed.' });
  }
});

// 5. Streaming endpoint (SSE)
app.post('/api/stream', async (req, res) => {
  try {
    const { provider, modelId, prompt, params, apiKey } = req.body as {
      provider: AIProvider;
      modelId: string;
      prompt: GenerationPrompt;
      params?: GenerationParams;
      apiKey?: string;
    };

    if (!provider || !adapters[provider]) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const key = resolveApiKey(provider, apiKey);
    if (!key && provider !== 'ollama') {
      res.status(400).json({ error: `No API key configured for ${provider}. Please enter your key in Settings or switch to Google Gemini.` });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const streamGen = adapters[provider].stream(prompt, key, modelId, params);

    for await (const chunk of streamGen) {
      if (chunk) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Stream generation failed.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SupportDocs AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
