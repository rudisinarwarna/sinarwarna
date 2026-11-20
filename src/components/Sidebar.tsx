import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import type { Conversation } from '../types/chat';
import { SinarLogo } from './SinarLogo';

interface SidebarProps {
  isDesktopOpen: boolean;
  isMobileOpen: boolean;
  isDark: boolean;
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  onCloseMobile: () => void;
  onToggleDesktop: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onToggleTheme: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isDesktopOpen,
  isMobileOpen,
  isDark,
  user,
  authReady,
  authLoading,
  conversations,
  activeConversationId,
  onCloseMobile,
  onToggleDesktop,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onToggleTheme,
  onSignIn,
  onSignOut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const userInitial = (user?.displayName || user?.email || 'K').charAt(0).toUpperCase();

  const renderSidebarContent = () => (
    <div className="flex h-full w-[280px] max-w-[85vw] flex-col border-r border-blue-500/15 dark:border-[#242C44] bg-[#F5F7FC] dark:bg-[#111626]">
      {/* Top accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-[#E51D2B] to-[#0A36FF]" />

      {/* Top Row */}
      <div className="flex h-14 items-center justify-between px-3">
        <button
          type="button"
          onClick={onToggleDesktop}
          title="Tutup panel samping"
          aria-label="Tutup panel samping"
          className="hidden lg:inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-600 hover:bg-blue-600/10 hover:text-blue-700 dark:text-zinc-400 dark:hover:bg-blue-500/15 dark:hover:text-white transition-colors cursor-pointer"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 pl-1 lg:hidden">
          <SinarLogo size={22} />
          <span className="font-display text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">
            Sinar Warna
          </span>
        </div>

        <button
          type="button"
          onClick={onCloseMobile}
          title="Tutup menu"
          aria-label="Tutup menu"
          className="inline-flex lg:hidden h-11 w-11 items-center justify-center rounded-xl text-zinc-600 hover:bg-red-500/15 hover:text-red-600 dark:text-zinc-300 dark:hover:bg-red-500/20 dark:hover:text-red-300 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Percakapan Baru</span>
        </button>
      </div>

      {/* Search & History */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-200/80 dark:border-[#242C44] px-3 pt-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {user ? 'Riwayat Cloud' : 'Riwayat Lokal'}
          </span>
          {conversations.length > 0 && (
            <span className="text-[11px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
              {conversations.length}
            </span>
          )}
        </div>

        {conversations.length > 2 && (
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari riwayat..."
              aria-label="Cari riwayat percakapan"
              className="h-9 w-full rounded-lg border border-zinc-200 dark:border-[#2A3350] bg-white dark:bg-[#0B0F1A] pl-8 pr-3 text-xs text-zinc-800 placeholder:text-zinc-400 dark:text-zinc-200 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        <div className="flex-1 space-y-1 overflow-y-auto pb-3">
          {filteredConversations.length === 0 ? (
            <p className="px-2 py-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
              {conversations.length === 0
                ? 'Belum ada riwayat. Mulai percakapan untuk menyimpan ide kreatif Anda.'
                : 'Tidak ada percakapan yang cocok.'}
            </p>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  className={`group flex min-h-[42px] items-center gap-1 rounded-xl px-2 py-1 transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-[#E51D2B]/14 to-[#0A36FF]/18 text-[#0A36FF] dark:from-[#E51D2B]/25 dark:to-[#0A36FF]/28 dark:text-blue-200 border border-blue-500/25'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-white/5'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onCloseMobile();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-1 text-left cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-65" />
                    <span className="truncate text-[13px] font-medium">{conv.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    title="Hapus percakapan"
                    aria-label={`Hapus ${conv.title}`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Theme & Firebase Account */}
      <div className="border-t border-zinc-200/80 dark:border-[#242C44] p-3 space-y-1.5">
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-600" />}
            <span>{isDark ? 'Tema Terang' : 'Tema Gelap'}</span>
          </span>
        </button>

        {authReady && user ? (
          <div className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Profil'}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 shrink-0 rounded-full object-cover border border-blue-500/30"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E51D2B] to-[#0A36FF] text-xs font-semibold text-white">
                  {userInitial}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {user.displayName || 'Kreator Sinar Warna'}
                </p>
                {user.email && (
                  <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Keluar akun"
              aria-label="Keluar akun"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/15 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!authReady || authLoading}
            onClick={() => {
              onSignIn();
              onCloseMobile();
            }}
            className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border border-blue-500/30 bg-white dark:bg-[#171E33] px-3 text-xs font-semibold text-zinc-800 hover:border-blue-500/60 hover:bg-blue-50/50 dark:text-zinc-100 dark:hover:bg-[#1E2742] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogIn className="h-4 w-4 shrink-0 text-[#0A36FF] dark:text-blue-400" />
            <span>{authLoading ? 'Menghubungkan...' : 'Masuk / Daftar Akun'}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent/collapsible sidebar */}
      <aside
        className={`hidden lg:block shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${
          isDesktopOpen ? 'w-[280px]' : 'w-0'
        }`}
      >
        {isDesktopOpen && renderSidebarContent()}
      </aside>

      {/* Mobile slide-over drawer (strictly controlled by isMobileOpen) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{renderSidebarContent()}</div>
        </div>
      )}
    </>
  );
};
