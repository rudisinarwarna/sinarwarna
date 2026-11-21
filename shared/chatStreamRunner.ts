import { type Content, type FunctionCall, type GoogleGenAI, type Part } from '@google/genai';
import {
  deleteAdminMemoriesByKeywordServer,
  saveAdminMemoryServer,
  type ServerAuthContext,
} from './firebaseServerAuth.ts';
import {
  buildChatSystemInstruction,
  DEFAULT_ADMIN_PRIVATE_MEMORIES,
  getChatAttempts,
  getChatToolsForUser,
  isRateLimitError,
  isTransientError,
} from './sinarWarnaPrompt.ts';

export interface ChatStreamEvent {
  text?: string;
  memoryAction?: {
    type: 'saved' | 'deleted';
    detail: string;
  };
}

function createTimeoutSignalCompat(
  parentSignal: AbortSignal,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onParentAbort = () => {
    controller.abort(
      parentSignal.reason || Object.assign(new Error('Aborted'), { name: 'AbortError' })
    );
  };
  if (parentSignal.aborted) {
    onParentAbort();
    return { signal: controller.signal, cleanup: () => {} };
  }
  parentSignal.addEventListener('abort', onParentAbort, { once: true });
  const timer = setTimeout(() => {
    controller.abort(Object.assign(new Error('Request timeout'), { name: 'TimeoutError' }));
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      parentSignal.removeEventListener('abort', onParentAbort);
    },
  };
}

export async function runChatStreamWithTools(params: {
  ai: GoogleGenAI;
  contents: Content[];
  mode: string;
  thinkingDepth: 'fast' | 'deep';
  authContext: ServerAuthContext;
  abortSignal: AbortSignal;
  onEvent: (event: ChatStreamEvent) => Promise<void> | void;
}): Promise<void> {
  const { ai, mode, thinkingDepth, authContext, abortSignal, onEvent } = params;

  const effectiveMemories = authContext.isAdmin
    ? authContext.adminMemories.length > 0 || authContext.seedMetaExists
      ? [...authContext.adminMemories]
      : [...DEFAULT_ADMIN_PRIVATE_MEMORIES]
    : [];

  let workingContents: Content[] = [...params.contents];
  const attempts = getChatAttempts(thinkingDepth);
  const tools = getChatToolsForUser(authContext.isAdmin);

  for (let turn = 0; turn < 3; turn++) {
    if (abortSignal.aborted) break;

    const systemInstruction = buildChatSystemInstruction({
      mode,
      isAdmin: authContext.isAdmin,
      adminMemories: effectiveMemories,
    });

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
      if (abortSignal.aborted) break;
      if (lastErr && isRateLimitError(lastErr) && step.model === attempts[0].model) {
        continue;
      }
      const stepTimer = createTimeoutSignalCompat(abortSignal, step.timeoutMs);
      try {
        const stream = await ai.models.generateContentStream({
          model: step.model,
          contents: workingContents,
          config: {
            systemInstruction,
            ...(tools ? { tools } : {}),
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
        if (abortSignal.aborted || !isTransientError(attemptErr)) {
          throw attemptErr;
        }
      }
    }

    if (!activeIterator || !firstResult) {
      throw lastErr || new Error('Gagal memulai aliran AI.');
    }

    const collectedModelParts: Part[] = [];
    const functionCalls: FunctionCall[] = [];

    let current = firstResult;
    while (!current.done) {
      if (abortSignal.aborted) break;
      const chunk = current.value;
      const candidateParts = chunk?.candidates?.[0]?.content?.parts;
      if (Array.isArray(candidateParts) && candidateParts.length > 0) {
        collectedModelParts.push(...candidateParts);
      }
      if (Array.isArray(chunk?.functionCalls) && chunk.functionCalls.length > 0) {
        for (const fc of chunk.functionCalls) {
          functionCalls.push(fc);
        }
      }
      if (chunk?.text) {
        await onEvent({ text: chunk.text });
      }
      current = await activeIterator.next();
    }

    if (functionCalls.length === 0 || !authContext.isAdmin || !authContext.idToken || !authContext.uid) {
      break;
    }

    const responseParts: Part[] = [];
    for (const fc of functionCalls) {
      const name = fc.name || '';
      const args = (fc.args || {}) as Record<string, unknown>;

      if (name === 'save_admin_memory') {
        const title = String(args.title || 'Pengingat Pribadi').trim();
        const content = String(args.content || '').trim();
        const saved = await saveAdminMemoryServer({
          idToken: authContext.idToken,
          uid: authContext.uid,
          email: authContext.email || '',
          title,
          content,
        });
        if (saved.ok && saved.memory) {
          effectiveMemories.push(saved.memory);
          await onEvent({
            memoryAction: { type: 'saved', detail: saved.memory.title },
          });
        }
        responseParts.push({
          functionResponse: {
            name,
            ...(fc.id ? { id: fc.id } : {}),
            response: saved.ok
              ? { ok: true, id: saved.memory?.id, title: saved.memory?.title }
              : { ok: false, error: saved.error },
          },
        });
      } else if (name === 'delete_admin_memory') {
        const keyword = String(args.keyword || '').trim();
        const deleted = await deleteAdminMemoriesByKeywordServer({
          idToken: authContext.idToken,
          keyword,
        });
        if (deleted.ok && deleted.deletedTitles.length > 0) {
          const lowerDeleted = deleted.deletedTitles.map((t) => t.toLowerCase());
          for (let i = effectiveMemories.length - 1; i >= 0; i--) {
            if (lowerDeleted.includes(effectiveMemories[i].title.toLowerCase())) {
              effectiveMemories.splice(i, 1);
            }
          }
          await onEvent({
            memoryAction: { type: 'deleted', detail: deleted.deletedTitles.join(', ') },
          });
        }
        responseParts.push({
          functionResponse: {
            name,
            ...(fc.id ? { id: fc.id } : {}),
            response: deleted.ok
              ? { ok: true, deletedTitles: deleted.deletedTitles }
              : { ok: false, error: deleted.error },
          },
        });
      }
    }

    if (responseParts.length === 0) break;

    workingContents = [
      ...workingContents,
      { role: 'model', parts: collectedModelParts },
      { role: 'user', parts: responseParts },
    ];
  }
}
