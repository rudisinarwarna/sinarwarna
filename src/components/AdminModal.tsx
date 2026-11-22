import React from 'react';
import type { User } from 'firebase/auth';
import { ShieldCheck, X } from 'lucide-react';
import type { AdminLevel } from '../services/adminService';
import { AdminPanel } from './AdminPanel';

interface AdminModalProps {
  isOpen: boolean;
  currentUser: User | null;
  adminLevel: AdminLevel;
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  currentUser,
  adminLevel,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Panel Administrator Sinar Warna"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-xl overflow-hidden rounded-t-3xl sm:rounded-3xl border border-blue-500/20 dark:border-[#242C44] bg-white dark:bg-[#111626] text-zinc-900 dark:text-[#E3E3E3] shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-[#E51D2B] to-[#0A36FF]" />

        <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-[#242C44] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#E51D2B]/15 to-[#0A36FF]/20 text-[#0A36FF] dark:text-blue-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-white">
                Administrator Sinar Warna
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {adminLevel === 'admin'
                  ? 'Kelola akun pengguna biasa & pengingat admin AI'
                  : 'Kelola akun pengguna, level admin, & pengingat admin AI'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel administrator"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[82dvh] overflow-y-auto p-5">
          <AdminPanel currentUser={currentUser} adminLevel={adminLevel} />
        </div>
      </div>
    </div>
  );
};
