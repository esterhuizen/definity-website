// Default social card (homepage + any route without its own). Concept-D dark
// card with the manifesto headline and the live base APY + GDI rank.

import { ImageResponse } from 'next/og';
import { getBaseApy } from '@/lib/apy';
import { getGdiStanding } from '@/lib/gdi';
import { OG_SIZE, loadOgFonts, OgCard, OgStat, OgEm } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'Definity — stake once, compound forever';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  const fonts = await loadOgFonts();

  let apyStr = '5.32';
  let rank = 2;
  let total = 23;
  try {
    const [apy, gdi] = await Promise.all([getBaseApy(), getGdiStanding()]);
    if (apy != null) apyStr = apy.toFixed(2);
    if (gdi) { rank = gdi.rank; total = gdi.total; }
  } catch {
    /* fall back to defaults */
  }

  return new ImageResponse(
    (
      <OgCard
        eyebrow="Institutional liquid staking · Solana"
        headline={<><span>Stake once. Compound&nbsp;</span><OgEm>forever.</OgEm></>}
        headlineSize={104}
        stats={
          <>
            <OgStat label="definSOL base APY" value={`${apyStr}%`} teal />
            <OgStat label="GDI rank" value={`#${rank} / ${total}`} />
            <OgStat label="Custody" value="Non-custodial" />
          </>
        }
        url="definity.finance"
      />
    ),
    { ...size, fonts },
  );
}
