import type { Metadata } from 'next';
import { PaymentsTracker } from './PaymentsTracker';

// Unlisted internal page (same conventions as /ops/fee-projection): noindex, unlinked,
// absent from sitemap.ts and robots.txt.
export const metadata: Metadata = {
  title: 'Payment watch',
  robots: { index: false, follow: false, nocache: true },
};

export default function OpsPaymentsPage() {
  return (
    <div className="dfy dfy-root">
      <div className="dfy-canvas" aria-hidden="true" />
      <PaymentsTracker />
    </div>
  );
}
