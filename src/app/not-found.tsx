import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container-narrow flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="eyebrow">404</span>
      <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight md:text-5xl">
        That page is off-chain.
      </h1>
      <p className="mt-4 max-w-md text-ink-muted text-pretty">
        The link you followed doesn&apos;t lead anywhere. Head back home and pick a thread.
      </p>
      <Link href="/" className="btn-ghost mt-8">
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>
    </div>
  );
}
