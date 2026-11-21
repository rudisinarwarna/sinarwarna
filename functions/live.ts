import { getCloudflareGeminiClient, type CfPagesContext } from '../shared/cfHelpers.ts';
import { resolveServerAuthContext } from '../shared/firebaseServerAuth.ts';
import { createLiveBridge, type LiveClientMessage } from '../shared/liveSessionManager.ts';
import { formatGeminiError } from '../shared/sinarWarnaPrompt.ts';

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
  const token = urlObj.searchParams.get('token');

  let bridge: ReturnType<typeof createLiveBridge> | null = null;
  let closedByClient = false;
  const earlyMessages: LiveClientMessage[] = [];

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

  const safeClose = () => {
    if (!closedByClient && serverWs.readyState === 1) {
      try {
        serverWs.close();
      } catch {
        // Ignore close error
      }
    }
  };

  serverWs.addEventListener('close', () => {
    closedByClient = true;
    bridge?.close();
    bridge = null;
    resolveDone();
  });

  serverWs.addEventListener('error', () => {
    closedByClient = true;
    bridge?.close();
    bridge = null;
    resolveDone();
  });

  serverWs.addEventListener('message', (event: MessageEvent) => {
    if (closedByClient) return;
    try {
      const raw = typeof event.data === 'string' ? event.data : String(event.data);
      const msg = JSON.parse(raw) as LiveClientMessage;
      if (!bridge) {
        if (earlyMessages.length < 30) {
          earlyMessages.push(msg);
        }
        return;
      }
      bridge.handleClientMessage(msg);
    } catch {
      // Ignore malformed message
    }
  });

  const runLive = (async () => {
    try {
      const authContext = await resolveServerAuthContext(token);
      if (closedByClient) {
        resolveDone();
        return;
      }

      if (authContext.isBlocked) {
        safeSend({
          error: 'Akun Anda telah diblokir atau dihapus oleh Administrator Sinar Warna.',
        });
        safeClose();
        resolveDone();
        return;
      }

      const ai = getCloudflareGeminiClient(context.env, 'v1beta');
      bridge = createLiveBridge({
        ai,
        initialVoice: rawVoice,
        mode,
        authContext,
        sendJson: safeSend,
        closeClient: safeClose,
        onDone: resolveDone,
      });

      await bridge.start();

      while (earlyMessages.length > 0 && bridge && !closedByClient) {
        const queued = earlyMessages.shift();
        if (queued) {
          bridge.handleClientMessage(queued);
        }
      }

      await donePromise;
    } catch (err) {
      const { message } = formatGeminiError(err);
      safeSend({ error: message });
      safeClose();
      resolveDone();
    }
  })();

  context.waitUntil?.(runLive);

  return new Response(null, {
    status: 101,
    webSocket: clientWs,
  } as unknown as ResponseInit);
}
