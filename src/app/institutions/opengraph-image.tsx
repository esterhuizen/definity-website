// Social card for /institutions. Restrained variant of the brand card: same
// layout, rigor-led copy matching the page (verification, not mission).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'definSOL for institutions: decentralisation you can verify';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function logoDataUri(): Promise<string | null> {
  try {
    const png = await readFile(join(process.cwd(), 'public/logo.png'));
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

const CHIPS = ['Non-custodial', 'Audited program', 'Reproducible scoring'];

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
            'radial-gradient(ellipse 50% 38% at 90% 0%, rgba(153, 69, 255, 0.08), transparent 60%), ' +
            'radial-gradient(ellipse 45% 32% at 0% 100%, rgba(20, 241, 149, 0.06), transparent 55%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={56} height={56} alt="" />
          ) : null}
          <div style={{ fontSize: 34, fontWeight: 700, color: '#0d1014', letterSpacing: -0.5 }}>
            Definity
          </div>
        </div>

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
            For institutions
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              fontSize: 62,
              fontWeight: 800,
              color: '#0d1014',
              letterSpacing: -1.5,
              lineHeight: 1.05,
            }}
          >
            <span>Decentralisation you can&nbsp;</span>
            <span
              style={{
                backgroundImage: 'linear-gradient(135deg, #14F195 0%, #9945FF 55%, #DC1FFF 100%)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              verify
            </span>
            <span>.</span>
          </div>
          <div style={{ fontSize: 30, color: '#52566a', lineHeight: 1.4, maxWidth: 980 }}>
            Non-custodial staked SOL, independently scored on the open GDI.
            Built for funds, treasuries, and ETP issuers.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 32,
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
          <div style={{ fontSize: 22, fontWeight: 600, color: '#8a8e9e', whiteSpace: 'nowrap' }}>
            definity.finance/institutions
          </div>
        </div>
      </div>
    ),
    size,
  );
}
