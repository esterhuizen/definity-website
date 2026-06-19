// Default social card (homepage + any route without its own card; /stake and
// /institutions override). Concept-D look: deep Definity blue, Bodoni serif
// manifesto headline, the ∞ mark, and the live base APY + GDI rank.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getBaseApy } from '@/lib/apy';
import { getGdiStanding } from '@/lib/gdi';

export const runtime = 'nodejs';
export const alt = 'Definity — stake once, compound forever';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Mono-line figure-eight (∞) — the brand mark, drawn as a stroked path.
const INF = 'M 18,28 C 18,15 32,15 50,28 C 68,41 82,41 82,28 C 82,15 68,15 50,28 C 32,41 18,41 18,28 Z';

function Stat({ label, value, teal }: { label: string; value: string; teal?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', fontSize: 15, letterSpacing: 2, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', fontFamily: 'Bodoni', fontWeight: 900, fontSize: 42, color: teal ? '#37f0b0' : '#ffffff' }}>
        {value}
      </div>
    </div>
  );
}

export default async function Image() {
  const [bodoni, bodoniItalic, jbmono] = await Promise.all([
    readFile(join(process.cwd(), 'public/og/bodoni.ttf')),
    readFile(join(process.cwd(), 'public/og/bodoni-italic.ttf')),
    readFile(join(process.cwd(), 'public/og/jbmono.ttf')),
  ]);

  let apyStr = '5.32';
  let rank = 2;
  let total = 23;
  try {
    const [apy, gdi] = await Promise.all([getBaseApy(), getGdiStanding()]);
    if (apy != null) apyStr = apy.toFixed(2);
    if (gdi) { rank = gdi.rank; total = gdi.total; }
  } catch {
    /* fall back to the defaults above */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '62px 72px',
          backgroundColor: '#0b1875',
          backgroundImage:
            'radial-gradient(1100px 780px at 80% -14%, #1f3ef0 0%, #1430cf 26%, #0a1576 58%, #06104a 100%)',
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
            Institutional liquid staking · Solana
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', fontFamily: 'Bodoni', fontWeight: 900, fontSize: 104, lineHeight: 1.0, letterSpacing: -1, textTransform: 'uppercase' }}>
            <span>Stake once. Compound&nbsp;</span>
            <span style={{ fontFamily: 'Bodoni', fontStyle: 'italic', fontWeight: 600, color: '#37f0b0' }}>forever.</span>
          </div>
        </div>

        {/* live data strip */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.16)', paddingTop: 28 }}>
          <div style={{ display: 'flex', gap: 56 }}>
            <Stat label="definSOL base APY" value={`${apyStr}%`} teal />
            <Stat label="GDI rank" value={`#${rank} / ${total}`} />
            <Stat label="Custody" value="Non-custodial" />
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#9fb0ff', letterSpacing: 1 }}>definity.finance</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Bodoni', data: bodoni, weight: 900, style: 'normal' },
        { name: 'Bodoni', data: bodoniItalic, weight: 600, style: 'italic' },
        { name: 'JBMono', data: jbmono, weight: 600, style: 'normal' },
      ],
    },
  );
}
