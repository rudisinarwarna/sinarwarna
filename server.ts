import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type LiveServerMessage,
} from '@google/genai';
import {
  buildContents,
  buildLivePersonaSessionConfig,
  formatGeminiError,
  getChatAttempts,
  isRateLimitError,
  isTransientError,
  MODE_INSTRUCTIONS,
  type IncomingMessage,
} from './shared/sinarWarnaPrompt.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw Object.assign(
      new Error('Kunci API Gemini belum dikonfigurasi. Silakan periksa panel Settings > Secrets.'),
      { status: 400 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Shared prompts, personas, and Gemini error/content helpers imported from ./shared/sinarWarnaPrompt.ts

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function createApp() {
  const app = express();
  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', requestOrigin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'sinar-warna' });
  });

  app.post('/api/chat/stream', async (req: Request, res: Response) => {
    const abortController = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) {
        abortController.abort();
      }
    });

    try {
      const { messages, mode = 'general', thinkingDepth = 'fast' } = req.body as {
        messages?: IncomingMessage[];
        mode?: string;
        thinkingDepth?: 'fast' | 'deep';
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Pesan percakapan tidak boleh kosong.' });
        return;
      }

      const ai = getGeminiClient();
      const contents = buildContents(messages);
      if (contents.length === 0) {
        res.status(400).json({ error: 'Tidak ada teks atau gambar valid untuk diproses.' });
        return;
      }

      const systemInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.general;
      const thinkingLevel =
        thinkingDepth === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.LOW;

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      res.write(': connected\n\n');

      const primaryModel = 'gemini-4-hydrogen';
      let activeIterator: AsyncIterator<Awaited<ReturnType<typeof ai.models.generateContentStream>> extends AsyncIterable<infer T> ? T : never> | null = null;
      let firstResult: IteratorResult<Awaited<ReturnType<typeof ai.models.generateContentStream>> extends AsyncIterable<infer T> ? T : never> | null = null;
      let lastErr: unknown;

      const attempts = getChatAttempts(thinkingDepth);

      for (const step of attempts) {
        if (abortController.signal.aborted) break;
        if (lastErr && isRateLimitError(lastErr) && step.model === primaryModel) {
          continue;
        }
        try {
          const stepSignal = AbortSignal.any([
            abortController.signal,
            AbortSignal.timeout(step.timeoutMs),
          ]);
          const stream = await ai.models.generateContentStream({
            model: step.model,
            contents,
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: step.level },
              abortSignal: stepSignal,
            },
          });
          const iterator = stream[Symbol.asyncIterator]();
          const first = await iterator.next();
          activeIterator = iterator;
          firstResult = first;
          break;
        } catch (attemptErr) {
          lastErr = attemptErr;
          if (abortController.signal.aborted || !isTransientError(attemptErr)) {
            throw attemptErr;
          }
          console.warn(
            `[Sinar Warna /api/chat/stream] Fallback from ${step.model}:`,
            (attemptErr as Error)?.name || (attemptErr as Error)?.message
          );
        }
      }

      if (!activeIterator || !firstResult) {
        throw lastErr || new Error('Gagal memulai aliran AI.');
      }

      let current = firstResult;
      while (!current.done) {
        if (abortController.signal.aborted) {
          break;
        }
        const chunkText = current.value?.text;
        if (chunkText) {
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
        current = await activeIterator.next();
      }

      if (!abortController.signal.aborted) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
      res.end();
    } catch (err) {
      if (abortController.signal.aborted && (err as Error)?.name === 'AbortError') {
        if (!res.writableEnded) {
          res.end();
        }
        return;
      }
      console.error('[Sinar Warna /api/chat/stream]', err);
      const { status, message } = formatGeminiError(err);
      if (!res.headersSent) {
        res.status(status).json({ error: message });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      }
    }
  });

  app.post('/api/title', async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body as { prompt?: string };
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Prompt diperlukan untuk membuat judul.' });
        return;
      }

      const ai = getGeminiClient();
      const titlePrompt = `Buat judul singkat maksimal 5 kata dalam Bahasa Indonesia (tanpa tanda kutip, tanpa tanda titik akhir) yang merangkum topik kreatif berikut:\n\n${prompt.slice(0, 400)}`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: titlePrompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: AbortSignal.timeout(7000),
          },
        });
      } catch (err) {
        if (!isTransientError(err)) throw err;
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: titlePrompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            abortSignal: AbortSignal.timeout(12000),
          },
        });
      }

      const title = (response.text || '')
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/\.+$/, '')
        .trim()
        .slice(0, 60);

      res.json({ title: title || 'Sesi Kreatif Baru' });
    } catch (err) {
      console.error('[Sinar Warna /api/title]', err);
      const { status, message } = formatGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname === '/live') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', async (clientWs: WebSocket, req: http.IncomingMessage) => {
    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let closedByClient = false;

    const urlObj = new URL(req.url || '/live', 'http://localhost');
    const rawVoice = urlObj.searchParams.get('voice') || 'santi';
    const mode = urlObj.searchParams.get('mode') || 'general';
    const { voiceName, liveSystemInstruction, greetingPrompt } = buildLivePersonaSessionConfig(
      rawVoice,
      mode
    );

    clientWs.on('close', () => {
      closedByClient = true;
      try {
        session?.close();
      } catch {
        // Ignore close errors
      }
      session = null;
    });

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        throw Object.assign(
          new Error('Kunci API Gemini belum dikonfigurasi. Silakan periksa panel Settings > Secrets.'),
          { status: 400 }
        );
      }
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          apiVersion: 'v1beta',
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: liveSystemInstruction,
        },
        callbacks: {
          onopen: () => {
            if (!closedByClient && clientWs.readyState === clientWs.OPEN) {
              clientWs.send(JSON.stringify({ ready: true }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (closedByClient || clientWs.readyState !== clientWs.OPEN) return;

            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (errEvent: unknown) => {
            const ev = errEvent as { message?: string; error?: { message?: string } };
            const detail = ev?.error?.message || ev?.message || String(errEvent);
            console.error('[Sinar Warna Live API Error]', detail, errEvent);
            if (!closedByClient && clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({
                  error: `Koneksi Gemini Live mengalami gangguan (${detail}). Silakan coba sambungkan ulang.`,
                })
              );
            }
          },
          onclose: (closeEvent: unknown) => {
            const ce = closeEvent as { code?: number; reason?: string };
            if (ce?.code && ce.code !== 1000) {
              console.error('[Sinar Warna Live API Close]', ce.code, ce.reason);
              if (!closedByClient && clientWs.readyState === clientWs.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    error: `Sesi Gemini Live ditutup (${ce.code}${ce.reason ? `: ${ce.reason}` : ''}).`,
                  })
                );
              }
            }
            if (!closedByClient && clientWs.readyState === clientWs.OPEN) {
              clientWs.close();
            }
          },
        },
      });

      if (closedByClient) {
        session.close();
        return;
      }

      try {
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
          turnComplete: true,
        });
      } catch (greetErr) {
        console.error('[Sinar Warna Live Greeting Error]', greetErr);
      }

      clientWs.on('message', (raw) => {
        if (!session || closedByClient) return;
        try {
          const msg = JSON.parse(raw.toString()) as {
            audio?: string;
            video?: string;
            text?: string;
          };
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          }
          if (msg.video) {
            session.sendRealtimeInput({
              video: { data: msg.video, mimeType: 'image/jpeg' },
            });
          }
          if (msg.text) {
            session.sendRealtimeInput({ text: msg.text });
          }
        } catch (err) {
          console.error('[Sinar Warna Live Input Parse Error]', err);
        }
      });
    } catch (err) {
      console.error('[Sinar Warna Live Connect Error]', err);
      const { message } = formatGeminiError(err);
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify({ error: message }));
        clientWs.close();
      }
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sinar Warna server running on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start Sinar Warna server:', err);
  process.exit(1);
});
