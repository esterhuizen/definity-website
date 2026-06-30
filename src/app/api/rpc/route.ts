import { NextResponse } from 'next/server';

// Same-origin Solana RPC proxy.
//
// The /stake dapp talks to this route instead of an RPC endpoint directly, so:
//   • the upstream RPC key (Helius etc.) stays SERVER-SIDE — never shipped to
//     the browser in a NEXT_PUBLIC_ var;
//   • browser requests are same-origin, covered by the existing CSP
//     `connect-src 'self'` — no CSP change needed;
//   • we can allowlist methods and cap body size to keep this from becoming
//     an open relay.
//
// Configure the upstream with SOLANA_RPC_URL (server-only env). If unset, the
// route 503s rather than leaking to a default.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.SOLANA_RPC_URL;
const MAX_BODY_BYTES = 16 * 1024;

// Read-only + the calls the deposit flow needs. No account-mutating RPC exists
// anyway (txs are signed client-side and submitted via sendTransaction), but we
// keep an explicit allowlist so this can't be repurposed as a generic relay.
const ALLOWED_METHODS = new Set([
  'getLatestBlockhash',
  'getAccountInfo',
  'getMultipleAccounts',
  'getBalance',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getMinimumBalanceForRentExemption',
  'getFeeForMessage',
  'getSignatureStatuses',
  'getEpochInfo',
  'getSlot',
  'sendTransaction',
  'simulateTransaction',
  'isBlockhashValid',
]);

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

// Embeds on validator domains call this proxy cross-origin (read-only methods
// only — the wallet submits the signed tx itself), so allow CORS.
export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request): Promise<Response> {
  const res = await handlePost(req);
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

async function handlePost(req: Request): Promise<Response> {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'RPC not configured' }, { status: 503 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  // Accept a single JSON-RPC call or a batch; every method must be allowlisted.
  const calls = Array.isArray(body) ? body : [body];
  for (const c of calls) {
    const method = (c as { method?: unknown })?.method;
    if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
      return NextResponse.json({ error: `method not allowed: ${String(method)}` }, { status: 403 });
    }
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'upstream RPC error', detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
