import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  Sun,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  formatAuthErrorIndonesia,
  resetPasswordWithEmail,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';

interface AuthScreenProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onClose?: () => void;
}

type AuthTab = 'login' | 'register';

export const AuthScreen: React.FC<AuthScreenProps> = ({ isDark, onToggleTheme, onClose }) => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState<'email' | 'google' | 'apple' | 'reset' | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const { t } = useLanguage();

  const isBusy = loadingMethod !== null;

  const handleTabChange = (nextTab: AuthTab) => {
    setTab(nextTab);
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage(t.auth.errEnterEmail);
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage(t.auth.errPasswordLength);
      return;
    }

    setLoadingMethod('email');
    try {
      if (tab === 'login') {
        await signInWithEmail(trimmedEmail, password);
      } else {
        await signUpWithEmail(trimmedEmail, password, displayName);
      }
    } catch (err) {
      const formatted = formatAuthErrorIndonesia(err);
      if (formatted) setErrorMessage(formatted);
    } finally {
      setLoadingMethod(null);
    }
  };

  const handlePasswordReset = async () => {
    if (isBusy) return;
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage(t.auth.errResetNeedEmail);
      return;
    }

    setLoadingMethod('reset');
    try {
      await resetPasswordWithEmail(trimmedEmail);
      setInfoMessage(t.auth.infoResetSent);
    } catch (err) {
      const formatted = formatAuthErrorIndonesia(err);
      if (formatted) setErrorMessage(formatted);
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isBusy) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setLoadingMethod('google');
    try {
      const res = await signInWithGoogle();
      if (!res) {
        setInfoMessage(t.auth.infoRedirectGoogle);
      }
    } catch (err) {
      const formatted = formatAuthErrorIndonesia(err);
      if (formatted) setErrorMessage(formatted);
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleAppleSignIn = async () => {
    if (isBusy) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setLoadingMethod('apple');
    try {
      const res = await signInWithApple();
      if (!res) {
        setInfoMessage(t.auth.infoRedirectApple);
      }
    } catch (err) {
      const formatted = formatAuthErrorIndonesia(err);
      if (formatted) setErrorMessage(formatted);
    } finally {
      setLoadingMethod(null);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
      className={`${
        onClose
          ? 'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 backdrop-blur-sm px-4 py-6 text-zinc-900 dark:text-[#E3E3E3]'
          : 'relative flex min-h-dvh w-full flex-col items-center justify-center overflow-y-auto bg-white dark:bg-[#0B0F1A] px-4 py-8 text-zinc-900 dark:text-[#E3E3E3]'
      }`}
      role={onClose ? 'dialog' : undefined}
      aria-modal={onClose ? 'true' : undefined}
      aria-label={t.auth.dialogAria}
    >
      {!onClose && (
        <>
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#E51D2B]/15 blur-[110px] dark:bg-[#E51D2B]/25" />
            <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#0A36FF]/15 blur-[120px] dark:bg-[#0A36FF]/30" />
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            title={isDark ? t.header.switchToLight : t.header.switchToDark}
            aria-label={isDark ? t.header.switchToLight : t.header.switchToDark}
            className="fixed right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/80 text-zinc-700 backdrop-blur-md hover:bg-zinc-100 dark:border-[#242C44] dark:bg-[#14192B]/80 dark:text-zinc-300 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </>
      )}

      <div className="relative z-10 w-full max-w-md space-y-5 my-auto">
        {!onClose && (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 animate-sinar-float">
              {!logoFailed ? (
                <img
                  src="/assets/sinar-warna-logo.png"
                  alt="Logo Sinar Warna"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="h-24 w-auto object-contain select-none drop-shadow-[0_6px_18px_rgba(10,54,255,0.28)]"
                />
              ) : (
                <span className="font-display text-4xl font-bold tracking-tight bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] bg-clip-text text-transparent">
                  SW
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-[1.75rem]">
              {t.auth.welcomeTitlePrefix}{' '}
              <span className="bg-gradient-to-r from-[#E51D2B] via-[#6366F1] to-[#0A36FF] bg-clip-text text-transparent dark:from-[#FF4D5A] dark:via-[#818CF8] dark:to-[#4F8BFF]">
                Sinar Warna
              </span>
            </h1>
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              {t.auth.welcomeSubtitle}
            </p>
          </div>
        )}

        {/* Auth Card */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-white/95 shadow-2xl shadow-blue-950/10 backdrop-blur-xl dark:border-[#242C44] dark:bg-[#111626]/95 dark:shadow-black/50">
          <div className="h-1 w-full bg-gradient-to-r from-[#E51D2B] to-[#0A36FF]" />

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title={t.auth.close}
              aria-label={t.auth.close}
              className="absolute right-3.5 top-3.5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className="p-5 sm:p-6 space-y-4">
            {onClose && (
              <div className="flex flex-col items-center text-center pt-1 pb-1">
                {!logoFailed ? (
                  <img
                    src="/assets/sinar-warna-logo.png"
                    alt="Logo Sinar Warna"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoFailed(true)}
                    className="mb-2.5 h-14 w-auto object-contain select-none drop-shadow-[0_4px_12px_rgba(10,54,255,0.28)]"
                  />
                ) : (
                  <span className="mb-2 font-display text-3xl font-bold tracking-tight bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] bg-clip-text text-transparent">
                    SW
                  </span>
                )}
                <h2 className="font-display text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                  {t.auth.modalTitlePrefix}{' '}
                  <span className="bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] bg-clip-text text-transparent dark:from-[#FF4D5A] dark:to-[#4F8BFF]">
                    Sinar Warna
                  </span>
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {t.auth.modalSubtitle}
                </p>
              </div>
            )}
            {/* Tab Switch: Masuk / Daftar */}
            <div
              role="tablist"
              aria-label={t.auth.dialogAria}
              className="grid grid-cols-2 rounded-2xl bg-zinc-100 p-1 dark:bg-[#0B0F1A]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'login'}
                onClick={() => handleTabChange('login')}
                className={`min-h-[40px] rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'login'
                    ? 'bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {t.auth.tabLogin}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'register'}
                onClick={() => handleTabChange('register')}
                className={`min-h-[40px] rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'register'
                    ? 'bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {t.auth.tabRegister}
              </button>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#E51D2B] dark:text-red-400" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {infoMessage && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="leading-relaxed">{infoMessage}</span>
              </div>
            )}

            {/* Email & Password Form */}
            <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3.5">
              {tab === 'register' && (
                <div className="space-y-1">
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {t.auth.fullNameLabel}
                  </label>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t.auth.fullNamePlaceholder}
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 pl-10 pr-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#0A36FF] focus:bg-white focus:outline-none dark:border-[#293456] dark:bg-[#0B0F1A] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  {t.auth.emailLabel}
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.auth.emailPlaceholder}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 pl-10 pr-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#0A36FF] focus:bg-white focus:outline-none dark:border-[#293456] dark:bg-[#0B0F1A] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {t.auth.passwordLabel}
                  </label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handlePasswordReset()}
                      className="text-[11px] font-medium text-[#0A36FF] hover:underline dark:text-blue-400 cursor-pointer"
                    >
                      {t.auth.forgotPassword}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.auth.passwordPlaceholder}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 pl-10 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-[#0A36FF] focus:bg-white focus:outline-none dark:border-[#293456] dark:bg-[#0B0F1A] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                    className="absolute right-2 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:opacity-95 disabled:opacity-60 transition-opacity cursor-pointer"
              >
                {loadingMethod === 'email'
                  ? tab === 'login'
                    ? t.auth.processingLogin
                    : t.auth.processingRegister
                  : tab === 'login'
                  ? t.auth.loginWithEmail
                  : t.auth.registerAccount}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-zinc-200 dark:border-[#242C44]" />
              <span className="mx-3 shrink-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {t.auth.orContinueWith}
              </span>
              <div className="flex-grow border-t border-zinc-200 dark:border-[#242C44]" />
            </div>

            {/* Social Providers: Google & Apple */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleGoogleSignIn()}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-800 hover:border-blue-500/50 hover:bg-blue-50/40 dark:border-[#293456] dark:bg-[#171E33] dark:text-zinc-100 dark:hover:bg-[#1E2742] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
                  />
                  <path
                    fill="#34A853"
                    d="M3.6 7.3l3.2 2.3C7.7 7.7 9.7 6.5 12 6.5c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 8.3 2.5 5.1 4.6 3.6 7.3z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12 21.5c2.6 0 4.8-.9 6.4-2.4l-3-2.5c-.8.6-1.9 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2l-3.2 2.5C4.7 19.2 8.1 21.5 12 21.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M21.1 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.4-1.1 2.5-2.1 3.1l3 2.5c1.8-1.6 2.8-4.1 2.8-7.9z"
                  />
                </svg>
                <span>{loadingMethod === 'google' ? t.auth.connecting : 'Google'}</span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleAppleSignIn()}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-900 px-3.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:border-[#293456] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
                </svg>
                <span>{loadingMethod === 'apple' ? t.auth.connecting : 'Apple'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
