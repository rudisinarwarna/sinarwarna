import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { ChatMessage, Conversation, CreativeModeId } from '../types/chat';

export const PRIMARY_ADMIN_EMAIL = 'rudi.sinarwarna@gmail.com';

export type UserRole = 'user' | 'admin' | 'admin_plus';
export type AdminLevel = 'none' | 'admin' | 'admin_plus' | 'primary';

export function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'number') return ts;
  return Date.now();
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
}

export function extractUserEmail(user: User | null | undefined): string {
  if (!user) return '';
  if (user.email) return user.email.trim().toLowerCase();
  const providerEmail = user.providerData?.find((p) => Boolean(p?.email))?.email;
  return providerEmail ? providerEmail.trim().toLowerCase() : '';
}

export function isUserVerifiedAccount(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.emailVerified) return true;
  return Boolean(
    user.providerData?.some(
      (p) => p?.providerId === 'google.com' || p?.providerId === 'apple.com'
    )
  );
}

export function isPrimaryAdminUser(user: User | null | undefined): boolean {
  return Boolean(
    isUserVerifiedAccount(user) && extractUserEmail(user) === PRIMARY_ADMIN_EMAIL
  );
}

export function normalizeUserRole(raw: unknown): UserRole {
  if (raw === 'admin_plus') return 'admin_plus';
  if (raw === 'admin') return 'admin';
  return 'user';
}

export interface UpsertProfileResult {
  role: UserRole;
  verifiedBadge: boolean;
  blocked: boolean;
  deleted: boolean;
}

const PROFILE_SYNC_PREFIX = 'sw_prof_sync_';
const ADMIN_GRANT_PREFIX = 'sw_adm_grant_';

export async function upsertUserProfile(user: User): Promise<UpsertProfileResult> {
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const displayName = (user.displayName || extractUserEmail(user).split('@')[0] || 'Kreator').slice(
    0,
    100
  );
  const cleanEmail = extractUserEmail(user).slice(0, 200);
  const photoUrl = user.photoURL ? user.photoURL.slice(0, 500) : undefined;
  const primaryAdmin = isPrimaryAdminUser(user);

  // Optimization: Skip redundant Firestore read and write if already synced in current session
  const profileSig = `${displayName}|${cleanEmail}|${photoUrl || ''}|${primaryAdmin ? '1' : '0'}`;
  try {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(`${PROFILE_SYNC_PREFIX}${uid}`);
      if (cached) {
        const parsed = JSON.parse(cached) as { sig: string; time: number; role: UserRole; verifiedBadge: boolean };
        if (parsed.sig === profileSig && Date.now() - parsed.time < 30 * 60 * 1000) {
          return {
            role: parsed.role,
            verifiedBadge: parsed.verifiedBadge,
            blocked: false,
            deleted: false,
          };
        }
      }
    }
  } catch {
    // Ignore storage parse error
  }

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const role: UserRole = primaryAdmin ? 'admin_plus' : 'user';
      const verifiedBadge = primaryAdmin;
      const payload: Record<string, unknown> = {
        uid,
        displayName,
        role,
        verifiedBadge,
        blocked: false,
        deleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanEmail) payload.email = cleanEmail;
      if (photoUrl) payload.photoUrl = photoUrl;
      await setDoc(userRef, payload);

      if (primaryAdmin) {
        await ensurePrimaryAdminGrant(user);
      }
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            `${PROFILE_SYNC_PREFIX}${uid}`,
            JSON.stringify({ sig: profileSig, time: Date.now(), role, verifiedBadge })
          );
        }
      } catch {
        // Ignore quota error
      }
      return { role, verifiedBadge, blocked: false, deleted: false };
    }

    const existing = snap.data();
    const blocked = existing.blocked === true;
    const deleted = existing.deleted === true;
    const role: UserRole = primaryAdmin ? 'admin_plus' : normalizeUserRole(existing.role);
    const verifiedBadge =
      primaryAdmin || role !== 'user' || existing.verifiedBadge === true;

    if (blocked || deleted) {
      return { role: 'user', verifiedBadge: false, blocked, deleted };
    }

    const needsUpdate =
      existing.displayName !== displayName ||
      existing.role !== role ||
      existing.verifiedBadge !== verifiedBadge ||
      existing.blocked !== false ||
      existing.deleted !== false ||
      (cleanEmail && existing.email !== cleanEmail) ||
      (photoUrl && existing.photoUrl !== photoUrl);

    if (needsUpdate) {
      const updates: Record<string, unknown> = {
        displayName,
        role,
        verifiedBadge,
        blocked: false,
        deleted: false,
        updatedAt: serverTimestamp(),
      };
      if (cleanEmail) updates.email = cleanEmail;
      if (photoUrl) updates.photoUrl = photoUrl;
      await updateDoc(userRef, updates);
    }

    if (primaryAdmin) {
      await ensurePrimaryAdminGrant(user);
    }

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          `${PROFILE_SYNC_PREFIX}${uid}`,
          JSON.stringify({ sig: profileSig, time: Date.now(), role, verifiedBadge })
        );
      }
    } catch {
      // Ignore quota error
    }

    return { role, verifiedBadge, blocked: false, deleted: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function ensurePrimaryAdminGrant(user: User): Promise<void> {
  const uid = sanitizeId(user.uid);
  const adminRef = doc(db, 'admins', uid);
  const path = `admins/${uid}`;

  // Optimization: Skip if already verified in session
  if (typeof window !== 'undefined' && sessionStorage.getItem(`${ADMIN_GRANT_PREFIX}${uid}`) === 'true') {
    return;
  }

  try {
    const snap = await getDoc(adminRef);
    if (!snap.exists()) {
      await setDoc(adminRef, {
        uid,
        email: (extractUserEmail(user) || PRIMARY_ADMIN_EMAIL).slice(0, 200),
        level: 'admin_plus',
        grantedBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (snap.data()?.level !== 'admin_plus') {
      await updateDoc(adminRef, {
        level: 'admin_plus',
        grantedBy: uid,
        updatedAt: serverTimestamp(),
      });
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`${ADMIN_GRANT_PREFIX}${uid}`, 'true');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeConversations(
  userId: string,
  onData: (conversations: Conversation[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const uid = sanitizeId(userId);
  const path = 'conversations';
  // Optimization: limit to 50 most relevant conversations to prevent unbounded read rows
  const q = query(collection(db, path), where('userId', '==', uid), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Conversation[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          title: String(data.title || 'Sesi Kreatif Baru'),
          mode: (data.mode as CreativeModeId) || 'general',
          messages: [],
          updatedAt: toMillis(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeMessages(
  conversationId: string,
  userId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const convId = sanitizeId(conversationId);
  const uid = sanitizeId(userId);
  const path = `conversations/${convId}/messages`;
  // Optimization: limit to 100 messages per conversation to control read row usage
  const q = query(collection(db, 'conversations', convId, 'messages'), where('userId', '==', uid), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ChatMessage[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          role: data.role === 'model' ? 'model' : 'user',
          text: String(data.text || ''),
          attachmentNames: Array.isArray(data.attachmentNames)
            ? data.attachmentNames.map((n) => String(n))
            : undefined,
          error: typeof data.error === 'string' ? data.error : undefined,
          createdAt: toMillis(data.createdAt),
        };
      });
      items.sort((a, b) => a.createdAt - b.createdAt);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createConversationDoc(
  userId: string,
  convId: string,
  title: string,
  mode: CreativeModeId
): Promise<void> {
  const safeId = sanitizeId(convId);
  const uid = sanitizeId(userId);
  const safeTitle = (title.trim() || 'Sesi Kreatif Baru').slice(0, 120);
  const path = `conversations/${safeId}`;

  try {
    await setDoc(doc(db, 'conversations', safeId), {
      id: safeId,
      userId: uid,
      title: safeTitle,
      mode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateConversationMeta(
  convId: string,
  updates: { title?: string; mode?: CreativeModeId }
): Promise<void> {
  // Optimization: If neither title nor mode changed, skip redundant write to save Firestore write quota
  if (!updates.title && !updates.mode) {
    return;
  }
  const safeId = sanitizeId(convId);
  const path = `conversations/${safeId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof updates.title === 'string') {
    payload.title = (updates.title.trim() || 'Sesi Kreatif Baru').slice(0, 120);
  }
  if (updates.mode) {
    payload.mode = updates.mode;
  }

  try {
    await updateDoc(doc(db, 'conversations', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveMessageDoc(params: {
  userId: string;
  conversationId: string;
  messageId: string;
  role: 'user' | 'model';
  text: string;
  attachmentNames?: string[];
  error?: string;
}): Promise<void> {
  const safeConvId = sanitizeId(params.conversationId);
  const safeMsgId = sanitizeId(params.messageId);
  const uid = sanitizeId(params.userId);
  const path = `conversations/${safeConvId}/messages/${safeMsgId}`;

  const payload: Record<string, unknown> = {
    id: safeMsgId,
    conversationId: safeConvId,
    userId: uid,
    role: params.role,
    text: params.text.slice(0, 32000),
    createdAt: serverTimestamp(),
  };

  if (params.attachmentNames && params.attachmentNames.length > 0) {
    payload.attachmentNames = params.attachmentNames
      .slice(0, 3)
      .map((name) => name.slice(0, 120));
  }

  if (params.error) {
    payload.error = params.error.slice(0, 500);
  }

  try {
    await setDoc(doc(db, 'conversations', safeConvId, 'messages', safeMsgId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveMessagesBatch(params: {
  userId: string;
  conversationId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'model';
    text: string;
    attachmentNames?: string[];
    error?: string;
  }>;
}): Promise<void> {
  if (params.messages.length === 0) return;
  const safeConvId = sanitizeId(params.conversationId);
  const uid = sanitizeId(params.userId);
  const path = `conversations/${safeConvId}/messages`;

  const batch = writeBatch(db);
  for (const msg of params.messages.slice(0, 100)) {
    const safeMsgId = sanitizeId(msg.id);
    const ref = doc(db, 'conversations', safeConvId, 'messages', safeMsgId);
    const payload: Record<string, unknown> = {
      id: safeMsgId,
      conversationId: safeConvId,
      userId: uid,
      role: msg.role,
      text: msg.text.slice(0, 32000),
      createdAt: serverTimestamp(),
    };
    if (msg.attachmentNames && msg.attachmentNames.length > 0) {
      payload.attachmentNames = msg.attachmentNames.slice(0, 3).map((n) => n.slice(0, 120));
    }
    if (msg.error) {
      payload.error = msg.error.slice(0, 500);
    }
    batch.set(ref, payload);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteConversationWithMessages(
  userId: string,
  convId: string
): Promise<void> {
  const safeConvId = sanitizeId(convId);
  const uid = sanitizeId(userId);
  const path = `conversations/${safeConvId}`;

  try {
    const msgsQuery = query(
      collection(db, 'conversations', safeConvId, 'messages'),
      where('userId', '==', uid)
    );
    const msgSnap = await getDocs(msgsQuery);
    const batch = writeBatch(db);
    for (const msgDoc of msgSnap.docs) {
      batch.delete(msgDoc.ref);
    }
    batch.delete(doc(db, 'conversations', safeConvId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
