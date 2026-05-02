import Image from 'next/image';
import { cn } from '@/lib/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src="/logo.png"
        alt=""
        width={36}
        height={36}
        priority
        className="h-9 w-auto select-none"
      />
      <span className="font-display text-lg font-semibold tracking-tight text-ink">
        Definity
      </span>
    </span>
  );
}
