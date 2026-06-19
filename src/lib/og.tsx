// Shared renderer for the Concept-D social cards (homepage + /institutions +
// /stake). Deep Definity blue, Bodoni serif headline, ∞ mark, teal accent, a
// live data strip. Satori needs real font binaries (and chokes on variable
// fonts), so we ship static TTFs in public/og.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReactNode } from 'react';

export const OG_SIZE = { width: 1200, height: 630 };

// Mono-line figure-eight (∞) — the brand mark, drawn as a stroked path.
const INF = 'M 18,28 C 18,15 32,15 50,28 C 68,41 82,41 82,28 C 82,15 68,15 50,28 C 32,41 18,41 18,28 Z';

export async function loadOgFonts() {
  const [bodoni, bodoniItalic, jbmono] = await Promise.all([
    readFile(join(process.cwd(), 'public/og/bodoni.ttf')),
    readFile(join(process.cwd(), 'public/og/bodoni-italic.ttf')),
    readFile(join(process.cwd(), 'public/og/jbmono.ttf')),
  ]);
  return [
    { name: 'Bodoni', data: bodoni, weight: 900 as const, style: 'normal' as const },
    { name: 'Bodoni', data: bodoniItalic, weight: 600 as const, style: 'italic' as const },
    { name: 'JBMono', data: jbmono, weight: 600 as const, style: 'normal' as const },
  ];
}

export function OgStat({ label, value, teal }: { label: string; value: string; teal?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginRight: 52 }}>
      <div style={{ display: 'flex', fontSize: 14, letterSpacing: 2, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', fontFamily: 'Bodoni', fontWeight: 900, fontSize: 34, color: teal ? '#37f0b0' : '#ffffff' }}>
        {value}
      </div>
    </div>
  );
}

// One headline line (a flex row so an inline accent sits beside the text).
export function OgLine({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex' }}>{children}</div>;
}

// Italic teal accent word for the headline.
export function OgEm({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: 'Bodoni', fontStyle: 'italic', fontWeight: 600, color: '#37f0b0' }}>{children}</span>
  );
}

export function OgCard({
  eyebrow,
  headline,
  headlineSize = 104,
  stats,
  url,
}: {
  eyebrow: string;
  headline: ReactNode;
  headlineSize?: number;
  stats: ReactNode;
  url: string;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '62px 72px',
        backgroundColor: '#0b1875',
        backgroundImage: 'radial-gradient(1100px 780px at 80% -14%, #1f3ef0 0%, #1430cf 26%, #0a1576 58%, #06104a 100%)',
        color: '#ffffff',
        fontFamily: 'JBMono',
        position: 'relative',
      }}
    >
      {/* faint ∞ watermark */}
      <div style={{ position: 'absolute', top: 96, right: -56, display: 'flex', opacity: 0.12 }}>
        <svg width={700} height={392} viewBox="0 0 100 56">
          <path d={INF} stroke="#ffffff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width={48} height={27} viewBox="0 0 100 56">
          <path d={INF} stroke="#ffffff" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, letterSpacing: 8 }}>DEFINITY</div>
      </div>

      {/* manifesto */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 20, letterSpacing: 5, color: '#9fb0ff', textTransform: 'uppercase', marginBottom: 28 }}>
          <div style={{ display: 'flex', width: 30, height: 2, backgroundColor: '#37f0b0' }} />
          {eyebrow}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Bodoni', fontWeight: 900, fontSize: headlineSize, lineHeight: 0.98, letterSpacing: -1, textTransform: 'uppercase' }}>
          {headline}
        </div>
      </div>

      {/* data strip */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.16)', paddingTop: 28 }}>
        <div style={{ display: 'flex' }}>{stats}</div>
        <div style={{ display: 'flex', fontSize: 24, color: '#9fb0ff', letterSpacing: 1 }}>{url}</div>
      </div>
    </div>
  );
}
