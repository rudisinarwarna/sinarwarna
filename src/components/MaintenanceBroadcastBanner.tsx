import React, { useState } from 'react';
import { AlertTriangle, Eye, Radio, ShieldAlert, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import { useLanguage } from '../i18n/LanguageContext';
import {
  getMaintenanceMessages,
  isPrivilegedAdminUser,
  setMaintenanceState,
  type AppLanguage,
  type MaintenanceState,
} from '../services/maintenanceManager';

interface MaintenanceBroadcastBannerProps {
  maintenance: MaintenanceState;
  user: User | { email?: string | null } | null;
  adminLevel?: string;
  lang?: AppLanguage;
  onDismiss?: () => void;
}

export const MaintenanceBroadcastBanner: React.FC<MaintenanceBroadcastBannerProps> = ({
  maintenance,
  user,
  adminLevel = 'none',
  lang: propLang,
  onDismiss,
}) => {
  const { lang: ctxLang } = useLanguage();
  const activeLang = propLang || ctxLang;
  const [showAdminModal, setShowAdminModal] = useState(false);
  const isPrivileged = isPrivilegedAdminUser(user, adminLevel);
  const messages = getMaintenanceMessages(activeLang);

  if (!maintenance.active) return null;

  const handleDeactivate = () => {
    setMaintenanceState({ active: false });
    onDismiss?.();
  };

  return (
    <>
      <div
        className="relative z-30 w-full overflow-hidden border-b border-blue-500/20 dark:border-[#242C44] bg-gradient-to-r from-[#E51D2B]/[0.08] via-blue-50/95 to-[#0A36FF]/[0.10] dark:from-[#1A0D18] dark:via-[#11162B] dark:to-[#0C142B] text-zinc-900 dark:text-white shadow-sm select-none"
        role="alert"
        aria-label={messages.title}
      >
        {/* Brand Glow Top Accent Line matching Sinar Warna */}
        <div className="h-[2px] w-full bg-gradient-to-r from-[#E51D2B] via-[#6366F1] to-[#0A36FF]" />

        <div className="flex h-10 items-center justify-between px-3 sm:px-5 text-xs">
          {/* Static Left Broadcast Pill */}
          <div className="z-10 flex shrink-0 items-center gap-2 pr-3 sm:pr-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E51D2B] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#E51D2B]" />
            </span>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-gradient-to-r from-[#E51D2B]/15 to-[#0A36FF]/15 px-2.5 py-0.5 font-display text-[10px] font-bold tracking-wider text-[#E51D2B] dark:border-blue-400/35 dark:from-[#E51D2B]/30 dark:to-[#0A36FF]/35 dark:text-amber-200 whitespace-nowrap">
              <Radio className="h-3 w-3 text-[#E51D2B] dark:text-[#FF4D5A]" />
              <span>{messages.badge}</span>
            </div>
          </div>

          {/* Infinite Repeating Broadcast Marquee Ticker */}
          <div className="relative min-w-0 flex-1 overflow-hidden group">
            <div className="flex w-max animate-marquee gap-10 text-xs font-medium text-zinc-800 dark:text-zinc-100 group-hover:[animation-play-state:paused]">
              <div className="flex shrink-0 items-center gap-6">
                <span>{messages.tickerText}</span>
                <span className="text-[#E51D2B] dark:text-[#FF4D5A]">✦</span>
                <span>{messages.tickerText}</span>
                <span className="text-[#0A36FF] dark:text-[#60A5FA]">✦</span>
              </div>
              <div className="flex shrink-0 items-center gap-6">
                <span>{messages.tickerText}</span>
                <span className="text-[#E51D2B] dark:text-[#FF4D5A]">✦</span>
                <span>{messages.tickerText}</span>
                <span className="text-[#0A36FF] dark:text-[#60A5FA]">✦</span>
              </div>
            </div>
          </div>

          {/* Static Right Admin / Action Controls */}
          <div className="z-10 flex shrink-0 items-center gap-1.5 pl-3">
            {isPrivileged && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(true)}
                  title={messages.adminViewRawErrorBtn}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/15 px-2.5 py-1 text-[10px] font-semibold text-[#0A36FF] hover:bg-blue-500/25 dark:border-blue-400/50 dark:bg-blue-500/20 dark:text-blue-200 dark:hover:bg-blue-500/35 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Eye className="h-3 w-3" />
                  <span className="hidden sm:inline">{messages.adminViewRawErrorBtn}</span>
                  <span className="sm:hidden">{messages.adminViewRawErrorShort}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeactivate}
                  title={messages.adminTurnOffBtn}
                  className="inline-flex items-center gap-1 rounded-full border border-[#E51D2B]/40 bg-[#E51D2B]/15 px-2.5 py-1 text-[10px] font-semibold text-[#E51D2B] hover:bg-[#E51D2B]/25 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-200 dark:hover:bg-red-500/35 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>{messages.adminDoneBtn}</span>
                </button>
              </>
            )}

            {!isPrivileged && onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label={messages.adminDismissAria}
                className="rounded-full p-1 text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Admin Raw Error Inspector Modal */}
      {showAdminModal && isPrivileged && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAdminModal(false);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-blue-500/30 bg-white dark:bg-[#111626] text-zinc-900 dark:text-white shadow-2xl">
            <div className="h-1 w-full bg-gradient-to-r from-[#E51D2B] to-[#0A36FF]" />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-[#242C44] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-[#E51D2B] dark:text-[#FF4D5A]" />
                  <h3 className="font-display text-sm font-bold tracking-tight">
                    {messages.adminModalTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  aria-label={messages.adminCloseBtn}
                  className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/35 p-3 text-amber-900 dark:text-amber-200">
                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{messages.adminPublicStatusLabel}</span>
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {messages.adminPublicStatusPrefix}{' '}
                    <span className="font-medium text-zinc-900 dark:text-white italic">
                      "{messages.title} - {messages.description}"
                    </span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-600 dark:text-zinc-400">
                    {messages.adminRawErrorLabel}
                  </label>
                  <pre className="max-h-48 overflow-y-auto rounded-2xl border border-red-300 dark:border-red-500/30 bg-red-50/90 dark:bg-zinc-950 p-3.5 font-mono text-xs text-red-900 dark:text-red-300 whitespace-pre-wrap break-words">
                    {maintenance.rawError || maintenance.reason || messages.adminRawErrorFallback}
                  </pre>
                </div>

                {maintenance.triggeredAt && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {messages.adminDetectedAtLabel}{' '}
                    {new Date(maintenance.triggeredAt).toLocaleString(
                      activeLang === 'zh' ? 'zh-CN' : activeLang === 'en' ? 'en-US' : 'id-ID'
                    )}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-200/80 dark:border-[#242C44] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    handleDeactivate();
                    setShowAdminModal(false);
                  }}
                  className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-semibold text-[#E51D2B] hover:bg-red-100 dark:border-red-500/40 dark:bg-red-600/25 dark:text-red-200 dark:hover:bg-red-600/40 transition-colors cursor-pointer"
                >
                  {messages.adminTurnOffBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="rounded-xl bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-white/15 dark:text-white dark:hover:bg-white/25 transition-colors cursor-pointer"
                >
                  {messages.adminCloseBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
