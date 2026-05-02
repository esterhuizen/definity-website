'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { track } from '@/lib/track';

// Fires a `pageview` event on initial render and on every Next.js
// client-side route change. Mounted once at the root of the layout so
// it follows every navigation in the app.
export function TrackPageView() {
  const pathname = usePathname();
  useEffect(() => {
    track('pageview', { page: pathname });
  }, [pathname]);
  return null;
}
