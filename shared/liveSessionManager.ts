import {
  Modality,
  type GoogleGenAI,
  type LiveServerMessage,
} from '@google/genai';
import {
  deleteAdminMemoriesByKeywordServer,
  saveAdminMemoryServer,
  type ServerAuthContext,
} from './firebaseServerAuth.ts';
import {
  buildLivePersonaSessionConfig,
  DEFAULT_ADMIN_PRIVATE_MEMORIES,
  formatGeminiError,
  normalizePersonaId,
  PERSONA_DISPLAY_NAMES,
  type CanonicalVoiceId,
} from './sinarWarnaPrompt.ts';

type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

export interface LiveClientMessage {
  audio?: string;
  video?: string;
  text?: string;
  switchVoice?: string;
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
  authContext: ServerAuthContext;
  sendJson: (payload: unknown) => void;
  closeClient: () => void;
  onDone?: () => void;
}): LiveBridgeController {
  const { ai, mode, authContext, sendJson, closeClient, onDone } = params;

  let currentVoice: CanonicalVoiceId = normalizePersonaId(params.initialVoice);
  const adminMemories = authContext.isAdmin
    ? authContext.adminMemories.length > 0 || authContext.seedMetaExists
      ? [...authContext.adminMemories]
      : [...DEFAULT_ADMIN_PRIVATE_MEMORIES]
    : [];

  let activeSession: LiveSession | null = null;
  let closedByClient = false;
  let isSwapping = false;
  let pendingSwitchTarget: CanonicalVoiceId | null = null;
  let switchTimer: ReturnType<typeof setTimeout> | null = null;
  let owieCaptionSentThisTurn = false;
  let lastOwieCaptionAt = 0;
  let owieRawBuffer = '';

  const recentTurns: string[] = [];
  const pendingInputs: LiveClientMessage[] = [];

  const pushRecentTurn = (line: string) => {
    const clean = line.trim();
    if (!clean) return;
    recentTurns.push(clean.slice(0, 200));
    if (recentTurns.length > 6) {
      recentTurns.shift();
    }
  };

  const clearSwitchTimer = () => {
    if (switchTimer !== null) {
      clearTimeout(switchTimer);
      switchTimer = null;
    }
  };

  const forwardInputToSession = (session: LiveSession, msg: LiveClientMessage) => {
    if (msg.audio) {
      session.sendRealtimeInput({
        audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
      });
    }
    if (msg.video) {
      session.sendRealtimeInput({
        video: { data: msg.video, mimeType: 'image/jpeg' },
      });
    }
    if (msg.text) {
      session.sendRealtimeInput({ text: msg.text });
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
      await connectPersonaSession(targetVoice, prevVoice);
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

  const connectPersonaSession = async (
    targetVoice: CanonicalVoiceId,
    handoffFrom: CanonicalVoiceId | null
  ) => {
    if (closedByClient) return;

    currentVoice = targetVoice;
    owieCaptionSentThisTurn = false;
    lastOwieCaptionAt = 0;
    owieRawBuffer = '';

    const { voiceName, liveSystemInstruction, greetingPrompt, tools } =
      buildLivePersonaSessionConfig(targetVoice, mode, {
        isAdmin: authContext.isAdmin,
        adminMemories,
        handoffFrom,
        recentContext: recentTurns.join(' | '),
      });

    let thisSession: LiveSession | null = null;

    thisSession = await ai.live.connect({
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
          if (closedByClient) return;
          if (!handoffFrom) {
            sendJson({ ready: true, voice: targetVoice });
          } else {
            sendJson({ switchedVoiceReady: targetVoice });
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (closedByClient || thisSession !== activeSession) return;

          const toolCalls = message.toolCall?.functionCalls;
          if (Array.isArray(toolCalls) && toolCalls.length > 0 && thisSession) {
            void (async () => {
              const responses: Array<{
                id?: string;
                name?: string;
                response: Record<string, unknown>;
              }> = [];

              for (const fc of toolCalls) {
                const name = fc.name || '';
                const args = (fc.args || {}) as Record<string, unknown>;

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
                    }, 5200);
                    responses.push({
                      id: fc.id,
                      name,
                      response: {
                        ok: true,
                        targetPersona: PERSONA_DISPLAY_NAMES[requested],
                        instruction:
                          currentVoice === 'owie'
                            ? `Panggil owie_caption bahwa kamu akan memanggilkan ${PERSONA_DISPLAY_NAMES[requested]}, lalu menggonggonglah sekali saja tanpa kata manusia.`
                            : `Ucapkan sekarang dengan singkat dan ramah bahwa kamu akan memanggilkan ${PERSONA_DISPLAY_NAMES[requested]} (misalnya: "Ok tunggu sebentar, akan saya panggilkan ${PERSONA_DISPLAY_NAMES[requested]}").`,
                      },
                    });
                  }
                } else if (name === 'owie_caption') {
                  const replyText = String(args.indonesian_reply || '').trim();
                  if (replyText) {
                    owieCaptionSentThisTurn = true;
                    lastOwieCaptionAt = Date.now();
                    pushRecentTurn(`Owie: ${replyText}`);
                    sendJson({
                      outputTranscript: replyText,
                      fromOwieCaption: true,
                      voice: 'owie',
                    });
                  }
                  responses.push({
                    id: fc.id,
                    name,
                    response: {
                      ok: true,
                      captionDisplayed: true,
                      nextStep:
                        "Sekarang SEGERA keluarkan SUARA GONGGONGAN anjing Chihuahua asli ('Guk! Guk! Yap yap! Arf!') TANPA mengucapkan satu pun kata manusia!",
                    },
                  });
                } else if (name === 'save_admin_memory') {
                  if (authContext.isAdmin && authContext.idToken && authContext.uid) {
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
                      response: { ok: false, error: 'Khusus akun admin terverifikasi.' },
                    });
                  }
                } else if (name === 'delete_admin_memory') {
                  if (authContext.isAdmin && authContext.idToken) {
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
                      response: { ok: false, error: 'Khusus akun admin terverifikasi.' },
                    });
                  }
                }
              }

              if (responses.length > 0 && thisSession && thisSession === activeSession && !closedByClient) {
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
            pushRecentTurn(`User: ${content.inputTranscription.text}`);
            sendJson({ inputTranscript: content.inputTranscription.text });
          }

          if (content?.outputTranscription?.text) {
            if (currentVoice === 'owie') {
              owieRawBuffer += content.outputTranscription.text;
            } else {
              pushRecentTurn(
                `${PERSONA_DISPLAY_NAMES[currentVoice]}: ${content.outputTranscription.text}`
              );
              sendJson({
                outputTranscript: content.outputTranscription.text,
                voice: currentVoice,
              });
            }
          }

          for (const part of content?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              sendJson({ audio: part.inlineData.data });
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
                  outputTranscript: `[Owie menggonggong] ${owieRawBuffer.trim()}`,
                  fromOwieCaption: true,
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
          if (closedByClient || thisSession !== activeSession || isSwapping) return;
          const ev = errEvent as { message?: string; error?: { message?: string } };
          const detail = ev?.error?.message || ev?.message || String(errEvent);
          sendJson({
            error: `Koneksi Gemini Live mengalami gangguan (${detail}). Silakan coba sambungkan ulang.`,
          });
        },
        onclose: (closeEvent: unknown) => {
          if (closedByClient || isSwapping || thisSession !== activeSession) return;
          const ce = closeEvent as { code?: number; reason?: string };
          if (ce?.code && ce.code !== 1000) {
            sendJson({
              error: `Sesi Gemini Live ditutup (${ce.code}${ce.reason ? `: ${ce.reason}` : ''}).`,
            });
          }
          closeClient();
          onDone?.();
        },
      },
    });

    if (closedByClient) {
      try {
        thisSession.close();
      } catch {
        // Ignore close error
      }
      return;
    }

    activeSession = thisSession;

    try {
      thisSession.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
        turnComplete: true,
      });
    } catch {
      // Non-fatal greeting error
    }

    while (pendingInputs.length > 0 && activeSession && !closedByClient) {
      const queued = pendingInputs.shift();
      if (queued) {
        forwardInputToSession(activeSession, queued);
      }
    }
  };

  return {
    start: async () => {
      await connectPersonaSession(currentVoice, null);
    },
    handleClientMessage: (msg: LiveClientMessage) => {
      if (closedByClient) return;

      if (msg.switchVoice) {
        const requested = normalizePersonaId(msg.switchVoice);
        if (requested !== currentVoice && !isSwapping) {
          void performPersonaHandoff(requested);
        }
        return;
      }

      if (!activeSession || isSwapping) {
        if (pendingInputs.length < 30) {
          pendingInputs.push(msg);
        }
        return;
      }
      forwardInputToSession(activeSession, msg);
    },
    close: () => {
      closedByClient = true;
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
