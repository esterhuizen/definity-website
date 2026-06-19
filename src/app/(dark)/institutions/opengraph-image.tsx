// Social card for /institutions — Concept-D dark, rigor-led: the GDI rank is
// the lead stat (decentralisation you can verify).

import { ImageResponse } from 'next/og';
import { getGdiStanding } from '@/lib/gdi';
import { OG_SIZE, loadOgFonts, OgCard, OgStat, OgEm, OgLine } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'definSOL for institutions: decentralisation you can verify';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  const fonts = await loadOgFonts();

  let rank = 2;
  let total = 23;
  try {
    const gdi = await getGdiStanding();
    if (gdi) { rank = gdi.rank; total = gdi.total; }
  } catch {
    /* fall back to defaults */
  }

  return new ImageResponse(
    (
      <OgCard
        eyebrow="For institutions"
        headline={
          <>
            <OgLine>Decentralisation</OgLine>
            <OgLine>you can&nbsp;<OgEm>verify.</OgEm></OgLine>
          </>
        }
        headlineSize={66}
        stats={
          <>
            <OgStat label="GDI rank" value={`#${rank} / ${total}`} teal />
            <OgStat label="Custody" value="Non-custodial" />
            <OgStat label="Program" value="Audited" />
          </>
        }
        url="definity.finance/institutions"
      />
    ),
    { ...size, fonts },
  );
}
