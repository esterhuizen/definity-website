'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { track } from '@/lib/track';

type Props = {
  href: string;
  event: string;
  className?: string;
  external?: boolean;
  children: ReactNode;
  ariaLabel?: string;
};

// Tracks a click then navigates as a normal link. For internal routes (`href`
// starting with `/` and no `external` prop), uses next/link so the SPA
// transition is preserved. For external links, renders a plain anchor with
// target=_blank + secure rel attrs.
export function TrackedLink({ href, event, className, external, children, ariaLabel }: Props) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={ariaLabel}
        onClick={() => track(event)}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() => track(event)}
    >
      {children}
    </Link>
  );
}
