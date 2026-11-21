import React from 'react';

const CONFETTI_PIECES = [
  { left: '6%', top: '8%', delay: '0s', duration: '5.4s', color: '#F59E0B', w: 8, h: 16 },
  { left: '14%', top: '18%', delay: '1.1s', duration: '6.1s', color: '#E51D2B', w: 7, h: 14 },
  { left: '22%', top: '6%', delay: '2.3s', duration: '5.8s', color: '#FBBF24', w: 9, h: 9 },
  { left: '34%', top: '11%', delay: '0.7s', duration: '6.4s', color: '#0A36FF', w: 7, h: 15 },
  { left: '49%', top: '5%', delay: '1.8s', duration: '5.5s', color: '#FDE047', w: 8, h: 14 },
  { left: '64%', top: '9%', delay: '0.4s', duration: '6.2s', color: '#FB7185', w: 8, h: 10 },
  { left: '76%', top: '14%', delay: '2.6s', duration: '5.7s', color: '#F59E0B', w: 7, h: 15 },
  { left: '86%', top: '7%', delay: '1.4s', duration: '6.0s', color: '#3B82F6', w: 8, h: 14 },
  { left: '92%', top: '20%', delay: '0.9s', duration: '5.3s', color: '#FBBF24', w: 9, h: 9 },
  { left: '9%', top: '54%', delay: '1.9s', duration: '6.5s', color: '#FBBF24', w: 7, h: 14 },
  { left: '19%', top: '72%', delay: '0.3s', duration: '5.9s', color: '#FB7185', w: 8, h: 14 },
  { left: '80%', top: '68%', delay: '2.1s', duration: '5.6s', color: '#E51D2B', w: 7, h: 15 },
  { left: '90%', top: '52%', delay: '1.2s', duration: '6.3s', color: '#FDE047', w: 8, h: 12 },
];

const SPARKLE_STARS = [
  { left: '10%', top: '16%', size: 18, delay: '0s', tone: 'text-amber-400' },
  { left: '88%', top: '14%', size: 20, delay: '0.6s', tone: 'text-amber-300' },
  { left: '18%', top: '42%', size: 14, delay: '1.1s', tone: 'text-rose-400' },
  { left: '82%', top: '40%', size: 15, delay: '0.4s', tone: 'text-amber-400' },
  { left: '12%', top: '78%', size: 18, delay: '0.9s', tone: 'text-blue-400' },
  { left: '87%', top: '76%', size: 18, delay: '1.4s', tone: 'text-amber-400' },
  { left: '28%', top: '84%', size: 13, delay: '0.3s', tone: 'text-amber-300' },
  { left: '72%', top: '84%', size: 13, delay: '1.2s', tone: 'text-rose-400' },
];

const FourPointStar: React.FC<{ size: number; className?: string }> = ({ size, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 1.5L14.3 9.7L22.5 12L14.3 14.3L12 22.5L9.7 14.3L1.5 12L9.7 9.7L12 1.5Z" />
  </svg>
);

/**
 * Dekorasi sementara layar selamat datang edisi Anniversary & Ulang Tahun ke-25 Ko Awen.
 * Hapus komponen ini beserta pemanggilannya di WelcomeCanvas.tsx bila masa perayaan selesai.
 */
export const KoAwenAnniversaryBackdrop: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {/* Warm celebratory gold + Sinar Warna ambient glow */}
      <div className="absolute left-1/2 top-8 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400/20 via-rose-500/15 to-blue-500/20 blur-3xl dark:from-amber-400/20 dark:via-rose-500/20 dark:to-blue-500/25" />
      <div className="absolute bottom-6 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#E51D2B]/15 via-amber-400/22 to-[#0A36FF]/15 blur-3xl dark:from-[#E51D2B]/22 dark:via-amber-400/25 dark:to-[#0A36FF]/22" />

      {/* Festive corner celebration bunting & golden silk ribbons */}
      <svg
        viewBox="0 0 420 140"
        fill="none"
        className="absolute left-0 top-0 h-24 w-64 sm:h-32 sm:w-96 opacity-80 dark:opacity-90"
      >
        <defs>
          <linearGradient id="annivRibbonL" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#E51D2B" />
          </linearGradient>
        </defs>
        <path
          d="M-10,10 Q95,95 215,32 T410,12"
          stroke="url(#annivRibbonL)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="6 6"
          opacity="0.7"
        />
        <path
          d="M-10,44 Q115,120 265,48"
          stroke="url(#annivRibbonL)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.45"
        />
        {/* Celebratory pennants */}
        <polygon points="36,39 54,48 40,66" fill="#F59E0B" opacity="0.82" />
        <polygon points="84,54 104,58 92,78" fill="#E51D2B" opacity="0.78" />
        <polygon points="136,53 156,51 148,72" fill="#FBBF24" opacity="0.85" />
        <polygon points="188,41 208,35 202,57" fill="#0A36FF" opacity="0.72" />
      </svg>

      <svg
        viewBox="0 0 420 140"
        fill="none"
        className="absolute right-0 top-0 h-24 w-64 sm:h-32 sm:w-96 -scale-x-100 opacity-80 dark:opacity-90"
      >
        <defs>
          <linearGradient id="annivRibbonR" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#0A36FF" />
          </linearGradient>
        </defs>
        <path
          d="M-10,10 Q95,95 215,32 T410,12"
          stroke="url(#annivRibbonR)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="6 6"
          opacity="0.7"
        />
        <path
          d="M-10,44 Q115,120 265,48"
          stroke="url(#annivRibbonR)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.45"
        />
        <polygon points="36,39 54,48 40,66" fill="#F59E0B" opacity="0.82" />
        <polygon points="84,54 104,58 92,78" fill="#0A36FF" opacity="0.72" />
        <polygon points="136,53 156,51 148,72" fill="#FBBF24" opacity="0.85" />
        <polygon points="188,41 208,35 202,57" fill="#E51D2B" opacity="0.78" />
      </svg>

      {/* Drifting festive confetti */}
      {CONFETTI_PIECES.map((piece, idx) => (
        <span
          key={idx}
          style={{
            left: piece.left,
            top: piece.top,
            width: `${piece.w}px`,
            height: `${piece.h}px`,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
          }}
          className="animate-anniversary-confetti absolute rounded-sm opacity-75 shadow-sm"
        />
      ))}

      {/* Twinkling jubilee stars */}
      {SPARKLE_STARS.map((star, idx) => (
        <span
          key={idx}
          style={{
            left: star.left,
            top: star.top,
            animationDelay: star.delay,
          }}
          className={`animate-anniversary-twinkle absolute ${star.tone}`}
        >
          <FourPointStar size={star.size} />
        </span>
      ))}
    </div>
  );
};

export const KoAwenAnniversaryHeader: React.FC = () => {
  return (
    <div className="relative z-10 mb-5 sm:mb-7 flex flex-col items-center text-center">
      {/* Ornate anniversary top flourish */}
      <div className="mb-2 flex items-center justify-center gap-3 text-amber-500 dark:text-amber-300">
        <span className="h-[1px] w-10 sm:w-16 bg-gradient-to-r from-transparent to-amber-500/80 dark:to-amber-300/80" />
        <FourPointStar size={14} className="animate-anniversary-twinkle" />
        <span className="font-anniversary-script text-2xl sm:text-3xl tracking-wide text-amber-600 dark:text-amber-200 drop-shadow-sm">
          Silver Celebration
        </span>
        <FourPointStar size={14} className="animate-anniversary-twinkle" />
        <span className="h-[1px] w-10 sm:w-16 bg-gradient-to-l from-transparent to-amber-500/80 dark:to-amber-300/80" />
      </div>

      {/* Main festive Anniversary & Birthday title above the floating logo */}
      <h2 className="font-anniversary max-w-3xl text-balance text-[clamp(1.35rem,3.6vw,2.55rem)] font-black leading-[1.15] tracking-wider bg-gradient-to-r from-[#B45309] via-[#E51D2B] to-[#0A36FF] bg-clip-text text-transparent dark:from-[#FEF08A] dark:via-[#F59E0B] dark:to-[#FB7185] drop-shadow-[0_2px_12px_rgba(245,158,11,0.28)]">
        HAPPY ANNIVERSARY &amp; HAPPY BDAY
        <span className="mt-1 block text-[clamp(1.75rem,4.6vw,3.15rem)] tracking-[0.12em] bg-gradient-to-r from-[#D97706] via-[#F59E0B] to-[#E11D48] bg-clip-text text-transparent dark:from-[#FFFBEB] dark:via-[#FDE047] dark:to-[#F59E0B]">
          KO AWEN
        </span>
      </h2>
    </div>
  );
};

export const KoAwenAnniversaryNumber25: React.FC = () => {
  return (
    <div className="relative z-10 mt-6 sm:mt-8 flex flex-col items-center justify-center">
      <div className="animate-anniversary-badge relative flex items-center justify-center">
        {/* Soft radiant jubilee halo behind 25 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 rounded-full bg-gradient-to-r from-amber-400/30 via-rose-500/20 to-amber-300/35 blur-2xl dark:from-amber-400/35 dark:via-rose-500/25 dark:to-blue-500/25"
        />

        {/* Left celebratory laurel / ribbon accent */}
        <svg
          width="48"
          height="78"
          viewBox="0 0 48 78"
          fill="none"
          aria-hidden="true"
          className="mr-1 sm:mr-2.5 text-amber-500 dark:text-amber-300 opacity-90"
        >
          <path
            d="M36 70C18 56 12 36 22 10"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <ellipse cx="18" cy="56" rx="7" ry="3.5" transform="rotate(-30 18 56)" fill="currentColor" opacity="0.8" />
          <ellipse cx="12" cy="42" rx="7.5" ry="3.5" transform="rotate(-12 12 42)" fill="currentColor" opacity="0.88" />
          <ellipse cx="13" cy="27" rx="7" ry="3.5" transform="rotate(14 13 27)" fill="currentColor" opacity="0.88" />
          <ellipse cx="20" cy="14" rx="6.5" ry="3" transform="rotate(35 20 14)" fill="currentColor" opacity="0.85" />
        </svg>

        {/* Giant festive 25 */}
        <div className="relative flex items-start">
          <span className="font-anniversary text-[5.25rem] sm:text-[7.25rem] font-black leading-none tracking-tight bg-gradient-to-b from-[#F59E0B] via-[#E51D2B] to-[#9A3412] bg-clip-text text-transparent dark:from-[#FFFBEB] dark:via-[#FDE047] dark:to-[#D97706] drop-shadow-[0_6px_22px_rgba(245,158,11,0.45)] select-none">
            25
          </span>
          <FourPointStar
            size={20}
            className="animate-anniversary-twinkle -ml-1 mt-1 text-amber-400 dark:text-amber-200"
          />
        </div>

        {/* Right celebratory laurel / ribbon accent */}
        <svg
          width="48"
          height="78"
          viewBox="0 0 48 78"
          fill="none"
          aria-hidden="true"
          className="ml-1 sm:ml-2.5 -scale-x-100 text-amber-500 dark:text-amber-300 opacity-90"
        >
          <path
            d="M36 70C18 56 12 36 22 10"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <ellipse cx="18" cy="56" rx="7" ry="3.5" transform="rotate(-30 18 56)" fill="currentColor" opacity="0.8" />
          <ellipse cx="12" cy="42" rx="7.5" ry="3.5" transform="rotate(-12 12 42)" fill="currentColor" opacity="0.88" />
          <ellipse cx="13" cy="27" rx="7" ry="3.5" transform="rotate(14 13 27)" fill="currentColor" opacity="0.88" />
          <ellipse cx="20" cy="14" rx="6.5" ry="3" transform="rotate(35 20 14)" fill="currentColor" opacity="0.85" />
        </svg>
      </div>
    </div>
  );
};
