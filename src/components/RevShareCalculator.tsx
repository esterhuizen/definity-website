'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Revenue-share calculator for /revenue-share.
//
// /api/revenue-share is fetched ONCE, for a known stake size, and every figure is
// rescaled on the client by stake ÷ quotedStake. That is exact, not an approximation:
// the share is stake × grossAPY × 2.5%, strictly linear in stake. Everything the API
// returns is either linear (amounts) or stake-invariant (the yield uplift, the fee
// split). So the slider is instant and the arithmetic still lives in exactly one
// place on the server, which is the point of the shared pool-economics module.

type Money = { sol: number; defSol: number | null; usd: number | null; nzd: number | null };
type Data = {
  ok: boolean;
  error?: string;
  inputs: {
    stakeSol: number;
    sharePct: number;
    netApyPct: number;
    grossApyPct: number;
    poolFeePct: number;
    definityFeePct: number;
    sanctumFeePct: number;
    exchangeRate: number;
    solUsd: number | null;
    priceSource: string | null;
    priceUpdatedAt: string | null;
    epochDays: number;
    epochDaysSource: 'live' | 'default' | 'override';
    epochsPerYear: number;
    epoch: number | null;
    statsUpdatedAt: string | null;
    overridden: string[];
  };
  yield: { netApyPct: number; upliftPp: number; effectiveApyPct: number; feeReturnedPct: number | null };
  perEpoch: Money;
  perMonth: Money;
  perYear: Money;
  breakdown: {
    grossRewardsSol: number;
    definityFeeSol: number;
    sanctumFeeSol: number;
    revShareSol: number;
    definityKeepsSol: number;
  };
};

const DEFAULT_STAKE = 100_000;
const MIN_STAKE = 1_000;
const MAX_STAKE = 1_000_000;
// Centred on the 100k default: 10k stays as the entry point for someone just over a
// 20k cap, and the top end extends to 500k so the row does not read as all-smaller.
const PRESETS = [10_000, 50_000, 100_000, 250_000, 500_000];
const REFRESH_MS = 120_000;

// Log slider: the interesting range spans three orders of magnitude, so a linear
// track would bury 10k in the first 1% of it.
const STEPS = 1000;
const toPos = (v: number) => Math.round((STEPS * Math.log(v / MIN_STAKE)) / Math.log(MAX_STAKE / MIN_STAKE));
const fromPos = (p: number) => snap(MIN_STAKE * Math.pow(MAX_STAKE / MIN_STAKE, p / STEPS));
function snap(v: number): number {
  const grain = v < 20_000 ? 500 : v < 100_000 ? 1_000 : v < 400_000 ? 5_000 : 10_000;
  return Math.max(MIN_STAKE, Math.min(MAX_STAKE, Math.round(v / grain) * grain));
}

const int = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const usd = (n: number | null | undefined, d = 0) =>
  n == null ? '—' : `US$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const dp = (n: number) => (n < 1 ? 4 : n < 100 ? 3 : 2);
const amt = (n: number | null | undefined, d?: number) =>
  n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d ?? dp(n), maximumFractionDigits: d ?? dp(n) });
const pct = (n: number | null | undefined, d = 2) => (n == null ? '—' : `${n.toFixed(d)}%`);

function ago(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 90) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function RevShareCalculator() {
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [typed, setTyped] = useState<string | null>(null); // raw text while the field has focus
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const firstRender = useRef(true);

  // A size in the URL makes a quote shareable: send a colleague the exact number you saw.
  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get('stake'));
    if (Number.isFinite(q) && q >= MIN_STAKE) setStake(snap(Math.min(q, MAX_STAKE)));
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const u = new URL(window.location.href);
    u.searchParams.set('stake', String(stake));
    window.history.replaceState(null, '', u);
  }, [stake]);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/revenue-share?stake=${DEFAULT_STAKE}`, { cache: 'no-store' });
      const j = (await r.json()) as Data;
      if (!j.ok) {
        setErr(j.error || 'Live figures are unavailable right now.');
        return;
      }
      setData(j);
      setErr(null);
      setFetchedAt(new Date().toISOString());
    } catch {
      setErr('Could not reach the pricing service.');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const i = data?.inputs;
  // Exact rescale — see the note at the top of the file.
  const k = data ? stake / data.inputs.stakeSol : 1;
  const m = useMemo(() => {
    if (!data) return null;
    const scale = (x: Money): Money => ({
      sol: x.sol * k,
      defSol: x.defSol == null ? null : x.defSol * k,
      usd: x.usd == null ? null : x.usd * k,
      nzd: x.nzd == null ? null : x.nzd * k,
    });
    return {
      perEpoch: scale(data.perEpoch),
      perMonth: scale(data.perMonth),
      perYear: scale(data.perYear),
      grossRewardsSol: data.breakdown.grossRewardsSol * k,
      poolFeeSol: (data.breakdown.definityFeeSol + data.breakdown.sanctumFeeSol) * k,
      revShareSol: data.breakdown.revShareSol * k,
    };
  }, [data, k]);

  // Fee-split slices, as a share of the whole pool fee.
  const split = i
    ? {
        yours: (i.definityFeePct * (i.sharePct / 100)) / i.poolFeePct,
        ours: (i.definityFeePct * (1 - i.sharePct / 100)) / i.poolFeePct,
        sanctum: i.sanctumFeePct / i.poolFeePct,
      }
    : null;

  const commitStake = (raw: string) => {
    const n = Number(raw.replace(/[^0-9.]/g, ''));
    setStake(Number.isFinite(n) && n > 0 ? snap(n) : DEFAULT_STAKE);
    setTyped(null);
  };

  return (
    <>
      <div className="ihero">
        <div>
          <div className="chapter">Revenue share</div>
          <h1>
            Past the cap?
            <br />
            <em>Get paid anyway.</em>
          </h1>
          <p className="lede">
            Your validator&apos;s directed allocation is <b>capped at 20,000 SOL</b>. Stake beyond it has nowhere left
            to be directed — so put it in the pool, and we pay you half of the fee Definity earns on it. Full staking
            yield on the whole position, plus a share of our revenue on top.
          </p>

          <div className="rs-size">
            <label className="lab" htmlFor="rs-stake">
              <span>Stake beyond your cap</span>
              <b>
                {int(stake)}
                <i>SOL</i>
              </b>
            </label>
            <div className="rs-field">
              <input
                id="rs-stake"
                className="wl-input"
                inputMode="decimal"
                aria-label="Stake beyond your cap, in SOL"
                value={typed ?? int(stake)}
                onChange={(e) => setTyped(e.target.value)}
                onBlur={(e) => commitStake(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitStake((e.target as HTMLInputElement).value);
                }}
              />
              <span className="rs-unit">SOL</span>
            </div>
            <input
              className="rs-range"
              type="range"
              min={0}
              max={STEPS}
              value={toPos(stake)}
              aria-label="Stake size"
              onChange={(e) => {
                setStake(fromPos(Number(e.target.value)));
                setTyped(null);
              }}
            />
            <div className="rs-presets">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={stake === p}
                  onClick={() => {
                    setStake(p);
                    setTyped(null);
                  }}
                >
                  {p >= 1000 ? `${p / 1000}k` : p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel rs-panel">
          <div className="phead">
            <span className="l">
              <span className="live" /> Your revenue share
            </span>
            <span>{err ? 'unavailable' : data ? 'live' : 'loading…'}</span>
          </div>
          <div className="prow">
            <div className="k">Paid per epoch</div>
            <div className="big">
              <div className="v">
                {m ? amt(m.perEpoch.defSol) : '—'}
                <i>definSOL</i>
              </div>
            </div>
            <div className="sub">
              ≈ {usd(m?.perEpoch.usd, 2)} per epoch · {amt(m?.perEpoch.sol)} SOL
            </div>
          </div>
          <div className="twocol">
            <div>
              <div className="k">Per month</div>
              <div className="v">{usd(m?.perMonth.usd)}</div>
              <div className="sub">{m ? `${amt(m.perMonth.defSol)} definSOL` : '—'}</div>
            </div>
            <div>
              <div className="k">Per year</div>
              <div className="v">{usd(m?.perYear.usd)}</div>
              <div className="sub">{m ? `${amt(m.perYear.defSol)} definSOL` : '—'}</div>
            </div>
          </div>
          <div className="soon">
            <span>
              Yield on that stake {pct(data?.yield.netApyPct)} → <b>{pct(data?.yield.effectiveApyPct)}</b>
            </span>
            <span>
              <b>+{data ? data.yield.upliftPp.toFixed(2) : '—'}pp</b>
            </span>
          </div>
        </div>
      </div>

      {err ? (
        <p style={{ marginTop: 26, color: '#ff8d8d', fontFamily: 'var(--mono)', fontSize: 12.5 }}>{err}</p>
      ) : null}

      {/* the disclosure, made graphic: where the pool fee actually goes */}
      <div className="rs-split">
        <h3>Where the pool fee goes</h3>
        <p>
          The pool charges {pct(i?.poolFeePct, 1)} on staking rewards. Definity keeps {pct(i?.definityFeePct, 1)} of
          that and Sanctum takes {pct(i?.sanctumFeePct, 1)}. Under revenue share, half of Definity&apos;s cut goes back
          to you — so{' '}
          <b style={{ color: '#fff', fontWeight: 500 }}>
            {data?.yield.feeReturnedPct != null ? `${Math.round(data.yield.feeReturnedPct)}%` : 'a third'} of the fee
            your stake pays comes back
          </b>{' '}
          as yield.
        </p>
        <div className="rs-bar" role="img" aria-label="The pool fee split three ways: returned to you, Definity, Sanctum">
          <span className="yours" style={{ flex: `0 0 ${(split ? split.yours : 1 / 3) * 100}%` }} />
          <span className="ours" style={{ flex: `0 0 ${(split ? split.ours : 1 / 3) * 100}%` }} />
          <span className="sanctum" style={{ flex: `0 0 ${(split ? split.sanctum : 1 / 3) * 100}%` }} />
        </div>
        <div className="rs-key">
          <div>
            <i style={{ background: 'var(--teal)' }} />
            <span>
              <b>Returned to you</b>
              {pct(i ? i.definityFeePct * (i.sharePct / 100) : null, 1)} of rewards ·{' '}
              {m ? `${amt(m.revShareSol)} SOL/yr` : '—'}
            </span>
          </div>
          <div>
            <i style={{ background: 'rgba(255,255,255,.30)' }} />
            <span>
              <b>Definity keeps</b>
              {pct(i ? i.definityFeePct * (1 - i.sharePct / 100) : null, 1)} of rewards · pool operations
            </span>
          </div>
          <div>
            <i style={{ background: 'rgba(255,255,255,.10)' }} />
            <span>
              <b>Sanctum</b>
              {pct(i?.sanctumFeePct, 1)} of rewards · stake-pool program
            </span>
          </div>
        </div>
      </div>

      {/* the working */}
      <div className="sublabel">The working</div>
      <table className="rs-work">
        <tbody>
          <Row k="Your stake" v={`${int(stake)} SOL`} />
          <Row
            k="Gross staking rewards"
            note={`${pct(i?.grossApyPct)} gross, from ${pct(i?.netApyPct)} net definSOL yield`}
            v={m ? `${amt(m.grossRewardsSol, 2)} SOL / year` : '—'}
          />
          <Row
            k="Pool fee on those rewards"
            note={`${pct(i?.poolFeePct, 1)} — Definity ${pct(i?.definityFeePct, 1)}, Sanctum ${pct(i?.sanctumFeePct, 1)}`}
            v={m ? `${amt(m.poolFeeSol, 2)} SOL / year` : '—'}
          />
          <Row
            k="Your revenue share"
            note={`${i ? i.sharePct : 50}% of Definity's fee`}
            v={m ? `${amt(m.revShareSol, 2)} SOL / year` : '—'}
          />
          <Row
            k="Epoch length"
            note={
              i
                ? `${i.epochsPerYear.toFixed(1)} epochs per year · ${i.epochDaysSource === 'live' ? 'measured from live slot time' : i.epochDaysSource === 'override' ? 'set by hand' : 'estimate'}`
                : undefined
            }
            v={i ? `${i.epochDays.toFixed(2)} days` : '—'}
          />
          <Row
            k="Paid per epoch"
            note="settled in definSOL"
            v={m ? `${amt(m.perEpoch.defSol)} definSOL · ${amt(m.perEpoch.sol)} SOL` : '—'}
          />
          <Row
            k="definSOL rate"
            note="rewards accrue in the rate, not as payment events"
            v={i ? `${i.exchangeRate.toFixed(6)} SOL per definSOL` : '—'}
          />
          <Row
            k="SOL price"
            note={i?.priceSource ? `${i.priceSource} · ${ago(i.priceUpdatedAt)}` : undefined}
            v={i?.solUsd != null ? usd(i.solUsd, 2) : '—'}
          />
        </tbody>
      </table>

      <div className="rs-meta">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span className="live" />
          {data ? `figures ${ago(fetchedAt)}` : 'loading…'}
        </span>
        {i?.epoch != null ? <span>epoch {i.epoch}</span> : null}
        {i?.statsUpdatedAt ? <span>pool yield {ago(i.statsUpdatedAt)}</span> : null}
        {i && i.overridden.filter((o) => o !== 'stake').length > 0 ? (
          <span style={{ color: '#f2b366' }}>what-if: {i.overridden.filter((o) => o !== 'stake').join(', ')}</span>
        ) : null}
      </div>
    </>
  );
}

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <tr>
      <td>
        {k}
        {note ? <span>{note}</span> : null}
      </td>
      <td>{v}</td>
    </tr>
  );
}
