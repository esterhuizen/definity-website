import type { Metadata } from 'next';
import { LINKS } from '@/config/pool';

export const metadata: Metadata = {
  title: 'Direct staking on your site — for validators · Definity',
  description:
    'Add a Definity direct-stake widget to your validator’s website. Your delegators stake to your node, Definity directs their stake plus up to 3.5× matching (up to 4.5× total) — without ever leaving your site.',
};

const SNIPPET = `<!-- Definity direct-stake widget -->
<div data-definity-direct-stake
     data-vote="YOUR_VOTE_ACCOUNT"
     data-name="Your Validator"></div>
<script src="https://definity.finance/embed/v1/widget.js" async></script>`;

function Code({ code }: { code: string }) {
  return (
    <pre
      style={{
        margin: '22px 0 0',
        padding: '18px 20px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.09)',
        overflowX: 'auto',
        fontFamily: 'var(--mono)',
        fontSize: 12.5,
        lineHeight: 1.75,
      }}
    >
      <code>{code}</code>
    </pre>
  );
}

export default function EmbedPage() {
  return (
    <div>
      {/* hero */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">∞</span>&nbsp; For validators</div>
          <div className="sec-head">
            <h1 className="sec-h">Direct staking, <em>on your site.</em></h1>
            <p className="sec-lede">
              Drop a Definity widget on your validator’s page. Your delegators stake straight to your node, Definity directs their
              stake plus up to 3.5× matching onto you — up to 4.5× in total — and they never leave your site.
            </p>
          </div>
          <p style={{ marginTop: 24 }}>
            <a className="btn btn-primary" href="/whitelist-apply">Apply for whitelisting →</a>
            <a className="morelink" href="#embed" style={{ marginLeft: 16 }}>Already in the pool? Get the snippet ↓</a>
          </p>
        </div>
      </section>

      {/* why */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">01</span>&nbsp; Why</div>
          <div className="creds">
            <div className="cred"><div className="ck">More stake on your node</div><div className="cv">up to 4.5×</div><div className="cd">Every SOL a delegator direct-stakes brings their own 1× plus up to 3.5× matched pool stake directly onto your validator — anti-gaming, claw-back-disciplined.</div></div>
            <div className="cred"><div className="ck">Your brand, your page</div><div className="cv">100% on-site</div><div className="cd">Wallet connect, signing, confirmation — the whole flow runs on your domain. No redirect, no Definity chrome, no drop-off.</div></div>
            <div className="cred"><div className="ck">Easy to say yes</div><div className="cv">liquid</div><div className="cd">Your delegators hold definSOL — a liquid token that keeps earning the pool’s yield — instead of locking a native stake account.</div></div>
          </div>
        </div>
      </section>

      {/* the embed */}
      <section className="sec" id="embed">
        <div className="wrap">
          <div className="chapter"><span className="n">02</span>&nbsp; The embed</div>
          <div className="sec-head">
            <h1 className="sec-h">Two lines.</h1>
            <p className="sec-lede">
              Paste the snippet where you want the widget. It renders natively in your page, connects the visitor’s wallet on your
              domain, and builds the stake transaction client-side — no servers of ours in the path.
            </p>
          </div>
          <Code code={SNIPPET} />
          <p style={{ marginTop: 14, color: 'var(--dim)', fontSize: 13, maxWidth: 720 }}>
            Set <code style={{ fontFamily: 'var(--mono)' }}>data-vote</code> to your validator’s vote account — it must be a Definity pool
            validator, and the widget stakes only to that one validator. <code style={{ fontFamily: 'var(--mono)' }}>data-ref</code> is
            optional (request one to attribute stakes to your site).
          </p>
          <p className="sec-lede" style={{ marginTop: 26 }}>
            The widget mounts into a shadow root, so your site’s CSS can’t touch it and it can’t touch yours. A React/npm package is
            on the way; the snippet above works on any site today.
          </p>
        </div>
      </section>

      {/* 100% on your site */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">03</span>&nbsp; 100% on your site</div>
          <div className="sec-head">
            <h1 className="sec-h">Nothing touches our pages.</h1>
            <p className="sec-lede">
              The deposit is a single on-chain instruction — a deposit to the pool plus a memo tagging your validator. None of it
              needs our servers, so every step happens on your domain. (We use a native script, not an iframe — so wallets connect
              the way they always do, and your visitor never sees a Definity URL.)
            </p>
          </div>
          <div className="creds">
            <div className="cred"><div className="ck">Wallet connect</div><div className="cv">your site</div><div className="cd">The visitor connects Phantom · Solflare · Backpack on your domain — a real page, so wallets work natively.</div></div>
            <div className="cred"><div className="ck">Build &amp; sign</div><div className="cv">your site</div><div className="cd">The transaction is assembled in the browser and signed in the visitor’s wallet. No Definity page is ever loaded.</div></div>
            <div className="cred"><div className="ck">Stake &amp; unstake</div><div className="cv">your site</div><div className="cd">Staking and redeeming definSOL → SOL both run inside the same widget, on your page.</div></div>
          </div>
        </div>
      </section>

      {/* get started */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">04</span>&nbsp; Get started</div>
          <div className="sec-head">
            <h1 className="sec-h">One requirement.</h1>
            <p className="sec-lede">
              Your validator has to be in Definity’s pool — the widget directs stake only to your node, so it must be a pool validator.
              Already in? The snippet above is all you need: set your vote and ship it. If your validator isn’t in the pool yet, apply
              through the whitelist and we’ll review it.
            </p>
          </div>
          <p style={{ marginTop: 26 }}>
            <a className="btn btn-primary" href="/whitelist-apply">Apply for whitelisting →</a>
            <a className="morelink" href={LINKS.telegram} target="_blank" rel="noreferrer" style={{ marginLeft: 18 }}>Already in the pool? Talk to us →</a>
          </p>
        </div>
      </section>
    </div>
  );
}
