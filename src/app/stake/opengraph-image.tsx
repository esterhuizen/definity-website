// Social preview card for /stake. Rendered server-side with next/og; design
// mirrors the site: light theme, ink palette, the Solana teal→purple→magenta
// sweep on the accent word, and the proof chips the hero leads with.
//
// No custom fonts on purpose (sgdi precedent): satori's default sans at heavy
// weights stays close to Manrope and keeps the route dependency-free.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Stake SOL for definSOL on Definity';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function logoDataUri(): Promise<string | null> {
  try {
    const png = await readFile(join(process.cwd(), 'public/logo.png'));
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null; // render without the mark rather than 500 the card
  }
}

const CHIPS = ['Non-custodial', 'Unstake anytime', 'Rewards in USDC'];

export default async function Image() {
  const logo = await logoDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: '#ffffff',
          backgroundImage:
            'radial-gradient(ellipse 60% 45% at 85% 0%, rgba(153, 69, 255, 0.12), transparent 60%), ' +
            'radial-gradient(ellipse 55% 40% at 5% 100%, rgba(20, 241, 149, 0.10), transparent 55%), ' +
            'radial-gradient(ellipse 40% 30% at 100% 80%, rgba(220, 31, 255, 0.07), transparent 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={56} height={56} alt="" />
          ) : null}
          <div style={{ fontSize: 34, fontWeight: 700, color: '#0d1014', letterSpacing: -0.5 }}>
            Definity
          </div>
        </div>

        {/* Headline block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 5,
              color: '#8a8e9e',
              textTransform: 'uppercase',
            }}
          >
            Liquid staking on Solana
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              fontSize: 84,
              fontWeight: 800,
              color: '#0d1014',
              letterSpacing: -2.5,
              lineHeight: 1.05,
            }}
          >
            <span>Stake SOL for&nbsp;</span>
            <span
              style={{
                backgroundImage: 'linear-gradient(135deg, #14F195 0%, #9945FF 55%, #DC1FFF 100%)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              definSOL
            </span>
            <span>.</span>
          </div>
          <div style={{ fontSize: 30, color: '#52566a', lineHeight: 1.4, maxWidth: 940 }}>
            Earning from the moment you stake, with independently verified
            geographic decentralisation.
          </div>
        </div>

        {/* Proof chips + URL */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            {CHIPS.map((c) => (
              <div
                key={c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 26px',
                  borderRadius: 999,
                  border: '2px solid #dcdee8',
                  backgroundColor: '#f3f4f8',
                  fontSize: 24,
                  fontWeight: 600,
                  color: '#0d1014',
                }}
              >
                {c}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, color: '#8a8e9e' }}>
            definity.finance/stake
          </div>
        </div>
      </div>
    ),
    size,
  );
}
