import {
  buildCorsHeaders,
  createTimeoutSignal,
  getCloudflareGeminiClient,
  jsonResponse,
  type CfPagesContext,
} from '../../../shared/cfHelpers.ts';
import {
  buildContents,
  formatGeminiError,
  getChatAttempts,
  isRateLimitError,
  isTransientError,
  MODE_INSTRUCTIONS,
  type IncomingMessage,
} from '../../../shared/sinarWarnaPrompt.ts';

export async function onRequestOptions(context: CfPagesContext): Promise<Response> {
  return new Response(null, { status: 204, headers: buildCorsHeaders(context.request) });
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

    const ai = getCloudflareGeminiClient(context.env);
    const contents = buildContents(messages);
    if (contents.length === 0) {
      return jsonResponse(
        context.request,
        { error: 'Tidak ada teks atau gambar valid untuk diproses.' },
        400
      );
    }

    const systemInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.general;
    const attempts = getChatAttempts(thinkingDepth);
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    const streamTask = (async () => {
      try {
        await writer.write(encoder.encode(': connected\n\n'));

        let activeIterator: AsyncIterator<
          Awaited<ReturnType<typeof ai.models.generateContentStream>> extends AsyncIterable<infer T>
            ? T
            : never
        > | null = null;
        let firstResult: IteratorResult<
          Awaited<ReturnType<typeof ai.models.generateContentStream>> extends AsyncIterable<infer T>
            ? T
            : never
        > | null = null;
        let lastErr: unknown;

        for (const step of attempts) {
          if (context.request.signal.aborted) break;
          if (lastErr && isRateLimitError(lastErr) && step.model === attempts[0].model) {
            continue;
          }
          const stepTimer = createTimeoutSignal(context.request.signal, step.timeoutMs);
          try {
            const stream = await ai.models.generateContentStream({
              model: step.model,
              contents,
              config: {
                systemInstruction,
                thinkingConfig: { thinkingLevel: step.level },
                abortSignal: stepTimer.signal,
              },
            });
            const iterator = stream[Symbol.asyncIterator]();
            const first = await iterator.next();
            activeIterator = iterator;
            firstResult = first;
            stepTimer.cleanup();
            break;
          } catch (attemptErr) {
            stepTimer.cleanup();
            lastErr = attemptErr;
            if (context.request.signal.aborted || !isTransientError(attemptErr)) {
              throw attemptErr;
            }
          }
        }

        if (!activeIterator || !firstResult) {
          throw lastErr || new Error('Gagal memulai aliran AI.');
        }

        let current = firstResult;
        while (!current.done) {
          if (context.request.signal.aborted) break;
          const chunkText = current.value?.text;
          if (chunkText) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ text: chunkText })}\n\n`));
          }
          current = await activeIterator.next();
        }

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
