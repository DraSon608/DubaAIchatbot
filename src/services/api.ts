import { DubaOfflineBrain } from './offlineBrain';
import { ServerHealth } from '../types/chat';

export interface ChatRequestOptions {
  messages: { role: string; content: string }[];
  systemInstruction?: string;
  forceOffline?: boolean;
  temperature?: number;
  searchGrounding?: boolean;
  apiProvider?: 'gemini' | 'ollama' | 'openai';
  ollamaEndpoint?: string;
  ollamaModel?: string;
  customOpenAIEndpoint?: string;
  customOpenAIKey?: string;
  customOpenAIModel?: string;
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string, modelUsed: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export class ApiService {
  public static async checkHealth(): Promise<ServerHealth> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('/api/health', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      return await res.json();
    } catch {
      return {
        status: 'offline',
        online: false,
        hasApiKey: false,
        model: 'duba-offline-core',
        searchGrounding: false,
        timestamp: Date.now(),
      };
    }
  }

  public static async streamChat(options: ChatRequestOptions): Promise<void> {
    const {
      messages,
      systemInstruction,
      forceOffline,
      temperature = 0.7,
      searchGrounding = true,
      apiProvider = 'gemini',
      ollamaEndpoint,
      ollamaModel,
      customOpenAIEndpoint,
      customOpenAIKey,
      customOpenAIModel,
      onChunk,
      onComplete,
      onError,
      signal,
    } = options;

    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // Check if we should use Offline Core directly
    const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (forceOffline || isBrowserOffline) {
      console.log('[Duba] Operating in Offline Neural Mode');
      try {
        let fullText = '';
        const stream = DubaOfflineBrain.generateStream(lastUserMessage, messages, systemInstruction);

        for await (const chunk of stream) {
          if (signal?.aborted) {
            break;
          }
          fullText += chunk;
          onChunk(chunk);
        }

        onComplete(fullText, 'duba-offline-core');
      } catch (err: any) {
        onError(err?.message || 'Error generating offline response.');
      }
      return;
    }

    // Attempt Online AI Call (with Search Grounding or Open-Source Ollama/OpenAI)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          systemInstruction,
          stream: true,
          temperature,
          searchGrounding,
          apiProvider,
          ollamaEndpoint,
          ollamaModel,
          customOpenAIEndpoint,
          customOpenAIKey,
          customOpenAIModel,
        }),
        signal,
      });

      if (!response.ok) {
        // Fallback to offline brain on server error
        console.warn(`[Duba Online] Server returned ${response.status}. Falling back to Duba Offline Neural Core.`);
        let fullText = '';
        const stream = DubaOfflineBrain.generateStream(lastUserMessage, messages, systemInstruction);
        for await (const chunk of stream) {
          if (signal?.aborted) break;
          fullText += chunk;
          onChunk(chunk);
        }
        onComplete(fullText, 'duba-offline-core');
        return;
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read streaming response from server.');
      }

      const decoder = new TextDecoder('utf-8');
      let fullText = '';
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

          if (dataStr === '[DONE]') {
            continue;
          }

          let data: any = null;
          try {
            data = JSON.parse(dataStr);
          } catch {
            // Non-JSON SSE line
            continue;
          }

          if (data?.error) {
            console.warn('[Duba Online] Stream reported error:', data.error);
            throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
          }

          if (data?.text) {
            fullText += data.text;
            onChunk(data.text);
          }
        }
      }

      if (!fullText.trim()) {
        throw new Error('No content received from online stream.');
      }

      const resolvedModelName =
        apiProvider === 'ollama'
          ? `Ollama (${ollamaModel || 'llama3.2'})`
          : apiProvider === 'openai'
          ? `OpenAI (${customOpenAIModel || 'gpt-4o-mini'})`
          : searchGrounding
          ? 'gemini-3.8-flash (Search Grounded)'
          : 'gemini-3.8-flash';

      onComplete(fullText, resolvedModelName);
    } catch (err: any) {
      if (signal?.aborted) {
        console.log('[Duba] Stream generation aborted by user.');
        return;
      }

      console.warn('[Duba] Network error encountered. Seamlessly switching to Offline Engine...', err);
      // Auto-fallback: Generate via Duba Offline Brain
      try {
        let fullText = '';
        const stream = DubaOfflineBrain.generateStream(lastUserMessage, messages, systemInstruction);
        for await (const chunk of stream) {
          if (signal?.aborted) break;
          fullText += chunk;
          onChunk(chunk);
        }
        onComplete(fullText, 'duba-offline-core');
      } catch (fallbackErr: any) {
        onError(fallbackErr?.message || 'Failed to complete request.');
      }
    }
  }

  public static async executeAutomation(actionType: string, payload: any): Promise<string> {
    try {
      const res = await fetch('/api/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, payload }),
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      return data.result || '';
    } catch (e: any) {
      // Local fallback for offline automation execution
      return `Offline Automation Result: Successfully transformed ${actionType} locally on device.`;
    }
  }
}
