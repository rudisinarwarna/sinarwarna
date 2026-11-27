import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { runChatStreamWithTools } from './shared/chatStreamRunner.ts';
import { resolveServerAuthContext } from './shared/firebaseServerAuth.ts';
import { createLiveBridge, type LiveClientMessage } from './shared/liveSessionManager.ts';
import {
  buildContents,
  formatGeminiError,
  isTransientError,
  selectSmartThinkingDepth,
  type IncomingMessage,
} from './shared/sinarWarnaPrompt.ts';

function formatCurrentDateText(): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()) + ' WIB';
  } catch {
    return new Date().toISOString();
  }
}

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

function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
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
      const { messages, mode = 'general', thinkingDepth = 'fast', language = 'id' } = req.body as {
        messages?: IncomingMessage[];
        mode?: string;
        thinkingDepth?: 'fast' | 'deep';
        language?: string;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Pesan percakapan tidak boleh kosong.' });
        return;
      }

      const bearerToken = extractBearerToken(req.headers.authorization);
      const authContext = await resolveServerAuthContext(bearerToken);
      if (authContext.isBlocked) {
        res.status(403).json({
          error: 'Akun Anda telah diblokir atau dihapus oleh Administrator Sinar Warna.',
        });
        return;
      }

      const ai = getGeminiClient();
      const contents = buildContents(messages);
      if (contents.length === 0) {
        res.status(400).json({ error: 'Tidak ada teks atau gambar valid untuk diproses.' });
        return;
      }

      const effectiveDepth = thinkingDepth === 'deep' ? 'deep' : selectSmartThinkingDepth(messages);

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      res.write(': connected\n\n');

      await runChatStreamWithTools({
        ai,
        contents,
        mode,
        thinkingDepth: effectiveDepth,
        language,
        currentDateText: formatCurrentDateText(),
        authContext,
        abortSignal: abortController.signal,
        onEvent: (event) => {
          if (!abortController.signal.aborted && !res.writableEnded) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        },
      });

      if (!abortController.signal.aborted && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
      if (!res.writableEnded) {
        res.end();
      }
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
    const urlObj = new URL(req.url || '/live', 'http://localhost');
    const rawVoice = urlObj.searchParams.get('voice') || 'awen';
    const mode = urlObj.searchParams.get('mode') || 'general';
    const token = urlObj.searchParams.get('token');
    const initialCamera = urlObj.searchParams.get('camera') === '1';
    const language = urlObj.searchParams.get('lang') || 'id';
    const rawLat = urlObj.searchParams.get('lat');
    const rawLng = urlObj.searchParams.get('lng');
    const parsedLat = rawLat !== null ? Number(rawLat) : NaN;
    const parsedLng = rawLng !== null ? Number(rawLng) : NaN;
    const initialUserLocation =
      Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
        ? { lat: parsedLat, lng: parsedLng }
        : null;

    let bridge: ReturnType<typeof createLiveBridge> | null = null;
    let closedByClient = false;

    const safeSend = (payload: unknown) => {
      if (closedByClient || clientWs.readyState !== clientWs.OPEN) return;
      try {
        clientWs.send(JSON.stringify(payload));
      } catch {
        // Ignore send error
      }
    };

    const safeClose = () => {
      if (!closedByClient && clientWs.readyState === clientWs.OPEN) {
        try {
          clientWs.close();
        } catch {
          // Ignore close error
        }
      }
    };

    clientWs.on('close', () => {
      closedByClient = true;
      bridge?.close();
      bridge = null;
    });

    clientWs.on('message', (raw) => {
      if (closedByClient) return;
      try {
        const msg = JSON.parse(raw.toString()) as LiveClientMessage;
        bridge?.handleClientMessage(msg);
      } catch (err) {
        console.error('[Sinar Warna Live Input Parse Error]', err);
      }
    });

    try {
      const authContext = await resolveServerAuthContext(token);
      if (closedByClient) return;

      if (authContext.isBlocked) {
        safeSend({
          error: 'Akun Anda telah diblokir atau dihapus oleh Administrator Sinar Warna.',
        });
        safeClose();
        return;
      }

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

      bridge = createLiveBridge({
        ai,
        initialVoice: rawVoice,
        mode,
        language,
        currentDateText: formatCurrentDateText(),
        initialUserLocation,
        initialCamera,
        authContext,
        sendJson: safeSend,
        closeClient: safeClose,
      });

      await bridge.start();
    } catch (err) {
      console.error('[Sinar Warna Live Connect Error]', err);
      const { message } = formatGeminiError(err);
      safeSend({ error: message });
      safeClose();
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
