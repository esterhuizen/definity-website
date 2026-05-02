import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FAQAccordion } from './FAQAccordion';

export function HomeFAQ() {
  return (
    <section id="faq" className="scroll-mt-24 py-24 md:py-32">
      <div className="container-narrow grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <span className="eyebrow">FAQ</span>
          <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Common questions, answered plainly.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted text-pretty">
            Still curious? The full FAQ goes deeper into validator selection, fees and security.
          </p>
          <Link
            href="/faq"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-sunrise-400 hover:text-sunrise-300"
          >
            Read the full FAQ <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="md:col-span-8">
          <FAQAccordion />
        </div>
      </div>
    </section>
  );
}
