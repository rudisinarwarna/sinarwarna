import { Modality, type GoogleGenAI, type LiveServerMessage } from '@google/genai';
import { getCloudflareGeminiClient, type CfPagesContext } from '../shared/cfHelpers.ts';
import {
  buildLivePersonaSessionConfig,
  formatGeminiError,
} from '../shared/sinarWarnaPrompt.ts';

interface CfWebSocket extends WebSocket {
  accept(): void;
}

declare const WebSocketPair: {
  new (): { 0: CfWebSocket; 1: CfWebSocket };
};

export async function onRequestGet(context: CfPagesContext): Promise<Response> {
  const upgradeHeader = context.request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const pair = new WebSocketPair();
  const clientWs = pair[0];
  const serverWs = pair[1];
  serverWs.accept();

  const urlObj = new URL(context.request.url);
  const rawVoice = urlObj.searchParams.get('voice') || 'santi';
  const mode = urlObj.searchParams.get('mode') || 'general';
  const { voiceName, liveSystemInstruction, greetingPrompt } = buildLivePersonaSessionConfig(
    rawVoice,
    mode
  );

  let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
  let closedByClient = false;
  const pendingInputs: Array<{ audio?: string; video?: string; text?: string }> = [];

  let resolveDone: () => void = () => {};
  const donePromise = new Promise<void>((res) => {
    resolveDone = res;
  });

  const safeSend = (payload: unknown) => {
    if (closedByClient || serverWs.readyState !== 1) return;
    try {
      serverWs.send(JSON.stringify(payload));
    } catch {
      // Ignore send error on closing socket
    }
  };

  const forwardInputToSession = (
    activeSession: NonNullable<typeof session>,
    msg: { audio?: string; video?: string; text?: string }
  ) => {
    if (msg.audio) {
      activeSession.sendRealtimeInput({
        audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
      });
    }
    if (msg.video) {
      activeSession.sendRealtimeInput({
        video: { data: msg.video, mimeType: 'image/jpeg' },
      });
    }
    if (msg.text) {
      activeSession.sendRealtimeInput({ text: msg.text });
    }
  };

  serverWs.addEventListener('close', () => {
    closedByClient = true;
    try {
      session?.close();
    } catch {
      // Ignore close error
    }
    session = null;
    resolveDone();
  });

  serverWs.addEventListener('error', () => {
    closedByClient = true;
    try {
      session?.close();
    } catch {
      // Ignore close error
    }
    session = null;
    resolveDone();
  });

  serverWs.addEventListener('message', (event: MessageEvent) => {
    if (closedByClient) return;
    try {
      const raw = typeof event.data === 'string' ? event.data : String(event.data);
      const msg = JSON.parse(raw) as { audio?: string; video?: string; text?: string };
      if (!session) {
        if (pendingInputs.length < 30) {
          pendingInputs.push(msg);
        }
        return;
      }
      forwardInputToSession(session, msg);
    } catch {
      // Ignore malformed message
    }
  });

  const runLive = (async () => {
    try {
      const ai = getCloudflareGeminiClient(context.env, 'v1beta');
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
            safeSend({ ready: true });
          },
          onmessage: (message: LiveServerMessage) => {
            if (closedByClient || serverWs.readyState !== 1) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              safeSend({ inputTranscript: content.inputTranscription.text });
            }
            if (content?.outputTranscription?.text) {
              safeSend({ outputTranscript: content.outputTranscription.text });
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                safeSend({ audio: part.inlineData.data });
              }
            }
            if (content?.interrupted) {
              safeSend({ interrupted: true });
            }
            if (content?.turnComplete) {
              safeSend({ turnComplete: true });
            }
          },
          onerror: (errEvent: unknown) => {
            const ev = errEvent as { message?: string; error?: { message?: string } };
            const detail = ev?.error?.message || ev?.message || String(errEvent);
            safeSend({
              error: `Koneksi Gemini Live mengalami gangguan (${detail}). Silakan coba sambungkan ulang.`,
            });
          },
          onclose: (closeEvent: unknown) => {
            const ce = closeEvent as { code?: number; reason?: string };
            if (ce?.code && ce.code !== 1000) {
              safeSend({
                error: `Sesi Gemini Live ditutup (${ce.code}${ce.reason ? `: ${ce.reason}` : ''}).`,
              });
            }
            if (!closedByClient && serverWs.readyState === 1) {
              try {
                serverWs.close();
              } catch {
                // Ignore close error
              }
            }
            resolveDone();
          },
        },
      });

      if (closedByClient) {
        session.close();
        resolveDone();
        return;
      }

      try {
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
          turnComplete: true,
        });
      } catch {
        // Non-fatal greeting error
      }

      while (pendingInputs.length > 0 && session && !closedByClient) {
        const queued = pendingInputs.shift();
        if (queued) {
          forwardInputToSession(session, queued);
        }
      }

      await donePromise;
    } catch (err) {
      const { message } = formatGeminiError(err);
      safeSend({ error: message });
      if (!closedByClient && serverWs.readyState === 1) {
        try {
          serverWs.close();
        } catch {
          // Ignore close error
        }
      }
      resolveDone();
    }
  })();

  context.waitUntil?.(runLive);

  return new Response(null, {
    status: 101,
    webSocket: clientWs,
  } as unknown as ResponseInit);
}
