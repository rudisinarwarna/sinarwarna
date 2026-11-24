import type { AdminLevel } from './firestoreChatService';
import type { Conversation, CreativeModeId } from '../types/chat';

const AUTH_SNAPSHOT_KEY = 'sinar-warna-auth-ui-v1';
const CONV_CACHE_PREFIX = 'sinar-warna-conv-ui-v1:';
const ACTIVE_CONV_PREFIX = 'sinar-warna-active-conv-v1:';
const PRIMARY_ADMIN_EMAIL = 'rudi.sinarwarna@gmail.com';
const MAX_CACHED_CONVS = 30;

export interface CachedAuthSession {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isEmailVerified: boolean;
  adminLevel: AdminLevel;
  isVerifiedBadge: boolean;
}

function isValidAdminLevel(val: unknown): val is AdminLevel {
  return val === 'none' || val === 'admin' || val === 'admin_plus' || val === 'primary';
}

function readFirebasePersistedFallback(): CachedAuthSession | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith('firebase:authUser:')) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        uid?: unknown;
        email?: unknown;
        emailVerified?: unknown;
        displayName?: unknown;
        photoURL?: unknown;
        photoUrl?: unknown;
        providerData?: Array<{ providerId?: unknown; email?: unknown }>;
      };
      if (typeof parsed?.uid !== 'string' || !parsed.uid) continue;

      const rawEmail =
        typeof parsed.email === 'string' && parsed.email
          ? parsed.email
          : parsed.providerData?.find((p) => typeof p?.email === 'string' && p.email)?.email;
      const email = typeof rawEmail === 'string' ? rawEmail : null;
      const hasTrustedProvider = Boolean(
        parsed.providerData?.some(
          (p) => p?.providerId === 'google.com' || p?.providerId === 'apple.com'
        )
      );
      const isEmailVerified = parsed.emailVerified === true || hasTrustedProvider;
      const isPrimary =
        isEmailVerified &&
        typeof email === 'string' &&
        (email.trim().toLowerCase() === 'rudi.sinarwarna@gmail.com' ||
          email.trim().toLowerCase() === 'rudifei@gmail.com');

      const photo =
        typeof parsed.photoURL === 'string'
          ? parsed.photoURL
          : typeof parsed.photoUrl === 'string'
          ? parsed.photoUrl
          : null;

      return {
        uid: parsed.uid,
        displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
        email,
        photoURL: photo,
        isEmailVerified,
        adminLevel: isPrimary ? 'primary' : 'none',
        isVerifiedBadge: isPrimary,
      };
    }
  } catch {
    // Ignore malformed localStorage entries
  }
  return null;
}

export function readCachedAuthSession(): CachedAuthSession | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(AUTH_SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CachedAuthSession>;
      if (typeof parsed?.uid === 'string' && parsed.uid) {
        const adminLevel: AdminLevel = isValidAdminLevel(parsed.adminLevel)
          ? parsed.adminLevel
          : 'none';
        return {
          uid: parsed.uid,
          displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
          email: typeof parsed.email === 'string' ? parsed.email : null,
          photoURL: typeof parsed.photoURL === 'string' ? parsed.photoURL : null,
          isEmailVerified: parsed.isEmailVerified === true,
          adminLevel,
          isVerifiedBadge: parsed.isVerifiedBadge === true || adminLevel !== 'none',
        };
      }
    }
  } catch {
    // Ignore storage read failure
  }
  return readFirebasePersistedFallback();
}

export function writeCachedAuthSession(session: CachedAuthSession): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(session));
  } catch {
    // Ignore quota/storage errors
  }
}

export function clearCachedAuthSession(uid?: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(AUTH_SNAPSHOT_KEY);
    if (uid) {
      window.localStorage.removeItem(`${CONV_CACHE_PREFIX}${uid}`);
      window.localStorage.removeItem(`${ACTIVE_CONV_PREFIX}${uid}`);
    }
  } catch {
    // Ignore storage errors
  }
}

export function readCachedConversations(uid: string): Conversation[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !uid) return [];
    const raw = window.localStorage.getItem(`${CONV_CACHE_PREFIX}${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      id?: unknown;
      title?: unknown;
      mode?: unknown;
      updatedAt?: unknown;
    }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item?.id === 'string' && item.id)
      .slice(0, MAX_CACHED_CONVS)
      .map((item) => ({
        id: String(item.id),
        title: typeof item.title === 'string' && item.title ? item.title : 'Sesi Kreatif Baru',
        mode: (typeof item.mode === 'string' ? item.mode : 'general') as CreativeModeId,
        messages: [],
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

export function writeCachedConversations(uid: string, conversations: Conversation[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !uid) return;
    const compact = conversations.slice(0, MAX_CACHED_CONVS).map((c) => ({
      id: c.id,
      title: c.title,
      mode: c.mode,
      updatedAt: c.updatedAt,
    }));
    window.localStorage.setItem(`${CONV_CACHE_PREFIX}${uid}`, JSON.stringify(compact));
  } catch {
    // Ignore quota/storage errors
  }
}

export function readCachedActiveConversationId(uid: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !uid) return null;
    const val = window.localStorage.getItem(`${ACTIVE_CONV_PREFIX}${uid}`);
    return val || null;
  } catch {
    return null;
  }
}

export function writeCachedActiveConversationId(uid: string, convId: string | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !uid) return;
    if (convId) {
      window.localStorage.setItem(`${ACTIVE_CONV_PREFIX}${uid}`, convId);
    } else {
      window.localStorage.removeItem(`${ACTIVE_CONV_PREFIX}${uid}`);
    }
  } catch {
    // Ignore storage errors
  }
}
