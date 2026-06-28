import { NextResponse } from 'next/server';
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// Instant directed-stake ingest (webhook). The widget POSTs a deposit's
// signature the moment it confirms; we fetch the tx on-chain, confirm it really
// is a `direct:`/`ref:` DepositSol into OUR pool, and append it to the webhook
// registry — so the dashboard reflects it within seconds instead of waiting for
// the 5-min cron. Spoof-proof: only a genuine on-chain directed deposit records
// (we never trust the POST body beyond the signature). The cron remains the
// backstop for anything the webhook misses (failed POST, external deposits); the
// requests API dedups the two by signature.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_PATH = process.env.DIRECTED_WEBHOOK_PATH ?? '/var/lib/definity-staging/directed-stake-webhook.jsonl';
const UPSTREAM = process.env.SOLANA_RPC_URL;
const POOL = 'Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL';
const POOL_PROGRAM = 'SPMBzsVUuoHA4Jm6KunbsotaahvVikZs1JyTW6iJvbn';
const DEFINSOL_MINT = 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA';
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const DEPOSIT_SOL_IX = 14;
const DEPOSIT_STAKE_IX = 9;
const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Decode(s: string): Buffer {
  let n = 0n;
  for (const c of s) {
    const v = B58.indexOf(c);
    if (v < 0) throw new Error('bad base58');
    n = n * 58n + BigInt(v);
  }
  const out: number[] = [];
  while (n > 0n) {
    out.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c === '1') out.unshift(0);
    else break;
  }
  return Buffer.from(out);
}

type Directed = { validatorVote?: string; partnerCode?: string };
function parseDirectedMemo(text: string): Directed | null {
  if (!text) return null;
  const out: Directed = {};
  for (const part of text.trim().split('&')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).trim();
    if (key === 'direct' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val)) out.validatorVote = val;
    else if (key === 'ref' && val) out.partnerCode = val;
  }
  return out.validatorVote || out.partnerCode ? out : null;
}

type TokenBalance = { mint: string; owner?: string; uiTokenAmount: { amount: string } };
type ParsedTx = {
  slot: number;
  blockTime?: number | null;
  meta?: { err: unknown | null; preTokenBalances?: TokenBalance[]; postTokenBalances?: TokenBalance[] } | null;
  transaction?: { message?: { accountKeys?: Array<{ pubkey: string } | string>; instructions?: Array<{ programId?: string; program?: string; parsed?: unknown; accounts?: string[]; data?: string }> } };
};

/** LST minted to `owner` of `mint` in this tx = post − pre token balance (decimal). */
function mintedToOwner(tx: ParsedTx, owner: string, mint: string): number | null {
  const meta = tx.meta;
  if (!meta) return null;
  const sum = (arr?: TokenBalance[]) =>
    (arr ?? []).filter((b) => b.mint === mint && b.owner === owner).reduce((a, b) => a + BigInt(b.uiTokenAmount.amount), 0n);
  const delta = sum(meta.postTokenBalances) - sum(meta.preTokenBalances);
  return delta > 0n ? Number(delta) / 1e9 : null;
}

function extract(tx: ParsedTx | null, signature: string) {
  if (!tx || tx.meta?.err) return null;
  const ixs = tx.transaction?.message?.instructions ?? [];
  let memoText: string | null = null;
  for (const ix of ixs) {
    if (ix.programId !== MEMO_PROGRAM && ix.program !== 'spl-memo') continue;
    if (typeof ix.parsed === 'string') { memoText = ix.parsed; break; }
    if (ix.data) { try { memoText = base58Decode(ix.data).toString('utf8'); break; } catch { /* skip */ } }
  }
  if (!memoText) return null;
  const directed = parseDirectedMemo(memoText);
  if (!directed) return null;

  let depositor: string | null = null;
  let depositLamports: number | null = null;
  let isDeposit = false;
  for (const ix of ixs) {
    if (ix.programId !== POOL_PROGRAM || !ix.accounts || !ix.data) continue;
    let bytes: Buffer;
    try { bytes = base58Decode(ix.data); } catch { continue; }
    if (ix.accounts[0] !== POOL) continue;
    if (bytes[0] === DEPOSIT_SOL_IX) {
      isDeposit = true;
      depositor = ix.accounts[3] ?? null;
      depositLamports = bytes.length >= 9 ? Number(bytes.readBigUInt64LE(1)) : null;
      break;
    }
    if (bytes[0] === DEPOSIT_STAKE_IX) { isDeposit = true; break; }
  }
  if (!isDeposit) return null;
  if (!depositor) {
    const k = tx.transaction?.message?.accountKeys?.[0];
    depositor = k ? (typeof k === 'string' ? k : k.pubkey) : null;
  }
  if (!depositor) return null;

  const kind = directed.validatorVote && directed.partnerCode ? 'both' : directed.validatorVote ? 'retail' : 'partner';
  return {
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    depositor,
    kind,
    validatorVote: directed.validatorVote ?? null,
    partnerCode: directed.partnerCode ?? null,
    depositLamports,
    depositSol: depositLamports != null ? depositLamports / 1e9 : null,
    mintedDefinsol: mintedToOwner(tx, depositor, DEFINSOL_MINT),
    via: 'webhook',
  };
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(UPSTREAM!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result as T;
}

export async function POST(req: Request) {
  if (!UPSTREAM) return NextResponse.json({ ok: false, error: 'RPC not configured' }, { status: 503 });
  let signature: string | undefined;
  try {
    signature = (await req.json())?.signature;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad body' }, { status: 400 });
  }
  if (!signature || !SIG_RE.test(signature)) {
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 400 });
  }

  // The tx may need a moment to confirm; poll a few times.
  let tx: ParsedTx | null = null;
  for (let i = 0; i < 6; i++) {
    tx = await rpc<ParsedTx | null>('getTransaction', [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
    if (tx) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!tx) return NextResponse.json({ ok: false, status: 'pending', note: 'tx not yet confirmed — the cron will pick it up' });

  const entry = extract(tx, signature);
  if (!entry) return NextResponse.json({ ok: false, status: 'not_directed', note: 'not a direct:/ref: deposit into the pool' });

  // Best-effort dedup; the requests API also dedups by signature on read.
  try {
    const existing = await readFile(WEBHOOK_PATH, 'utf8').catch(() => '');
    if (existing.includes(signature)) {
      return NextResponse.json({ ok: true, status: 'duplicate', entry });
    }
    await mkdir(dirname(WEBHOOK_PATH), { recursive: true }).catch(() => {});
    await appendFile(WEBHOOK_PATH, JSON.stringify(entry) + '\n');
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: 'recorded', entry });
}
