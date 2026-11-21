import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DEFAULT_ADMIN_PRIVATE_MEMORIES } from '../../shared/sinarWarnaPrompt';
import {
  isPrimaryAdminUser,
  PRIMARY_ADMIN_EMAIL,
  sanitizeId,
  toMillis,
} from './firestoreChatService';

export interface ManagedUserRecord {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  role: 'admin' | 'user';
  verifiedBadge: boolean;
  blocked: boolean;
  deleted: boolean;
  isPrimaryAdmin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AdminMemoryDoc {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  createdByEmail?: string;
  createdAt: number;
  updatedAt: number;
}

export function subscribeOwnUserAccess(
  user: User,
  onUpdate: (status: {
    isAdmin: boolean;
    isVerifiedBadge: boolean;
    blocked: boolean;
    deleted: boolean;
    docMissingAfterSeen: boolean;
  }) => void
): Unsubscribe {
  const uid = sanitizeId(user.uid);
  const primary = isPrimaryAdminUser(user);

  let userDocSeen = false;
  let userRoleAdmin = false;
  let userVerifiedBadge = false;
  let adminDocExists = false;
  let blocked = false;
  let deleted = false;
  let docMissingAfterSeen = false;

  const emit = () => {
    const active = !blocked && !deleted && !docMissingAfterSeen;
    const isAdmin = (primary || userRoleAdmin || adminDocExists) && active;
    onUpdate({
      isAdmin,
      isVerifiedBadge: (isAdmin || userVerifiedBadge) && active,
      blocked,
      deleted,
      docMissingAfterSeen,
    });
  };

  const unsubUser = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        userDocSeen = true;
        docMissingAfterSeen = false;
        const data = snap.data();
        blocked = data.blocked === true;
        deleted = data.deleted === true;
        userRoleAdmin = data.role === 'admin';
        userVerifiedBadge = data.verifiedBadge === true;
      } else {
        if (userDocSeen) {
          docMissingAfterSeen = true;
        }
      }
      emit();
    },
    () => {
      emit();
    }
  );

  const unsubAdmin = onSnapshot(
    doc(db, 'admins', uid),
    (snap) => {
      adminDocExists = snap.exists();
      emit();
    },
    () => {
      emit();
    }
  );

  return () => {
    unsubUser();
    unsubAdmin();
  };
}

export async function seedDefaultAdminMemoriesOnce(adminUser: User): Promise<void> {
  const uid = sanitizeId(adminUser.uid);
  const seedRef = doc(db, 'adminMeta', 'seed');
  try {
    const seedSnap = await getDoc(seedRef);
    if (seedSnap.exists() && seedSnap.data()?.seededDefaultMemories === true) {
      return;
    }

    const existingSnap = await getDocs(collection(db, 'adminMemories'));
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));

    const batch = writeBatch(db);
    for (const mem of DEFAULT_ADMIN_PRIVATE_MEMORIES) {
      if (!existingIds.has(mem.id)) {
        batch.set(doc(db, 'adminMemories', mem.id), {
          id: mem.id,
          title: mem.title.slice(0, 120),
          content: mem.content.slice(0, 2000),
          createdBy: uid,
          createdByEmail: (adminUser.email || '').slice(0, 200),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
    batch.set(seedRef, {
      seededDefaultMemories: true,
      updatedBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'adminMeta/seed');
  }
}

export function subscribeAllUsers(
  onData: (users: ManagedUserRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: ManagedUserRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        const email = String(data.email || '').trim().toLowerCase();
        const isPrimary = email === PRIMARY_ADMIN_EMAIL;
        const role: 'admin' | 'user' = isPrimary || data.role === 'admin' ? 'admin' : 'user';
        return {
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'Pengguna'),
          email: String(data.email || ''),
          photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
          role,
          verifiedBadge: isPrimary || role === 'admin' || data.verifiedBadge === true,
          blocked: data.blocked === true,
          deleted: data.deleted === true,
          isPrimaryAdmin: isPrimary,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        };
      });

      list.sort((a, b) => {
        if (a.isPrimaryAdmin !== b.isPrimaryAdmin) return a.isPrimaryAdmin ? -1 : 1;
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        if (a.verifiedBadge !== b.verifiedBadge) return a.verifiedBadge ? -1 : 1;
        return b.createdAt - a.createdAt;
      });

      onData(list);
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

export async function setUserAdminRole(
  actingAdmin: User,
  targetUser: ManagedUserRecord,
  makeAdmin: boolean
): Promise<void> {
  if (targetUser.isPrimaryAdmin) {
    throw new Error('Admin utama (rudi.sinarwarna@gmail.com) tidak dapat diubah.');
  }
  const targetUid = sanitizeId(targetUser.uid);
  const path = `users/${targetUid}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', targetUid), {
      role: makeAdmin ? 'admin' : 'user',
      verifiedBadge: makeAdmin ? true : Boolean(targetUser.verifiedBadge),
      blocked: Boolean(targetUser.blocked),
      deleted: Boolean(targetUser.deleted),
      updatedAt: serverTimestamp(),
    });
    if (makeAdmin) {
      batch.set(doc(db, 'admins', targetUid), {
        uid: targetUid,
        email: (targetUser.email || '').slice(0, 200),
        grantedBy: sanitizeId(actingAdmin.uid),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.delete(doc(db, 'admins', targetUid));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setUserVerifiedBadge(
  targetUser: ManagedUserRecord,
  verifiedBadge: boolean
): Promise<void> {
  if (targetUser.isPrimaryAdmin) {
    throw new Error('Centang biru Admin utama bersifat permanen.');
  }
  const targetUid = sanitizeId(targetUser.uid);
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role: targetUser.role,
      verifiedBadge,
      blocked: Boolean(targetUser.blocked),
      deleted: Boolean(targetUser.deleted),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setUserBlocked(
  targetUser: ManagedUserRecord,
  blocked: boolean
): Promise<void> {
  if (targetUser.isPrimaryAdmin) {
    throw new Error('Admin utama tidak dapat diblokir.');
  }
  const targetUid = sanitizeId(targetUser.uid);
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role: targetUser.role,
      verifiedBadge: Boolean(targetUser.verifiedBadge),
      blocked,
      deleted: Boolean(targetUser.deleted),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserAccount(targetUser: ManagedUserRecord): Promise<void> {
  if (targetUser.isPrimaryAdmin) {
    throw new Error('Admin utama tidak dapat dihapus.');
  }
  const targetUid = sanitizeId(targetUser.uid);
  const path = `users/${targetUid}`;

  try {
    const convSnap = await getDocs(
      query(collection(db, 'conversations'), where('userId', '==', targetUid))
    );

    const refsToDelete = [];
    for (const convDoc of convSnap.docs) {
      const msgSnap = await getDocs(
        query(
          collection(db, 'conversations', convDoc.id, 'messages'),
          where('userId', '==', targetUid)
        )
      );
      for (const msgDoc of msgSnap.docs) {
        refsToDelete.push(msgDoc.ref);
      }
      refsToDelete.push(convDoc.ref);
    }

    const adminGrantSnap = await getDoc(doc(db, 'admins', targetUid));
    if (adminGrantSnap.exists()) {
      refsToDelete.push(adminGrantSnap.ref);
    }

    refsToDelete.push(doc(db, 'users', targetUid));

    // Commit in chunks of 400 (Firestore batch limit is 500)
    for (let i = 0; i < refsToDelete.length; i += 400) {
      const chunk = refsToDelete.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAdminMemories(
  onData: (memories: AdminMemoryDoc[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'adminMemories';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: AdminMemoryDoc[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          title: String(data.title || 'Pengingat'),
          content: String(data.content || ''),
          createdBy: String(data.createdBy || ''),
          createdByEmail:
            typeof data.createdByEmail === 'string' ? data.createdByEmail : undefined,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        };
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      onData(list);
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

export async function addAdminMemory(params: {
  adminUser: User;
  title: string;
  content: string;
}): Promise<void> {
  const cleanTitle = params.title.trim().slice(0, 120) || 'Pengingat Pribadi';
  const cleanContent = params.content.trim().slice(0, 2000);
  if (!cleanContent) {
    throw new Error('Isi pengingat tidak boleh kosong.');
  }
  const memId = sanitizeId(`mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `adminMemories/${memId}`;
  try {
    await setDoc(doc(db, 'adminMemories', memId), {
      id: memId,
      title: cleanTitle,
      content: cleanContent,
      createdBy: sanitizeId(params.adminUser.uid),
      createdByEmail: (params.adminUser.email || '').slice(0, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAdminMemory(memoryId: string): Promise<void> {
  const safeId = sanitizeId(memoryId);
  const path = `adminMemories/${safeId}`;
  try {
    await deleteDoc(doc(db, 'adminMemories', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
