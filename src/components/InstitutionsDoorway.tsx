import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';

// Mid-page off-ramp: catches institutions who read past the security section
// and routes them to /institutions without disrupting the retail flow.
export function InstitutionsDoorway() {
  return (
    <section className="container-narrow py-8">
      <div className="surface flex flex-col items-start gap-5 p-8 md:flex-row md:items-center md:justify-between md:p-10">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg-muted ring-1 ring-ring">
            <Building2 className="h-5 w-5 text-sunrise-500" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-ink md:text-2xl">Staking at size?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted text-pretty">
              Non-custodial, independently-verified decentralisation, and full on-chain
              transparency. Built for funds, treasuries, and ETP issuers.
            </p>
          </div>
        </div>
        <Link href="/institutions" className="btn-primary shrink-0">
          For institutions <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
