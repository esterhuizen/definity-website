import { getGdiStanding, GDI_URLS } from '@/lib/gdi';
import { POOL, LINKS } from '@/config/pool';
import { LogoMark } from './LogoMark';

// Shared Concept-D footer for the migrated (dark) route group. Live GDI rank, all real
// verifiable links. Self-contained (fetches its own GDI standing) so any dark page can use it.
export async function FooterD() {
  const gdi = await getGdiStanding();
  // Omit the numbers on a GDI outage rather than baking in a stale rank; the links
  // still resolve (to the pool page, or the index when we can't confirm the rank).
  const gdiHref = gdi ? GDI_URLS.pool : GDI_URLS.index;

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="fgrid">
          <div className="fcol">
            <div className="fbrand"><LogoMark /> Definity</div>
            <p className="ftag">Non-custodial liquid staking on Solana. Stake SOL → definSOL.</p>
          </div>
          <div className="fcol"><h4>Product</h4>
            <a href={LINKS.sanctumLst} target="_blank" rel="noreferrer">Stake on Sanctum</a>
            <a href={LINKS.jupiterSwap} target="_blank" rel="noreferrer">Swap on Jupiter</a>
            <a href="/institutions">Institutions</a>
            <a href="/stake">Stake widget</a>
          </div>
          <div className="fcol"><h4>Verify</h4>
            <a href={gdiHref} target="_blank" rel="noreferrer">GDI rank{gdi ? ` #${gdi.rank}/${gdi.total}` : ''}</a>
            <a href={LINKS.solscanPool} target="_blank" rel="noreferrer">Pool on Solscan</a>
            <a href={LINKS.solscanMint} target="_blank" rel="noreferrer">Mint on Solscan</a>
            <a href="/addresses">Addresses</a>
          </div>
          <div className="fcol"><h4>Connect</h4>
            <a href={LINKS.twitter} target="_blank" rel="noreferrer">X / Twitter</a>
            <a href={LINKS.telegram} target="_blank" rel="noreferrer">Telegram</a>
            <a href="/faq">FAQ</a>
          </div>
        </div>
        <div className="fbot">
          <span>© Definity · {POOL.lstName}</span>
          <span>Non-custodial · Audited Sanctum program{gdi ? ` · Ranked #${gdi.rank} of ${gdi.total} on the GDI` : ' · Ranked on the GDI'}</span>
        </div>
        <p className="ftag" style={{ marginTop: 10, opacity: 0.75 }}>
          Definity is a Solana staking protocol. Not affiliated with Definity Financial Corporation.
        </p>
      </div>
    </footer>
  );
}
