import React, { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  BadgeCheck,
  Ban,
  BookOpen,
  CheckCircle2,
  Crown,
  Globe,
  Mic,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldOff,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import {
  addAdminMemory,
  addPublicMemory,
  canManageUserRecord,
  deleteAdminMemory,
  deletePublicMemory,
  deleteUserAccount,
  saveLiveOpeningGreeting,
  seedDefaultAdminMemoriesOnce,
  setFreewillMode,
  setUserBlocked,
  setUserRoleLevel,
  setUserVerifiedBadge,
  subscribeAdminMemories,
  subscribeAllUsers,
  subscribeFreewillConfig,
  subscribeLiveOpeningGreeting,
  subscribePublicMemories,
  type AdminLevel,
  type AdminMemoryDoc,
  type ManagedUserRecord,
  type PublicMemoryDoc,
  type UserRole,
} from '../services/adminService';
import { VerifiedBlueBadge } from './VerifiedBlueBadge';

interface AdminPanelProps {
  currentUser: User | null;
  adminLevel?: AdminLevel;
  compact?: boolean;
}

function getLevelLabel(level: AdminLevel): string {
  if (level === 'primary') return 'Admin Utama';
  if (level === 'admin_plus') return 'Admin+';
  if (level === 'admin') return 'Admin';
  return 'User';
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  adminLevel = 'admin',
  compact = false,
}) => {
  const canAccessMemories = adminLevel === 'primary' || adminLevel === 'admin_plus';

  const [subTab, setSubTab] = useState<'users' | 'publicMemories' | 'liveGreeting' | 'memories'>('users');
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [memories, setMemories] = useState<AdminMemoryDoc[]>([]);
  const [publicMemories, setPublicMemories] = useState<PublicMemoryDoc[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [busyMemoryId, setBusyMemoryId] = useState<string | null>(null);
  const [confirmDeleteMemId, setConfirmDeleteMemId] = useState<string | null>(null);
  const [busyPublicMemId, setBusyPublicMemId] = useState<string | null>(null);
  const [confirmDeletePublicMemId, setConfirmDeletePublicMemId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [savingMemory, setSavingMemory] = useState(false);

  const [newPublicTitle, setNewPublicTitle] = useState('');
  const [newPublicContent, setNewPublicContent] = useState('');
  const [savingPublicMemory, setSavingPublicMemory] = useState(false);

  const [savedLiveGreeting, setSavedLiveGreeting] = useState('');
  const [liveGreetingInput, setLiveGreetingInput] = useState('');
  const [savingLiveGreeting, setSavingLiveGreeting] = useState(false);

  const [freewillEnabled, setFreewillEnabled] = useState(false);
  const [togglingFreewill, setTogglingFreewill] = useState(false);
  const [confirmFreewillOn, setConfirmFreewillOn] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!canAccessMemories && (subTab === 'liveGreeting' || subTab === 'memories')) {
      setSubTab('users');
    }
  }, [canAccessMemories, subTab]);

  useEffect(() => {
    if (!currentUser) return;

    const unsubUsers = subscribeAllUsers(
      (list) => setUsers(list),
      (err) => setFeedback({ type: 'err', text: err.message })
    );

    const unsubPublicMemories = subscribePublicMemories(
      (list) => setPublicMemories(list),
      (err) => setFeedback({ type: 'err', text: err.message })
    );

    let unsubFreewill: (() => void) | undefined;
    if (adminLevel === 'primary') {
      unsubFreewill = subscribeFreewillConfig(
        (enabled) => {
          setFreewillEnabled(enabled);
          if (enabled) setConfirmFreewillOn(false);
        },
        (err) => setFeedback({ type: 'err', text: err.message })
      );
    } else {
      setFreewillEnabled(false);
      setConfirmFreewillOn(false);
    }

    let unsubMemories: (() => void) | undefined;
    let unsubLiveGreeting: (() => void) | undefined;
    if (canAccessMemories) {
      void seedDefaultAdminMemoriesOnce(currentUser).catch((err) => {
        console.error('Seed admin memories skipped/error:', err);
      });
      unsubMemories = subscribeAdminMemories(
        (list) => setMemories(list),
        (err) => setFeedback({ type: 'err', text: err.message })
      );
      unsubLiveGreeting = subscribeLiveOpeningGreeting(
        (text) => {
          setSavedLiveGreeting(text);
          setLiveGreetingInput(text);
        },
        (err) => setFeedback({ type: 'err', text: err.message })
      );
    } else {
      setMemories([]);
      setSavedLiveGreeting('');
      setLiveGreetingInput('');
    }

    return () => {
      unsubUsers();
      unsubPublicMemories();
      unsubFreewill?.();
      unsubMemories?.();
      unsubLiveGreeting?.();
    };
  }, [adminLevel, canAccessMemories, currentUser]);

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

  const handleSetRole = async (target: ManagedUserRecord, nextRole: UserRole) => {
    if (!currentUser || busyUid) return;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      await setUserRoleLevel(currentUser, adminLevel, target, nextRole);
      const roleName =
        nextRole === 'admin_plus' ? 'Admin+' : nextRole === 'admin' ? 'Admin' : 'User';
      setFeedback({
        type: 'ok',
        text:
          nextRole === 'user'
            ? `${target.displayName} diubah menjadi User biasa.`
            : `${target.displayName} sekarang menjadi ${roleName} (otomatis centang biru verified).`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah level pengguna.',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleVerifiedBadge = async (target: ManagedUserRecord) => {
    if (!currentUser || busyUid) return;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      const nextVerified = !target.verifiedBadge;
      await setUserVerifiedBadge(adminLevel, currentUser.uid, target, nextVerified);
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
    if (!currentUser || busyUid) return;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      const nextBlocked = !target.blocked;
      await setUserBlocked(adminLevel, currentUser.uid, target, nextBlocked);
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
    if (!currentUser || busyUid) return;
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      await deleteUserAccount(adminLevel, currentUser.uid, target);
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

  const handleToggleFreewill = async (nextEnabled: boolean) => {
    if (!currentUser || adminLevel !== 'primary' || togglingFreewill) return;
    setTogglingFreewill(true);
    setConfirmFreewillOn(false);
    setFeedback(null);
    try {
      await setFreewillMode({
        primaryAdminUser: currentUser,
        enabled: nextEnabled,
        memories,
      });
      setFreewillEnabled(nextEnabled);
      setFeedback({
        type: 'ok',
        text: nextEnabled
          ? 'FREEWILL AKTIF: Semua pengguna terdaftar & tamu belum daftar mendapat efek Admin (bahasa semi-gaul & pengingat AI), sementara tamu tetap tidak melihat panel Admin.'
          : 'FREEWILL NONAKTIF: Hak akses kembali ke level akun masing-masing.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mengubah mode FREEWILL.',
      });
    } finally {
      setTogglingFreewill(false);
    }
  };

  const handlePressFreewillButton = () => {
    if (!currentUser || adminLevel !== 'primary' || togglingFreewill) return;
    if (!freewillEnabled) {
      setConfirmFreewillOn(true);
      return;
    }
    void handleToggleFreewill(false);
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !canAccessMemories || savingMemory) return;
    if (!newContent.trim()) {
      setFeedback({ type: 'err', text: 'Isi pengingat tidak boleh kosong.' });
      return;
    }
    setSavingMemory(true);
    setFeedback(null);
    const memTitle = newTitle.trim() || 'Pengingat Pribadi';
    const memContent = newContent.trim();
    try {
      await addAdminMemory({
        adminUser: currentUser,
        title: memTitle,
        content: memContent,
      });
      if (adminLevel === 'primary' && freewillEnabled) {
        await setFreewillMode({
          primaryAdminUser: currentUser,
          enabled: true,
          memories: [{ title: memTitle, content: memContent }, ...memories],
        }).catch(() => {});
      }
      setNewTitle('');
      setNewContent('');
      setFeedback({
        type: 'ok',
        text: 'Pengingat pribadi disimpan dan disinkronkan ke Admin+ & Admin Utama.',
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
    if (!canAccessMemories || busyMemoryId) return;
    setBusyMemoryId(mem.id);
    setFeedback(null);
    try {
      await deleteAdminMemory(mem.id);
      if (currentUser && adminLevel === 'primary' && freewillEnabled) {
        await setFreewillMode({
          primaryAdminUser: currentUser,
          enabled: true,
          memories: memories.filter((m) => m.id !== mem.id),
        }).catch(() => {});
      }
      setConfirmDeleteMemId(null);
      setFeedback({
        type: 'ok',
        text: `Pengingat "${mem.title}" telah dihapus.`,
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

  const handleAddPublicMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || savingPublicMemory) return;
    if (!newPublicContent.trim()) {
      setFeedback({ type: 'err', text: 'Isi pengingat umum tidak boleh kosong.' });
      return;
    }
    setSavingPublicMemory(true);
    setFeedback(null);
    try {
      await addPublicMemory({
        adminUser: currentUser,
        title: newPublicTitle.trim() || 'Pengingat Umum',
        content: newPublicContent.trim(),
      });
      setNewPublicTitle('');
      setNewPublicContent('');
      setFeedback({
        type: 'ok',
        text: 'Pengingat umum disimpan dan langsung diketahui AI untuk semua pengguna.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan pengingat umum.',
      });
    } finally {
      setSavingPublicMemory(false);
    }
  };

  const handleDeletePublicMemory = async (mem: PublicMemoryDoc) => {
    if (busyPublicMemId) return;
    setBusyPublicMemId(mem.id);
    setFeedback(null);
    try {
      await deletePublicMemory(mem.id);
      setConfirmDeletePublicMemId(null);
      setFeedback({
        type: 'ok',
        text: `Pengingat umum "${mem.title}" telah dihapus.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menghapus pengingat umum.',
      });
    } finally {
      setBusyPublicMemId(null);
    }
  };

  const handleSaveLiveGreeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !canAccessMemories || savingLiveGreeting) return;
    setSavingLiveGreeting(true);
    setFeedback(null);
    const nextText = liveGreetingInput.trim().slice(0, 500);
    try {
      await saveLiveOpeningGreeting(currentUser, nextText);
      setFeedback({
        type: 'ok',
        text: nextText
          ? 'Kata pembuka AI Live disimpan. Saat AI Live dinyalakan, AI akan langsung mengucapkan kalimat ini.'
          : 'Kata pembuka AI Live dikembalikan ke sapaan bawaan.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan kata pembuka AI Live.',
      });
    } finally {
      setSavingLiveGreeting(false);
    }
  };

  const handleResetLiveGreeting = async () => {
    if (!currentUser || !canAccessMemories || savingLiveGreeting) return;
    setSavingLiveGreeting(true);
    setFeedback(null);
    try {
      await saveLiveOpeningGreeting(currentUser, '');
      setLiveGreetingInput('');
      setFeedback({
        type: 'ok',
        text: 'Kata pembuka AI Live dikembalikan ke sapaan bawaan.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal mereset kata pembuka AI Live.',
      });
    } finally {
      setSavingLiveGreeting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Level Status Banner */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/25 px-3 py-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-2 py-0.5 text-[10px] font-bold text-white shrink-0">
            {getLevelLabel(adminLevel)}
          </span>
          <VerifiedBlueBadge size="xs" title="Admin Terverifikasi" />
          <span className="truncate text-zinc-600 dark:text-zinc-300">
            {adminLevel === 'primary' &&
              'Akses penuh: FREEWILL, semua level admin, pengingat umum & pribadi.'}
            {adminLevel === 'admin_plus' &&
              'Kelola User, Admin biasa, pengingat umum, sapaan Live, & pengingat pribadi.'}
            {adminLevel === 'admin' &&
              'Kelola User biasa & Pengingat Umum (tidak bisa ubah sesama Admin).'}
          </span>
        </div>
      </div>

      {/* FREEWILL Control (Hanya Admin Utama) */}
      {adminLevel === 'primary' && (
        <div
          className={`space-y-2.5 rounded-2xl border p-3 transition-colors ${
            freewillEnabled
              ? 'border-amber-500/50 bg-gradient-to-r from-amber-50/90 via-red-50/60 to-blue-50/70 dark:border-amber-500/40 dark:from-amber-950/35 dark:via-red-950/25 dark:to-blue-950/30'
              : 'border-zinc-200 dark:border-[#242C44] bg-zinc-50/80 dark:bg-[#0B0F1A]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2">
                <Zap
                  className={`h-4 w-4 shrink-0 ${
                    freewillEnabled
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                />
                <span className="text-xs font-bold tracking-wide text-zinc-900 dark:text-white">
                  FREEWILL
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    freewillEnabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-zinc-200/80 text-zinc-600 dark:bg-white/10 dark:text-zinc-400'
                  }`}
                >
                  {freewillEnabled ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Menjadikan semua user terdaftar &amp; tamu (yang belum daftar) mendapat efek sekelas Admin di AI (bahasa semi-gaul &amp; semua pengingat). Untuk yang belum daftar, menu Admin tetap tersembunyi.
              </p>
            </div>
            <button
              type="button"
              disabled={togglingFreewill}
              onClick={handlePressFreewillButton}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                freewillEnabled
                  ? 'bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] text-white shadow-sm hover:opacity-95'
                  : 'border border-zinc-300 dark:border-[#2E3858] bg-white dark:bg-[#14192B] text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-[#1C233B]'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{togglingFreewill ? 'Menyimpan...' : freewillEnabled ? 'FREEWILL: ON' : 'FREEWILL: OFF'}</span>
            </button>
          </div>

          {confirmFreewillOn && !freewillEnabled && (
            <div className="rounded-xl border border-amber-500/50 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-amber-950 dark:text-amber-100">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                  <p className="font-bold">Peringatan: Hidupkan Mode FREEWILL?</p>
                  <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                    Semua pengguna terdaftar dan tamu yang belum daftar akan langsung mendapatkan efek level Admin (akses pengingat pribadi &amp; gaya bahasa semi-gaul AI). Lanjutkan mengaktifkan FREEWILL?
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={togglingFreewill}
                  onClick={() => setConfirmFreewillOn(false)}
                  className="inline-flex h-8 items-center rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#14192B] px-3 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1C233B] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={togglingFreewill}
                  onClick={() => void handleToggleFreewill(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-3 text-[11px] font-bold text-white hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="h-3 w-3" />
                  <span>{togglingFreewill ? 'Mengaktifkan...' : 'Ya, Hidupkan FREEWILL'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-navigation: Semua Admin bisa akses Pengguna & Pengingat Umum; Admin+ & Admin Utama tambah Sapaan Live & Pengingat Pribadi */}
      <div
        className={`grid gap-1.5 rounded-2xl bg-zinc-100 p-1.5 dark:bg-[#0B0F1A] ${
          canAccessMemories ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'
        }`}
      >
        <button
          type="button"
          onClick={() => setSubTab('users')}
          className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'users'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-[#1A2238] dark:text-white'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <Users className="h-3.5 w-3.5 text-[#0A36FF] dark:text-blue-400 shrink-0" />
          <span>Pengguna ({filteredUsers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('publicMemories')}
          className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            subTab === 'publicMemories'
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-[#1A2238] dark:text-white'
              : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Pengingat Umum ({publicMemories.length})</span>
        </button>

        {canAccessMemories && (
          <>
            <button
              type="button"
              onClick={() => setSubTab('liveGreeting')}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'liveGreeting'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-[#1A2238] dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <Mic className="h-3.5 w-3.5 text-[#0A36FF] dark:text-blue-400 shrink-0" />
              <span>Sapaan Live</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('memories')}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                subTab === 'memories'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-[#1A2238] dark:text-white'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 text-[#E51D2B] dark:text-[#FF4D5A] shrink-0" />
              <span>Pengingat Pribadi ({memories.length})</span>
            </button>
          </>
        )}
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
                const canManage = canManageUserRecord(adminLevel, currentUser?.uid || '', u);

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
                            {(u.verifiedBadge || u.role !== 'user' || u.isPrimaryAdmin) && (
                              <VerifiedBlueBadge
                                size="sm"
                                title={
                                  u.isPrimaryAdmin
                                    ? 'Admin Utama Terverifikasi'
                                    : u.role === 'admin_plus'
                                    ? 'Admin+ Terverifikasi'
                                    : u.role === 'admin'
                                    ? 'Admin Terverifikasi'
                                    : 'Pengguna Terverifikasi'
                                }
                              />
                            )}
                            {u.isPrimaryAdmin ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                <Crown className="h-2.5 w-2.5" />
                                Admin Utama
                              </span>
                            ) : u.role === 'admin_plus' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300">
                                <Sparkles className="h-2.5 w-2.5" />
                                Admin+
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
                        Akun Admin Utama permanen dengan centang biru verified (dilindungi dari perubahan, blokir, atau penghapusan).
                      </p>
                    ) : isSelf ? (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Akun Anda sendiri yang sedang login.
                      </p>
                    ) : !canManage ? (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {u.role === 'admin_plus'
                          ? 'Akun Admin+ hanya dapat diubah oleh Admin Utama.'
                          : 'Admin biasa tidak dapat mengubah sesama Admin. Hanya Admin+ atau Admin Utama yang dapat mengubah Admin.'}
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {u.role !== 'user' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSetRole(u, 'user')}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-[#2E3858] bg-white dark:bg-[#14192B] px-2.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1C233B] disabled:opacity-50 cursor-pointer"
                          >
                            <ShieldOff className="h-3 w-3" />
                            <span>Ubah ke User</span>
                          </button>
                        )}

                        {u.role !== 'admin' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSetRole(u, 'admin')}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-white dark:bg-[#14192B] px-2.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 disabled:opacity-50 cursor-pointer"
                          >
                            <UserCheck className="h-3 w-3" />
                            <span>Jadikan Admin</span>
                          </button>
                        )}

                        {adminLevel === 'primary' && u.role !== 'admin_plus' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSetRole(u, 'admin_plus')}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-500/35 bg-indigo-50/80 dark:bg-indigo-950/40 px-2.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 cursor-pointer"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>Jadikan Admin+</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isBusy || u.role !== 'user'}
                          title={
                            u.role !== 'user'
                              ? 'Semua Admin otomatis memiliki centang biru verified'
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
                          disabled={isBusy}
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
                            disabled={isBusy}
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
      ) : subTab === 'publicMemories' ? (
        <div className="space-y-3">
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-950/25 px-3 py-2 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            <strong>Pengingat Umum (Untuk Semua Pengguna):</strong> Semua informasi di sini akan
            diketahui dan diingat oleh AI saat melayani siapa saja (User biasa, tamu belum daftar,
            maupun semua Admin). Dapat dikelola oleh <strong>Admin ke atas</strong>.
          </p>

          <form
            onSubmit={(e) => void handleAddPublicMemory(e)}
            className="rounded-2xl border border-zinc-200 dark:border-[#242C44] bg-zinc-50/80 dark:bg-[#0B0F1A] p-3 space-y-2"
          >
            <input
              type="text"
              value={newPublicTitle}
              onChange={(e) => setNewPublicTitle(e.target.value)}
              maxLength={120}
              placeholder="Judul singkat (misal: Promo Bulan Ini / Jam Operasional)"
              className="h-9 w-full rounded-xl border border-zinc-200 dark:border-[#2A3350] bg-white dark:bg-[#111626] px-3 text-xs text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            />
            <textarea
              value={newPublicContent}
              onChange={(e) => setNewPublicContent(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Tulis info atau pengingat umum untuk semua pelanggan Sinar Warna..."
              className="w-full rounded-xl border border-zinc-200 dark:border-[#2A3350] bg-white dark:bg-[#111626] px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={savingPublicMemory || !newPublicContent.trim()}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#0A36FF] px-3 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{savingPublicMemory ? 'Menyimpan...' : 'Tambah Pengingat Umum'}</span>
            </button>
          </form>

          <div className={`space-y-2 overflow-y-auto ${compact ? 'max-h-[34dvh]' : 'max-h-[40dvh]'}`}>
            {publicMemories.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 dark:border-[#242C44] p-4 text-center text-xs text-zinc-500">
                Belum ada pengingat umum tambahan. Pengingat toko bawaan tetap aktif untuk semua pengguna.
              </p>
            ) : (
              publicMemories.map((mem) => {
                const isBusy = busyPublicMemId === mem.id;
                const confirming = confirmDeletePublicMemId === mem.id;
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
                      </div>

                      {confirming ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeletePublicMemory(mem)}
                            className="h-7 rounded-lg bg-[#E51D2B] px-2 text-[11px] font-semibold text-white hover:bg-red-600 cursor-pointer"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmDeletePublicMemId(null)}
                            className="h-7 rounded-lg border border-zinc-300 dark:border-zinc-700 px-2 text-[11px] text-zinc-600 dark:text-zinc-300 cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeletePublicMemId(mem.id)}
                          title="Hapus pengingat umum"
                          aria-label={`Hapus pengingat umum ${mem.title}`}
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
      ) : subTab === 'liveGreeting' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/25 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 space-y-1">
            <p>
              <strong>Kata Pembuka AI Live (Khusus Admin+ &amp; Admin Utama):</strong> Ketik kalimat
              pertama yang akan langsung diucapkan AI setiap kali mode <strong>AI Live</strong>{' '}
              dihidupkan.
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              Kosongkan lalu simpan jika ingin memakai sapaan bawaan.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-[#242C44] bg-white dark:bg-[#111626] px-3 py-2.5 text-xs space-y-1">
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              Status Sapaan Awal Saat Ini:
            </p>
            {savedLiveGreeting ? (
              <p className="font-medium text-zinc-900 dark:text-white">
                &ldquo;{savedLiveGreeting}&rdquo;
              </p>
            ) : (
              <p className="italic text-zinc-500 dark:text-zinc-400">
                Menggunakan sapaan bawaan (&ldquo;Hi apa kabar, ada yang mau di tanya seputar cat
                atau lainnya?&rdquo;)
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => void handleSaveLiveGreeting(e)}
            className="rounded-2xl border border-zinc-200 dark:border-[#242C44] bg-zinc-50/80 dark:bg-[#0B0F1A] p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <label
                htmlFor="live-greeting-textarea"
                className="text-xs font-semibold text-zinc-800 dark:text-zinc-200"
              >
                Teks Kata-Kata Awal AI Live
              </label>
              <span className="text-[10px] text-zinc-400">{liveGreetingInput.length}/500</span>
            </div>
            <textarea
              id="live-greeting-textarea"
              value={liveGreetingInput}
              onChange={(e) => setLiveGreetingInput(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder='Contoh: "Selamat datang di Toko Cat Sinar Warna! Lagi cari cat tembok, cat duco, atau warna oplos apa nih?"'
              className="w-full rounded-xl border border-zinc-200 dark:border-[#2A3350] bg-white dark:bg-[#111626] px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={savingLiveGreeting}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-3 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>
                  {savingLiveGreeting ? 'Menyimpan...' : 'Simpan Kata Pembuka Live'}
                </span>
              </button>
              {(savedLiveGreeting || liveGreetingInput.trim()) && (
                <button
                  type="button"
                  disabled={savingLiveGreeting}
                  onClick={() => void handleResetLiveGreeting()}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 dark:border-[#2E3858] bg-white dark:bg-[#14192B] px-3 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1C233B] disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Bawaan</span>
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="rounded-xl border border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/25 px-3 py-2 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            <strong>Pengingat Pribadi (Khusus Admin+ &amp; Admin Utama):</strong> Semua pengingat di
            sini aktif saat Admin+ atau Admin Utama login dan tersinkron otomatis. Admin biasa
            tidak dapat melihat bagian ini.
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
              placeholder="Tulis hal yang ingin selalu diingat AI..."
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
