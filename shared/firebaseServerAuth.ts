const FIREBASE_PROJECT_ID = 'sinar-warna-ai';
const FIRESTORE_DATABASE_ID = 'ai-studio-sinarwarna-dd26643e-bc06-45c9-a721-ba2bcbbf462b';
export const PRIMARY_ADMIN_EMAIL = 'rudi.sinarwarna@gmail.com';

const JWKS_URL =
  'https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com';

interface CachedJwks {
  keys: Record<string, JsonWebKey & { kid?: string; alg?: string; use?: string }>;
  expiresAt: number;
}

let jwksCache: CachedJwks | null = null;

export interface VerifiedFirebaseClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export interface AdminMemoryRecord {
  id: string;
  title: string;
  content: string;
}

export type AdminLevel = 'none' | 'admin' | 'admin_plus' | 'primary';

export interface FreewillServerConfig {
  enabled: boolean;
  memoriesSummary: string;
}

export interface ServerAuthContext {
  authenticated: boolean;
  uid: string | null;
  email: string | null;
  isAdmin: boolean;
  adminLevel: AdminLevel;
  canAccessAdminMemories: boolean;
  isPrimaryAdmin: boolean;
  isBlocked: boolean;
  adminMemories: AdminMemoryRecord[];
  adminMemoriesFetchOk: boolean;
  publicMemories: AdminMemoryRecord[];
  freewill: FreewillServerConfig;
  seedMetaExists: boolean;
  idToken: string | null;
}

function base64UrlToUint8Array(input: string): Uint8Array {
  const padLen = (4 - (input.length % 4)) % 4;
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  const binary = atob(normalized);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function decodeJwtJson<T>(segment: string): T {
  const bytes = base64UrlToUint8Array(segment);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

async function getGoogleJwks(forceRefresh = false): Promise<CachedJwks['keys']> {
  const now = Date.now();
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const res = await fetch(JWKS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase JWKS (${res.status})`);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) * 1000 : 300_000;

  const data = (await res.json()) as {
    keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }>;
  };
  const keyMap: CachedJwks['keys'] = {};
  for (const key of data.keys || []) {
    if (key.kid) {
      keyMap[key.kid] = key;
    }
  }

  jwksCache = {
    keys: keyMap,
    expiresAt: now + ttlMs,
  };
  return keyMap;
}

export async function verifyFirebaseIdToken(
  idToken: string | null | undefined
): Promise<VerifiedFirebaseClaims | null> {
  if (!idToken || typeof idToken !== 'string') return null;
  const parts = idToken.trim().split('.');
  if (parts.length !== 3) return null;

  try {
    const header = decodeJwtJson<{ alg?: string; kid?: string }>(parts[0]);
    const payload = decodeJwtJson<{
      iss?: string;
      aud?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
    }>(parts[1]);

    if (header.alg !== 'RS256' || !header.kid) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
      payload.aud !== FIREBASE_PROJECT_ID ||
      !payload.sub ||
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= nowSec ||
      typeof payload.iat !== 'number' ||
      payload.iat > nowSec + 300
    ) {
      return null;
    }

    let keys = await getGoogleJwks(false);
    let jwk = keys[header.kid];
    if (!jwk) {
      keys = await getGoogleJwks(true);
      jwk = keys[header.kid];
    }
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlToUint8Array(parts[2]);

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature as unknown as BufferSource,
      signingInput
    );
    if (!valid) return null;

    return {
      uid: payload.sub,
      email: (payload.email || '').trim().toLowerCase(),
      emailVerified: Boolean(payload.email_verified),
    };
  } catch (err) {
    console.warn('[verifyFirebaseIdToken] failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

function firestoreDocsBaseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents`;
}

interface FirestoreRestDoc {
  name?: string;
  fields?: Record<
    string,
    {
      stringValue?: string;
      booleanValue?: boolean;
      timestampValue?: string;
    }
  >;
}

function getDocIdFromName(name: string | undefined): string {
  if (!name) return '';
  const idx = name.lastIndexOf('/');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

export async function fetchAdminMemoriesServerWithStatus(
  idToken: string
): Promise<{ ok: boolean; memories: AdminMemoryRecord[] }> {
  try {
    const url = `${firestoreDocsBaseUrl()}/adminMemories?pageSize=100`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false, memories: [] };
    const data = (await res.json()) as { documents?: FirestoreRestDoc[] };
    const memories = (data.documents || [])
      .map((d) => ({
        id: d.fields?.id?.stringValue || getDocIdFromName(d.name),
        title: d.fields?.title?.stringValue || 'Pengingat',
        content: d.fields?.content?.stringValue || '',
      }))
      .filter((m) => m.id && m.content);
    return { ok: true, memories };
  } catch {
    return { ok: false, memories: [] };
  }
}

export async function fetchAdminMemoriesServer(idToken: string): Promise<AdminMemoryRecord[]> {
  const { memories } = await fetchAdminMemoriesServerWithStatus(idToken);
  return memories;
}

export async function fetchPublicMemoriesServer(): Promise<AdminMemoryRecord[]> {
  try {
    const url = `${firestoreDocsBaseUrl()}:runQuery`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2500),
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'publicMemories' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'isPublic' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
          limit: 100,
        },
      }),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ document?: FirestoreRestDoc }>;
    return rows
      .map((row) => row.document)
      .filter((d): d is FirestoreRestDoc => Boolean(d))
      .map((d) => ({
        id: d.fields?.id?.stringValue || getDocIdFromName(d.name),
        title: d.fields?.title?.stringValue || 'Pengingat Umum',
        content: d.fields?.content?.stringValue || '',
      }))
      .filter((m) => m.id && m.content);
  } catch {
    return [];
  }
}

export async function fetchFreewillConfigServer(): Promise<FreewillServerConfig> {
  try {
    const url = `${firestoreDocsBaseUrl()}/appConfig/freewill`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      return { enabled: false, memoriesSummary: '' };
    }
    const doc = (await res.json().catch(() => null)) as FirestoreRestDoc | null;
    const enabled = doc?.fields?.enabled?.booleanValue === true;
    const memoriesSummary = enabled
      ? (doc?.fields?.memoriesSummary?.stringValue || '').trim().slice(0, 10000)
      : '';
    return { enabled, memoriesSummary };
  } catch {
    return { enabled: false, memoriesSummary: '' };
  }
}

export async function fetchLiveOpeningGreetingServer(): Promise<string> {
  try {
    const url = `${firestoreDocsBaseUrl()}/appConfig/live`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return '';
    const doc = (await res.json().catch(() => null)) as FirestoreRestDoc | null;
    const text = doc?.fields?.greetingText?.stringValue || '';
    return text.trim().slice(0, 500);
  } catch {
    return '';
  }
}

export async function resolveServerAuthContext(
  idToken: string | null | undefined
): Promise<ServerAuthContext> {
  const [publicMemories, freewill, claims] = await Promise.all([
    fetchPublicMemoriesServer().catch(() => []),
    fetchFreewillConfigServer().catch(() => ({ enabled: false, memoriesSummary: '' })),
    idToken ? verifyFirebaseIdToken(idToken) : Promise.resolve(null),
  ]);

  const empty: ServerAuthContext = {
    authenticated: false,
    uid: null,
    email: null,
    isAdmin: false,
    adminLevel: 'none',
    canAccessAdminMemories: false,
    isPrimaryAdmin: false,
    isBlocked: false,
    adminMemories: [],
    adminMemoriesFetchOk: false,
    publicMemories,
    freewill,
    seedMetaExists: false,
    idToken: null,
  };

  if (!idToken || !claims) return empty;

  const isPrimaryAdmin =
    claims.emailVerified && claims.email === PRIMARY_ADMIN_EMAIL.toLowerCase();

  let isBlocked = false;
  let adminLevel: AdminLevel = 'none';

  if (claims.emailVerified) {
    const base = firestoreDocsBaseUrl();
    const headers = { Authorization: `Bearer ${idToken}` };

    const [userRes, adminRes] = await Promise.all([
      fetch(`${base}/users/${encodeURIComponent(claims.uid)}`, { headers }).catch(() => null),
      isPrimaryAdmin
        ? Promise.resolve(null)
        : fetch(`${base}/admins/${encodeURIComponent(claims.uid)}`, { headers }).catch(() => null),
    ]);

    let userRoleField = 'user';
    if (userRes && userRes.ok) {
      const userDoc = (await userRes.json().catch(() => null)) as FirestoreRestDoc | null;
      const blockedVal = userDoc?.fields?.blocked?.booleanValue === true;
      const deletedVal = userDoc?.fields?.deleted?.booleanValue === true;
      userRoleField = userDoc?.fields?.role?.stringValue || 'user';
      if (blockedVal || deletedVal) {
        isBlocked = true;
      }
    }

    if (isPrimaryAdmin) {
      adminLevel = 'primary';
    } else if (!isBlocked && adminRes && adminRes.ok) {
      const adminDoc = (await adminRes.json().catch(() => null)) as FirestoreRestDoc | null;
      const grantLevel = adminDoc?.fields?.level?.stringValue || '';
      if (grantLevel === 'admin_plus' || userRoleField === 'admin_plus') {
        adminLevel = 'admin_plus';
      } else {
        adminLevel = 'admin';
      }
    }
  }

  if (isBlocked) {
    adminLevel = 'none';
  }

  const isAdmin = Boolean(claims.emailVerified && adminLevel !== 'none' && !isBlocked);
  const canAccessAdminMemories = Boolean(
    isAdmin && (adminLevel === 'primary' || adminLevel === 'admin_plus')
  );

  let adminMemories: AdminMemoryRecord[] = [];
  let adminMemoriesFetchOk = false;
  let seedMetaExists = false;

  if (canAccessAdminMemories) {
    const base = firestoreDocsBaseUrl();
    const headers = { Authorization: `Bearer ${idToken}` };
    const [memoriesResult, seedRes] = await Promise.all([
      fetchAdminMemoriesServerWithStatus(idToken),
      fetch(`${base}/adminMeta/seed`, { headers, signal: AbortSignal.timeout(4000) }).catch(() => null),
    ]);
    adminMemories = memoriesResult.memories;
    adminMemoriesFetchOk = memoriesResult.ok;
    seedMetaExists = Boolean(seedRes && seedRes.ok);
  }

  return {
    authenticated: true,
    uid: claims.uid,
    email: claims.email,
    isAdmin,
    adminLevel,
    canAccessAdminMemories,
    isPrimaryAdmin,
    isBlocked,
    adminMemories,
    adminMemoriesFetchOk,
    publicMemories,
    freewill,
    seedMetaExists,
    idToken,
  };
}

function sanitizeFirestoreId(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return clean || `mem-${Date.now()}`;
}

export async function saveAdminMemoryServer(params: {
  idToken: string;
  uid: string;
  email: string;
  title: string;
  content: string;
}): Promise<{ ok: boolean; memory?: AdminMemoryRecord; error?: string }> {
  const memId = sanitizeFirestoreId(`mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const title = (params.title || 'Pengingat Pribadi').trim().slice(0, 120) || 'Pengingat Pribadi';
  const content = (params.content || '').trim().slice(0, 2000);
  if (!content) {
    return { ok: false, error: 'Isi pengingat tidak boleh kosong.' };
  }

  const docName = `projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/adminMemories/${memId}`;
  const url = `${firestoreDocsBaseUrl()}:commit`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: docName,
            fields: {
              id: { stringValue: memId },
              title: { stringValue: title },
              content: { stringValue: content },
              createdBy: { stringValue: params.uid.slice(0, 128) },
              createdByEmail: { stringValue: (params.email || '').slice(0, 200) },
            },
          },
          currentDocument: { exists: false },
          updateTransforms: [
            { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `Gagal menyimpan ingatan (${res.status}): ${errText}` };
  }

  return {
    ok: true,
    memory: { id: memId, title, content },
  };
}

export async function deleteAdminMemoriesByKeywordServer(params: {
  idToken: string;
  keyword: string;
}): Promise<{ ok: boolean; deletedTitles: string[]; error?: string }> {
  const rawKeyword = (params.keyword || '').trim().toLowerCase();
  if (!rawKeyword) {
    return { ok: false, deletedTitles: [], error: 'Kata kunci ingatan wajib diisi.' };
  }

  const all = await fetchAdminMemoriesServer(params.idToken);
  const terms = rawKeyword
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const matches = all.filter((m) => {
    const hay = `${m.id} ${m.title} ${m.content}`.toLowerCase();
    if (hay.includes(rawKeyword)) return true;
    if (terms.length > 0 && terms.every((t) => hay.includes(t))) return true;
    return false;
  });

  if (matches.length === 0) {
    return {
      ok: false,
      deletedTitles: [],
      error: `Tidak ditemukan pengingat pribadi yang cocok dengan "${params.keyword}".`,
    };
  }

  const deletedTitles: string[] = [];
  for (const m of matches) {
    const delUrl = `${firestoreDocsBaseUrl()}/adminMemories/${encodeURIComponent(m.id)}`;
    const res = await fetch(delUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${params.idToken}` },
    });
    if (res.ok) {
      deletedTitles.push(m.title);
    }
  }

  return {
    ok: deletedTitles.length > 0,
    deletedTitles,
    error: deletedTitles.length === 0 ? 'Gagal menghapus dokumen pengingat di database.' : undefined,
  };
}

export async function savePublicMemoryServer(params: {
  idToken: string;
  uid: string;
  title: string;
  content: string;
}): Promise<{ ok: boolean; memory?: AdminMemoryRecord; error?: string }> {
  const memId = sanitizeFirestoreId(`pub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const title = (params.title || 'Pengingat Umum').trim().slice(0, 120) || 'Pengingat Umum';
  const content = (params.content || '').trim().slice(0, 2000);
  if (!content) {
    return { ok: false, error: 'Isi pengingat umum tidak boleh kosong.' };
  }

  const docName = `projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/publicMemories/${memId}`;
  const url = `${firestoreDocsBaseUrl()}:commit`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: docName,
            fields: {
              id: { stringValue: memId },
              title: { stringValue: title },
              content: { stringValue: content },
              isPublic: { booleanValue: true },
              createdBy: { stringValue: params.uid.slice(0, 128) },
            },
          },
          currentDocument: { exists: false },
          updateTransforms: [
            { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `Gagal menyimpan pengingat umum (${res.status}): ${errText}` };
  }

  return {
    ok: true,
    memory: { id: memId, title, content },
  };
}

export async function deletePublicMemoriesByKeywordServer(params: {
  idToken: string;
  keyword: string;
}): Promise<{ ok: boolean; deletedTitles: string[]; error?: string }> {
  const rawKeyword = (params.keyword || '').trim().toLowerCase();
  if (!rawKeyword) {
    return { ok: false, deletedTitles: [], error: 'Kata kunci pengingat umum wajib diisi.' };
  }

  const all = await fetchPublicMemoriesServer();
  const terms = rawKeyword
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const matches = all.filter((m) => {
    const hay = `${m.id} ${m.title} ${m.content}`.toLowerCase();
    if (hay.includes(rawKeyword)) return true;
    if (terms.length > 0 && terms.every((t) => hay.includes(t))) return true;
    return false;
  });

  if (matches.length === 0) {
    return {
      ok: false,
      deletedTitles: [],
      error: `Tidak ditemukan pengingat umum yang cocok dengan "${params.keyword}".`,
    };
  }

  const deletedTitles: string[] = [];
  for (const m of matches) {
    const delUrl = `${firestoreDocsBaseUrl()}/publicMemories/${encodeURIComponent(m.id)}`;
    const res = await fetch(delUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${params.idToken}` },
    });
    if (res.ok) {
      deletedTitles.push(m.title);
    }
  }

  return {
    ok: deletedTitles.length > 0,
    deletedTitles,
    error:
      deletedTitles.length === 0 ? 'Gagal menghapus dokumen pengingat umum di database.' : undefined,
  };
}
