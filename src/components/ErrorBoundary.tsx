import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { getTranslations } from '../i18n/translations';
import { getAppLanguage } from '../services/maintenanceManager';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const t = getTranslations(getAppLanguage());
    let readable = error.message || t.errors.boundaryFallback;
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed?.error) {
        readable = `${t.errors.boundaryDbPrefix} (${parsed.operationType || 'op'}): ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      const t = getTranslations(getAppLanguage());
      return (
        <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-[#131314] p-6 text-zinc-900 dark:text-[#E3E3E3]">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-[#2E2F33] bg-zinc-50 dark:bg-[#1E1F20] p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h1 className="font-display text-base font-semibold">
                {t.errors.boundaryTitle}
              </h1>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t.errors.boundaryReload}</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
