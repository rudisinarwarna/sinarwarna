import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const RECAPTCHA_SITE_KEY =
  firebaseConfig.recaptchaSiteKey || '6LcMqikuAAAAAJJd9jmIeHFeD54SdaqfapH5ilyz';

const app = initializeApp({
  ...firebaseConfig,
  apiKey: 'AIzaSyDlQg7raXIKzz4-RIRbyzb8uK0VcxVv4nM',
  authDomain: 'sinar-warna-ai.firebaseapp.com',
  projectId: 'sinar-warna-ai',
  storageBucket: 'sinar-warna-ai.firebasestorage.app',
  messagingSenderId: '207131100614',
  appId: '1:207131100614:web:486897c38eb0cb4ba75ec7',
  measurementId: 'G-KW5VVLQVSD',
});

export let appCheck: AppCheck | null = null;
if (typeof window !== 'undefined' && RECAPTCHA_SITE_KEY) {
  try {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('Firebase App Check initialization skipped:', err);
  }
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

export let analytics: Analytics | null = null;
void isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch(() => {
    // Analytics disabled or blocked in browser context
  });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithApple() {
  return signInWithPopup(auth, appleProvider);
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const cleanName = displayName?.trim();
  if (cleanName) {
    try {
      await updateProfile(credential.user, { displayName: cleanName.slice(0, 100) });
    } catch {
      // Non-fatal profile display name update failure
    }
  }
  return credential;
}

export async function resetPasswordWithEmail(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}

export async function signOutUser() {
  return signOut(auth);
}

export function formatAuthErrorIndonesia(err: unknown): string | null {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/popup-blocked':
      return 'Pop-up login diblokir oleh peramban. Izinkan pop-up untuk situs ini lalu coba lagi.';
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau kata sandi salah. Silakan periksa kembali atau daftar akun baru.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan masuk menggunakan akun Anda.';
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan gagal. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi internet bermasalah. Periksa jaringan Anda lalu coba lagi.';
    case 'auth/account-exists-with-different-credential':
      return 'Email ini sudah terhubung dengan metode masuk lain. Gunakan metode masuk yang sesuai.';
    case 'auth/operation-not-allowed':
      return 'Metode login ini belum diaktifkan di konfigurasi Firebase Auth.';
    case 'auth/unauthorized-domain':
      return 'Domain ini belum diotorisasi di Firebase Authentication Console.';
    default: {
      const msg = (err as { message?: string })?.message;
      return msg ? `Gagal masuk: ${msg}` : 'Terjadi kesalahan saat masuk. Silakan coba lagi.';
    }
  }
}
