import { NextResponse } from 'next/server';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createPublicKey, verify as edVerify } from 'node:crypto';
import { getBase58Encoder } from '@solana/kit';
import { canonicalDirectStakeMessage } from '@/lib/direct-stake';

export const runtime = 'nodejs';

// Tracking for direct-stake REQUESTS. Same durable-first design as /api/whitelist:
//   1. Validate strictly.
//   2. Verify the wallet actually signed this exact request (ed25519).
//   3. Append to a JSONL file on disk — the durable, operator-inspectable record.
//
// No funds move: this records a user's/partner's intent (which wallet wants
// `amountSol` directed to which validators) so Definity can direct it when the
// program goes live. The signature makes the record non-repudiable — anyone can
// POST, but only the key holder can produce a valid signature over the message.

const B58_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const B58_SIG = /^[1-9A-HJ-NP-Za-km-z]{64,128}$/;
const MAX_VALIDATORS = 10;

// Wrap a raw 32-byte ed25519 public key in SPKI DER so node:crypto can verify it.
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function verifyEd25519(messageUtf8: string, walletB58: string, sigB58: string): boolean {
  try {
    const enc = getBase58Encoder();
    const pubRaw = Buffer.from(enc.encode(walletB58));
    if (pubRaw.length !== 32) return false;
    const sig = Buffer.from(enc.encode(sigB58));
    if (sig.length !== 64) return false;
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, pubRaw]),
      format: 'der',
      type: 'spki',
    });
    return edVerify(null, Buffer.from(messageUtf8, 'utf8'), key, sig);
  } catch {
    return false;
  }
}

type DirectStakeRequest = {
  wallet: string;
  validators: string[];
  amountSol: number;
  ts: string;
  signature: string;
};

function validate(body: unknown): { ok: true; req: DirectStakeRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Bad request.' };
  const b = body as Record<string, unknown>;

  const wallet = typeof b.wallet === 'string' ? b.wallet.trim() : '';
  if (!B58_KEY.test(wallet)) return { ok: false, error: 'Invalid wallet address.' };

  const validators = Array.isArray(b.validators)
    ? b.validators.filter((v): v is string => typeof v === 'string' && B58_KEY.test(v.trim())).map((v) => v.trim())
    : [];
  if (validators.length < 1 || validators.length > MAX_VALIDATORS) {
    return { ok: false, error: 'Select 1–10 valid validators.' };
  }

  const amountSol = typeof b.amountSol === 'number' ? b.amountSol : Number(b.amountSol);
  if (!Number.isFinite(amountSol) || amountSol <= 0 || amountSol > 1e9) {
    return { ok: false, error: 'Invalid amount.' };
  }

  // ISO timestamp the client put in the signed message. Must be a recent, sane
  // string (also limits replay to a window).
  const ts = typeof b.ts === 'string' ? b.ts.trim() : '';
  const tms = Date.parse(ts);
  if (!ts || ts.length > 40 || Number.isNaN(tms) || Math.abs(Date.now() - tms) > 10 * 60_000) {
    return { ok: false, error: 'Invalid or stale timestamp.' };
  }

  const signature = typeof b.signature === 'string' ? b.signature.trim() : '';
  if (!B58_SIG.test(signature)) return { ok: false, error: 'Invalid signature.' };

  return { ok: true, req: { wallet, validators, amountSol, ts, signature } };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad JSON.' }, { status: 400 });
  }

  const v = validate(body);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  // Reconstruct the exact message from the submitted fields and require the
  // wallet's signature over it. Any tampered field → different message → invalid.
  const message = canonicalDirectStakeMessage(v.req.wallet, v.req.validators, v.req.amountSol, v.req.ts);
  if (!verifyEd25519(message, v.req.wallet, v.req.signature)) {
    return NextResponse.json({ ok: false, error: 'Signature does not match the connected wallet / request.' }, { status: 400 });
  }

  const ua = (req.headers.get('user-agent') || '').slice(0, 200);
  const id = `ds_${Date.now().toString(36)}_${v.req.wallet.slice(0, 6)}`;
  const entry = {
    id,
    ts: v.req.ts,
    receivedAt: new Date().toISOString(),
    status: 'pending',
    wallet: v.req.wallet,
    validators: v.req.validators,
    amountSol: v.req.amountSol,
    message,
    signature: v.req.signature,
    ua,
  };

  // Durable record: append to JSONL on disk. This IS the tracking store.
  const logPath = process.env.DIRECT_STAKE_LOG_PATH || '/var/lib/definity/direct-stake-requests.jsonl';
  try {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) {
    console.error('[direct-stake] disk-write failed:', e);
    return NextResponse.json(
      { ok: false, error: 'Could not save your request. Please try again or reach us on Telegram.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id });
}
