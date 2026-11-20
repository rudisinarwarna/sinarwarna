import { GoogleGenAI } from '@google/genai';

export interface CfEnv {
  GEMINI_API_KEY?: string;
}

export interface CfPagesContext {
  request: Request;
  env: CfEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export function buildCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...buildCorsHeaders(request),
    },
  });
}

export function getApiKeyFromEnv(env: CfEnv): string | null {
  const fromCf = env?.GEMINI_API_KEY;
  const fromProc =
    typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
  const key = (fromCf || fromProc || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return key;
}

export function getCloudflareGeminiClient(env: CfEnv, apiVersion?: string): GoogleGenAI {
  const apiKey = getApiKeyFromEnv(env);
  if (!apiKey) {
    throw Object.assign(
      new Error(
        'Kunci API Gemini (GEMINI_API_KEY) belum dikonfigurasi pada Cloudflare Pages Variables & Secrets.'
      ),
      { status: 400 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      ...(apiVersion ? { apiVersion } : {}),
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function createTimeoutSignal(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onParentAbort = () => {
    controller.abort(parentSignal?.reason || Object.assign(new Error('Aborted'), { name: 'AbortError' }));
  };

  if (parentSignal?.aborted) {
    onParentAbort();
    return { signal: controller.signal, cleanup: () => {} };
  }

  parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  const timer = setTimeout(() => {
    controller.abort(Object.assign(new Error('Request timeout'), { name: 'TimeoutError' }));
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onParentAbort);
    },
  };
}
