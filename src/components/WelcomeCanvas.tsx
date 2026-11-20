import React, { useState } from 'react';

export const WelcomeCanvas: React.FC = () => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-5 py-8 text-center sm:py-14">
      {/* Single large background-less Sinar Warna logo with soft red-blue ambient aura */}
      <div className="relative mb-6 flex items-center justify-center sm:mb-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 rounded-full bg-gradient-to-tr from-[#E51D2B]/25 via-transparent to-[#0A36FF]/30 blur-2xl dark:from-[#E51D2B]/35 dark:to-[#0A36FF]/40"
        />
        <div className="relative animate-sinar-float">
          {!imgFailed ? (
            <img
              src="/assets/sinar-warna-logo.png"
              alt="Logo Sinar Warna"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-28 w-auto sm:h-36 object-contain select-none drop-shadow-[0_6px_22px_rgba(10,54,255,0.28)]"
            />
          ) : (
            <span className="font-display text-5xl font-bold tracking-tight bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] bg-clip-text text-transparent">
              SW
            </span>
          )}
        </div>
      </div>

      {/* Minimal, elegant Gemini-style greeting */}
      <div className="space-y-2.5">
        <h1 className="font-display text-[clamp(1.6rem,4.5vw,2.6rem)] font-semibold leading-[1.2] tracking-tight text-zinc-900 dark:text-white [text-wrap:balance]">
          Hai, selamat datang di{' '}
          <span className="bg-gradient-to-r from-[#E51D2B] via-[#6366F1] to-[#0A36FF] bg-clip-text text-transparent dark:from-[#FF4D5A] dark:via-[#818CF8] dark:to-[#4F8BFF]">
            Sinar Warna
          </span>
          ..
        </h1>

        <p className="text-base font-medium text-zinc-600 dark:text-zinc-300 sm:text-lg">
          Ada yang mau di tanya seputar cat atau lainnya?
        </p>
      </div>
    </div>
  );
};
