import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  AlertCircle,
  LogIn,
  MailCheck,
  Menu,
  Moon,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react';
import { AdminModal } from './components/AdminModal';
import { AuthScreen } from './components/AuthScreen';
import { VerifiedBlueBadge } from './components/VerifiedBlueBadge';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import {
  InstallAppPrompt,
  isInstallPromptDismissed,
  markInstallPromptDismissed,
} from './components/InstallAppPrompt';
import { LiveStudioModal } from './components/LiveStudioModal';
import { MessageBubble } from './components/MessageBubble';
import { PromptComposer } from './components/PromptComposer';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { SinarLogo } from './components/SinarLogo';
import { WelcomeCanvas } from './components/WelcomeCanvas';
import { usePWAInstall } from './hooks/usePWAInstall';
import { buildApiUrl } from './config/api';
import {
  auth,
  consumeAuthRedirectResult,
  formatAuthErrorIndonesia,
  reloadCurrentUser,
  resendVerificationEmail,
  signOutUser,
} from './firebase';
import {
  seedDefaultAdminMemoriesOnce,
  subscribeFreewillConfig,
  subscribeOwnUserAccess,
  type AdminLevel,
} from './services/adminService';
import {
  clearCachedAuthSession,
  readCachedActiveConversationId,
  readCachedAuthSession,
  readCachedConversations,
  writeCachedActiveConversationId,
  writeCachedAuthSession,
  writeCachedConversations,
  type CachedAuthSession,
} from './services/authSessionCache';

import {
  createConversationDoc,
  deleteConversationWithMessages,
  isPrimaryAdminUser,
  isUserVerifiedAccount,
  saveMessageDoc,
  saveMessagesBatch,
  subscribeConversations,
  subscribeMessages,
  updateConversationMeta,
  upsertUserProfile,
} from './services/firestoreChatService';
import type {
  ChatMessage,
  Conversation,
  CreativeModeId,
  ImageAttachment,
  ThinkingDepth,
} from './types/chat';

const LEGACY_STORAGE_KEY = 'sinar-warna-chats-v1';
const THEME_KEY = 'sinar-warna-theme';
const LEGACY_LIVE_TRANSCRIPT_KEY = 'sinar-warna-live-transcript';
const LIVE_TRANSCRIPT_KEY = 'sinar-warna-live-transcript-v2';

function loadInitialTheme(): boolean {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

function loadInitialLiveTranscript(): boolean {
  try {
    localStorage.removeItem(LEGACY_LIVE_TRANSCRIPT_KEY);
    return localStorage.getItem(LIVE_TRANSCRIPT_KEY) === 'true';
  } catch {
    return false;
  }
}

function clearLegacyGuestStorage() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage removal failure
  }
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(loadInitialTheme);
  const [sidebarDesktopOpen, setSidebarDesktopOpen] = useState<boolean>(true);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState<boolean>(false);

  // Firebase Auth state (seeded synchronously from cached UI snapshot to eliminate refresh flicker/delay)
  const [cachedAuth, setCachedAuth] = useState<CachedAuthSession | null>(() =>
    readCachedAuthSession()
  );
  const [user, setUser] = useState<User | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(() =>
    Boolean(cachedAuth?.isEmailVerified)
  );
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [verificationActionBusy, setVerificationActionBusy] = useState<'resend' | 'reload' | null>(
    null
  );
  const [verificationBannerDismissed, setVerificationBannerDismissed] = useState<boolean>(false);

  // Ephemeral guest conversations (in-memory only for current visit, never persisted)
  const [localConversations, setLocalConversations] = useState<Conversation[]>([]);

  // Cloud Firestore conversations & messages for active conversation
  const [cloudConversations, setCloudConversations] = useState<Conversation[]>(() =>
    cachedAuth?.isEmailVerified ? readCachedConversations(cachedAuth.uid) : []
  );
  const [cloudMessagesByConv, setCloudMessagesByConv] = useState<Record<string, ChatMessage[]>>({});
  const [pendingMessagesByConv, setPendingMessagesByConv] = useState<Record<string, ChatMessage[]>>(
    {}
  );
  const [inMemoryAttachments, setInMemoryAttachments] = useState<
    Record<string, ImageAttachment[]>
  >({});

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() =>
    cachedAuth?.isEmailVerified ? readCachedActiveConversationId(cachedAuth.uid) : null
  );

  const [activeMode, setActiveMode] = useState<CreativeModeId>('general');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const [liveModalOpen, setLiveModalOpen] = useState<boolean>(false);
  const [liveInitialCameraOn, setLiveInitialCameraOn] = useState<boolean>(false);
  const [showLiveTranscript, setShowLiveTranscript] = useState<boolean>(loadInitialLiveTranscript);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);
  const [adminLevel, setAdminLevel] = useState<AdminLevel>(() =>
    cachedAuth?.isEmailVerified ? cachedAuth.adminLevel : 'none'
  );
  const [freewillEnabled, setFreewillEnabled] = useState<boolean>(false);
  const [isVerifiedBadge, setIsVerifiedBadge] = useState<boolean>(() =>
    Boolean(cachedAuth?.isEmailVerified && cachedAuth.isVerifiedBadge)
  );
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(
    () => !isInstallPromptDismissed()
  );
  const [pendingCameraAttachment, setPendingCameraAttachment] = useState<ImageAttachment | null>(
    null
  );

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCloudUser = Boolean(user && isEmailVerified);

  // When FREEWILL is active:
  // - Logged-in verified users get Admin UI & permissions ('admin'), keeping Primary/Admin+ intact.
  // - Unregistered / unverified guests keep 'none' UI (no Administrator menu/badge), while AI backend applies admin effects.
  const effectiveAdminLevel: AdminLevel = !isCloudUser
    ? 'none'
    : adminLevel !== 'none'
    ? adminLevel
    : freewillEnabled
    ? 'admin'
    : 'none';
  const isAdmin = effectiveAdminLevel !== 'none';
  const effectiveVerifiedBadge = isCloudUser && (isAdmin || isVerifiedBadge);

  // Optimistic display-only state while Firebase Auth hydrates on refresh
  const displayUser = user ?? cachedAuth;
  const displayIsCloudUser = user
    ? isCloudUser
    : Boolean(!authReady && cachedAuth?.isEmailVerified);
  const displayAdminLevel: AdminLevel = isCloudUser
    ? effectiveAdminLevel
    : displayIsCloudUser && cachedAuth
    ? cachedAuth.adminLevel
    : 'none';
  const displayVerifiedBadge =
    displayIsCloudUser &&
    (displayAdminLevel !== 'none' || isVerifiedBadge || Boolean(!authReady && cachedAuth?.isVerifiedBadge));

  // Consume redirect result (for Google/Apple redirect flow outside iframes) & listen to Auth state
  useEffect(() => {
    void consumeAuthRedirectResult()
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
          setIsEmailVerified(isUserVerifiedAccount(result.user));
          setAuthModalOpen(false);
        }
      })
      .catch((err) => {
        const formatted = formatAuthErrorIndonesia(err);
        if (formatted) setBannerNotice(formatted);
      });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      const verified = isUserVerifiedAccount(firebaseUser);
      setIsEmailVerified(verified);
      setVerificationBannerDismissed(false);
      setAuthReady(true);
      if (firebaseUser) {
        setAuthModalOpen(false);
        if (verified) {
          setLocalConversations([]);
          const existingSnap = readCachedAuthSession();
          const sameUid = existingSnap?.uid === firebaseUser.uid;
          const primary = isPrimaryAdminUser(firebaseUser);
          const initialLevel: AdminLevel = primary
            ? 'primary'
            : sameUid && existingSnap
            ? existingSnap.adminLevel
            : 'none';
          const initialBadge = primary || (sameUid && Boolean(existingSnap?.isVerifiedBadge));
          setAdminLevel(initialLevel);
          setIsVerifiedBadge(initialBadge);
          void upsertUserProfile(firebaseUser)
            .then((res) => {
              if (res.blocked || res.deleted) {
                setAdminLevel('none');
                setIsVerifiedBadge(false);
                setAdminModalOpen(false);
                setLiveModalOpen(false);
                clearCachedAuthSession(firebaseUser.uid);
                setCachedAuth(null);
                setBannerNotice(
                  res.deleted
                    ? 'Akun Anda telah dihapus oleh Administrator Sinar Warna.'
                    : 'Akun Anda telah diblokir oleh Administrator Sinar Warna.'
                );
                void signOutUser();
                return;
              }
              const nextLevel: AdminLevel = primary
                ? 'primary'
                : res.role === 'admin_plus'
                ? 'admin_plus'
                : res.role === 'admin'
                ? 'admin'
                : 'none';
              setAdminLevel(nextLevel);
              setIsVerifiedBadge(nextLevel !== 'none' || res.verifiedBadge);
            })
            .catch((err) => {
              console.error('Failed to sync user profile:', err);
            });
        } else {
          setAdminLevel('none');
          setIsVerifiedBadge(false);
          setAdminModalOpen(false);
        }
      } else {
        clearCachedAuthSession();
        setCachedAuth(null);
        setAdminLevel('none');
        setIsVerifiedBadge(false);
        setAdminModalOpen(false);
        setLocalConversations([]);
        setCloudConversations([]);
        setCloudMessagesByConv({});
        setPendingMessagesByConv({});
        setInMemoryAttachments({});
        setActiveConversationId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time subscription to user's own Admin tier, block, or account removal status
  useEffect(() => {
    if (!authReady || !isCloudUser || !user) return;
    let seededForSession = false;

    const unsubscribe = subscribeOwnUserAccess(user, (status) => {
      if (status.blocked || status.deleted || status.docMissingAfterSeen) {
        setAdminLevel('none');
        setIsVerifiedBadge(false);
        setAdminModalOpen(false);
        setSettingsModalOpen(false);
        setLiveModalOpen(false);
        setBannerNotice(
          status.blocked
            ? 'Akun Anda telah diblokir oleh Administrator Sinar Warna.'
            : 'Akun Anda telah dihapus oleh Administrator Sinar Warna.'
        );
        void signOutUser();
        return;
      }
      setAdminLevel(status.adminLevel);
      setIsVerifiedBadge(status.isVerifiedBadge);
      if (status.canAccessMemories && !seededForSession) {
        seededForSession = true;
        void seedDefaultAdminMemoriesOnce(user).catch((err) => {
          console.error('Seed default admin memories skipped/error:', err);
        });
      }
    });

    return () => unsubscribe();
  }, [authReady, isCloudUser, user]);

  // Subscribe to Firestore conversations when authenticated & verified
  useEffect(() => {
    if (!authReady || !isCloudUser || !user) return;

    const unsubscribe = subscribeConversations(
      user.uid,
      (items) => {
        setCloudConversations(items);
        setActiveConversationId((prevId) => {
          if (prevId && items.some((c) => c.id === prevId)) return prevId;
          return items.length > 0 ? items[0].id : null;
        });
      },
      (err) => {
        setBannerNotice(`Gagal memuat riwayat cloud: ${err.message}`);
      }
    );

    return () => unsubscribe();
  }, [authReady, isCloudUser, user]);

  // Subscribe to messages for the active cloud conversation
  const existsInCloud = Boolean(
    activeConversationId && cloudConversations.some((c) => c.id === activeConversationId)
  );
  useEffect(() => {
    if (!authReady || !isCloudUser || !user || !activeConversationId || !existsInCloud) return;

    const unsubscribe = subscribeMessages(
      activeConversationId,
      user.uid,
      (msgs) => {
        setCloudMessagesByConv((prev) => ({
          ...prev,
          [activeConversationId]: msgs,
        }));
      },
      (err) => {
        setBannerNotice(`Gagal memuat pesan percakapan: ${err.message}`);
      }
    );

    return () => unsubscribe();
  }, [authReady, isCloudUser, user?.uid, activeConversationId, existsInCloud]);

  // Keep lightweight auth & sidebar summary cache synchronized for instant reload
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      clearCachedAuthSession();
      setCachedAuth(null);
      return;
    }
    const nextSnapshot: CachedAuthSession = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      isEmailVerified,
      adminLevel: effectiveAdminLevel,
      isVerifiedBadge: effectiveVerifiedBadge,
    };
    writeCachedAuthSession(nextSnapshot);
    setCachedAuth(nextSnapshot);
  }, [authReady, user, isEmailVerified, effectiveAdminLevel, effectiveVerifiedBadge]);

  useEffect(() => {
    if (!authReady || !isCloudUser || !user) return;
    writeCachedConversations(user.uid, cloudConversations);
  }, [authReady, isCloudUser, user, cloudConversations]);

  useEffect(() => {
    if (!authReady || !isCloudUser || !user) return;
    writeCachedActiveConversationId(user.uid, activeConversationId);
  }, [authReady, isCloudUser, user, activeConversationId]);

  // Subscribe to global FREEWILL mode (non-PII doc in appConfig/freewill)
  useEffect(() => {
    const unsubscribe = subscribeFreewillConfig((enabled) => {
      setFreewillEnabled(enabled);
    });
    return () => unsubscribe();
  }, []);

  // Sync dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage error
    }
  }, [isDark]);

  // Persist Live Transcript Box preference
  useEffect(() => {
    try {
      localStorage.setItem(LIVE_TRANSCRIPT_KEY, showLiveTranscript ? 'true' : 'false');
    } catch {
      // Ignore storage error
    }
  }, [showLiveTranscript]);

  // Remove any legacy local chat storage so unregistered/guest chats never persist across visits
  useEffect(() => {
    clearLegacyGuestStorage();
  }, []);

  const conversations = displayIsCloudUser ? cloudConversations : localConversations;

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  // Merge cloud messages + pending streaming messages seamlessly
  const messages: ChatMessage[] = useMemo(() => {
    if (!activeConversationId) return [];
    if (!isCloudUser) {
      return activeConversation?.messages || [];
    }

    const cloudList = cloudMessagesByConv[activeConversationId] || [];
    const pendingList = pendingMessagesByConv[activeConversationId] || [];

    const mergedMap = new Map<string, ChatMessage>();
    for (const m of cloudList) {
      mergedMap.set(m.id, {
        ...m,
        attachments: inMemoryAttachments[m.id] || m.attachments,
      });
    }
    for (const p of pendingList) {
      const existing = mergedMap.get(p.id);
      if (!existing || isStreaming || p.error || p.text.length >= existing.text.length) {
        mergedMap.set(p.id, {
          ...p,
          attachments: inMemoryAttachments[p.id] || p.attachments,
        });
      }
    }
    return Array.from(mergedMap.values()).sort((a, b) => a.createdAt - b.createdAt);
  }, [
    activeConversationId,
    activeConversation,
    cloudMessagesByConv,
    inMemoryAttachments,
    isCloudUser,
    isStreaming,
    pendingMessagesByConv,
  ]);

  // Sync active mode when switching conversations
  useEffect(() => {
    if (activeConversation) {
      setActiveMode(activeConversation.mode);
    }
  }, [activeConversation?.id]);

  // Auto-scroll to bottom on new message/token
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
  }, [messages.length, messages.at(-1)?.text, isStreaming]);

  const handleResendVerification = useCallback(async () => {
    if (verificationActionBusy) return;
    setVerificationActionBusy('resend');
    try {
      await resendVerificationEmail();
      setBannerNotice(
        'Email verifikasi telah dikirim ulang. Periksa kotak masuk atau folder spam Anda.'
      );
    } catch (err) {
      const formatted = formatAuthErrorIndonesia(err);
      setBannerNotice(formatted || 'Gagal mengirim ulang email verifikasi. Coba beberapa saat lagi.');
    } finally {
      setVerificationActionBusy(null);
    }
  }, [verificationActionBusy]);

  const handleCheckVerification = useCallback(async () => {
    if (verificationActionBusy) return;
    setVerificationActionBusy('reload');
    try {
      const reloaded = await reloadCurrentUser();
      if (reloaded?.emailVerified) {
        await reloaded.getIdToken(true);
        setIsEmailVerified(true);
        setVerificationBannerDismissed(true);
        await upsertUserProfile(reloaded).catch((err) => {
          console.error('Failed to sync user profile after verification:', err);
        });
        setBannerNotice('Email berhasil diverifikasi! Riwayat Cloud sekarang aktif.');
      } else {
        setBannerNotice(
          'Email Anda belum terverifikasi. Klik tautan verifikasi di email Anda lalu tekan Cek Ulang.'
        );
      }
    } catch (err) {
      const formatted = formatAuthErrorIndonesia(err);
      setBannerNotice(formatted || 'Gagal memeriksa status verifikasi email.');
    } finally {
      setVerificationActionBusy(null);
    }
  }, [verificationActionBusy]);

  const handleSignOut = useCallback(async () => {
    setBannerNotice(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setLiveModalOpen(false);
    setCameraModalOpen(false);
    setSidebarMobileOpen(false);
    clearCachedAuthSession(user?.uid || cachedAuth?.uid);
    setCachedAuth(null);
    setCloudConversations([]);
    setLocalConversations([]);
    setInMemoryAttachments({});
    setActiveConversationId(null);
    await auth.authStateReady().catch(() => undefined);
    await signOutUser();
  }, [cachedAuth?.uid, user?.uid]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const handleNewChat = useCallback(() => {
    stopStreaming();
    setActiveConversationId(null);
    if (!isCloudUser) {
      setLocalConversations([]);
      setInMemoryAttachments({});
    }
  }, [isCloudUser, stopStreaming]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === activeConversationId) return;
      stopStreaming();
      setActiveConversationId(id);
    },
    [activeConversationId, stopStreaming]
  );



  const handleDeleteConversation = useCallback(
    async (id: string) => {
      if (id === activeConversationId) {
        stopStreaming();
        setActiveConversationId(null);
      }
      if (isCloudUser && user) {
        try {
          await deleteConversationWithMessages(user.uid, id);
        } catch (err) {
          setBannerNotice(
            err instanceof Error ? err.message : 'Gagal menghapus percakapan dari cloud.'
          );
        }
      } else {
        setLocalConversations((prev) => prev.filter((c) => c.id !== id));
      }
    },
    [activeConversationId, isCloudUser, stopStreaming, user]
  );

  const fetchAutoTitle = useCallback(
    async (convId: string, firstPrompt: string, currentUser: User | null) => {
      try {
        const response = await fetch(buildApiUrl('/api/title'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: firstPrompt }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { title?: string };
        if (!data.title) return;

        if (currentUser) {
          await updateConversationMeta(convId, { title: data.title });
        } else {
          setLocalConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, title: data.title! } : c))
          );
        }
      } catch {
        // Non-blocking auto-title failure is acceptable
      }
    },
    []
  );

  const streamAssistantReply = useCallback(
    async (
      convId: string,
      historyForApi: ChatMessage[],
      modelMessageId: string,
      mode: CreativeModeId,
      depth: ThinkingDepth,
      currentUser: User | null
    ) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);

      let accumulatedText = '';
      let streamError: string | undefined;

      try {
        const idToken = currentUser ? await currentUser.getIdToken().catch(() => null) : null;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (idToken) {
          headers.Authorization = `Bearer ${idToken}`;
        }

        const response = await fetch(buildApiUrl('/api/chat/stream'), {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            mode,
            thinkingDepth: depth,
            messages: historyForApi.map((m) => ({
              role: m.role,
              text: m.text,
              attachments: m.attachments?.map((a) => ({
                mimeType: a.mimeType,
                data: a.data,
              })),
            })),
          }),
        });

        if (!response.ok) {
          let errMsg = `Permintaan gagal (${response.status}).`;
          try {
            const errJson = (await response.json()) as { error?: string };
            if (errJson.error) errMsg = errJson.error;
          } catch {
            // Fallback message
          }
          throw new Error(errMsg);
        }

        if (!response.body) {
          throw new Error('Aliran respons server tidak tersedia.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const event of events) {
            const lines = event.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonText = line.slice(6).trim();
              if (!jsonText) continue;

              let payload: { text?: string; error?: string; done?: boolean };
              try {
                payload = JSON.parse(jsonText) as {
                  text?: string;
                  error?: string;
                  done?: boolean;
                };
              } catch {
                continue;
              }

              if (payload.error) {
                throw new Error(payload.error);
              }

              if (payload.text) {
                accumulatedText += payload.text;
                if (currentUser) {
                  setPendingMessagesByConv((prev) => ({
                    ...prev,
                    [convId]: (prev[convId] || []).map((m) =>
                      m.id === modelMessageId ? { ...m, text: accumulatedText } : m
                    ),
                  }));
                } else {
                  setLocalConversations((prev) =>
                    prev.map((c) => {
                      if (c.id !== convId) return c;
                      return {
                        ...c,
                        updatedAt: Date.now(),
                        messages: c.messages.map((m) =>
                          m.id === modelMessageId ? { ...m, text: accumulatedText } : m
                        ),
                      };
                    })
                  );
                }
              }
            }
          }
        }

        if (accumulatedText.trim().length === 0 && !streamError) {
          streamError = 'Respons AI kosong atau terputus. Silakan coba kirim ulang.';
          if (currentUser) {
            setPendingMessagesByConv((prev) => ({
              ...prev,
              [convId]: (prev[convId] || []).map((m) =>
                m.id === modelMessageId ? { ...m, error: streamError } : m
              ),
            }));
          } else {
            setLocalConversations((prev) =>
              prev.map((c) => {
                if (c.id !== convId) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === modelMessageId ? { ...m, error: streamError } : m
                  ),
                };
              })
            );
          }
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          streamError =
            err instanceof Error ? err.message : 'Gagal terhubung ke asisten Sinar Warna.';
          if (currentUser) {
            setPendingMessagesByConv((prev) => ({
              ...prev,
              [convId]: (prev[convId] || []).map((m) =>
                m.id === modelMessageId ? { ...m, error: streamError } : m
              ),
            }));
          } else {
            setLocalConversations((prev) =>
              prev.map((c) => {
                if (c.id !== convId) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === modelMessageId ? { ...m, error: streamError } : m
                  ),
                };
              })
            );
          }
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsStreaming(false);

        if (currentUser && (accumulatedText.trim().length > 0 || streamError)) {
          try {
            await saveMessageDoc({
              userId: currentUser.uid,
              conversationId: convId,
              messageId: modelMessageId,
              role: 'model',
              text: accumulatedText,
              error: streamError,
            });
          } catch (saveErr) {
            console.error('Failed to persist model message to Firestore:', saveErr);
          }
        }
      }
      return accumulatedText.trim().length > 0 && !streamError;
    },
    []
  );

  const sendMessage = useCallback(
    async (
      text: string,
      attachments: ImageAttachment[] = [],
      overrideMode?: CreativeModeId
    ) => {
      if (isStreaming) return;
      const effectiveMode = overrideMode || activeMode;
      if (overrideMode) setActiveMode(overrideMode);

      const userMsgId = createId();
      const modelMsgId = createId();
      const now = Date.now();
      const attachmentNames = attachments.map((a) => a.name);

      if (attachments.length > 0) {
        setInMemoryAttachments((prev) => ({
          ...prev,
          [userMsgId]: attachments,
        }));
      }

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        text,
        attachments: attachments.length > 0 ? attachments : undefined,
        attachmentNames: attachmentNames.length > 0 ? attachmentNames : undefined,
        createdAt: now,
      };

      const placeholderModelMsg: ChatMessage = {
        id: modelMsgId,
        role: 'model',
        text: '',
        createdAt: now + 1,
      };

      let targetConvId = activeConversationId;
      let historyForApi: ChatMessage[] = [];
      let shouldAutoTitle = false;

      const fallbackTitle = text
        ? text.slice(0, 42) + (text.length > 42 ? '...' : '')
        : 'Analisis Gambar Kreatif';

      let cloudUser = isCloudUser ? user : null;
      if (!authReady && cachedAuth) {
        await auth.authStateReady().catch(() => undefined);
        const resolved = auth.currentUser;
        cloudUser = resolved && isUserVerifiedAccount(resolved) ? resolved : null;
      }

      if (!targetConvId) {
        targetConvId = createId();
        shouldAutoTitle = true;
        historyForApi = [userMsg];

        if (cloudUser) {
          setPendingMessagesByConv((prev) => ({
            ...prev,
            [targetConvId!]: [userMsg, placeholderModelMsg],
          }));
          setActiveConversationId(targetConvId);

          try {
            await createConversationDoc(cloudUser.uid, targetConvId, fallbackTitle, effectiveMode);
            await saveMessageDoc({
              userId: cloudUser.uid,
              conversationId: targetConvId,
              messageId: userMsgId,
              role: 'user',
              text,
              attachmentNames,
            });
          } catch (persistErr) {
            console.error('Failed to persist new conversation to Firestore:', persistErr);
          }
        } else {
          const newConv: Conversation = {
            id: targetConvId,
            title: fallbackTitle,
            mode: effectiveMode,
            messages: [userMsg, placeholderModelMsg],
            updatedAt: now,
          };
          setLocalConversations((prev) => [newConv, ...prev]);
          setActiveConversationId(targetConvId);
        }
      } else {
        const priorMessages = messages.filter((m) => !m.error);
        historyForApi = [...priorMessages, userMsg];

        if (cloudUser) {
          setPendingMessagesByConv((prev) => ({
            ...prev,
            [targetConvId!]: [...(prev[targetConvId!] || []), userMsg, placeholderModelMsg],
          }));
          try {
            await saveMessageDoc({
              userId: cloudUser.uid,
              conversationId: targetConvId,
              messageId: userMsgId,
              role: 'user',
              text,
              attachmentNames,
            });
          } catch (persistErr) {
            console.error('Failed to persist user message to Firestore:', persistErr);
          }
        } else {
          setLocalConversations((prev) =>
            prev.map((c) =>
              c.id === targetConvId
                ? {
                    ...c,
                    mode: effectiveMode,
                    updatedAt: now,
                    messages: [...c.messages, userMsg, placeholderModelMsg],
                  }
                : c
            )
          );
        }
      }

      const succeeded = await streamAssistantReply(
        targetConvId,
        historyForApi,
        modelMsgId,
        effectiveMode,
        'fast',
        cloudUser
      );

      if (succeeded && shouldAutoTitle && text.length > 35) {
        void fetchAutoTitle(targetConvId, text, cloudUser);
      }
    },
    [
      activeConversationId,
      activeMode,
      fetchAutoTitle,
      isCloudUser,
      isStreaming,
      messages,
      streamAssistantReply,
      user,
    ]
  );

  const handleRegenerate = useCallback(async () => {
    if (!activeConversation || isStreaming || messages.length === 0) return;

    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) return;

    const baseMessages = messages.slice(0, lastUserIndex + 1).filter((m) => !m.error);
    const modelMsgId = createId();
    const placeholderModelMsg: ChatMessage = {
      id: modelMsgId,
      role: 'model',
      text: '',
      createdAt: Date.now(),
    };

    const cloudUser = isCloudUser ? user : null;

    if (cloudUser) {
      setPendingMessagesByConv((prev) => ({
        ...prev,
        [activeConversation.id]: [...(prev[activeConversation.id] || []), placeholderModelMsg],
      }));
    } else {
      setLocalConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                updatedAt: Date.now(),
                messages: [...messages.slice(0, lastUserIndex + 1), placeholderModelMsg],
              }
            : c
        )
      );
    }

    await streamAssistantReply(
      activeConversation.id,
      baseMessages,
      modelMsgId,
      activeConversation.mode,
      'fast',
      cloudUser
    );
  }, [activeConversation, isCloudUser, isStreaming, messages, streamAssistantReply, user]);

  const handleOpenCamera = useCallback(() => {
    setCameraModalOpen(true);
  }, []);

  const handleOpenLiveVoice = useCallback(() => {
    stopStreaming();
    setLiveInitialCameraOn(false);
    setLiveModalOpen(true);
  }, [stopStreaming]);

  const handleConsumePendingCameraAttachment = useCallback(() => {
    setPendingCameraAttachment(null);
  }, []);

  const handleLiveClose = useCallback(
    async (transcriptLog?: Array<{ role: 'user' | 'model'; text: string }>) => {
      setLiveModalOpen(false);
      if (!showLiveTranscript || !transcriptLog || transcriptLog.length === 0) return;

      // Normalize non-empty entries and merge adjacent same-role entries
      const normalized: Array<{ role: 'user' | 'model'; text: string }> = [];
      for (const entry of transcriptLog) {
        const cleanText = entry.text.trim();
        if (!cleanText) continue;
        const last = normalized[normalized.length - 1];
        if (last && last.role === entry.role) {
          last.text = `${last.text}\n${cleanText}`;
        } else {
          normalized.push({ role: entry.role, text: cleanText });
        }
      }
      if (normalized.length === 0) return;

      const baseTime = Date.now();
      const newMessages: ChatMessage[] = normalized.map((item, idx) => ({
        id: createId(),
        role: item.role,
        text: item.text.slice(0, 32000),
        createdAt: baseTime + idx,
      }));

      const firstSnippet = normalized[0].text.slice(0, 36);
      const liveTitle = `Sesi Live: ${firstSnippet}${normalized[0].text.length > 36 ? '...' : ''}`;
      let targetConvId = activeConversationId;

      const cloudUser = isCloudUser ? user : null;

      if (!targetConvId) {
        targetConvId = createId();
        if (cloudUser) {
          setPendingMessagesByConv((prev) => ({
            ...prev,
            [targetConvId!]: newMessages,
          }));
          setActiveConversationId(targetConvId);
          try {
            await createConversationDoc(cloudUser.uid, targetConvId, liveTitle, activeMode);
            // Optimization: Write all messages in 1 atomic batch rather than individual round-trips
            await saveMessagesBatch({
              userId: cloudUser.uid,
              conversationId: targetConvId,
              messages: newMessages,
            });
          } catch (err) {
            console.error('Failed to persist live transcript to Firestore:', err);
          }
        } else {
          const newConv: Conversation = {
            id: targetConvId,
            title: liveTitle,
            mode: activeMode,
            messages: newMessages,
            updatedAt: baseTime,
          };
          setLocalConversations((prev) => [newConv, ...prev]);
          setActiveConversationId(targetConvId);
        }
      } else if (cloudUser) {
        setPendingMessagesByConv((prev) => ({
          ...prev,
          [targetConvId!]: [...(prev[targetConvId!] || []), ...newMessages],
        }));
        try {
          // Optimization: Append all messages in 1 atomic batch rather than individual round-trips
          await saveMessagesBatch({
            userId: cloudUser.uid,
            conversationId: targetConvId,
            messages: newMessages,
          });
        } catch (err) {
          console.error('Failed to append live transcript to Firestore:', err);
        }
      } else {
        setLocalConversations((prev) =>
          prev.map((c) =>
            c.id === targetConvId
              ? {
                  ...c,
                  updatedAt: baseTime,
                  messages: [...c.messages, ...newMessages],
                }
              : c
          )
        );
      }
    },
    [activeConversationId, activeMode, isCloudUser, user]
  );

  const lastModelMsgId = [...messages].reverse().find((m) => m.role === 'model')?.id;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white dark:bg-[#0B0F1A] text-zinc-900 dark:text-[#E3E3E3]">
      <Sidebar
        isDesktopOpen={sidebarDesktopOpen}
        isMobileOpen={sidebarMobileOpen}
        user={displayUser}
        isCloudUser={displayIsCloudUser}
        isAdmin={displayAdminLevel !== 'none'}
        isVerifiedBadge={displayVerifiedBadge}
        authReady={authReady}
        authLoading={false}
        conversations={displayIsCloudUser ? conversations : []}
        activeConversationId={activeConversationId}
        onCloseMobile={() => setSidebarMobileOpen(false)}
        onToggleDesktop={() => setSidebarDesktopOpen(false)}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={(id) => {
          void handleDeleteConversation(id);
        }}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onSignIn={() => setAuthModalOpen(true)}
        onSignOut={() => {
          void handleSignOut();
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar (simple, mobile-first Gemini layout with vivid Red-Blue accents) */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-blue-500/15 dark:border-[#222B45] px-3 sm:px-5">
          <div className="flex items-center gap-2 min-w-0">
            {!sidebarDesktopOpen && (
              <button
                type="button"
                onClick={() => setSidebarDesktopOpen(true)}
                title="Buka panel samping"
                aria-label="Buka panel samping"
                className="hidden lg:inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 hover:bg-blue-600/10 hover:text-[#0A36FF] dark:text-zinc-400 dark:hover:bg-blue-500/15 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setSidebarMobileOpen(true)}
              title="Buka menu"
              aria-label="Buka menu"
              className="inline-flex lg:hidden h-11 w-11 items-center justify-center rounded-xl text-zinc-700 hover:bg-blue-600/10 dark:text-zinc-300 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-zinc-100/70 dark:hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <SinarLogo size={24} />
              <span className="font-display text-base font-semibold tracking-tight bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] bg-clip-text text-transparent dark:from-[#FF4D5A] dark:to-[#4F8BFF]">
                Sinar Warna
              </span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {displayIsCloudUser && (displayAdminLevel !== 'none' || displayVerifiedBadge) && displayUser && (
              <span
                title={
                  displayAdminLevel === 'primary'
                    ? 'Admin Utama Terverifikasi'
                    : displayAdminLevel === 'admin_plus'
                    ? 'Admin+ Terverifikasi'
                    : displayAdminLevel === 'admin'
                    ? 'Admin Terverifikasi'
                    : 'Akun Terverifikasi'
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-50/70 dark:bg-sky-950/30 px-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap shrink-0"
              >
                <span className="max-w-[110px] truncate hidden sm:inline">
                  {displayUser.displayName || 'Terverifikasi'}
                </span>
                <VerifiedBlueBadge
                  size="xs"
                  title={displayAdminLevel !== 'none' ? 'Admin Terverifikasi' : 'Akun Terverifikasi'}
                />
              </span>
            )}

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleNewChat}
                title="Percakapan Baru"
                aria-label="Percakapan Baru"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-blue-500/30 bg-white dark:bg-[#14192B] px-3 text-xs font-medium text-zinc-700 hover:bg-blue-50 dark:text-zinc-200 dark:hover:bg-[#1C233B] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5 text-[#E51D2B] dark:text-[#FF4D5A]" />
                <span className="hidden sm:inline">Percakapan Baru</span>
              </button>
            )}

            {authReady && !user && (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-50/70 dark:bg-blue-950/40 px-3 text-xs font-semibold text-[#0A36FF] dark:text-blue-200 hover:bg-blue-100/80 dark:hover:bg-blue-900/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Masuk</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              title={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
              aria-label={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer shrink-0"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {bannerNotice && (
          <div className="mx-auto mt-2 flex w-[calc(100%-1.5rem)] max-w-3xl items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{bannerNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              aria-label="Tutup pemberitahuan"
              className="rounded-md p-1 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {user && !isEmailVerified && !verificationBannerDismissed && (
          <div className="mx-auto mt-2 flex w-[calc(100%-1.5rem)] max-w-3xl flex-wrap items-center justify-between gap-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/90 dark:bg-blue-950/35 px-3.5 py-2.5 text-xs text-blue-950 dark:text-blue-100">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0A36FF] dark:text-blue-400" />
              <span className="leading-relaxed">
                Akun <strong>{user.email || 'Anda'}</strong> belum terverifikasi. Verifikasi email
                untuk menyimpan riwayat percakapan (sementara obrolan tidak disimpan ke riwayat).
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={verificationActionBusy !== null}
                onClick={() => void handleResendVerification()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-[#14192B] px-2.5 text-[11px] font-semibold text-blue-800 dark:text-blue-200 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>
                  {verificationActionBusy === 'resend' ? 'Mengirim...' : 'Kirim Ulang Email'}
                </span>
              </button>
              <button
                type="button"
                disabled={verificationActionBusy !== null}
                onClick={() => void handleCheckVerification()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-2.5 text-[11px] font-semibold text-white hover:opacity-95 disabled:opacity-60 transition-opacity cursor-pointer whitespace-nowrap"
              >
                <RefreshCw
                  className={`h-3 w-3 ${verificationActionBusy === 'reload' ? 'animate-spin' : ''}`}
                />
                <span>
                  {verificationActionBusy === 'reload' ? 'Memeriksa...' : 'Sudah Verifikasi? Cek Ulang'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVerificationBannerDismissed(true)}
                aria-label="Tutup banner verifikasi"
                className="rounded-md p-1 text-blue-700 hover:bg-blue-200/50 dark:text-blue-300 dark:hover:bg-blue-900/50 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Chat Viewport */}
        <main className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex min-h-full w-full items-stretch justify-center">
              <WelcomeCanvas />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-7 px-4 py-6 sm:py-8">
              {messages.map((msg, index) => {
                const isLast = index === messages.length - 1;
                const isThisStreaming = isStreaming && isLast && msg.role === 'model';
                const isLastModel = msg.id === lastModelMsgId;

                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={isThisStreaming}
                    isLastModelMessage={isLastModel}
                    onQuickRefine={(instruction) => {
                      void sendMessage(instruction);
                    }}
                    onRegenerate={() => {
                      void handleRegenerate();
                    }}
                  />
                );
              })}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </main>

        {/* Bottom Composer */}
        <div className="shrink-0 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-[#0B0F1A] dark:via-[#0B0F1A]/95 pt-1">
          <PromptComposer
            isStreaming={isStreaming}
            onSend={(text, attachments) => {
              void sendMessage(text, attachments);
            }}
            onStop={stopStreaming}
            onOpenCamera={handleOpenCamera}
            onOpenLive={handleOpenLiveVoice}
            pendingCameraAttachment={pendingCameraAttachment}
            onConsumePendingCameraAttachment={handleConsumePendingCameraAttachment}
          />
        </div>
      </div>

      <CameraCaptureModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={(attachment) => {
          setPendingCameraAttachment(attachment);
        }}
      />

      <LiveStudioModal
        isOpen={liveModalOpen}
        initialCameraOn={liveInitialCameraOn}
        showTranscriptBox={showLiveTranscript}
        activeMode={activeMode}
        user={isCloudUser ? user : null}
        onClose={(transcriptLog) => {
          void handleLiveClose(transcriptLog);
        }}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        isDark={isDark}
        showLiveTranscript={showLiveTranscript}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        isAdmin={isAdmin}
        adminLevel={effectiveAdminLevel}
        currentUser={user}
        onClose={() => setSettingsModalOpen(false)}
        onSetTheme={(dark) => setIsDark(dark)}
        onSetShowLiveTranscript={(show) => setShowLiveTranscript(show)}
        onInstallAndroid={install}
      />

      <AdminModal
        isOpen={adminModalOpen && isAdmin}
        currentUser={user}
        adminLevel={effectiveAdminLevel}
        onClose={() => setAdminModalOpen(false)}
      />

      {showInstallBanner && !isInstalled && !settingsModalOpen && !adminModalOpen && !liveModalOpen && !authModalOpen && (
        <InstallAppPrompt
          isInstallable={isInstallable}
          isInstalled={isInstalled}
          isIOS={isIOS}
          onInstall={install}
          onOpenSettings={() => setSettingsModalOpen(true)}
          onDismiss={() => {
            markInstallPromptDismissed();
            setShowInstallBanner(false);
          }}
        />
      )}

      {authModalOpen && !user && (
        <AuthScreen
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
          onClose={() => setAuthModalOpen(false)}
        />
      )}
    </div>
  );
}
