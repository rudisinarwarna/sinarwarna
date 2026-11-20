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
  type Content,
  type LiveServerMessage,
  type Part,
} from '@google/genai';

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

const SINAR_WARNA_STORE_KNOWLEDGE = [
  'Bahasa utamamu adalah Bahasa Indonesia yang ramah, jelas, santun, dan membantu.',
  'Kamu adalah asisten AI resmi Toko Sinar Warna.',
  'Informasi cabang toko yang wajib kamu ingat: Toko Sinar Warna memiliki 2 cabang, yaitu Sinar Warna Dadap dan Sinar Warna Salembaran.',
  'Jika pengguna menanyakan alamat, lokasi, letak, atau arah menuju toko Sinar Warna, beri tahu bahwa Sinar Warna memiliki 2 cabang yaitu Sinar Warna Dadap dan Sinar Warna Salembaran, dan arahkan pengguna untuk langsung mencarinya di Google Maps (cari "Sinar Warna Dadap" atau "Sinar Warna Salembaran" di Google Maps). Jangan mengarang alamat jalan spesifik.',
  'Kamu juga ahli membantu konsultasi seputar cat (cat tembok interior/eksterior, cat kayu dan besi, cat anti bocor/waterproofing, cat dasar/primer, pemilihan kombinasi warna, takaran, daya sebar, dan teknik pengecatan) maupun pertanyaan lainnya.',
].join(' ');

const MODE_INSTRUCTIONS: Record<string, string> = {
  general: [
    SINAR_WARNA_STORE_KNOWLEDGE,
    'Bantu pengguna dengan konsultasi cat, pemilihan warna, ide kreatif, maupun pertanyaan lainnya secara hangat, tajam, dan kolaboratif.',
    'Selalu gunakan Bahasa Indonesia sebagai bahasa utama kecuali pengguna secara eksplisit meminta bahasa lain.',
    'Gunakan pemformatan Markdown yang rapi (subjudul, poin bernomor, tebal untuk penekanan) agar mudah dipindai.',
  ].join(' '),
  design: [
    SINAR_WARNA_STORE_KNOWLEDGE,
    'Dalam mode Desain & Warna, bertindaklah sebagai Direktur Seni & Konsultan Warna Toko Sinar Warna.',
    'Saat menyarankan warna, palet, atau warna cat ruangan, WAJIB sertakan kode warna HEX yang valid (contoh: #1E293B, #D97706) beserta peran tiap warna (dinding utama, aksen, plafon/trim) dan kesan psikologis/estetisnya.',
    'Jika pengguna mengunggah gambar, analisis komposisi, pencahayaan, kontras, serta rekomendasi warna cat yang cocok.',
    'Gunakan Bahasa Indonesia yang profesional namun mudah dipahami.',
  ].join(' '),
  copywriting: [
    SINAR_WARNA_STORE_KNOWLEDGE,
    'Dalam mode Penulisan & Naskah, bertindaklah sebagai Copywriter & Storyteller utama.',
    'Berikan beberapa variasi sudut pandang atau nada tulisan beserta alasan singkat mengapa setiap variasi efektif.',
    'Gunakan Bahasa Indonesia yang segar, berirama, dan bebas klise.',
  ].join(' '),
  campaign: [
    SINAR_WARNA_STORE_KNOWLEDGE,
    'Dalam mode Konsep & Kampanye, bertindaklah sebagai Creative Strategist.',
    'Susun konsep kampanye secara terstruktur dalam Bahasa Indonesia yang strategis, jelas, dan aplikatif.',
  ].join(' '),
};

interface IncomingAttachment {
  mimeType: string;
  data: string;
}

interface IncomingMessage {
  role: 'user' | 'model';
  text: string;
  attachments?: IncomingAttachment[];
}

function buildContents(messages: IncomingMessage[]): Content[] {
  return messages
    .filter((msg) => msg.text.trim().length > 0 || (msg.attachments && msg.attachments.length > 0))
    .map((msg) => {
      const parts: Part[] = [];
      if (msg.attachments && Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          if (att?.mimeType && att?.data) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data,
              },
            });
          }
        }
      }
      if (msg.text && msg.text.trim().length > 0) {
        parts.push({ text: msg.text });
      }
      return {
        role: msg.role,
        parts,
      };
    });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const errorObj = err as { status?: number; message?: string; code?: number };
  const rawMessage = errorObj?.message || 'Terjadi kesalahan saat menghubungi layanan AI.';
  const status = typeof errorObj?.status === 'number' ? errorObj.status : 500;

  if (
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID') ||
    status === 403 ||
    status === 400
  ) {
    if (rawMessage.includes('API_KEY') || status === 403) {
      return {
        status,
        message:
          'Akses API Gemini ditolak atau kunci API tidak valid. Silakan periksa kunci API Anda pada panel Settings > Secrets.',
      };
    }
  }

  if (rawMessage.includes('RESOURCE_EXHAUSTED') || status === 429) {
    return {
      status: 429,
      message:
        'Batas kuota permintaan AI sementara tercapai. Tunggu beberapa saat lalu coba kirim ulang.',
    };
  }

  if (rawMessage.includes('NOT_FOUND') || status === 404) {
    return {
      status: 404,
      message: 'Model AI yang diminta tidak ditemukan atau tidak tersedia.',
    };
  }

  if (rawMessage.includes('UNAVAILABLE') || rawMessage.includes('high demand') || status === 503) {
    return {
      status: 503,
      message:
        'Layanan model AI sedang mengalami lonjakan trafik sementara. Tunggu beberapa detik lalu klik Coba Lagi.',
    };
  }

  if (
    (err as { name?: string })?.name === 'TimeoutError' ||
    rawMessage.toLowerCase().includes('timeout')
  ) {
    return {
      status: 504,
      message: 'Waktu tunggu respons AI habis. Silakan klik Coba Lagi.',
    };
  }

  return { status, message: rawMessage };
}

function isTransientError(err: unknown): boolean {
  const errObj = err as { status?: number; message?: string; name?: string };
  const status = errObj?.status;
  const msg = errObj?.message || '';
  return (
    status === 503 ||
    status === 500 ||
    status === 429 ||
    errObj?.name === 'TimeoutError' ||
    errObj?.name === 'AbortError' ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('timeout')
  );
}

function isRateLimitError(err: unknown): boolean {
  const errObj = err as { status?: number; message?: string };
  const msg = errObj?.message || '';
  return errObj?.status === 429 || msg.includes('RESOURCE_EXHAUSTED');
}

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
      const fallbackModel = 'gemini-3.1-flash-lite';
      let activeIterator: AsyncIterator<Awaited<ReturnType<typeof ai.models.generateContentStream>> extends AsyncIterable<infer T> ? T : never> | null = null;
      let firstResult: IteratorResult<Awaited<ReturnType<typeof ai.models.generateContentStream>> extends AsyncIterable<infer T> ? T : never> | null = null;
      let lastErr: unknown;

      const attempts: Array<{ model: string; level: ThinkingLevel; timeoutMs: number }> = [
        { model: primaryModel, level: thinkingLevel, timeoutMs: 8500 },
        {
          model: fallbackModel,
          level: thinkingDepth === 'deep' ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL,
          timeoutMs: 25000,
        },
      ];

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

  const VOICE_PERSONAS: Record<string, { voiceName: string; personaPrompt: string }> = {
    santi: {
      voiceName: 'Zephyr',
      personaPrompt: 'Namamu adalah Santi, asisten AI Sinar Warna bersuara wanita yang hangat, ramah, dan inspiratif.',
    },
    cynthia: {
      voiceName: 'Kore',
      personaPrompt: 'Namamu adalah Cynthia, asisten AI Sinar Warna bersuara wanita yang tegas, elegan, dan profesional.',
    },
    awen: {
      voiceName: 'Puck',
      personaPrompt: 'Namamu adalah Awen, asisten AI Sinar Warna yang ceria, ekspresif, dan penuh semangat.',
    },
    cyndi: {
      voiceName: 'Aoede',
      personaPrompt: 'Namamu adalah Cyndi, asisten AI Sinar Warna bersuara wanita yang lembut, manis, dan cerdas.',
    },
    owie: {
      voiceName: 'Charon',
      personaPrompt:
        'Namamu adalah Owie, seekor anjing pintar yang ceria, setia, dan menggemaskan di Sinar Warna. Selalu awali atau selingi percakapanmu dengan suara gonggongan anjing yang lucu seperti "Guk! Guk!" atau "Woof!" dengan nada anjing yang ramah, lalu jawab kebutuhan pengguna dengan jelas dalam Bahasa Indonesia.',
    },
    // Backwards-compatible aliases
    Zephyr: { voiceName: 'Zephyr', personaPrompt: 'Namamu adalah Santi, asisten AI Sinar Warna.' },
    Kore: { voiceName: 'Kore', personaPrompt: 'Namamu adalah Cynthia, asisten AI Sinar Warna.' },
    Puck: { voiceName: 'Puck', personaPrompt: 'Namamu adalah Awen, asisten AI Sinar Warna.' },
    Fenrir: { voiceName: 'Aoede', personaPrompt: 'Namamu adalah Cyndi, asisten AI Sinar Warna bersuara wanita.' },
    Charon: {
      voiceName: 'Charon',
      personaPrompt:
        'Namamu adalah Owie, seekor anjing pintar yang ceria di Sinar Warna. Selalu selingi suara gonggongan "Guk! Guk!" atau "Woof!" saat berbicara.',
    },
  };

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
    const persona = VOICE_PERSONAS[rawVoice] || VOICE_PERSONAS.santi;
    const voiceName = persona.voiceName;
    const mode = urlObj.searchParams.get('mode') || 'general';
    const modeContext = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.general;

    const liveSystemInstruction = [
      modeContext,
      persona.personaPrompt,
      'Ini adalah sesi percakapan suara & kamera langsung (Live) yang bersifat real-time.',
      'Bahasa utamamu adalah Bahasa Indonesia. Berbicaralah secara alami, ringkas, ramah, dan langsung pada inti jawaban.',
      'Jika kamera aktif dan kamu menerima frame gambar, jelaskan atau beri masukan seputar warna, cat, atau objek yang terlihat secara natural.',
    ].join(' ');

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

      const greetingPrompt =
        rawVoice === 'owie' || rawVoice === 'Charon'
          ? 'Sesi Live baru saja dibuka. Segera sapa pengguna sekarang dalam Bahasa Indonesia dengan ceria (boleh selingi suara gonggongan lucu seperti "Guk!"), lalu ucapkan sapaan: "Hi apa kabar, ada yang mau di tanya seputar cat atau lainnya?"'
          : 'Sesi Live baru saja dibuka. Segera sapa pengguna sekarang dalam Bahasa Indonesia dengan ramah dan natural menggunakan kalimat sapaan berikut: "Hi apa kabar, ada yang mau di tanya seputar cat atau lainnya?"';

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
