import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  Download,
  MessageSquareText,
  Moon,
  PlusSquare,
  Settings,
  Share,
  ShieldCheck,
  Smartphone,
  Sun,
  X,
} from 'lucide-react';
import type { AdminLevel } from '../services/adminService';
import { AdminPanel } from './AdminPanel';
import { SinarLogo } from './SinarLogo';

interface SettingsModalProps {
  isOpen: boolean;
  isDark: boolean;
  showLiveTranscript: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAdmin?: boolean;
  adminLevel?: AdminLevel;
  currentUser?: User | null;
  onClose: () => void;
  onSetTheme: (dark: boolean) => void;
  onSetShowLiveTranscript: (show: boolean) => void;
  onInstallAndroid: () => Promise<boolean>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  isDark,
  showLiveTranscript,
  isInstallable,
  isInstalled,
  isIOS,
  isAdmin = false,
  adminLevel = 'none',
  currentUser = null,
  onClose,
  onSetTheme,
  onSetShowLiveTranscript,
  onInstallAndroid,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'admin'>('general');
  const [androidGuideOpen, setAndroidGuideOpen] = useState(false);
  const [safariGuideOpen, setSafariGuideOpen] = useState(isIOS);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isAdmin && activeTab === 'admin') {
      setActiveTab('general');
    }
  }, [activeTab, isAdmin]);

  if (!isOpen) return null;

  const handleAndroidClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        const accepted = await onInstallAndroid();
        if (!accepted) {
          setAndroidGuideOpen(true);
        }
      } finally {
        setInstalling(false);
      }
      return;
    }
    setAndroidGuideOpen((prev) => !prev);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Pengaturan Sinar Warna"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        className={`w-full overflow-hidden rounded-t-3xl sm:rounded-3xl border border-blue-500/20 dark:border-[#242C44] bg-white dark:bg-[#111626] text-zinc-900 dark:text-[#E3E3E3] shadow-2xl ${
          isAdmin && activeTab === 'admin' ? 'sm:max-w-xl' : 'sm:max-w-md'
        }`}
      >
        <div className="h-1 w-full bg-gradient-to-r from-[#E51D2B] to-[#0A36FF]" />

        <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-[#242C44] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <SinarLogo size={24} />
            <h2 className="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-white">
              Pengaturan
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isAdmin && (
          <div className="border-b border-zinc-200/80 dark:border-[#242C44] px-5 py-2.5">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1 dark:bg-[#0B0F1A]">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'general'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-[#1A2238] dark:text-white'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                <Settings className="h-3.5 w-3.5 text-[#0A36FF] dark:text-blue-400" />
                <span>Umum &amp; Tampilan</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Administrator</span>
              </button>
            </div>
          </div>
        )}

        <div className="max-h-[78dvh] overflow-y-auto p-5 space-y-6">
          {isAdmin && activeTab === 'admin' ? (
            <AdminPanel currentUser={currentUser} adminLevel={adminLevel} compact />
          ) : (
            <>
              {/* Pengaturan Cahaya / Tema */}
              <section className="space-y-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Pengaturan Cahaya & Tema
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Pilih tampilan terang atau gelap sesuai kenyamanan mata Anda.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1.5 dark:bg-[#0B0F1A]">
                  <button
                    type="button"
                    onClick={() => onSetTheme(false)}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      !isDark
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Sun className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>Tema Terang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTheme(true)}
                    className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      isDark
                        ? 'bg-[#1A2238] text-white shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Moon className="h-4 w-4 text-blue-400 shrink-0" />
                    <span>Tema Gelap</span>
                  </button>
                </div>
              </section>

              <div className="border-t border-zinc-200/80 dark:border-[#242C44]" />

              {/* Kotak Teks Bicara di AI Live */}
              <section className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-white">
                      <MessageSquareText className="h-4 w-4 text-[#0A36FF] dark:text-blue-400 shrink-0" />
                      <span>Kotak Teks Bicara AI Live</span>
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Tampilkan atau sembunyikan kotak teks percakapan langsung saat memakai AI Live.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1.5 dark:bg-[#0B0F1A]">
                  <button
                    type="button"
                    onClick={() => onSetShowLiveTranscript(true)}
                    className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      showLiveTranscript
                        ? 'bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] text-white shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span>Hidupkan Teks</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetShowLiveTranscript(false)}
                    className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      !showLiveTranscript
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-[#1A2238] dark:text-white'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span>Matikan Teks</span>
                  </button>
                </div>
              </section>

              <div className="border-t border-zinc-200/80 dark:border-[#242C44]" />

              {/* Download / Pasang Web App Android & Safari Apple */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Download Aplikasi Sinar Warna
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Pasang aplikasi web ke layar utama agar lebih cepat dibuka di Android maupun
                    iPhone (Safari).
                  </p>
                </div>

                {isInstalled ? (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Aplikasi Sinar Warna sudah terpasang di perangkat ini.</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Android */}
                    <button
                      type="button"
                      disabled={installing}
                      onClick={() => void handleAndroidClick()}
                      className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-4 py-2.5 text-left text-white shadow-sm hover:opacity-95 disabled:opacity-60 transition-opacity cursor-pointer"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Smartphone className="h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold">
                            {installing ? 'Memproses...' : 'Download App untuk Android'}
                          </span>
                          <span className="block text-[11px] text-white/85 truncate">
                            {isInstallable
                              ? 'Ketuk untuk langsung memasang di HP Android'
                              : 'Pasang lewat Google Chrome Android'}
                          </span>
                        </span>
                      </span>
                      <Download className="h-4 w-4 shrink-0" />
                    </button>

                    {androidGuideOpen && (
                      <div className="rounded-2xl border border-zinc-200 dark:border-[#242C44] bg-zinc-50 dark:bg-[#0B0F1A] p-3.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 space-y-1.5">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          Cara Pasang di Android (Chrome):
                        </p>
                        <p>1. Buka halaman ini menggunakan browser Google Chrome.</p>
                        <p>
                          2. Ketuk ikon menu <strong>titik tiga (⋮)</strong> di pojok kanan atas.
                        </p>
                        <p>
                          3. Pilih <strong>Tambahkan ke Layar Utama</strong> atau{' '}
                          <strong>Instal aplikasi</strong>.
                        </p>
                      </div>
                    )}

                    {/* Apple Safari */}
                    <button
                      type="button"
                      onClick={() => setSafariGuideOpen((prev) => !prev)}
                      className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-[#293456] bg-zinc-50 dark:bg-[#171E33] px-4 py-2.5 text-left text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#1E2742] transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Share className="h-4 w-4 shrink-0 text-[#0A36FF] dark:text-blue-400" />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold">
                            Download App untuk Apple Safari
                          </span>
                          <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            Panduan pasang di iPhone, iPad, atau Mac Safari
                          </span>
                        </span>
                      </span>
                      <PlusSquare className="h-4 w-4 shrink-0 text-zinc-400" />
                    </button>

                    {safariGuideOpen && (
                      <div className="rounded-2xl border border-zinc-200 dark:border-[#242C44] bg-zinc-50 dark:bg-[#0B0F1A] p-3.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 space-y-1.5">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          Cara Pasang di Safari Apple (iPhone / iPad):
                        </p>
                        <p>
                          1. Pastikan situs dibuka lewat browser <strong>Safari</strong>.
                        </p>
                        <p className="flex items-center gap-1.5 flex-wrap">
                          <span>2. Ketuk tombol</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-[#0A36FF] dark:text-blue-400">
                            <Share className="h-3.5 w-3.5" /> Bagikan (Share)
                          </span>
                          <span>di bagian bawah layar Safari.</span>
                        </p>
                        <p>
                          3. Gulir ke bawah, pilih <strong>Tambah ke Layar Utama</strong> (
                          <em>Add to Home Screen</em>), lalu ketuk <strong>Tambah</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
