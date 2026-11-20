import {
  collection,
  doc,
  getDoc,
  getDocs,
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

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'number') return ts;
  return Date.now();
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
}

export async function upsertUserProfile(user: User): Promise<void> {
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const displayName = (user.displayName || user.email?.split('@')[0] || 'Kreator').slice(0, 100);
  const photoUrl = user.photoURL ? user.photoURL.slice(0, 500) : undefined;

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        uid,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) payload.photoUrl = photoUrl;
      await setDoc(userRef, payload);
    } else {
      const updates: Record<string, unknown> = {
        displayName,
        updatedAt: serverTimestamp(),
      };
      if (photoUrl) updates.photoUrl = photoUrl;
      await updateDoc(userRef, updates);
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
  const q = query(collection(db, path), where('userId', '==', uid));

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
  const q = query(collection(db, 'conversations', convId, 'messages'), where('userId', '==', uid));

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
