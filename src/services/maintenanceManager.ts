import type { User } from 'firebase/auth';

export const PRIMARY_ADMIN_EMAILS = [
  'rudi.sinarwarna@gmail.com',
  'rudifei@gmail.com',
] as const;

export type AppLanguage = 'id' | 'en' | 'zh';

const LANG_STORAGE_KEY = 'sw_app_language_v1';
const MAINTENANCE_STORAGE_KEY = 'sw_maintenance_active_v1';

export interface MaintenanceState {
  active: boolean;
  reason?: string;
  rawError?: string;
  triggeredAt?: number;
}

export function extractEmail(user: User | { email?: string | null } | null | undefined): string {
  if (!user) return '';
  if (user.email) return user.email.trim().toLowerCase();
  if ('providerData' in user && Array.isArray(user.providerData)) {
    const providerEmail = user.providerData.find((p) => Boolean(p?.email))?.email;
    return providerEmail ? providerEmail.trim().toLowerCase() : '';
  }
  return '';
}

export function isPrivilegedAdminUser(
  user: User | { email?: string | null } | null | undefined,
  adminLevel?: string
): boolean {
  if (adminLevel === 'primary' || adminLevel === 'admin_plus' || adminLevel === 'admin') {
    return true;
  }
  if (!user) return false;
  const email = extractEmail(user);
  if (
    email === 'rudifei@gmail.com' ||
    email === 'rudi.sinarwarna@gmail.com' ||
    PRIMARY_ADMIN_EMAILS.includes(email as (typeof PRIMARY_ADMIN_EMAILS)[number])
  ) {
    return true;
  }
  return false;
}

export function isQuotaOrLimitError(err: unknown): boolean {
  if (!err) return false;
  const text = String(
    typeof err === 'object' && err !== null && 'message' in err
      ? (err as { message: unknown }).message
      : err
  ).toLowerCase();

  return (
    text.includes('429') ||
    text.includes('resource_exhausted') ||
    text.includes('quota') ||
    text.includes('kuota') ||
    text.includes('rate limit') ||
    text.includes('rate_limit') ||
    text.includes('limit hydrogen') ||
    text.includes('hydrogen rpm') ||
    text.includes('rpm') ||
    text.includes('too many requests') ||
    text.includes('exceeded') ||
    text.includes('overloaded') ||
    text.includes('high demand') ||
    text.includes('503') ||
    text.includes('unavailable') ||
    text.includes('pemeliharaan') ||
    text.includes('maintenance') ||
    text.includes('client is offline') ||
    text.includes('quota metric')
  );
}

export function getAppLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'id';
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'id' || saved === 'zh') return saved;
    const nav = navigator.language?.toLowerCase() || '';
    if (nav.startsWith('zh')) return 'zh';
    if (nav.startsWith('en')) return 'en';
    return 'id';
  } catch {
    return 'id';
  }
}

export function setAppLanguage(lang: AppLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage quota error
  }
}

export function getMaintenanceMessages(lang: AppLanguage = 'id'): {
  title: string;
  badge: string;
  description: string;
  tickerText: string;
  tryAgainText: string;
  adminModalTitle: string;
  adminPublicStatusLabel: string;
  adminPublicStatusPrefix: string;
  adminRawErrorLabel: string;
  adminRawErrorFallback: string;
  adminDetectedAtLabel: string;
  adminTurnOffBtn: string;
  adminCloseBtn: string;
  adminViewRawErrorBtn: string;
  adminViewRawErrorShort: string;
  adminDoneBtn: string;
  adminDismissAria: string;
} {
  if (lang === 'en') {
    return {
      title: 'Under Maintenance',
      badge: 'UNDER MAINTENANCE',
      description:
        'System is currently Under Maintenance to optimize capacity and server performance. Please try again in a few moments.',
      tickerText:
        'SYSTEM BROADCAST: Sinar Warna AI is currently Under Maintenance. Server capacity is being upgraded. Please wait a moment, services will resume shortly.',
      tryAgainText: 'Try Again Later',
      adminModalTitle: 'Original Raw Error Details (Admin Only)',
      adminPublicStatusLabel: 'Public User View:',
      adminPublicStatusPrefix: 'Regular users see a friendly Under Maintenance message:',
      adminRawErrorLabel: 'Raw System Error Message:',
      adminRawErrorFallback: 'No raw error details recorded.',
      adminDetectedAtLabel: 'Detected at:',
      adminTurnOffBtn: 'Turn Off Maintenance',
      adminCloseBtn: 'Close',
      adminViewRawErrorBtn: 'View Raw Error',
      adminViewRawErrorShort: 'Error',
      adminDoneBtn: 'Done',
      adminDismissAria: 'Dismiss broadcast',
    };
  }

  if (lang === 'zh') {
    return {
      title: '系统维护中 (Under Maintenance)',
      badge: '系统维护中',
      description:
        '系统目前正在维护中（Under Maintenance），以优化服务器容量和性能。请稍后再试。',
      tickerText:
        '系统公告：Sinar Warna AI 目前正在系统维护中（Under Maintenance）。技术团队正在优化服务器容量，请稍候片刻，服务将很快恢复正常。',
      tryAgainText: '稍后再试',
      adminModalTitle: '原始错误详情（管理员专属）',
      adminPublicStatusLabel: '普通用户显示状态：',
      adminPublicStatusPrefix: '普通用户将看到友好的维护提示：',
      adminRawErrorLabel: '系统原始错误信息：',
      adminRawErrorFallback: '暂无原始错误详情。',
      adminDetectedAtLabel: '检测时间：',
      adminTurnOffBtn: '关闭维护模式',
      adminCloseBtn: '关闭',
      adminViewRawErrorBtn: '查看原始错误',
      adminViewRawErrorShort: '错误',
      adminDoneBtn: '完成',
      adminDismissAria: '关闭公告',
    };
  }

  return {
    title: 'Sedang Dalam Pemeliharaan (Under Maintenance)',
    badge: 'UNDER MAINTENANCE',
    description:
      'Mohon maaf atas ketidaknyamanannya. Sistem saat ini sedang Under Maintenance untuk peningkatan kapasitas server. Silakan coba kembali dalam beberapa saat.',
    tickerText:
      'SIARAN SISTEM: Sinar Warna AI saat ini sedang Under Maintenance. Tim teknis sedang mengoptimalkan kapasitas server. Mohon tunggu beberapa saat, layanan akan segera kembali normal.',
    tryAgainText: 'Coba Lagi Nanti',
    adminModalTitle: 'Detail Error Asli (Tampilan Admin)',
    adminPublicStatusLabel: 'Status Pengguna Publik:',
    adminPublicStatusPrefix: 'Pengguna umum melihat pesan ramah Under Maintenance:',
    adminRawErrorLabel: 'Pesan Error Asli Sistem:',
    adminRawErrorFallback: 'Tidak ada detail error mentah.',
    adminDetectedAtLabel: 'Waktu terdeteksi:',
    adminTurnOffBtn: 'Matikan Mode Pemeliharaan',
    adminCloseBtn: 'Tutup',
    adminViewRawErrorBtn: 'Lihat Error Asli',
    adminViewRawErrorShort: 'Error',
    adminDoneBtn: 'Selesai',
    adminDismissAria: 'Tutup siaran',
  };
}

export function sanitizeErrorForViewer(params: {
  rawError: string;
  user: User | { email?: string | null } | null | undefined;
  adminLevel?: string;
  lang?: AppLanguage;
}): {
  isLimit: boolean;
  displayMessage: string;
  rawError: string;
  isPrivileged: boolean;
} {
  const { rawError, user, adminLevel, lang = getAppLanguage() } = params;
  const isPrivileged = isPrivilegedAdminUser(user, adminLevel);
  const isLimit = isQuotaOrLimitError(rawError);

  if (isPrivileged) {
    return {
      isLimit,
      displayMessage: rawError,
      rawError,
      isPrivileged: true,
    };
  }

  if (isLimit) {
    const localized = getMaintenanceMessages(lang);
    return {
      isLimit: true,
      displayMessage: localized.description,
      rawError,
      isPrivileged: false,
    };
  }

  return {
    isLimit: false,
    displayMessage: rawError,
    rawError,
    isPrivileged: false,
  };
}

const maintenanceSubscribers = new Set<(state: MaintenanceState) => void>();

export function getMaintenanceState(): MaintenanceState {
  if (typeof window === 'undefined') {
    return { active: false };
  }
  try {
    const raw = sessionStorage.getItem(MAINTENANCE_STORAGE_KEY);
    if (!raw) return { active: false };
    const parsed = JSON.parse(raw) as MaintenanceState;
    if (parsed.triggeredAt && Date.now() - parsed.triggeredAt > 45 * 60 * 1000) {
      sessionStorage.removeItem(MAINTENANCE_STORAGE_KEY);
      return { active: false };
    }
    return parsed;
  } catch {
    return { active: false };
  }
}

export function setMaintenanceState(next: MaintenanceState): void {
  if (typeof window !== 'undefined') {
    try {
      if (next.active) {
        sessionStorage.setItem(
          MAINTENANCE_STORAGE_KEY,
          JSON.stringify({
            ...next,
            triggeredAt: next.triggeredAt || Date.now(),
          })
        );
      } else {
        sessionStorage.removeItem(MAINTENANCE_STORAGE_KEY);
      }
    } catch {
      // Ignore sessionStorage error
    }
  }

  for (const sub of maintenanceSubscribers) {
    try {
      sub(next);
    } catch {
      // Ignore callback errors
    }
  }
}

export function triggerMaintenanceFromError(rawError: string): void {
  if (!isQuotaOrLimitError(rawError)) return;
  setMaintenanceState({
    active: true,
    reason: 'Server Quota / Rate Limit Reached',
    rawError,
    triggeredAt: Date.now(),
  });
}

export function subscribeMaintenance(
  cb: (state: MaintenanceState) => void
): () => void {
  maintenanceSubscribers.add(cb);
  cb(getMaintenanceState());
  return () => {
    maintenanceSubscribers.delete(cb);
  };
}
