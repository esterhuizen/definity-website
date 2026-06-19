// Social card for /stake — Concept-D dark, action-led: live base APY up front.

import { ImageResponse } from 'next/og';
import { getBaseApy } from '@/lib/apy';
import { OG_SIZE, loadOgFonts, OgCard, OgStat, OgEm, OgLine } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'Stake SOL for definSOL on Definity';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  const fonts = await loadOgFonts();

  let apyStr = '5.32';
  try {
    const apy = await getBaseApy();
    if (apy != null) apyStr = apy.toFixed(2);
  } catch {
    /* fall back to default */
  }

  return new ImageResponse(
    (
      <OgCard
        eyebrow="Liquid staking on Solana"
        headline={
          <>
            <OgLine>Stake SOL for</OgLine>
            <OgLine><OgEm>definSOL.</OgEm></OgLine>
          </>
        }
        headlineSize={92}
        stats={
          <>
            <OgStat label="Base APY" value={`${apyStr}%`} teal />
            <OgStat label="Custody" value="Non-custodial" />
            <OgStat label="Exit" value="Anytime" />
          </>
        }
        url="definity.finance/stake"
      />
    ),
    { ...size, fonts },
  );
}
