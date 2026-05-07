import { NextResponse } from 'next/server';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// First-party event ingest.
// - Same-origin POST only (no cookies set, no CORS exposed).
// - Validated against an explicit allowlist so a stranger can't fill the log
//   with arbitrary event names.
// - Appends one JSON line per event to EVENTS_LOG_PATH. The daily report
//   script reads this file and aggregates yesterday's slice.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENTS_LOG_PATH = process.env.EVENTS_LOG_PATH || '/var/lib/definity/events.jsonl';

const ALLOWED_EVENTS = new Set([
  // implicit page views
  'pageview',
  // primary CTAs
  'cta_stake_jupiter',
  'cta_stake_sanctum',
  'cta_whitelist_apply',
  // outbound links worth measuring
  'outbound_solscan',
  'outbound_telegram',
  'outbound_twitter',
  // form-funnel
  'whitelist_form_open',
  'whitelist_form_submit_attempt',
  'whitelist_form_submit_success',
  'whitelist_form_submit_error',
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return new NextResponse(null, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const event = typeof b.event === 'string' ? b.event : null;
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return new NextResponse(null, { status: 400 });
  }

  const page = typeof b.page === 'string' ? b.page.slice(0, 200) : '';
  const ref  = typeof b.referrer === 'string' ? b.referrer.slice(0, 200) : '';
  const ua   = (req.headers.get('user-agent') || '').slice(0, 200);

  // Coarse referrer host only — we don't want to log full URLs with query
  // strings that might carry a third-party's tracking parameters.
  let refHost = '';
  if (ref) {
    try { refHost = new URL(ref).host; } catch { /* keep blank */ }
  }

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    page,
    refHost,
    ua,
  }) + '\n';

  try {
    await mkdir(dirname(EVENTS_LOG_PATH), { recursive: true });
    await appendFile(EVENTS_LOG_PATH, line, 'utf8');
  } catch (err) {
    // Don't 500 the user for a logging failure — silently swallow.
    console.error('events log append failed:', err);
  }

  // 204 No Content — sendBeacon doesn't read response bodies anyway.
  return new NextResponse(null, { status: 204 });
}
