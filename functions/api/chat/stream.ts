import {
  buildCorsHeaders,
  getCloudflareGeminiClient,
  jsonResponse,
  type CfPagesContext,
} from '../../../shared/cfHelpers.ts';
import { runChatStreamWithTools } from '../../../shared/chatStreamRunner.ts';
import { resolveServerAuthContext } from '../../../shared/firebaseServerAuth.ts';
import {
  buildContents,
  formatGeminiError,
  type IncomingMessage,
} from '../../../shared/sinarWarnaPrompt.ts';

export async function onRequestOptions(context: CfPagesContext): Promise<Response> {
  return new Response(null, { status: 204, headers: buildCorsHeaders(context.request) });
}

function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function onRequestPost(context: CfPagesContext): Promise<Response> {
  try {
    const body = (await context.request.json().catch(() => ({}))) as {
      messages?: IncomingMessage[];
      mode?: string;
      thinkingDepth?: 'fast' | 'deep';
    };

    const { messages, mode = 'general', thinkingDepth = 'fast' } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse(context.request, { error: 'Pesan percakapan tidak boleh kosong.' }, 400);
    }

    const bearerToken = extractBearerToken(context.request.headers.get('Authorization'));
    const authContext = await resolveServerAuthContext(bearerToken);
    if (authContext.isBlocked) {
      return jsonResponse(
        context.request,
        { error: 'Akun Anda telah diblokir atau dihapus oleh Administrator Sinar Warna.' },
        403
      );
    }

    const ai = getCloudflareGeminiClient(context.env);
    const contents = buildContents(messages);
    if (contents.length === 0) {
      return jsonResponse(
        context.request,
        { error: 'Tidak ada teks atau gambar valid untuk diproses.' },
        400
      );
    }

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    const streamTask = (async () => {
      try {
        await writer.write(encoder.encode(': connected\n\n'));

        await runChatStreamWithTools({
          ai,
          contents,
          mode,
          thinkingDepth,
          authContext,
          abortSignal: context.request.signal,
          onEvent: async (event) => {
            if (!context.request.signal.aborted) {
              await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
          },
        });

        if (!context.request.signal.aborted) {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        }
      } catch (err) {
        if (!(context.request.signal.aborted && (err as Error)?.name === 'AbortError')) {
          const { message } = formatGeminiError(err);
          try {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
          } catch {
            // Ignore write after close
          }
        }
      } finally {
        try {
          await writer.close();
        } catch {
          // Ignore close error
        }
      }
    })();

    context.waitUntil?.(streamTask);

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        ...buildCorsHeaders(context.request),
      },
    });
  } catch (err) {
    const { status, message } = formatGeminiError(err);
    return jsonResponse(context.request, { error: message }, status);
  }
}
