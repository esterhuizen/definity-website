import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brand assets',
  description: 'Definity marketing assets: logos, the ∞ mark, the dynamic signature, palette and type.',
  robots: { index: false, follow: false },
};

// Unlisted brand/marketing pack. Not linked from anywhere; share the URL directly.

function Dl({ svg, png, name }: { svg: string; png?: string; name: string }) {
  return (
    <div className="mk-dl">
      <a href={svg} download={`${name}.svg`}>SVG</a>
      {png ? <a href={png} download={`${name}.png`}>PNG</a> : null}
    </div>
  );
}

export default function MarketingPage() {
  return (
    <>
      <section className="sec">
        <div className="wrap">
          <div className="chapter">Brand</div>
          <div className="sec-head">
            <h1 className="sec-h">Marketing <em>assets.</em></h1>
            <p className="sec-lede">Logos, the ∞ mark, and a static frame of the landing-page signature — download-ready as SVG (vector) and PNG. This page is unlisted; share the link directly.</p>
          </div>
        </div>
      </section>

      {/* 01 Logo */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">01</span>&nbsp; Logo</div>
          <p className="sec-lede" style={{ marginTop: '14px' }}>The full wordmark lockup — the ∞ mark with DEFINITY in JetBrains Mono.</p>
          <div className="mk-grid">
            <div className="mk-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mk-frame"><img src="/marketing/lockup-white-on-blue.svg" alt="Definity logo, white on blue" /></div>
              <div className="mk-meta"><span className="mk-t">White on blue</span><Dl name="definity-lockup-white-on-blue" svg="/marketing/lockup-white-on-blue.svg" png="/marketing/asset?v=lockup-white-on-blue" /></div>
            </div>
            <div className="mk-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mk-frame"><img src="/marketing/lockup-blue-on-white.svg" alt="Definity logo, blue on white" /></div>
              <div className="mk-meta"><span className="mk-t">Blue on white</span><Dl name="definity-lockup-blue-on-white" svg="/marketing/lockup-blue-on-white.svg" png="/marketing/asset?v=lockup-blue-on-white" /></div>
            </div>
            <div className="mk-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mk-frame"><img src="/marketing/lockup-teal-white.png" alt="Definity lockup, teal mark on dark, white wordmark" /></div>
              <div className="mk-meta"><span className="mk-t">Teal on dark · 2× mark</span><Dl name="definity-lockup-teal-white" svg="/marketing/lockup-teal-white.svg" png="/marketing/asset?v=lockup-teal-white" /></div>
            </div>
            <div className="mk-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mk-frame"><img src="/marketing/lockup-teal-white-1_5x.png" alt="Definity lockup, teal mark on dark, 1.5x mark" /></div>
              <div className="mk-meta"><span className="mk-t">Teal on dark · 1.5× mark</span><Dl name="definity-lockup-teal-white-1_5x" svg="/marketing/lockup-teal-white-1_5x.svg" png="/marketing/asset?v=lockup-teal-white-1_5x" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* 02 Mark */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">02</span>&nbsp; The ∞ mark</div>
          <p className="sec-lede" style={{ marginTop: '14px' }}>The top-left mark — a single mono-line lemniscate. For avatars, favicons, and tight spaces.</p>
          <div className="mk-grid mk-grid-4">
            <div className="mk-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mk-frame"><img src="/marketing/mark-white-on-blue.svg" alt="∞ mark, white on blue" style={{ width: 140 }} /></div>
              <div className="mk-meta"><span className="mk-t">White / blue</span><Dl name="definity-mark-white-on-blue" svg="/marketing/mark-white-on-blue.svg" png="/marketing/asset?v=mark-white-on-blue" /></div>
            </div>
            <div className="mk-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mk-frame"><img src="/marketing/mark-blue-on-white.svg" alt="∞ mark, blue on white" style={{ width: 140 }} /></div>
              <div className="mk-meta"><span className="mk-t">Blue / white</span><Dl name="definity-mark-blue-on-white" svg="/marketing/mark-blue-on-white.svg" png="/marketing/asset?v=mark-blue-on-white" /></div>
            </div>
            <div className="mk-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mk-frame blue"><img src="/marketing/mark-white.svg" alt="∞ mark, white" style={{ width: 130 }} /></div>
              <div className="mk-meta"><span className="mk-t">Mono white</span><Dl name="definity-mark-white" svg="/marketing/mark-white.svg" /></div>
            </div>
            <div className="mk-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mk-frame white"><img src="/marketing/mark-blue.svg" alt="∞ mark, blue" style={{ width: 130 }} /></div>
              <div className="mk-meta"><span className="mk-t">Mono blue</span><Dl name="definity-mark-blue" svg="/marketing/mark-blue.svg" /></div>
            </div>
            <div className="mk-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mk-frame"><img src="/marketing/token-circle.svg" alt="On-chain token icon, circle" style={{ width: 140 }} /></div>
              <div className="mk-meta"><span className="mk-t">On-chain token icon</span><Dl name="definity-token-circle" svg="/marketing/token-circle.svg" png="/marketing/asset?v=token-circle" /></div>
              <div className="mk-cap">Circle-native icon for wallets and explorers, which render token logos as circles. Bright fill stays legible on light and dark.</div>
            </div>
          </div>
        </div>
      </section>

      {/* 03 Signature */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">03</span>&nbsp; Dynamic signature</div>
          <p className="sec-lede" style={{ marginTop: '14px' }}>A static frame of the landing-page animation — particles flowing along a Gerono lemniscate.</p>
          <div className="mk-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marketing/hero-infinity.svg" alt="Definity dynamic ∞ signature" />
          </div>
          <div className="mk-meta" style={{ border: '1px solid var(--hair)', borderTop: 0 }}>
            <span className="mk-t">Signature ∞ · on Definity blue</span>
            <Dl name="definity-signature" svg="/marketing/hero-infinity.svg" />
          </div>
        </div>
      </section>

      {/* 04 Palette + type */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">04</span>&nbsp; Palette &amp; type</div>
          <div className="mk-swatches">
            {[
              { c: '#1430cf', n: 'Definity blue' },
              { c: '#1c3ae6', n: 'Bright blue' },
              { c: '#07114e', n: 'Deep navy' },
              { c: '#37f0b0', n: 'Signal teal' },
              { c: '#ffffff', n: 'White' },
            ].map((s) => (
              <div className="mk-sw" key={s.c}>
                <div className="chip" style={{ background: s.c }} />
                <div className="lab"><b>{s.c.toUpperCase()}</b><span>{s.n}</span></div>
              </div>
            ))}
          </div>
          <div className="mk-type">
            <div className="mk-face">
              <div className="big">Stake once. <em style={{ fontStyle: 'italic' }}>Compound.</em></div>
              <div className="nm">Bodoni Moda · display / headlines</div>
            </div>
            <div className="mk-face">
              <div className="bigm">5.32% · #2/23</div>
              <div className="nm">JetBrains Mono · data, labels, wordmark</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
