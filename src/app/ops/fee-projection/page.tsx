import type { Metadata } from 'next';
import { FeeProjection } from './FeeProjection';

// Unlisted internal page: not linked in nav, absent from sitemap.ts, and noindex here
// (kept out of robots.txt on purpose — listing the path there would advertise it).
export const metadata: Metadata = {
  title: 'Fee projection',
  robots: { index: false, follow: false, nocache: true },
};

// Standalone: outside the (dark) route group, so no shared nav/footer — but we reuse the
// same .dfy theme (tokens + fonts) and the .dfy-canvas dark backdrop.
export default function OpsFeeProjectionPage() {
  return (
    <div className="dfy dfy-root">
      <div className="dfy-canvas" aria-hidden="true" />
      <FeeProjection />
    </div>
  );
}
