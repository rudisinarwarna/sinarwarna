import {
  FunctionResponseScheduling,
  InteractionStatus,
  Modality,
  ThinkingLevel,
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
  location?: { lat: number; lng: number } | null;
  locationDenied?: boolean;
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
  language?: string;
  currentDateText?: string;
  initialUserLocation?: { lat: number; lng: number } | null;
  initialCamera?: boolean;
  authContext: ServerAuthContext;
  sendJson: (payload: unknown) => void;
  closeClient: () => void;
  onDone?: () => void;
}): LiveBridgeController {
  const {
    ai,
    mode,
    language = 'id',
    currentDateText,
    initialUserLocation = null,
    initialCamera = false,
    authContext,
    sendJson,
    closeClient,
    onDone,
  } = params;

  let currentVoice: CanonicalVoiceId = normalizePersonaId(params.initialVoice);
  let userLocation: { lat: number; lng: number } | null = initialUserLocation;
  let pendingLocationResolvers: Array<(loc: { lat: number; lng: number } | null) => void> = [];
  let preferExtendedThinking = false;
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
        const shouldIncludeOwieFallback =
          p.id === 'mem_default_foto_owie' && !authContext.seedOwiePhotoMetaExists;
        const shouldIncludeGeneralFallback =
          !authContext.seedPhotoMetaExists || !authContext.adminMemoriesFetchOk;
        if (
          (shouldIncludeFounderFallback ||
            shouldIncludeChrisFallback ||
            shouldIncludeOwieFallback ||
            shouldIncludeGeneralFallback) &&
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
  let pendingEndSession = false;
  let sawFarewellOutputSinceEndCall = false;
  let endSessionTimer: ReturnType<typeof setTimeout> | null = null;
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

  const clearEndSessionTimer = () => {
    if (endSessionTimer !== null) {
      clearTimeout(endSessionTimer);
      endSessionTimer = null;
    }
  };

  const resolvePendingLocationWaiters = (loc: { lat: number; lng: number } | null) => {
    const waiters = pendingLocationResolvers;
    pendingLocationResolvers = [];
    for (const resolve of waiters) {
      resolve(loc);
    }
  };

  const waitForUserLocation = (timeoutMs = 3500): Promise<{ lat: number; lng: number } | null> => {
    if (userLocation) return Promise.resolve(userLocation);
    sendJson({ requestLocation: true });
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingLocationResolvers = pendingLocationResolvers.filter((fn) => fn !== onResolved);
        resolve(userLocation);
      }, timeoutMs);
      const onResolved = (loc: { lat: number; lng: number } | null) => {
        clearTimeout(timer);
        resolve(loc);
      };
      pendingLocationResolvers.push(onResolved);
    });
  };

  const runLiveWebSearch = async (paramsSearch: {
    query: string;
    searchType?: string;
    needsUserLocation?: boolean;
  }): Promise<{
    answer: string;
    sources: Array<{ title: string; uri: string }>;
    mapsUri?: string;
    searchType: 'web' | 'places';
  }> => {
    const cleanQuery = paramsSearch.query.trim();
    const isPlaces = paramsSearch.searchType === 'places';
    const wantsTrafficOrRoute =
      /\b(jarak|macet|kemacetan|lalu lintas|traffic|rute|route|arah|estimasi|waktu tempuh|berapa menit|berapa jam|terdekat|nearest|mall|mal|pusat perbelanjaan)\b/i.test(
        cleanQuery
      );

    if ((paramsSearch.needsUserLocation || isPlaces) && !userLocation) {
      await waitForUserLocation(3500);
    }

    const searchPrompt = [
      `Pertanyaan pengguna: ${cleanQuery}`,
      currentDateText ? `Waktu sekarang: ${currentDateText}.` : '',
      userLocation
        ? `Lokasi GPS pengguna saat ini: latitude ${userLocation.lat.toFixed(5)}, longitude ${userLocation.lng.toFixed(5)} (gunakan titik koordinat GPS ini sebagai asal pencarian terdekat/jarak/rute).`
        : 'Lokasi GPS spesifik tidak tersedia; gunakan konteks area umum atau Tangerang/Jakarta jika relevan.',
      'Berikan ringkasan fakta paling lengkap, akurat, langsung ke inti, beserta nama tempat terdekat, perkiraan jarak/waktu tempuh, alamat, atau kondisi rute/lalu lintas nyatanya secara ringkas agar langsung bisa dibacakan asisten suara (JANGAN menyuruh pengguna mencari sendiri).',
    ]
      .filter(Boolean)
      .join('\n');

    const runMapsQuery = () =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: searchPrompt,
        config: {
          tools: [{ googleMaps: {} }],
          ...(userLocation
            ? {
                toolConfig: {
                  retrievalConfig: {
                    latLng: {
                      latitude: userLocation.lat,
                      longitude: userLocation.lng,
                    },
                  },
                },
              }
            : {}),
          abortSignal: AbortSignal.timeout(18000),
        },
      });

    const runSearchQuery = () =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: searchPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          abortSignal: AbortSignal.timeout(18000),
        },
      });

    const responsesToMerge: Array<Awaited<ReturnType<typeof runMapsQuery>>> = [];
    if (isPlaces) {
      if (wantsTrafficOrRoute) {
        const [mapsRes, searchRes] = await Promise.allSettled([runMapsQuery(), runSearchQuery()]);
        if (mapsRes.status === 'fulfilled') responsesToMerge.push(mapsRes.value);
        if (searchRes.status === 'fulfilled') responsesToMerge.push(searchRes.value);
        if (responsesToMerge.length === 0) {
          throw (mapsRes.status === 'rejected' ? mapsRes.reason : new Error('Gagal mencari lokasi.'));
        }
      } else {
        responsesToMerge.push(await runMapsQuery());
      }
    } else {
      responsesToMerge.push(await runSearchQuery());
    }

    const sourcesMap = new Map<string, { title: string; uri: string }>();
    const textParts: string[] = [];
    let firstMapsUri: string | undefined;

    for (const resp of responsesToMerge) {
      const txt = (resp.text || '').trim();
      if (txt) textParts.push(txt);
      const chunks = resp.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunks)) {
        for (const c of chunks) {
          if (c?.web?.uri && !sourcesMap.has(c.web.uri)) {
            sourcesMap.set(c.web.uri, {
              title: (c.web.title || c.web.uri).trim(),
              uri: c.web.uri,
            });
          }
          if (c?.maps?.uri) {
            if (!firstMapsUri) firstMapsUri = c.maps.uri;
            if (!sourcesMap.has(c.maps.uri)) {
              sourcesMap.set(c.maps.uri, {
                title: (c.maps.title || 'Google Maps').trim(),
                uri: c.maps.uri,
              });
            }
          }
        }
      }
    }

    const answer = textParts.join('\n\n').trim() || 'Informasi belum ditemukan.';
    const sources = Array.from(sourcesMap.values()).slice(0, 6);
    const mapsUri =
      firstMapsUri ||
      (isPlaces
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanQuery)}`
        : undefined);

    return {
      answer,
      sources,
      mapsUri,
      searchType: isPlaces ? 'places' : 'web',
    };
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
      const cleanData = (pm.imageData || '')
        .replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '')
        .trim();
      if (!cleanData) continue;
      parts.push({
        text: `Foto Referensi [${pm.title}]: ${pm.content}`,
      });
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanData,
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
    pendingEndSession = false;
    sawFarewellOutputSinceEndCall = false;
    clearEndSessionTimer();
    owieCaptionSentThisTurn = false;
    lastOwieCaptionAt = 0;
    owieRawBuffer = '';
    sessionPrimedPhotos = false;

    const sessionGen = ++activeSessionGeneration;
    const useExtendedThinking = preferExtendedThinking;
    const liveModel = useExtendedThinking ? 'gemini-3.8-live-extended-thinking' : 'gemini-3.8-live';

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
        nonBlockingTools: useExtendedThinking,
        language,
        currentDateText,
        userLocation,
      });

    const isStillCurrent = () => !closedByClient && sessionGen === activeSessionGeneration;
    let openNotified = false;
    let readySent = false;
    let sessionTerminatedEarly = false;
    let earlyTerminationMessage = '';
    let earlyTerminationRaw = '';

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

    let thisSession: LiveSession;
    try {
      thisSession = await ai.live.connect({
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          ...(useExtendedThinking
            ? {
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.HIGH,
                },
              }
            : {}),
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
                  scheduling?: FunctionResponseScheduling;
                }> = [];

                const attachScheduling = () =>
                  useExtendedThinking ? { scheduling: FunctionResponseScheduling.WHEN_IDLE } : {};

                for (const fc of toolCalls) {
                  const name = fc.name || '';
                  const args = (fc.args || {}) as Record<string, unknown>;

                  try {
                    if (name === 'search_web') {
                      const query = String(args.query || '').trim();
                      const searchType = String(args.searchType || 'web');
                      const needsUserLocation = Boolean(args.needsUserLocation);
                      if (!query) {
                        responses.push({
                          id: fc.id,
                          name,
                          response: { ok: false, error: 'Query pencarian kosong.' },
                          ...attachScheduling(),
                        });
                      } else {
                        const result = await runLiveWebSearch({
                          query,
                          searchType,
                          needsUserLocation,
                        });
                        pushRecentTurn(`Kartu di layar Live (${query}): ${result.answer.slice(0, 140)}`);
                        sendJson({
                          liveSearchCard: {
                            query,
                            summary: result.answer,
                            searchType: result.searchType,
                            sources: result.sources,
                            mapsUri: result.mapsUri,
                          },
                        });
                        responses.push({
                          id: fc.id,
                          name,
                          response: {
                            ok: true,
                            displayedOnUserScreen: true,
                            answer: result.answer,
                            sources: result.sources,
                            ...(result.mapsUri ? { mapsUri: result.mapsUri } : {}),
                            instruction:
                              'DATA REAL-TIME SUDAH DITERIMA DAN LANGSUNG DITAMPILKAN SEBAGAI KARTU DI LAYAR LIVE PENGGUNA. SEGERA bacakan dan jelaskan ringkasan jawabannya (tempat, jarak, rute, kondisi lalu lintas, atau fakta angkanya) secara langsung dan percaya diri sesuai kartu layar! Jangan pernah bilang tidak tahu, tidak bisa lihat layar, atau cek sendiri di Google Maps.',
                          },
                          ...attachScheduling(),
                        });
                      }
                    } else if (name === 'switch_persona') {
                      const requested = normalizePersonaId(String(args.targetPersona || ''));
                      if (requested === currentVoice) {
                        responses.push({
                          id: fc.id,
                          name,
                          response: {
                            ok: false,
                            message: `Pengguna sudah berbicara dengan ${PERSONA_DISPLAY_NAMES[currentVoice]}.`,
                          },
                          ...attachScheduling(),
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
                          ...attachScheduling(),
                        });
                      }
                    } else if (name === 'end_live_session') {
                      pendingEndSession = true;
                      sawFarewellOutputSinceEndCall = false;
                      clearEndSessionTimer();
                      sendJson({ endingSession: true });
                      endSessionTimer = setTimeout(() => {
                        if (pendingEndSession && !closedByClient) {
                          pendingEndSession = false;
                          sawFarewellOutputSinceEndCall = false;
                          sendJson({ endSessionWhenAudioDone: true });
                        }
                      }, 7500);
                      responses.push({
                        id: fc.id,
                        name,
                        response: {
                          ok: true,
                          closingAfterReply: true,
                          instruction:
                            currentVoice === 'owie'
                              ? `Panggil owie_caption dengan salam perpisahan singkat dan ramah dalam Bahasa Indonesia (jika belum), lalu tutup dengan "Guk!". Setelah giliranmu selesai, sesi Live akan otomatis dimatikan.`
                              : useSemiGaul
                              ? `Ucapkan salam perpisahan singkat dan santai pakai gayamu (misalnya: "Oke siap, dadah! Kapan-kapan ngobrol lagi ya!"), lalu akhiri giliranmu. Sesi Live akan otomatis dimatikan setelah kamu selesai berbicara.`
                              : `Ucapkan salam perpisahan singkat yang hangat dan ramah sesuai bahasa pengguna (misalnya: "Baik, terima kasih sudah mengobrol! Sampai jumpa lagi ya!"), lalu akhiri giliranmu. Sesi Live akan otomatis dimatikan setelah kamu selesai berbicara.`,
                        },
                        ...attachScheduling(),
                      });
                    } else if (name === 'owie_caption') {
                      const replyText = String(args.indonesian_reply || '').trim();
                      if (replyText) {
                        owieCaptionSentThisTurn = true;
                        if (pendingEndSession) {
                          sawFarewellOutputSinceEndCall = true;
                        }
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
                        ...attachScheduling(),
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
                          ...attachScheduling(),
                        });
                      } else {
                        responses.push({
                          id: fc.id,
                          name,
                          response: {
                            ok: false,
                            error: 'Khusus akun Admin, Admin+, atau Admin Utama terverifikasi.',
                          },
                          ...attachScheduling(),
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
                          ...attachScheduling(),
                        });
                      } else {
                        responses.push({
                          id: fc.id,
                          name,
                          response: {
                            ok: false,
                            error: 'Khusus akun Admin, Admin+, atau Admin Utama terverifikasi.',
                          },
                          ...attachScheduling(),
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
                          ...attachScheduling(),
                        });
                      } else {
                        responses.push({
                          id: fc.id,
                          name,
                          response: {
                            ok: false,
                            error: 'Khusus akun Admin terverifikasi ke atas.',
                          },
                          ...attachScheduling(),
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
                          ...attachScheduling(),
                        });
                      } else {
                        responses.push({
                          id: fc.id,
                          name,
                          response: {
                            ok: false,
                            error: 'Khusus akun Admin terverifikasi ke atas.',
                          },
                          ...attachScheduling(),
                        });
                      }
                    } else {
                      responses.push({
                        id: fc.id,
                        name,
                        response: { ok: false, error: `Fungsi ${name} tidak dikenali.` },
                        ...attachScheduling(),
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
                      ...attachScheduling(),
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
              if (pendingEndSession) {
                sawFarewellOutputSinceEndCall = true;
              }
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
                if (pendingEndSession) {
                  sawFarewellOutputSinceEndCall = true;
                }
                sendJson({ audio: part.inlineData.data, voice: currentVoice });
              }
            }

            if (content?.interrupted) {
              sendJson({ interrupted: true });
            }

            const interactionDone =
              content?.turnComplete ||
              (useExtendedThinking && content?.interactionStatus === InteractionStatus.IDLE);

            if (content?.turnComplete) {
              if (currentVoice === 'owie') {
                const recentlyCaptioned = Date.now() - lastOwieCaptionAt < 12000;
                if (!owieCaptionSentThisTurn && !recentlyCaptioned && owieRawBuffer.trim()) {
                  if (pendingEndSession) {
                    sawFarewellOutputSinceEndCall = true;
                  }
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

              if (pendingEndSession && sawFarewellOutputSinceEndCall && !closedByClient) {
                pendingEndSession = false;
                sawFarewellOutputSinceEndCall = false;
                clearEndSessionTimer();
                sendJson({ endSessionWhenAudioDone: true });
              } else if (pendingSwitchTarget && !isSwapping && !closedByClient) {
                const target = pendingSwitchTarget;
                void performPersonaHandoff(target);
              }
            } else if (interactionDone) {
              sendJson({ turnComplete: true });
              if (pendingEndSession && sawFarewellOutputSinceEndCall && !closedByClient) {
                pendingEndSession = false;
                sawFarewellOutputSinceEndCall = false;
                clearEndSessionTimer();
                sendJson({ endSessionWhenAudioDone: true });
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
              earlyTerminationRaw = rawDetail;
              return;
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
              earlyTerminationRaw = `${ce?.code || ''} ${ce?.reason || ''}`;
              return;
            }
            if (isSwapping || isReconnecting) return;
            void attemptAutoReconnect(info.message, info.retryable);
          },
        },
      });
    } catch (connectErr) {
      if (useExtendedThinking && !closedByClient) {
        const msgStr = connectErr instanceof Error ? connectErr.message : String(connectErr);
        const lower = msgStr.toLowerCase();
        const isQuotaOrKey =
          lower.includes('resource_exhausted') ||
          lower.includes('quota') ||
          lower.includes('api_key') ||
          lower.includes('api key');
        if (!isQuotaOrKey) {
          preferExtendedThinking = false;
          await connectPersonaSession(targetVoice, handoffFrom, isReconnect);
          return;
        }
      }
      throw connectErr;
    }

    if (!isStillCurrent() || sessionTerminatedEarly) {
      try {
        thisSession.close();
      } catch {
        // Ignore close error
      }
      if (useExtendedThinking && sessionTerminatedEarly && !closedByClient) {
        const lowerEarly = earlyTerminationRaw.toLowerCase();
        const isQuotaOrKey =
          lowerEarly.includes('resource_exhausted') ||
          lowerEarly.includes('quota') ||
          lowerEarly.includes('api_key') ||
          lowerEarly.includes('api key');
        if (!isQuotaOrKey) {
          preferExtendedThinking = false;
          await connectPersonaSession(targetVoice, handoffFrom, isReconnect);
          return;
        }
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

      if (msg.location && typeof msg.location.lat === 'number' && typeof msg.location.lng === 'number') {
        userLocation = { lat: msg.location.lat, lng: msg.location.lng };
        resolvePendingLocationWaiters(userLocation);
        return;
      }

      if (msg.locationDenied) {
        resolvePendingLocationWaiters(null);
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
      clearEndSessionTimer();
      resolvePendingLocationWaiters(null);
      pendingSwitchTarget = null;
      pendingEndSession = false;
      sawFarewellOutputSinceEndCall = false;
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
