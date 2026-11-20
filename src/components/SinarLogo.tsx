import React, { useState } from 'react';

interface SinarLogoProps {
  size?: number;
  spinning?: boolean;
  className?: string;
}

export const SinarLogo: React.FC<SinarLogoProps> = ({
  size = 28,
  spinning = false,
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <span
      style={{ width: Math.round(size * 1.27), height: size }}
      className={`inline-flex shrink-0 items-center justify-center bg-transparent select-none ${
        spinning ? 'animate-sinar-speak' : ''
      } ${className}`}
    >
      {!imgFailed ? (
        <img
          src="/assets/sinar-warna-logo.png"
          alt="Logo Sinar Warna"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-contain drop-shadow-[0_2px_10px_rgba(37,99,235,0.18)]"
        />
      ) : (
        <span className="font-display text-sm font-bold tracking-tight bg-gradient-to-r from-[#E51D2B] to-[#0A36FF] bg-clip-text text-transparent">
          SW
        </span>
      )}
    </span>
  );
};
