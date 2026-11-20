import { ThinkingLevel } from '@google/genai';
import {
  buildCorsHeaders,
  createTimeoutSignal,
  getCloudflareGeminiClient,
  jsonResponse,
  type CfPagesContext,
} from '../../shared/cfHelpers.ts';
import { formatGeminiError, isTransientError } from '../../shared/sinarWarnaPrompt.ts';

export async function onRequestOptions(context: CfPagesContext): Promise<Response> {
  return new Response(null, { status: 204, headers: buildCorsHeaders(context.request) });
}

export async function onRequestPost(context: CfPagesContext): Promise<Response> {
  try {
    const body = (await context.request.json().catch(() => ({}))) as { prompt?: string };
    const prompt = body.prompt;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return jsonResponse(context.request, { error: 'Prompt diperlukan untuk membuat judul.' }, 400);
    }

    const ai = getCloudflareGeminiClient(context.env);
    const titlePrompt = `Buat judul singkat maksimal 5 kata dalam Bahasa Indonesia (tanpa tanda kutip, tanpa tanda titik akhir) yang merangkum topik kreatif berikut:\n\n${prompt.slice(0, 400)}`;

    let response;
    const primaryTimeout = createTimeoutSignal(context.request.signal, 7000);
    try {
      response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: titlePrompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: primaryTimeout.signal,
        },
      });
    } catch (err) {
      if (!isTransientError(err)) throw err;
      const fallbackTimeout = createTimeoutSignal(context.request.signal, 12000);
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: titlePrompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
            abortSignal: fallbackTimeout.signal,
          },
        });
      } finally {
        fallbackTimeout.cleanup();
      }
    } finally {
      primaryTimeout.cleanup();
    }

    const title = (response.text || '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\.+$/, '')
      .trim()
      .slice(0, 60);

    return jsonResponse(context.request, { title: title || 'Sesi Kreatif Baru' });
  } catch (err) {
    const { status, message } = formatGeminiError(err);
    return jsonResponse(context.request, { error: message }, status);
  }
}
