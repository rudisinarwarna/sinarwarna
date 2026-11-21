import React from 'react';

interface VerifiedBlueBadgeProps {
  size?: 'xs' | 'sm' | 'md';
  title?: string;
}

const SIZE_CLASSES: Record<NonNullable<VerifiedBlueBadgeProps['size']>, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

export const VerifiedBlueBadge: React.FC<VerifiedBlueBadgeProps> = ({
  size = 'sm',
  title = 'Terverifikasi',
}) => {
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex shrink-0 items-center justify-center align-middle"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={SIZE_CLASSES[size]}
        aria-hidden="true"
      >
        <path
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
          fill="#1D9BF0"
        />
        <path
          d="M9.75 12.65l1.75 1.75 3.85-4.3"
          stroke="#FFFFFF"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
};
