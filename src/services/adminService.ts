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
  normalizeUserRole,
  PRIMARY_ADMIN_EMAIL,
  sanitizeId,
  toMillis,
  type AdminLevel,
  type UserRole,
} from './firestoreChatService';

export type { AdminLevel, UserRole };

export interface ManagedUserRecord {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  role: UserRole;
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

export function canManageUserRecord(
  actingLevel: AdminLevel,
  actingUid: string,
  target: ManagedUserRecord
): boolean {
  if (!actingUid || target.isPrimaryAdmin || target.uid === actingUid) {
    return false;
  }
  if (actingLevel === 'primary') return true;
  if (actingLevel === 'admin_plus') {
    return target.role === 'user' || target.role === 'admin';
  }
  if (actingLevel === 'admin') {
    return target.role === 'user';
  }
  return false;
}

export function subscribeOwnUserAccess(
  user: User,
  onUpdate: (status: {
    isAdmin: boolean;
    adminLevel: AdminLevel;
    canAccessMemories: boolean;
    isVerifiedBadge: boolean;
    blocked: boolean;
    deleted: boolean;
    docMissingAfterSeen: boolean;
  }) => void
): Unsubscribe {
  const uid = sanitizeId(user.uid);
  const primary = isPrimaryAdminUser(user);

  let userDocSeen = false;
  let userRole: UserRole = 'user';
  let userVerifiedBadge = false;
  let adminDocExists = false;
  let adminGrantLevel: 'admin' | 'admin_plus' = 'admin';
  let blocked = false;
  let deleted = false;
  let docMissingAfterSeen = false;

  const emit = () => {
    const active = !blocked && !deleted && !docMissingAfterSeen;
    let adminLevel: AdminLevel = 'none';
    if (active) {
      if (primary) {
        adminLevel = 'primary';
      } else if (adminDocExists) {
        adminLevel =
          adminGrantLevel === 'admin_plus' || userRole === 'admin_plus'
            ? 'admin_plus'
            : 'admin';
      } else if (userRole === 'admin_plus') {
        adminLevel = 'admin_plus';
      } else if (userRole === 'admin') {
        adminLevel = 'admin';
      }
    }

    const isAdmin = adminLevel !== 'none';
    const canAccessMemories = adminLevel === 'primary' || adminLevel === 'admin_plus';
    onUpdate({
      isAdmin,
      adminLevel,
      canAccessMemories,
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
        userRole = normalizeUserRole(data.role);
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
      adminGrantLevel = snap.data()?.level === 'admin_plus' ? 'admin_plus' : 'admin';
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
        const role: UserRole = isPrimary ? 'admin_plus' : normalizeUserRole(data.role);
        return {
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'Pengguna'),
          email: String(data.email || ''),
          photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : undefined,
          role,
          verifiedBadge: isPrimary || role !== 'user' || data.verifiedBadge === true,
          blocked: data.blocked === true,
          deleted: data.deleted === true,
          isPrimaryAdmin: isPrimary,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        };
      });

      const rank = (u: ManagedUserRecord) => {
        if (u.isPrimaryAdmin) return 4;
        if (u.role === 'admin_plus') return 3;
        if (u.role === 'admin') return 2;
        if (u.verifiedBadge) return 1;
        return 0;
      };

      list.sort((a, b) => {
        const diff = rank(b) - rank(a);
        if (diff !== 0) return diff;
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

export async function setUserRoleLevel(
  actingAdmin: User,
  actingLevel: AdminLevel,
  targetUser: ManagedUserRecord,
  nextRole: UserRole
): Promise<void> {
  if (targetUser.isPrimaryAdmin) {
    throw new Error('Admin utama (rudi.sinarwarna@gmail.com) tidak dapat diubah.');
  }
  if (!canManageUserRecord(actingLevel, actingAdmin.uid, targetUser)) {
    throw new Error('Anda tidak memiliki izin untuk mengubah level akun ini.');
  }
  if (nextRole === 'admin_plus' && actingLevel !== 'primary') {
    throw new Error('Hanya Admin Utama yang dapat mengangkat atau mengubah level Admin+.');
  }

  const targetUid = sanitizeId(targetUser.uid);
  const path = `users/${targetUid}`;
  const grantRef = doc(db, 'admins', targetUid);

  try {
    const existingGrantSnap = await getDoc(grantRef);
    const batch = writeBatch(db);

    batch.update(doc(db, 'users', targetUid), {
      role: nextRole,
      verifiedBadge: nextRole !== 'user' ? true : Boolean(targetUser.verifiedBadge),
      blocked: Boolean(targetUser.blocked),
      deleted: Boolean(targetUser.deleted),
      updatedAt: serverTimestamp(),
    });

    if (nextRole === 'user') {
      if (existingGrantSnap.exists()) {
        batch.delete(grantRef);
      }
    } else {
      const grantLevel = nextRole === 'admin_plus' ? 'admin_plus' : 'admin';
      if (existingGrantSnap.exists()) {
        batch.update(grantRef, {
          level: grantLevel,
          grantedBy: sanitizeId(actingAdmin.uid),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(grantRef, {
          uid: targetUid,
          email: (targetUser.email || '').slice(0, 200),
          level: grantLevel,
          grantedBy: sanitizeId(actingAdmin.uid),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setUserVerifiedBadge(
  actingLevel: AdminLevel,
  actingUid: string,
  targetUser: ManagedUserRecord,
  verifiedBadge: boolean
): Promise<void> {
  if (targetUser.isPrimaryAdmin) {
    throw new Error('Centang biru Admin utama bersifat permanen.');
  }
  if (!canManageUserRecord(actingLevel, actingUid, targetUser)) {
    throw new Error('Anda tidak memiliki izin untuk mengubah centang biru akun ini.');
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
  actingLevel: AdminLevel,
  actingUid: string,
  targetUser: ManagedUserRecord,
  blocked: boolean
): Promise<void> {
  if (targetUser.isPrimaryAdmin) {
    throw new Error('Admin utama tidak dapat diblokir.');
  }
  if (!canManageUserRecord(actingLevel, actingUid, targetUser)) {
    throw new Error('Anda tidak memiliki izin untuk memblokir akun ini.');
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

export async function deleteUserAccount(
  actingLevel: AdminLevel,
  actingUid: string,
  targetUser: ManagedUserRecord
): Promise<void> {
  if (targetUser.isPrimaryAdmin) {
    throw new Error('Admin utama tidak dapat dihapus.');
  }
  if (!canManageUserRecord(actingLevel, actingUid, targetUser)) {
    throw new Error('Anda tidak memiliki izin untuk menghapus akun ini.');
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

export function subscribeLiveOpeningGreeting(
  onData: (greetingText: string, updatedAt: number) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'appConfig/live';
  return onSnapshot(
    doc(db, 'appConfig', 'live'),
    (snap) => {
      if (!snap.exists()) {
        onData('', 0);
        return;
      }
      const data = snap.data();
      onData(String(data.greetingText || ''), toMillis(data.updatedAt));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveLiveOpeningGreeting(
  adminUser: User,
  greetingText: string
): Promise<void> {
  const path = 'appConfig/live';
  const cleanText = greetingText.trim().slice(0, 500);
  const ref = doc(db, 'appConfig', 'live');
  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        greetingText: cleanText,
        updatedBy: sanitizeId(adminUser.uid),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        greetingText: cleanText,
        updatedBy: sanitizeId(adminUser.uid),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

