'use client';

import { useEffect } from 'react';

const TYPEFORM_EMBED_SRC = 'https://embed.typeform.com/next/embed.js';

// Inline Typeform "live" embed.
//
// We intentionally bypass next/script here: with strategy="afterInteractive",
// Next adds a <link rel="preload"> for the script but the execute phase can
// fail to attach (browser console warns "preloaded ... but not used"), so the
// embed never initialises and the user sees an empty div. Manual injection in
// useEffect avoids the preload-vs-execute race entirely.
export function TypeformEmbed({
  formId,
  height = 720,
  className,
}: {
  formId: string;
  /**
   * Wrapper height in px. Must be a definite height (not min-height) so
   * Typeform's iframe — which uses `height: 100%` — has something to
   * resolve against; otherwise the iframe collapses to its natural size
   * and renders as a small tile.
   */
  height?: number;
  className?: string;
}) {
  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TYPEFORM_EMBED_SRC}"]`,
    );

    if (existing) {
      // Script is already in the DOM (e.g. user navigated away and back).
      // Ask Typeform's runtime to re-scan the page so it picks up THIS div.
      // The exact API name varies across Typeform releases; we try the known
      // variants and silently no-op if none exist (the inline auto-scan that
      // ran on first load will already have processed visible widgets).
      const tf = (window as unknown as { tf?: { load?: () => void; createWidget?: () => void } }).tf;
      tf?.load?.();
      tf?.createWidget?.();
      return;
    }

    const s = document.createElement('script');
    s.src = TYPEFORM_EMBED_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return (
    <div
      data-tf-live={formId}
      className={className}
      style={{ height, position: 'relative', width: '100%' }}
    />
  );
}
