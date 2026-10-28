import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// Ensure DISABLE_HMR is active in AI Studio preview to prevent iframe WebSocket errors
process.env.DISABLE_HMR = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    online: true,
    hasApiKey: Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY'),
    model: 'gemini-3.8-flash',
    searchGrounding: true,
    timestamp: Date.now(),
  });
});

// Stream or regular chat endpoint supporting Gemini (with Search Grounding), Ollama, and OpenAI
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages,
      systemInstruction,
      stream = true,
      temperature = 0.7,
      searchGrounding = true,
      apiProvider = 'gemini',
      ollamaEndpoint,
      ollamaModel,
      customOpenAIEndpoint,
      customOpenAIKey,
      customOpenAIModel,
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    // Natural, brilliant ChatGPT-like system instruction
    const defaultSystemInstruction =
      systemInstruction ||
      `You are Duba, a brilliant, thoughtful, and articulate AI assistant modeled after ChatGPT.
You converse naturally, intelligently, and helpfully on any topic — coding, writing, reasoning, math, science, philosophy, creative brainstorming, and everyday questions.
Provide direct, beautifully formatted responses with clean Markdown, clear typography, and well-commented code snippets when appropriate.
Adapt seamlessly to the user's tone and requirements, answering questions directly and insightfully without unnecessary preamble or rigid automation templates.
If the user writes in English, respond in fluent English. If the user writes or asks in Dzongkha (རྫོང་ཁ), respond naturally in polite, grammatical Dzongkha.`;

    // 1. OPEN-SOURCE OLLAMA PROVIDER
    if (apiProvider === 'ollama') {
      try {
        const endpoint = (ollamaEndpoint || 'http://localhost:11434').replace(/\/+$/, '');
        const ollamaRes = await fetch(`${endpoint}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel || 'llama3.2',
            messages: [
              ...(defaultSystemInstruction ? [{ role: 'system', content: defaultSystemInstruction }] : []),
              ...messages,
            ],
            stream: true,
            options: { temperature: typeof temperature === 'number' ? temperature : 0.7 },
          }),
        });

        if (ollamaRes.ok && ollamaRes.body) {
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders?.();

          const reader = (ollamaRes.body as any).getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

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
                const parsed = JSON.parse(trimmed);
                const chunkText = parsed.message?.content;
                if (chunkText) {
                  res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
                  if (typeof (res as any).flush === 'function') {
                    (res as any).flush();
                  }
                }
              } catch {}
            }
          }

          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
      } catch (ollamaErr: any) {
        console.warn('[Ollama API] Local endpoint unreachable. Falling back to built-in online engine...', ollamaErr?.message);
      }
    }

    // 2. OPENAI-COMPATIBLE / OPEN-SOURCE API GATEWAY PROVIDER
    if (apiProvider === 'openai') {
      try {
        const endpoint = (customOpenAIEndpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (customOpenAIKey) {
          headers['Authorization'] = `Bearer ${customOpenAIKey}`;
        }

        const openaiRes = await fetch(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: customOpenAIModel || 'gpt-4o-mini',
            messages: [
              ...(defaultSystemInstruction ? [{ role: 'system', content: defaultSystemInstruction }] : []),
              ...messages,
            ],
            stream: true,
            temperature: typeof temperature === 'number' ? temperature : 0.7,
          }),
        });

        if (openaiRes.ok && openaiRes.body) {
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('X-Accel-Buffering', 'no');
          res.flushHeaders?.();

          const reader = (openaiRes.body as any).getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                const chunkText = parsed.choices?.[0]?.delta?.content;
                if (chunkText) {
                  res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
                  if (typeof (res as any).flush === 'function') {
                    (res as any).flush();
                  }
                }
              } catch {}
            }
          }

          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
      } catch (openaiErr: any) {
        console.warn('[OpenAI API] Gateway error. Falling back to built-in online engine...', openaiErr?.message);
      }
    }

    // 3. BUILT-IN ONLINE ENGINE WITH GOOGLE SEARCH GROUNDING
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'API key is not configured or invalid. Duba Offline Neural Core is available locally.',
        offlineAvailable: true,
      });
      return;
    }

    // Format messages for Gemini
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content || '' }],
    }));

    if (stream) {
      // Server-Sent Events (SSE) streaming with anti-buffering headers for Cloud Run / Nginx
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      let responseStream = null;
      let usedModel = 'gemini-3.8-flash';

      // Feature: Google Search Grounding (gemini-3.8-flash with googleSearch tool)
      if (searchGrounding) {
        try {
          responseStream = await ai.models.generateContentStream({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction: defaultSystemInstruction,
              temperature: typeof temperature === 'number' ? temperature : 0.7,
              tools: [{ googleSearch: {} }],
            },
          });
          usedModel = 'gemini-3.8-flash (Search Grounded)';
        } catch (searchErr: any) {
          console.warn('[Duba Search] Grounding unavailable or limit reached. Switching to ultra-fast model...', searchErr?.status || searchErr?.message?.slice(0, 40));
        }
      }

      // Fast model fallback
      if (!responseStream) {
        const candidateModels = ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-flash-latest'];
        for (const modelName of candidateModels) {
          try {
            responseStream = await ai.models.generateContentStream({
              model: modelName,
              contents,
              config: {
                systemInstruction: defaultSystemInstruction,
                temperature: typeof temperature === 'number' ? temperature : 0.7,
              },
            });
            usedModel = modelName;
            break;
          } catch (modelErr: any) {
            console.warn(`[Duba Online] Model ${modelName} unavailable (${modelErr?.status || modelErr?.message?.slice(0, 40)}). Trying fallback...`);
          }
        }
      }

      if (!responseStream) {
        throw new Error('All online AI models are momentarily busy. Switching to offline engine.');
      }

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      let response = null;

      if (searchGrounding) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction: defaultSystemInstruction,
              temperature: typeof temperature === 'number' ? temperature : 0.7,
              tools: [{ googleSearch: {} }],
            },
          });
        } catch {}
      }

      if (!response) {
        const candidateModels = ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-flash-latest'];
        for (const modelName of candidateModels) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction: defaultSystemInstruction,
                temperature: typeof temperature === 'number' ? temperature : 0.7,
              },
            });
            break;
          } catch {}
        }
      }

      if (!response) {
        throw new Error('Online AI unavailable.');
      }

      res.json({
        text: response.text || '',
        model: 'gemini-3.8-flash',
      });
    }
  } catch (error: any) {
    console.error('Online Chat Error:', error);
    const errorMessage = error?.message || 'Error communicating with Duba Online Engine.';
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.status(500).json({
        error: errorMessage,
        offlineAvailable: true,
      });
    }
  }
});

// Automation action endpoint (e.g. data structuring, workflow generation, code optimization)
app.post('/api/automate', async (req: Request, res: Response) => {
  try {
    const { actionType, payload } = req.body;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'Cloud automation requires active Gemini connection. You can use Duba Offline Tools.',
      });
      return;
    }

    let prompt = '';
    let systemInstruction = 'You are Duba Automation Engine, an expert at automating workflows, transforming data, and generating production code.';

    switch (actionType) {
      case 'workflow_plan':
        prompt = `Create an automated step-by-step workflow automation plan for the following goal: "${payload.goal}". Include triggers, steps, tools, and error handling.`;
        break;
      case 'code_refactor':
        prompt = `Refactor, optimize, and add automation tests to this code:\n\`\`\`${payload.language || 'javascript'}\n${payload.code}\n\`\`\``;
        break;
      case 'data_extract':
        prompt = `Extract structured data (entities, dates, action items, key metrics) from this text and return it in clean structured Markdown with a summary table:\n\n${payload.text}`;
        break;
      default:
        prompt = payload.prompt || 'Automate the task requested.';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    res.json({
      result: response.text || '',
      actionType,
      model: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Automation Error:', error);
    res.status(500).json({ error: error?.message || 'Failed to execute automation.' });
  }
});

// Serve frontend in development via Vite middleware or in production from dist
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Duba AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Duba server:', err);
  process.exit(1);
});
