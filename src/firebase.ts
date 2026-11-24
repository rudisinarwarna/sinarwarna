import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  OAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type AuthProvider,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  getAppLanguage,
  isQuotaOrLimitError,
  sanitizeErrorForViewer,
  triggerMaintenanceFromError,
} from './services/maintenanceManager';

const RECAPTCHA_SITE_KEY =
  firebaseConfig.recaptchaSiteKey || '6LcMqikuAAAAAJJd9jmIeHFeD54SdaqfapH5ilyz';
const PENDING_REDIRECT_KEY = 'sw-auth-redirect-pending';

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

export const db = (() => {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
})();

export const auth = (() => {
  if (typeof window === 'undefined') return getAuth(app);
  try {
    return initializeAuth(app, {
      persistence: [browserLocalPersistence, indexedDBLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
})();
auth.languageCode = 'id';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');
appleProvider.setCustomParameters({ locale: 'id' });

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

function isInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

async function signInWithProviderSmart(provider: AuthProvider) {
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    if (
      !isInIframe() &&
      (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment')
    ) {
      try {
        sessionStorage.setItem(PENDING_REDIRECT_KEY, '1');
      } catch {
        // Ignore sessionStorage error
      }
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function consumeAuthRedirectResult() {
  try {
    if (typeof window !== 'undefined') {
      const pending = sessionStorage.getItem(PENDING_REDIRECT_KEY);
      if (pending !== '1') return null;
      sessionStorage.removeItem(PENDING_REDIRECT_KEY);
    }
  } catch {
    // Proceed to check redirect result if sessionStorage is unavailable
  }
  return getRedirectResult(auth);
}

export async function signInWithGoogle() {
  return signInWithProviderSmart(googleProvider);
}

export async function signInWithApple() {
  return signInWithProviderSmart(appleProvider);
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
  if (!credential.user.emailVerified) {
    try {
      await sendEmailVerification(credential.user);
    } catch {
      // Non-fatal verification email send failure
    }
  }
  return credential;
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) return;
  await sendEmailVerification(auth.currentUser);
}

export async function reloadCurrentUser() {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  return auth.currentUser;
}

export async function resetPasswordWithEmail(email: string) {
  return sendPasswordResetEmail(auth, email.trim());
}

export async function signOutUser() {
  return signOut(auth);
}

export function formatAuthErrorIndonesia(err: unknown): string | null {
  const code = (err as { code?: string })?.code || '';
  const lang = getAppLanguage();

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return null;
  }

  const rawMsg = (err as { message?: string })?.message || code || '';
  if (rawMsg && isQuotaOrLimitError(rawMsg)) {
    triggerMaintenanceFromError(rawMsg);
    const sanitized = sanitizeErrorForViewer({
      rawError: rawMsg,
      user: auth.currentUser,
      lang,
    });
    if (!sanitized.isPrivileged) {
      return sanitized.displayMessage;
    }
  }

  if (lang === 'en') {
    switch (code) {
      case 'auth/popup-blocked':
        return 'Sign-in pop-up was blocked by your browser. Allow pop-ups for this site and try again.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password. Please check and try again, or register a new account.';
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please sign in to your account.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Network connection error. Please check your internet and try again.';
      case 'auth/account-exists-with-different-credential':
        return 'This email is already linked to another sign-in method (such as Google or Email). Please use your previous method.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled in the Firebase Authentication Console.';
      case 'auth/unauthorized-domain':
        return `Domain ${typeof window !== 'undefined' ? window.location.hostname : 'this site'} is not added to Authorized Domains in Firebase Authentication Console.`;
      case 'auth/missing-or-invalid-nonce':
      case 'auth/invalid-oauth-provider-id':
        return 'Apple Sign-In configuration (Service ID / Key / Redirect URL) needs review in Firebase Console.';
      case 'auth/internal-error':
        return 'Login configuration or OAuth connection error occurred. Verify Authorized Domains and App Check settings.';
      default: {
        const msg = (err as { message?: string })?.message;
        return msg ? `Sign-in failed: ${msg}` : 'An error occurred during sign-in. Please try again.';
      }
    }
  }

  if (lang === 'zh') {
    switch (code) {
      case 'auth/popup-blocked':
        return '登录弹窗被浏览器拦截，请允许本站弹窗后重试。';
      case 'auth/invalid-email':
        return '邮箱地址格式无效。';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return '邮箱或密码错误，请检查后重试或注册新账号。';
      case 'auth/email-already-in-use':
        return '该邮箱已注册，请直接登录。';
      case 'auth/weak-password':
        return '密码强度不足，请至少使用 6 个字符。';
      case 'auth/too-many-requests':
        return '尝试次数过多，请稍后再试。';
      case 'auth/network-request-failed':
        return '网络连接异常，请检查网络后重试。';
      case 'auth/account-exists-with-different-credential':
        return '该邮箱已绑定其他登录方式（如 Google 或邮箱密码），请使用原来的方式登录。';
      case 'auth/operation-not-allowed':
        return 'Firebase 控制台尚未启用此登录方式。';
      case 'auth/unauthorized-domain':
        return `域名 ${typeof window !== 'undefined' ? window.location.hostname : '当前域名'} 尚未添加到 Firebase 授权域名列表。`;
      case 'auth/missing-or-invalid-nonce':
      case 'auth/invalid-oauth-provider-id':
        return '请在 Firebase 控制台检查 Apple 登录配置（Service ID / Key / 回调地址）。';
      case 'auth/internal-error':
        return '登录配置或 OAuth 连接出现异常，请确认授权域名与 App Check 设置。';
      default: {
        const msg = (err as { message?: string })?.message;
        return msg ? `登录失败：${msg}` : '登录时发生错误，请重试。';
      }
    }
  }

  switch (code) {
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
      return 'Email ini sudah terhubung dengan metode masuk lain (misalnya Google/Email). Gunakan metode masuk yang sebelumnya Anda pakai.';
    case 'auth/operation-not-allowed':
      return 'Metode login ini belum diaktifkan di Firebase Authentication Console.';
    case 'auth/unauthorized-domain':
      return `Domain ${typeof window !== 'undefined' ? window.location.hostname : 'ini'} belum ditambahkan ke Authorized Domains di Firebase Authentication Console.`;
    case 'auth/missing-or-invalid-nonce':
    case 'auth/invalid-oauth-provider-id':
      return 'Konfigurasi Apple Sign-In (Service ID / Key / Redirect URL) di Firebase Console perlu diperiksa kembali.';
    case 'auth/internal-error':
      return 'Terjadi gangguan konfigurasi login atau koneksi OAuth. Pastikan domain sudah terdaftar di Firebase Authorized Domains dan App Check reCAPTCHA mengizinkan domain ini.';
    default: {
      const msg = (err as { message?: string })?.message;
      return msg ? `Gagal masuk: ${msg}` : 'Terjadi kesalahan saat masuk. Silakan coba lagi.';
    }
  }
}
