// Default social card (homepage + any route without its own). Concept-D dark
// card with the manifesto headline and the live base APY + GDI rank.

import { ImageResponse } from 'next/og';
import { getBaseApy } from '@/lib/apy';
import { getGdiStanding } from '@/lib/gdi';
import { OG_SIZE, loadOgFonts, OgCard, OgStat } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'Definity — stake once, compound forever';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  const fonts = await loadOgFonts();

  // Honest defaults: a social card must not bake a fabricated APY/rank on a >a-day source
  // outage. getBaseApy/getGdiStanding read the collector's last-good stats.json, so a real
  // number is used virtually always; the words are the truthful fallback, never a number.
  let apyVal = 'On-chain';
  let gdiVal = 'Verifiable';
  try {
    const [apy, gdi] = await Promise.all([getBaseApy(), getGdiStanding()]);
    if (apy != null) apyVal = `${apy.toFixed(2)}%`;
    if (gdi) gdiVal = `#${gdi.rank} / ${gdi.total}`;
  } catch {
    /* keep the honest word-fallbacks */
  }

  return new ImageResponse(
    (
      <OgCard
        eyebrow="Institutional liquid staking · Solana"
        headlineText="Stake once. Compound"
        headlineAccent="forever."
        headlineSize={104}
        stats={
          <>
            <OgStat label="Base APY" value={apyVal} teal />
            <OgStat label="GDI rank" value={gdiVal} />
            <OgStat label="Custody" value="Non-custodial" />
          </>
        }
        url="definity.finance"
      />
    ),
    { ...size, fonts },
  );
}
