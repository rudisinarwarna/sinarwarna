import React, { useState } from 'react';
import {
  KoAwenAnniversaryBackdrop,
  KoAwenAnniversaryHeader,
  KoAwenAnniversaryNumber25,
} from './KoAwenAnniversaryDecor';

export const WelcomeCanvas: React.FC = () => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="relative flex min-h-full w-full flex-col items-center justify-center overflow-hidden px-5 py-7 text-center sm:py-10">
      <KoAwenAnniversaryBackdrop />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center">
        {/* Festive celebratory banner above the floating Sinar Warna logo */}
        <KoAwenAnniversaryHeader />

        {/* Single large background-less Sinar Warna logo with celebratory gold + red-blue aura */}
        <div className="relative mb-5 flex items-center justify-center sm:mb-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-7 rounded-full bg-gradient-to-tr from-[#E51D2B]/30 via-amber-400/25 to-[#0A36FF]/35 blur-2xl dark:from-[#E51D2B]/40 dark:via-amber-400/30 dark:to-[#0A36FF]/45"
          />
          <div className="relative animate-sinar-float">
            {!imgFailed ? (
              <img
                src="/assets/sinar-warna-logo.png"
                alt="Logo Sinar Warna"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-24 w-auto sm:h-32 object-contain select-none drop-shadow-[0_6px_22px_rgba(10,54,255,0.28)]"
              />
            ) : (
              <span className="font-display text-5xl font-bold tracking-tight bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] bg-clip-text text-transparent">
                SW
              </span>
            )}
          </div>
        </div>

        {/* Minimal, elegant Gemini-style greeting */}
        <div className="space-y-2">
          <h1 className="font-display text-[clamp(1.45rem,3.8vw,2.35rem)] font-semibold leading-[1.2] tracking-tight text-zinc-900 dark:text-white [text-wrap:balance]">
            Hai, selamat datang di{' '}
            <span className="bg-gradient-to-r from-[#E51D2B] via-[#6366F1] to-[#0A36FF] bg-clip-text text-transparent dark:from-[#FF4D5A] dark:via-[#818CF8] dark:to-[#4F8BFF]">
              Sinar Warna
            </span>
            ..
          </h1>

          <p className="text-sm sm:text-base font-medium text-zinc-600 dark:text-zinc-300">
            Ada yang mau di tanya seputar cat atau lainnya?
          </p>
        </div>

        {/* Big festive 25 in the empty space below */}
        <KoAwenAnniversaryNumber25 />
      </div>
    </div>
  );
};
