import { type Content, type FunctionCall, type GoogleGenAI, type Part } from '@google/genai';
import { DEFAULT_ADMIN_PHOTO_MEMORIES } from './adminPhotoMemories.ts';
import {
  deleteAdminMemoriesByKeywordServer,
  deletePublicMemoriesByKeywordServer,
  saveAdminMemoryServer,
  savePublicMemoryServer,
  type ServerAuthContext,
} from './firebaseServerAuth.ts';
import {
  buildChatSystemInstruction,
  DEFAULT_ADMIN_PRIVATE_MEMORIES,
  getChatAttempts,
  getChatToolsForUser,
  isRateLimitError,
  isTransientError,
  type AdminMemoryItem,
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

  const useSemiGaul = authContext.isAdmin || authContext.freewill.enabled;
  const includePrivateMemories =
    authContext.canAccessAdminMemories || authContext.freewill.enabled;
  const canManageAdminMemories = Boolean(
    authContext.canAccessAdminMemories && authContext.idToken && authContext.uid
  );
  const canManagePublicMemories = Boolean(
    (authContext.isAdmin || authContext.freewill.enabled) &&
      authContext.authenticated &&
      authContext.idToken &&
      authContext.uid
  );

  const effectiveAdminMemories: AdminMemoryItem[] = (() => {
    const normalizeFounderNick = (item: AdminMemoryItem): AdminMemoryItem => {
      if (
        !authContext.seedFounderAngkuiMetaExists &&
        item.id === 'mem_default_foto_rudi_hongkwe' &&
        item.content.includes('memanggilnya "Kui"')
      ) {
        return {
          ...item,
          content: item.content.replace('memanggilnya "Kui"', 'memanggilnya "Angkui"'),
        };
      }
      return item;
    };

    if (authContext.canAccessAdminMemories) {
      const base: AdminMemoryItem[] =
        authContext.adminMemories.length > 0 ||
        (authContext.seedMetaExists && authContext.adminMemoriesFetchOk)
          ? authContext.adminMemories.map(normalizeFounderNick)
          : [...DEFAULT_ADMIN_PRIVATE_MEMORIES];
      const existingIds = new Set(base.map((m) => m.id));
      if (!authContext.seedFamilyInaMetaExists || !authContext.seedRudiNoteMetaExists) {
        for (const m of DEFAULT_ADMIN_PRIVATE_MEMORIES) {
          if (
            (m.id === 'mem_default_cynthia_cyndi' ||
              m.id === 'mem_default_ina_karyawan' ||
              m.id === 'mem_default_rudi_tidak_serumah') &&
            !existingIds.has(m.id)
          ) {
            base.push(m);
            existingIds.add(m.id);
          }
        }
      }
      for (const p of DEFAULT_ADMIN_PHOTO_MEMORIES) {
        const shouldIncludeFounderFallback =
          p.id === 'mem_default_foto_rudi_hongkwe' && !authContext.seedFounderPhotoMetaExists;
        const shouldIncludeGeneralFallback =
          !authContext.seedPhotoMetaExists || !authContext.adminMemoriesFetchOk;
        if ((shouldIncludeFounderFallback || shouldIncludeGeneralFallback) && !existingIds.has(p.id)) {
          base.push(p);
        }
      }
      return base;
    }
    if (authContext.freewill.enabled) {
      return !authContext.freewill.memoriesSummary
        ? [...DEFAULT_ADMIN_PRIVATE_MEMORIES, ...DEFAULT_ADMIN_PHOTO_MEMORIES]
        : [...DEFAULT_ADMIN_PHOTO_MEMORIES];
    }
    return [];
  })();

  const effectivePublicMemories = [...authContext.publicMemories];

  const photoMemories = includePrivateMemories
    ? effectiveAdminMemories
        .filter((m): m is AdminMemoryItem & { imageData: string } => Boolean(m.imageData))
        .slice(0, 6)
    : [];

  const photoPrimerTurns: Content[] = [];
  if (photoMemories.length > 0) {
    const photoParts: Part[] = [
      {
        text: 'REFERENSI FOTO PENGINGAT ADMIN (GUNAKAN UNTUK MENGENALI STRUKTUR INTI WAJAH ATAU OBJEK SAAT PENGGUNA MENGIRIM FOTO — TETAP KENALI WALAU GANTI GAYA RAMBUT ATAU MEMAKAI/MELEPAS KACAMATA):',
      },
    ];
    for (const pm of photoMemories) {
      photoParts.push({ text: `Foto Referensi [${pm.title}]: ${pm.content}` });
      photoParts.push({ inlineData: { mimeType: 'image/jpeg', data: pm.imageData } });
    }
    photoPrimerTurns.push({ role: 'user', parts: photoParts });
    photoPrimerTurns.push({
      role: 'model',
      parts: [
        {
          text: 'Baik, saya sudah mengingat semua foto referensi pengingat admin beserta keterangannya.',
        },
      ],
    });
  }

  let latestAttachedPhotoBase64: string | undefined;
  for (let i = params.contents.length - 1; i >= 0; i--) {
    if (params.contents[i].role === 'user') {
      const parts = params.contents[i].parts || [];
      for (const p of parts) {
        const mime = p.inlineData?.mimeType || '';
        const data = p.inlineData?.data || '';
        if (mime.startsWith('image/') && data.length > 0 && data.length <= 160000) {
          latestAttachedPhotoBase64 = data;
          break;
        }
      }
      break;
    }
  }

  let workingContents: Content[] = [...photoPrimerTurns, ...params.contents];
  const attempts = getChatAttempts(thinkingDepth);
  const tools = getChatToolsForUser({
    canManageAdminMemories,
    canManagePublicMemories,
  });

  for (let turn = 0; turn < 3; turn++) {
    if (abortSignal.aborted) break;

    const systemInstruction = buildChatSystemInstruction({
      mode,
      useSemiGaul,
      includePrivateMemories,
      adminMemories: effectiveAdminMemories,
      privateMemoriesSummary: authContext.canAccessAdminMemories
        ? undefined
        : authContext.freewill.enabled
        ? authContext.freewill.memoriesSummary
        : undefined,
      publicMemories: effectivePublicMemories,
      canManageAdminMemories,
      canManagePublicMemories,
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

    if (
      functionCalls.length === 0 ||
      (!canManageAdminMemories && !canManagePublicMemories) ||
      !authContext.idToken ||
      !authContext.uid
    ) {
      break;
    }

    const responseParts: Part[] = [];
    for (const fc of functionCalls) {
      const name = fc.name || '';
      const args = (fc.args || {}) as Record<string, unknown>;

      if (name === 'save_admin_memory' && canManageAdminMemories) {
        const title = String(args.title || 'Pengingat Admin').trim();
        const content = String(args.content || '').trim();
        const shouldAttachPhoto = args.useAttachedPhoto !== false && Boolean(latestAttachedPhotoBase64);
        const saved = await saveAdminMemoryServer({
          idToken: authContext.idToken,
          uid: authContext.uid,
          email: authContext.email || '',
          title,
          content,
          ...(shouldAttachPhoto ? { imageData: latestAttachedPhotoBase64 } : {}),
        });
        if (saved.ok && saved.memory) {
          effectiveAdminMemories.push(saved.memory);
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
      } else if (name === 'delete_admin_memory' && canManageAdminMemories) {
        const keyword = String(args.keyword || '').trim();
        const deleted = await deleteAdminMemoriesByKeywordServer({
          idToken: authContext.idToken,
          keyword,
        });
        if (deleted.ok && deleted.deletedTitles.length > 0) {
          const lowerDeleted = deleted.deletedTitles.map((t) => t.toLowerCase());
          for (let i = effectiveAdminMemories.length - 1; i >= 0; i--) {
            if (lowerDeleted.includes(effectiveAdminMemories[i].title.toLowerCase())) {
              effectiveAdminMemories.splice(i, 1);
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
      } else if (name === 'save_public_memory' && canManagePublicMemories) {
        const title = String(args.title || 'Pengingat Umum').trim();
        const content = String(args.content || '').trim();
        const saved = await savePublicMemoryServer({
          idToken: authContext.idToken,
          uid: authContext.uid,
          title,
          content,
        });
        if (saved.ok && saved.memory) {
          effectivePublicMemories.push(saved.memory);
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
      } else if (name === 'delete_public_memory' && canManagePublicMemories) {
        const keyword = String(args.keyword || '').trim();
        const deleted = await deletePublicMemoriesByKeywordServer({
          idToken: authContext.idToken,
          keyword,
        });
        if (deleted.ok && deleted.deletedTitles.length > 0) {
          const lowerDeleted = deleted.deletedTitles.map((t) => t.toLowerCase());
          for (let i = effectivePublicMemories.length - 1; i >= 0; i--) {
            if (lowerDeleted.includes(effectivePublicMemories[i].title.toLowerCase())) {
              effectivePublicMemories.splice(i, 1);
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
