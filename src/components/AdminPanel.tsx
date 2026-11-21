import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  BadgeCheck,
  Ban,
  BookOpen,
  CheckCircle2,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldOff,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  addAdminMemory,
  deleteAdminMemory,
  deleteUserAccount,
  seedDefaultAdminMemoriesOnce,
  setUserAdminRole,
  setUserBlocked,
  setUserVerifiedBadge,
  subscribeAdminMemories,
  subscribeAllUsers,
  type AdminMemoryDoc,
  type ManagedUserRecord,
} from '../services/adminService';
import { VerifiedBlueBadge } from './VerifiedBlueBadge';

interface AdminPanelProps {
  currentUser: User | null;
  compact?: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, compact = false }) => {
  const [subTab, setSubTab] = useState<'users' | 'memories'>('users');
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [memories, setMemories] = useState<AdminMemoryDoc[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [busyMemoryId, setBusyMemoryId] = useState<string | null>(null);
  const [confirmDeleteMemId, setConfirmDeleteMemId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [savingMemory, setSavingMemory] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    void seedDefaultAdminMemoriesOnce(currentUser).catch((err) => {
      console.error('Seed admin memories skipped/error:', err);
    });

    const unsubUsers = subscribeAllUsers(
      (list) => setUsers(list),
      (err) => setFeedback({ type: 'err', text: err.message })
    );
    const unsubMemories = subscribeAdminMemories(
      (list) => setMemories(list),
      (err) => setFeedback({ type: 'err', text: err.message })
    );

    return () => {
      unsubUsers();
      unsubMemories();
    };
  }, [currentUser]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const visible = users.filter((u) => !u.deleted);
    if (!q) return visible;
    return visible.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [userSearch, users]);

  const handleToggleAdmin = async (target: ManagedUserRecord) => {
    if (!currentUser || busyUid) return;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      const makeAdmin = target.role !== 'admin';
      await setUserAdminRole(currentUser, target, makeAdmin);
      setFeedback({
        type: 'ok',
        text: makeAdmin
          ? `${target.displayName} sekarang menjadi Admin (dengan centang biru verified).`
          : `Hak Admin untuk ${target.displayName} telah dicabut.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah peran pengguna.',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleVerifiedBadge = async (target: ManagedUserRecord) => {
    if (busyUid) return;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      const nextVerified = !target.verifiedBadge;
      await setUserVerifiedBadge(target, nextVerified);
      setFeedback({
        type: 'ok',
        text: nextVerified
          ? `Centang biru verified diberikan kepada ${target.displayName}.`
          : `Centang biru verified untuk ${target.displayName} telah dicabut.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah centang biru verified.',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleBlock = async (target: ManagedUserRecord) => {
    if (busyUid) return;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      const nextBlocked = !target.blocked;
      await setUserBlocked(target, nextBlocked);
      setFeedback({
        type: 'ok',
        text: nextBlocked
          ? `Akun ${target.displayName} telah diblokir.`
          : `Blokir akun ${target.displayName} telah dibuka.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah status blokir.',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleDeleteUser = async (target: ManagedUserRecord) => {
    if (busyUid) return;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      await deleteUserAccount(target);
      setConfirmDeleteUid(null);
      setFeedback({
        type: 'ok',
        text: `Akun ${target.displayName} beserta riwayat percakapannya telah dihapus.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus akun pengguna.',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || savingMemory) return;
    if (!newContent.trim()) {
      setFeedback({ type: 'err', text: 'Isi pengingat tidak boleh kosong.' });
      return;
    }
    setSavingMemory(true);
    setFeedback(null);
    try {
      await addAdminMemory({
        adminUser: currentUser,
        title: newTitle.trim() || 'Pengingat Pribadi',
        content: newContent.trim(),
      });
      setNewTitle('');
      setNewContent('');
      setFeedback({
        type: 'ok',
        text: 'Pengingat pribadi disimpan dan langsung disinkronkan ke semua Admin.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan pengingat.',
      });
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (mem: AdminMemoryDoc) => {
    if (busyMemoryId) return;
    setBusyMemoryId(mem.id);
    setFeedback(null);
    try {
      await deleteAdminMemory(mem.id);
      setConfirmDeleteMemId(null);
      setFeedback({
        type: 'ok',
        text: `Pengingat "${mem.title}" telah dihapus dari semua Admin.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus pengingat.',
      });
    } finally {
      setBusyMemoryId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1.5 dark:bg-[#0B0F1A]">
        <button
          type="button"
          onClick={() => setSubTab('users')}
          className={`flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'users'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-[#1A2238] dark:text-white'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <Users className="h-3.5 w-3.5 text-[#0A36FF] dark:text-blue-400" />
          <span>Pengguna ({filteredUsers.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('memories')}
          className={`flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'memories'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-[#1A2238] dark:text-white'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-[#E51D2B] dark:text-[#FF4D5A]" />
          <span>Pengingat Pribadi ({memories.length})</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {subTab === 'users' ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Cari nama atau email pengguna..."
              className="h-9 w-full rounded-xl border border-zinc-200 dark:border-[#2A3350] bg-zinc-50 dark:bg-[#0B0F1A] pl-9 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className={`space-y-2.5 overflow-y-auto ${compact ? 'max-h-[46dvh]' : 'max-h-[55dvh]'}`}>
            {filteredUsers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 dark:border-[#242C44] p-4 text-center text-xs text-zinc-500">
                Belum ada pengguna terdaftar yang cocok.
              </p>
            ) : (
              filteredUsers.map((u) => {
                const isSelf = currentUser?.uid === u.uid;
                const isBusy = busyUid === u.uid;
                const isConfirmingDelete = confirmDeleteUid === u.uid;

                return (
                  <div
                    key={u.uid}
                    className="rounded-2xl border border-zinc-200/90 dark:border-[#242C44] bg-zinc-50/70 dark:bg-[#0B0F1A] p-3 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {u.photoUrl ? (
                          <img
                            src={u.photoUrl}
                            alt={u.displayName}
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 shrink-0 rounded-full object-cover border border-blue-500/25"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E51D2B] to-[#0A36FF] text-xs font-bold text-white">
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-xs font-semibold text-zinc-900 dark:text-white">
                              {u.displayName}
                            </p>
                            {(u.verifiedBadge || u.role === 'admin' || u.isPrimaryAdmin) && (
                              <VerifiedBlueBadge
                                size="sm"
                                title={
                                  u.isPrimaryAdmin
                                    ? 'Admin Utama Terverifikasi'
                                    : u.role === 'admin'
                                    ? 'Admin Terverifikasi'
                                    : 'Pengguna Terverifikasi'
                                }
                              />
                            )}
                            {u.isPrimaryAdmin ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                <Shield className="h-2.5 w-2.5" />
                                Admin Utama
                              </span>
                            ) : u.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-blue-600/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#0A36FF] dark:bg-blue-500/20 dark:text-blue-300">
                                <Shield className="h-2.5 w-2.5" />
                                Admin
                              </span>
                            ) : (
                              <span className="rounded-md bg-zinc-200/80 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                                User
                              </span>
                            )}
                            {u.blocked && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                                <Ban className="h-2.5 w-2.5" />
                                Diblokir
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                            {u.email || u.uid}
                          </p>
                        </div>
                      </div>
                    </div>

                    {u.isPrimaryAdmin ? (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Akun Admin Utama permanen dengan centang biru verified (dilindungi dari blokir atau penghapusan).
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() => void handleToggleAdmin(u)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-white dark:bg-[#14192B] px-2.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 disabled:opacity-50 cursor-pointer"
                        >
                          {u.role === 'admin' ? (
                            <>
                              <ShieldOff className="h-3 w-3" />
                              <span>Cabut Admin</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" />
                              <span>Jadikan Admin</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || isSelf || u.role === 'admin'}
                          title={
                            u.role === 'admin'
                              ? 'Admin otomatis memiliki centang biru verified'
                              : undefined
                          }
                          onClick={() => void handleToggleVerifiedBadge(u)}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium disabled:opacity-50 cursor-pointer ${
                            u.verifiedBadge
                              ? 'border-sky-500/40 bg-sky-50 text-sky-700 dark:bg-sky-950/35 dark:text-sky-300'
                              : 'border-sky-500/30 bg-white dark:bg-[#14192B] text-sky-600 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40'
                          }`}
                        >
                          <BadgeCheck className="h-3 w-3 text-[#1D9BF0]" />
                          <span>{u.verifiedBadge ? 'Cabut Centang Biru' : 'Beri Centang Biru'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() => void handleToggleBlock(u)}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium disabled:opacity-50 cursor-pointer ${
                            u.blocked
                              ? 'border-emerald-500/35 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300'
                              : 'border-amber-500/35 bg-amber-50 text-amber-800 dark:bg-amber-950/35 dark:text-amber-300'
                          }`}
                        >
                          <ShieldAlert className="h-3 w-3" />
                          <span>{u.blocked ? 'Buka Blokir' : 'Blokir'}</span>
                        </button>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleDeleteUser(u)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#E51D2B] px-2.5 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-50 cursor-pointer"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteUid(null)}
                              className="inline-flex h-8 items-center rounded-lg border border-zinc-300 dark:border-zinc-700 px-2 text-[11px] text-zinc-600 dark:text-zinc-300 cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy || isSelf}
                            onClick={() => setConfirmDeleteUid(u.uid)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-500/30 bg-white dark:bg-[#14192B] px-2.5 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Hapus Akun</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="rounded-xl border border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/25 px-3 py-2 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            <strong>Pengingat Pribadi (Khusus Admin):</strong> Semua pengingat di sini hanya
            aktif saat Admin login (dengan bahasa santai lu/gua) dan tersinkron otomatis ke seluruh
            Admin. Pengingat Toko (2 cabang &amp; cat oplos) tetap aktif untuk semua pengguna.
          </p>

          <form
            onSubmit={(e) => void handleAddMemory(e)}
            className="rounded-2xl border border-zinc-200 dark:border-[#242C44] bg-zinc-50/80 dark:bg-[#0B0F1A] p-3 space-y-2"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={120}
              placeholder="Judul singkat (misal: Jadwal Meeting / Info Keluarga)"
              className="h-9 w-full rounded-xl border border-zinc-200 dark:border-[#2A3350] bg-white dark:bg-[#111626] px-3 text-xs text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Tulis hal yang ingin selalu diingat AI untuk semua Admin..."
              className="w-full rounded-xl border border-zinc-200 dark:border-[#2A3350] bg-white dark:bg-[#111626] px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={savingMemory || !newContent.trim()}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-3 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{savingMemory ? 'Menyimpan...' : 'Tambah Pengingat Pribadi'}</span>
            </button>
          </form>

          <div className={`space-y-2 overflow-y-auto ${compact ? 'max-h-[34dvh]' : 'max-h-[40dvh]'}`}>
            {memories.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 dark:border-[#242C44] p-4 text-center text-xs text-zinc-500">
                Belum ada pengingat pribadi tersimpan.
              </p>
            ) : (
              memories.map((mem) => {
                const isBusy = busyMemoryId === mem.id;
                const confirming = confirmDeleteMemId === mem.id;
                return (
                  <div
                    key={mem.id}
                    className="rounded-2xl border border-zinc-200/90 dark:border-[#242C44] bg-zinc-50/70 dark:bg-[#0B0F1A] p-3 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                          {mem.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {mem.content}
                        </p>
                        {mem.createdByEmail && (
                          <p className="mt-1 text-[10px] text-zinc-400">
                            Ditambahkan oleh {mem.createdByEmail}
                          </p>
                        )}
                      </div>

                      {confirming ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeleteMemory(mem)}
                            className="h-7 rounded-lg bg-[#E51D2B] px-2 text-[11px] font-semibold text-white hover:bg-red-600 cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmDeleteMemId(null)}
                            className="h-7 rounded-lg border border-zinc-300 dark:border-zinc-700 px-2 text-[11px] text-zinc-600 dark:text-zinc-300 cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteMemId(mem.id)}
                          title="Hapus pengingat pribadi"
                          aria-label={`Hapus pengingat ${mem.title}`}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
