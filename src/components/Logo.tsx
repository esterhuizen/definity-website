import { cn } from '@/lib/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff8a4c" />
            <stop offset="0.55" stopColor="#ff7a59" />
            <stop offset="1" stopColor="#b07aff" />
          </linearGradient>
        </defs>
        <path
          d="M14 1.75 24.5 7v9.5l-10.5 8.75L3.5 16.5V7L14 1.75Z"
          stroke="url(#logo-grad)"
          strokeWidth="1.6"
          fill="none"
        />
        <path
          d="M9 10.5h6.2c2.2 0 3.8 1.7 3.8 3.9 0 2.2-1.6 3.9-3.8 3.9H9v-7.8Z"
          fill="url(#logo-grad)"
        />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight text-ink">Definity</span>
    </span>
  );
}
