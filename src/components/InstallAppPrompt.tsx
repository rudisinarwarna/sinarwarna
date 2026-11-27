import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const INSTALL_DISMISSED_KEY = 'sinar-warna-install-dismissed-v1';

export function isInstallPromptDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markInstallPromptDismissed(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
  } catch {
    // Ignore storage restriction
  }
}

interface InstallAppPromptProps {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onInstall: () => Promise<boolean>;
  onOpenSettings: () => void;
  onDismiss: () => void;
}

export const InstallAppPrompt: React.FC<InstallAppPromptProps> = ({
  isInstallable,
  isInstalled,
  isIOS,
  onInstall,
  onOpenSettings,
  onDismiss,
}) => {
  const { t } = useLanguage();
  const [showSafariSteps, setShowSafariSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      setBusy(true);
      try {
        const accepted = await onInstall();
        if (accepted) {
          onDismiss();
          return;
        }
      } finally {
        setBusy(false);
      }
    }

    if (isIOS) {
      setShowSafariSteps((prev) => !prev);
      return;
    }

    onDismiss();
    onOpenSettings();
  };

  return (
    <div
      role="dialog"
      aria-label={t.installPrompt.dialogAria}
      className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-md rounded-2xl border border-blue-500/25 dark:border-[#293456] bg-white/95 dark:bg-[#111626]/95 p-4 shadow-2xl backdrop-blur-md sm:bottom-5 sm:left-auto sm:right-5"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <img
            src="/apple-touch-icon.png?v=2"
            alt="Logo Sinar Warna"
            className="h-11 w-11 rounded-xl border border-zinc-200/90 bg-white object-contain p-0.5 shadow-sm"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                {t.installPrompt.title}
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t.installPrompt.desc}
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t.installPrompt.closeAria}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showSafariSteps && (
            <div className="mt-2.5 rounded-xl border border-zinc-200 dark:border-[#242C44] bg-zinc-50 dark:bg-[#0B0F1A] p-2.5 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 space-y-1">
              <p>
                {t.installPrompt.step1Prefix}{' '}
                <span className="inline-flex items-center gap-1 font-semibold text-[#0A36FF] dark:text-blue-400">
                  <Share className="h-3 w-3" /> {t.installPrompt.step1Share}
                </span>{' '}
                {t.installPrompt.step1Suffix}
              </p>
              <p>
                {t.installPrompt.step2Prefix} <strong>{t.installPrompt.step2AddHome}</strong>
                {t.installPrompt.step2Middle} <strong>{t.installPrompt.step2Add}</strong>.
              </p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleInstallClick()}
              className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-3.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60 transition-opacity cursor-pointer whitespace-nowrap"
            >
              {isIOS ? (
                <Share className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <Download className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                {busy
                  ? t.installPrompt.installing
                  : isInstallable
                  ? t.installPrompt.installWebApp
                  : isIOS
                  ? t.installPrompt.installSafari
                  : t.installPrompt.installWebApp}
              </span>
            </button>

            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-zinc-200 dark:border-[#293456] px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {t.installPrompt.later}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
