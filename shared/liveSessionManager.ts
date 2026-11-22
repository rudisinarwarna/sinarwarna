import {
  Modality,
  type Content,
  type GoogleGenAI,
  type LiveServerMessage,
  type Part,
} from '@google/genai';
import { DEFAULT_ADMIN_PHOTO_MEMORIES } from './adminPhotoMemories.ts';
import {
  deleteAdminMemoriesByKeywordServer,
  deletePublicMemoriesByKeywordServer,
  fetchLiveOpeningGreetingServer,
  saveAdminMemoryServer,
  savePublicMemoryServer,
  type ServerAuthContext,
} from './firebaseServerAuth.ts';
import {
  buildLivePersonaSessionConfig,
  DEFAULT_ADMIN_PRIVATE_MEMORIES,
  formatGeminiError,
  normalizePersonaId,
  PERSONA_DISPLAY_NAMES,
  type AdminMemoryItem,
  type CanonicalVoiceId,
} from './sinarWarnaPrompt.ts';

type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

export interface LiveClientMessage {
  audio?: string;
  video?: string;
  text?: string;
  switchVoice?: string;
  ping?: boolean;
}

export interface LiveBridgeController {
  start: () => Promise<void>;
  handleClientMessage: (msg: LiveClientMessage) => void;
  close: () => void;
}

export function createLiveBridge(params: {
  ai: GoogleGenAI;
  initialVoice: string;
  mode: string;
  initialCamera?: boolean;
  authContext: ServerAuthContext;
  sendJson: (payload: unknown) => void;
  closeClient: () => void;
  onDone?: () => void;
}): LiveBridgeController {
  const { ai, mode, initialCamera = false, authContext, sendJson, closeClient, onDone } = params;

  let currentVoice: CanonicalVoiceId = normalizePersonaId(params.initialVoice);
  const useSemiGaul = authContext.isAdmin || authContext.freewill.enabled;
  const includePrivateMemories =
    authContext.canAccessAdminMemories || authContext.freewill.enabled;
  const canUseAdminMemories = Boolean(
    authContext.canAccessAdminMemories && authContext.idToken && authContext.uid
  );
  const canManagePublicMemories = Boolean(
    (authContext.isAdmin || authContext.freewill.enabled) &&
      authContext.authenticated &&
      authContext.idToken &&
      authContext.uid
  );
  const adminMemories: AdminMemoryItem[] = (() => {
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
      if (
        !authContext.seedFamilyInaMetaExists ||
        !authContext.seedRudiNoteMetaExists ||
        !authContext.seedSelfCameraReactMetaExists
      ) {
        for (const m of DEFAULT_ADMIN_PRIVATE_MEMORIES) {
          if (
            (m.id === 'mem_default_cynthia_cyndi' ||
              m.id === 'mem_default_ina_karyawan' ||
              m.id === 'mem_default_rudi_tidak_serumah' ||
              m.id === 'mem_default_reaksi_kamera_keluarga') &&
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
        const shouldIncludeChrisFallback =
          p.id === 'mem_default_foto_chris' && !authContext.seedChrisPhotoMetaExists;
        const shouldIncludeGeneralFallback =
          !authContext.seedPhotoMetaExists || !authContext.adminMemoriesFetchOk;
        if (
          (shouldIncludeFounderFallback || shouldIncludeChrisFallback || shouldIncludeGeneralFallback) &&
          !existingIds.has(p.id)
        ) {
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

  const getPhotoMemories = (): Array<{ title: string; content: string; imageData: string }> => {
    if (!includePrivateMemories) return [];
    return adminMemories
      .filter((m): m is AdminMemoryItem & { imageData: string } => Boolean(m.imageData))
      .slice(0, 8);
  };
  const publicMemories = [...authContext.publicMemories];

  let activeSession: LiveSession | null = null;
  let activeSessionGeneration = 0;
  let closedByClient = false;
  let isSwapping = false;
  let isReconnecting = false;
  let reconnectAttempts = 0;
  let pendingSwitchTarget: CanonicalVoiceId | null = null;
  let switchTimer: ReturnType<typeof setTimeout> | null = null;
  let owieCaptionSentThisTurn = false;
  let lastOwieCaptionAt = 0;
  let owieRawBuffer = '';
  let customOpeningGreeting = '';
  let cameraEverActivated = initialCamera;
  let sessionPrimedPhotos = false;

  const recentTurns: string[] = [];

  const pushRecentTurn = (line: string) => {
    const clean = line.trim();
    if (!clean) return;
    recentTurns.push(clean.slice(0, 180));
    if (recentTurns.length > 5) {
      recentTurns.shift();
    }
  };

  const clearSwitchTimer = () => {
    if (switchTimer !== null) {
      clearTimeout(switchTimer);
      switchTimer = null;
    }
  };

  const buildPhotoPrimerParts = (): Part[] => {
    const photoMemories = getPhotoMemories();
    if (photoMemories.length === 0) return [];
    const parts: Part[] = [
      {
        text: 'REFERENSI FOTO PENGINGAT ADMIN (HAPALKAN STRUKTUR INTI WAJAH & KETERANGAN INI UNTUK MENGENALI ORANG/OBJEK SAAT KAMERA LIVE AKTIF — TETAP KENALI WALAU MEREKA GANTI GAYA RAMBUT ATAU MEMAKAI/MELEPAS KACAMATA):',
      },
    ];
    for (const pm of photoMemories) {
      parts.push({
        text: `Foto Referensi [${pm.title}]: ${pm.content}`,
      });
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: pm.imageData,
        },
      });
    }
    return parts;
  };

  const formatLiveCloseInfo = (code?: number, reason?: string): { message: string; retryable: boolean } => {
    const cleanReason = (reason || '').trim();
    const lower = cleanReason.toLowerCase();
    if (
      lower.includes('resource_exhausted') ||
      lower.includes('quota') ||
      lower.includes('rate') ||
      lower.includes('limit') ||
      lower.includes('exceeded') ||
      code === 429
    ) {
      return {
        message: `Batas kuota / limit Gemini Live API habis${cleanReason ? ` (${cleanReason})` : ''}. Tunggu beberapa menit atau periksa kuota GEMINI_API_KEY Anda.`,
        retryable: false,
      };
    }
    if (
      code === 1008 ||
      lower.includes('api_key') ||
      lower.includes('api key') ||
      lower.includes('permission') ||
      lower.includes('unauthorized') ||
      lower.includes('not found')
    ) {
      return {
        message: `Akses Gemini Live ditolak (${code || 1008}${cleanReason ? `: ${cleanReason}` : ''}). Periksa GEMINI_API_KEY atau izin model.`,
        retryable: false,
      };
    }
    if (code === 1007 || lower.includes('invalid')) {
      return {
        message: `Permintaan ke Gemini Live tidak valid (${code}${cleanReason ? `: ${cleanReason}` : ''}).`,
        retryable: false,
      };
    }
    const detail =
      code && code !== 1000
        ? `Sesi Gemini Live ditutup (${code}${cleanReason ? `: ${cleanReason}` : ''}).`
        : 'Sesi Gemini Live terputus. Tekan Sambung Ulang untuk melanjutkan.';
    return { message: detail, retryable: true };
  };

  const forwardInputToSession = (session: LiveSession, msg: LiveClientMessage) => {
    try {
      if (msg.audio) {
        session.sendRealtimeInput({
          audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
        });
      }
      if (msg.video) {
        cameraEverActivated = true;
        if (!sessionPrimedPhotos) {
          sessionPrimedPhotos = true;
          const photoParts = buildPhotoPrimerParts();
          if (photoParts.length > 0) {
            try {
              session.sendClientContent({
                turns: [
                  {
                    role: 'user',
                    parts: [
                      ...photoParts,
                      {
                        text: 'Kamera Live baru saja aktif. Hafalkan semua foto referensi Pengingat Admin ini untuk mengenali wajah di kamera, lalu jawab sangat singkat ("Siap, kamera aktif!") tanpa kalimat panjang.',
                      },
                    ],
                  },
                ],
                turnComplete: true,
              });
            } catch (primeErr) {
              console.warn('[Live lazy photo prime]', primeErr instanceof Error ? primeErr.message : primeErr);
            }
          }
        }
        session.sendRealtimeInput({
          video: { data: msg.video, mimeType: 'image/jpeg' },
        });
      }
      if (msg.text) {
        session.sendRealtimeInput({ text: msg.text });
      }
    } catch (err) {
      console.warn('[Live forwardInputToSession]', err instanceof Error ? err.message : err);
    }
  };

  const performPersonaHandoff = async (targetVoice: CanonicalVoiceId) => {
    if (closedByClient || isSwapping || targetVoice === currentVoice) {
      pendingSwitchTarget = null;
      clearSwitchTimer();
      return;
    }

    isSwapping = true;
    pendingSwitchTarget = null;
    clearSwitchTimer();
    activeSessionGeneration += 1;

    const prevVoice = currentVoice;
    const oldSession = activeSession;
    activeSession = null;

    try {
      oldSession?.close();
    } catch {
      // Ignore close error on old session
    }

    sendJson({
      switchingVoice: targetVoice,
      fromVoice: prevVoice,
      handoffNotice: `Memanggil ${PERSONA_DISPLAY_NAMES[targetVoice]}...`,
    });

    try {
      await connectPersonaSession(targetVoice, prevVoice, false);
    } catch (err) {
      const { message } = formatGeminiError(err);
      sendJson({ error: message });
      if (!closedByClient) {
        closeClient();
        onDone?.();
      }
    } finally {
      isSwapping = false;
    }
  };

  const attemptAutoReconnect = async (reasonDetail: string, retryable = true) => {
    if (closedByClient || isSwapping || isReconnecting) return;
    if (!retryable || reconnectAttempts >= 2) {
      sendJson({
        error: reasonDetail || 'Sesi Gemini Live terputus. Tekan Sambung Ulang untuk melanjutkan.',
      });
      closeClient();
      onDone?.();
      return;
    }

    reconnectAttempts += 1;
    isReconnecting = true;
    activeSessionGeneration += 1;
    const oldSession = activeSession;
    activeSession = null;

    try {
      oldSession?.close();
    } catch {
      // Ignore close error
    }

    sendJson({
      handoffNotice: 'Menyambungkan ulang sesi Live...',
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (closedByClient) return;
      await connectPersonaSession(currentVoice, null, true);
    } catch (err) {
      const { message } = formatGeminiError(err);
      sendJson({ error: message || reasonDetail });
      if (!closedByClient) {
        closeClient();
        onDone?.();
      }
    } finally {
      isReconnecting = false;
    }
  };

  const connectPersonaSession = async (
    targetVoice: CanonicalVoiceId,
    handoffFrom: CanonicalVoiceId | null,
    isReconnect: boolean
  ) => {
    if (closedByClient) return;

    currentVoice = targetVoice;
    owieCaptionSentThisTurn = false;
    lastOwieCaptionAt = 0;
    owieRawBuffer = '';
    sessionPrimedPhotos = false;

    const sessionGen = ++activeSessionGeneration;

    const { voiceName, liveSystemInstruction, greetingPrompt, tools } =
      buildLivePersonaSessionConfig(targetVoice, mode, {
        useSemiGaul,
        includePrivateMemories,
        adminMemories,
        privateMemoriesSummary: authContext.canAccessAdminMemories
          ? undefined
          : authContext.freewill.enabled
          ? authContext.freewill.memoriesSummary
          : undefined,
        publicMemories,
        canManageAdminMemories: canUseAdminMemories,
        canManagePublicMemories,
        handoffFrom,
        recentContext: recentTurns.join(' | '),
        customOpeningGreeting: !handoffFrom && !isReconnect ? customOpeningGreeting : undefined,
      });

    const isStillCurrent = () => !closedByClient && sessionGen === activeSessionGeneration;
    let openNotified = false;
    let readySent = false;
    let sessionTerminatedEarly = false;
    let earlyTerminationMessage = '';

    const emitReadyIfCurrent = () => {
      if (readySent || sessionTerminatedEarly || !activeSession || !isStillCurrent()) return;
      readySent = true;
      if (isReconnect) {
        sendJson({ sessionReady: true, voice: targetVoice });
      } else if (!handoffFrom) {
        sendJson({ ready: true, voice: targetVoice });
      } else {
        sendJson({ switchedVoiceReady: targetVoice });
      }
    };

    const thisSession = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: liveSystemInstruction,
        tools,
      },
      callbacks: {
        onopen: () => {
          if (!isStillCurrent() || sessionTerminatedEarly) return;
          openNotified = true;
          emitReadyIfCurrent();
        },
        onmessage: (message: LiveServerMessage) => {
          if (!isStillCurrent()) return;

          const toolCalls = message.toolCall?.functionCalls;
          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            void (async () => {
              const responses: Array<{
                id?: string;
                name?: string;
                response: Record<string, unknown>;
              }> = [];

              for (const fc of toolCalls) {
                const name = fc.name || '';
                const args = (fc.args || {}) as Record<string, unknown>;

                try {
                  if (name === 'switch_persona') {
                    const requested = normalizePersonaId(String(args.targetPersona || ''));
                    if (requested === currentVoice) {
                      responses.push({
                        id: fc.id,
                        name,
                        response: {
                          ok: false,
                          message: `Pengguna sudah berbicara dengan ${PERSONA_DISPLAY_NAMES[currentVoice]}.`,
                        },
                      });
                    } else {
                      pendingSwitchTarget = requested;
                      clearSwitchTimer();
                      switchTimer = setTimeout(() => {
                        if (pendingSwitchTarget && !closedByClient) {
                          void performPersonaHandoff(pendingSwitchTarget);
                        }
                      }, currentVoice === 'owie' ? 2200 : 5200);
                      responses.push({
                        id: fc.id,
                        name,
                        response: {
                          ok: true,
                          targetPersona: PERSONA_DISPLAY_NAMES[requested],
                          instruction:
                            currentVoice === 'owie'
                              ? `Panggil owie_caption bahwa Owie akan memanggilkan ${PERSONA_DISPLAY_NAMES[requested]}, lalu akhiri giliranmu singkat.`
                              : useSemiGaul
                              ? `Ucapkan sekarang dengan gaya semi-gaul lu/gua menggunakan suaramu sendiri bahwa kamu mau memanggilkan ${PERSONA_DISPLAY_NAMES[requested]} (misalnya: "Oke tunggu bentar ya, gua panggilin ${PERSONA_DISPLAY_NAMES[requested]} dulu nih!").`
                              : `Ucapkan sekarang dengan singkat dan ramah menggunakan suaramu sendiri bahwa kamu akan memanggilkan ${PERSONA_DISPLAY_NAMES[requested]} (misalnya: "Ok tunggu sebentar, akan saya panggilkan ${PERSONA_DISPLAY_NAMES[requested]}").`,
                        },
                      });
                    }
                  } else if (name === 'owie_caption') {
                    const replyText = String(args.indonesian_reply || '').trim();
                    if (replyText) {
                      owieCaptionSentThisTurn = true;
                      lastOwieCaptionAt = Date.now();
                      pushRecentTurn(`Topik Owie: ${replyText}`);
                      sendJson({
                        outputTranscript: replyText,
                        fromOwieCaption: true,
                        owieBark: true,
                        voice: 'owie',
                      });
                    }
                    responses.push({
                      id: fc.id,
                      name,
                      response: {
                        ok: true,
                        captionDisplayed: true,
                        barkPlayed: true,
                        nextStep:
                          "Teks jawaban sudah tampil di layar dan suara gonggongan Chihuahua asli sudah diputar. Selesaikan giliranmu sekarang dengan singkat ('Guk!').",
                      },
                    });
                  } else if (name === 'save_admin_memory') {
                    if (canUseAdminMemories && authContext.idToken && authContext.uid) {
                      const title = String(args.title || 'Pengingat Admin').trim();
                      const content = String(args.content || '').trim();
                      const saved = await saveAdminMemoryServer({
                        idToken: authContext.idToken,
                        uid: authContext.uid,
                        email: authContext.email || '',
                        title,
                        content,
                      });
                      if (saved.ok && saved.memory) {
                        adminMemories.push(saved.memory);
                        sendJson({
                          memoryAction: { type: 'saved', detail: saved.memory.title },
                        });
                      }
                      responses.push({
                        id: fc.id,
                        name,
                        response: saved.ok
                          ? { ok: true, title: saved.memory?.title }
                          : { ok: false, error: saved.error },
                      });
                    } else {
                      responses.push({
                        id: fc.id,
                        name,
                        response: {
                          ok: false,
                          error: 'Khusus akun Admin, Admin+, atau Admin Utama terverifikasi.',
                        },
                      });
                    }
                  } else if (name === 'delete_admin_memory') {
                    if (canUseAdminMemories && authContext.idToken) {
                      const keyword = String(args.keyword || '').trim();
                      const deleted = await deleteAdminMemoriesByKeywordServer({
                        idToken: authContext.idToken,
                        keyword,
                      });
                      if (deleted.ok && deleted.deletedTitles.length > 0) {
                        const lowerDeleted = deleted.deletedTitles.map((t) => t.toLowerCase());
                        for (let i = adminMemories.length - 1; i >= 0; i--) {
                          if (lowerDeleted.includes(adminMemories[i].title.toLowerCase())) {
                            adminMemories.splice(i, 1);
                          }
                        }
                        sendJson({
                          memoryAction: {
                            type: 'deleted',
                            detail: deleted.deletedTitles.join(', '),
                          },
                        });
                      }
                      responses.push({
                        id: fc.id,
                        name,
                        response: deleted.ok
                          ? { ok: true, deletedTitles: deleted.deletedTitles }
                          : { ok: false, error: deleted.error },
                      });
                    } else {
                      responses.push({
                        id: fc.id,
                        name,
                        response: {
                          ok: false,
                          error: 'Khusus akun Admin, Admin+, atau Admin Utama terverifikasi.',
                        },
                      });
                    }
                  } else if (name === 'save_public_memory') {
                    if (canManagePublicMemories && authContext.idToken && authContext.uid) {
                      const title = String(args.title || 'Pengingat Umum').trim();
                      const content = String(args.content || '').trim();
                      const saved = await savePublicMemoryServer({
                        idToken: authContext.idToken,
                        uid: authContext.uid,
                        title,
                        content,
                      });
                      if (saved.ok && saved.memory) {
                        publicMemories.push(saved.memory);
                        sendJson({
                          memoryAction: { type: 'saved', detail: saved.memory.title },
                        });
                      }
                      responses.push({
                        id: fc.id,
                        name,
                        response: saved.ok
                          ? { ok: true, title: saved.memory?.title }
                          : { ok: false, error: saved.error },
                      });
                    } else {
                      responses.push({
                        id: fc.id,
                        name,
                        response: {
                          ok: false,
                          error: 'Khusus akun Admin terverifikasi ke atas.',
                        },
                      });
                    }
                  } else if (name === 'delete_public_memory') {
                    if (canManagePublicMemories && authContext.idToken) {
                      const keyword = String(args.keyword || '').trim();
                      const deleted = await deletePublicMemoriesByKeywordServer({
                        idToken: authContext.idToken,
                        keyword,
                      });
                      if (deleted.ok && deleted.deletedTitles.length > 0) {
                        const lowerDeleted = deleted.deletedTitles.map((t) => t.toLowerCase());
                        for (let i = publicMemories.length - 1; i >= 0; i--) {
                          if (lowerDeleted.includes(publicMemories[i].title.toLowerCase())) {
                            publicMemories.splice(i, 1);
                          }
                        }
                        sendJson({
                          memoryAction: {
                            type: 'deleted',
                            detail: deleted.deletedTitles.join(', '),
                          },
                        });
                      }
                      responses.push({
                        id: fc.id,
                        name,
                        response: deleted.ok
                          ? { ok: true, deletedTitles: deleted.deletedTitles }
                          : { ok: false, error: deleted.error },
                      });
                    } else {
                      responses.push({
                        id: fc.id,
                        name,
                        response: {
                          ok: false,
                          error: 'Khusus akun Admin terverifikasi ke atas.',
                        },
                      });
                    }
                  } else {
                    responses.push({
                      id: fc.id,
                      name,
                      response: { ok: false, error: `Fungsi ${name} tidak dikenali.` },
                    });
                  }
                } catch (toolErr) {
                  responses.push({
                    id: fc.id,
                    name,
                    response: {
                      ok: false,
                      error:
                        toolErr instanceof Error
                          ? toolErr.message
                          : 'Terjadi kesalahan saat menjalankan aksi.',
                    },
                  });
                }
              }

              if (responses.length > 0 && isStillCurrent()) {
                try {
                  thisSession.sendToolResponse({ functionResponses: responses });
                } catch {
                  // Ignore tool response send failure on closing session
                }
              }
            })();
          }

          const content = message.serverContent;
          if (content?.inputTranscription?.text) {
            pushRecentTurn(`Pengguna: ${content.inputTranscription.text}`);
            sendJson({ inputTranscript: content.inputTranscription.text });
          }

          if (content?.outputTranscription?.text) {
            reconnectAttempts = 0;
            if (currentVoice === 'owie') {
              owieRawBuffer += content.outputTranscription.text;
            } else {
              pushRecentTurn(`Topik: ${content.outputTranscription.text}`);
              sendJson({
                outputTranscript: content.outputTranscription.text,
                voice: currentVoice,
              });
            }
          }

          for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data && currentVoice !== 'owie') {
              reconnectAttempts = 0;
              sendJson({ audio: part.inlineData.data, voice: currentVoice });
            }
          }

          if (content?.interrupted) {
            sendJson({ interrupted: true });
          }

          if (content?.turnComplete) {
            if (currentVoice === 'owie') {
              const recentlyCaptioned = Date.now() - lastOwieCaptionAt < 12000;
              if (!owieCaptionSentThisTurn && !recentlyCaptioned && owieRawBuffer.trim()) {
                sendJson({
                  outputTranscript: owieRawBuffer.trim(),
                  fromOwieCaption: true,
                  owieBark: true,
                  voice: 'owie',
                });
              }
              owieCaptionSentThisTurn = false;
              owieRawBuffer = '';
            }
            sendJson({ turnComplete: true });

            if (pendingSwitchTarget && !isSwapping && !closedByClient) {
              const target = pendingSwitchTarget;
              void performPersonaHandoff(target);
            }
          }
        },
        onerror: (errEvent: unknown) => {
          if (!isStillCurrent()) return;
          const ev = errEvent as { message?: string; error?: { message?: string } };
          const rawDetail = ev?.error?.message || ev?.message || String(errEvent);
          const info = formatLiveCloseInfo(undefined, rawDetail);
          if (!readySent) {
            sessionTerminatedEarly = true;
            earlyTerminationMessage = info.message;
          }
          if (isSwapping || isReconnecting) return;
          void attemptAutoReconnect(info.message, info.retryable);
        },
        onclose: (closeEvent: unknown) => {
          if (!isStillCurrent()) return;
          const ce = closeEvent as { code?: number; reason?: string };
          const info = formatLiveCloseInfo(ce?.code, ce?.reason);
          if (!readySent) {
            sessionTerminatedEarly = true;
            earlyTerminationMessage = info.message;
          }
          if (isSwapping || isReconnecting) return;
          void attemptAutoReconnect(info.message, info.retryable);
        },
      },
    });

    if (!isStillCurrent() || sessionTerminatedEarly) {
      try {
        thisSession.close();
      } catch {
        // Ignore close error
      }
      if (sessionTerminatedEarly && earlyTerminationMessage) {
        throw new Error(earlyTerminationMessage);
      }
      return;
    }

    activeSession = thisSession;

    const shouldGreet = !isReconnect || recentTurns.length === 0;
    const photoParts = cameraEverActivated ? buildPhotoPrimerParts() : [];
    const turnsToSend: Content[] = [];

    if (photoParts.length > 0 && shouldGreet) {
      sessionPrimedPhotos = true;
      turnsToSend.push({ role: 'user', parts: photoParts });
      turnsToSend.push({
        role: 'model',
        parts: [
          {
            text: 'Baik, semua foto referensi pengingat admin sudah saya hafalkan dan siap digunakan untuk mengenali wajah maupun objek di kamera Live.',
          },
        ],
      });
    }

    if (shouldGreet) {
      turnsToSend.push({ role: 'user', parts: [{ text: greetingPrompt }] });
    }

    if (turnsToSend.length > 0 && isStillCurrent() && !sessionTerminatedEarly) {
      try {
        thisSession.sendClientContent({
          turns: turnsToSend,
          turnComplete: true,
        });
      } catch (clientContentErr) {
        console.warn(
          '[Live initial sendClientContent]',
          clientContentErr instanceof Error ? clientContentErr.message : clientContentErr
        );
      }
    }

    if (openNotified) {
      emitReadyIfCurrent();
    } else {
      emitReadyIfCurrent();
    }
  };

  return {
    start: async () => {
      customOpeningGreeting = await fetchLiveOpeningGreetingServer().catch(() => '');
      if (closedByClient) return;
      await connectPersonaSession(currentVoice, null, false);
    },
    handleClientMessage: (msg: LiveClientMessage) => {
      if (closedByClient) return;

      if (msg.ping) {
        sendJson({ pong: true });
        return;
      }

      if (msg.switchVoice) {
        const requested = normalizePersonaId(msg.switchVoice);
        if (requested !== currentVoice && !isSwapping) {
          void performPersonaHandoff(requested);
        }
        return;
      }

      if (!activeSession || isSwapping || isReconnecting) {
        return;
      }
      forwardInputToSession(activeSession, msg);
    },
    close: () => {
      closedByClient = true;
      activeSessionGeneration += 1;
      clearSwitchTimer();
      pendingSwitchTarget = null;
      const s = activeSession;
      activeSession = null;
      try {
        s?.close();
      } catch {
        // Ignore close error
      }
      onDone?.();
    },
  };
}
