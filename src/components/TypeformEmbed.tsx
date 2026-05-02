'use client';

import Script from 'next/script';

// Inline Typeform "live" embed. Mirrors the snippet Typeform hands you:
//   <div data-tf-live="<form-id>"></div>
//   <script src="//embed.typeform.com/next/embed.js"></script>
//
// We render the div as a React component and load the script via
// next/script (strategy="afterInteractive") so the div is in the DOM
// before the script tries to find it. CSP must allow embed.typeform.com
// (script-src) and *.typeform.com (frame-src) — see next.config.js.
export function TypeformEmbed({
  formId,
  minHeight = 600,
  className,
}: {
  formId: string;
  minHeight?: number;
  className?: string;
}) {
  return (
    <>
      <div
        data-tf-live={formId}
        className={className}
        style={{ minHeight, position: 'relative', width: '100%' }}
      />
      <Script
        id="typeform-embed"
        src="https://embed.typeform.com/next/embed.js"
        strategy="afterInteractive"
      />
    </>
  );
}
