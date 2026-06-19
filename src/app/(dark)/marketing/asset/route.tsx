// PNG export of the brand assets (so the wordmark renders with the real
// JetBrains Mono everywhere). /marketing/asset?v=<name>
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

const BLUE = '#1430cf', BRIGHT = '#1c3ae6', DEEP = '#0a1576';
const MARK = 'M30 15 C30 4 12 4 12 15 C12 26 30 26 30 15 C30 4 48 4 48 15 C48 26 30 26 30 15 Z';
const GRAD = `radial-gradient(900px 520px at 78% -20%, ${BRIGHT} 0%, ${BLUE} 42%, ${DEEP} 100%)`;

function Mark({ stroke, w }: { stroke: string; w: number }) {
  return (
    <svg width={w} height={w / 2} viewBox="0 0 60 30">
      <path d={MARK} fill="none" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function GET(req: Request) {
  const v = new URL(req.url).searchParams.get('v') ?? 'lockup-white-on-blue';
  const jb = await readFile(join(process.cwd(), 'public/og/jbmono.ttf'));
  const onBlue = !v.includes('blue-on-white');
  const fg = onBlue ? '#ffffff' : BLUE;
  const sub = onBlue ? 'rgba(255,255,255,0.62)' : 'rgba(20,48,207,0.6)';
  const bg = onBlue ? GRAD : '#ffffff';
  const fonts = [{ name: 'JBMono', data: jb, weight: 700 as const, style: 'normal' as const }];

  if (v.startsWith('mark')) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 96, background: bg }}>
          <Mark stroke={fg} w={300} />
        </div>
      ),
      { width: 480, height: 480, fonts },
    );
  }

  // wordmark lockup
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 40, padding: '0 90px', background: bg, fontFamily: 'JBMono' }}>
        <Mark stroke={fg} w={156} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontWeight: 700, fontSize: 104, letterSpacing: 14, color: fg }}>DEFINITY</div>
          <div style={{ display: 'flex', fontWeight: 700, fontSize: 21, letterSpacing: 8, color: sub, marginTop: 10 }}>LIQUID STAKING · SOLANA</div>
        </div>
      </div>
    ),
    { width: 1280, height: 340, fonts },
  );
}
