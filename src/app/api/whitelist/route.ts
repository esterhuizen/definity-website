import { NextResponse } from 'next/server';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  createWhitelistApplication,
  type ContactMethod,
  type WhitelistApplication,
} from '@/lib/notion';
import { fireWhitelistRoutine } from '@/lib/routine';
import { sendWhitelistTelegram } from '@/lib/telegram';

// Same first-party design as /api/track:
//   1. Validate strictly. Reject silently with 400 on bad input.
//   2. Write to a JSONL file on disk FIRST — that's the durable record.
//      If Notion is down or our token is wrong, the data still lands.
//   3. Best-effort POST to the Notion DB. Failure is logged but doesn't
//      change the user-facing outcome (we already captured them).
//
// No cookies. No IP recorded. UA is captured for spam triage only.

const CONTACT_METHODS: readonly ContactMethod[] = [
  'Email',
  'Telegram',
  'X / Twitter',
  'Other',
];

const MAX = {
  voteId: 64,
  country: 80,
  contribution: 4000,
  contactId: 200,
  xHandles: 400,
};

const MIN_CONTRIBUTION = 20;

type Errors = Partial<Record<keyof WhitelistApplication | 'honeypot' | '_form', string>>;

function asTrimmedString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

function validate(body: unknown): { ok: true; app: WhitelistApplication } | { ok: false; errors: Errors } {
  if (!body || typeof body !== 'object') return { ok: false, errors: { _form: 'Bad request body.' } };
  const b = body as Record<string, unknown>;

  // Honeypot — bots auto-fill, real users never see this field.
  if (typeof b.url === 'string' && b.url.length > 0) {
    return { ok: false, errors: { honeypot: 'rejected' } };
  }

  const errors: Errors = {};
  const voteId = asTrimmedString(b.voteId, MAX.voteId);
  const country = asTrimmedString(b.country, MAX.country);
  const contribution = asTrimmedString(b.contribution, MAX.contribution);
  const contactId = asTrimmedString(b.contactId, MAX.contactId);
  const xHandles = asTrimmedString(b.xHandles, MAX.xHandles);

  if (!voteId) errors.voteId = "Validator's vote id is required.";
  if (!country) errors.country = "Country is required.";
  if (!contribution) errors.contribution = 'Please describe your contributions.';
  else if (contribution.length < MIN_CONTRIBUTION) {
    errors.contribution = `A bit more detail please (at least ${MIN_CONTRIBUTION} characters).`;
  }
  if (!contactId) errors.contactId = 'Contact ID is required.';
  if (!xHandles) errors.xHandles = 'Please share at least one X handle.';

  const cm = typeof b.contactMethod === 'string' ? b.contactMethod : '';
  if (!CONTACT_METHODS.includes(cm as ContactMethod)) {
    errors.contactMethod = 'Pick one of: ' + CONTACT_METHODS.join(', ') + '.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    app: {
      voteId: voteId!,
      country: country!,
      contribution: contribution!,
      contactMethod: cm as ContactMethod,
      contactId: contactId!,
      xHandles: xHandles!,
    },
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: { _form: 'Bad JSON.' } }, { status: 400 });
  }

  const result = validate(body);
  if (!result.ok) {
    // Honeypot trip → 204 (look indistinguishable from a successful submit
    // so bots don't learn the field name from a 400 response).
    if (result.errors.honeypot) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
  }

  const submittedAt = new Date().toISOString();
  const ua = (req.headers.get('user-agent') || '').slice(0, 200);

  // 1. Durable record: append to JSONL on disk before we touch the network.
  const logPath = process.env.WHITELIST_LOG_PATH || '/var/lib/definity/whitelist-applications.jsonl';
  const entry = { ts: submittedAt, ua, ...result.app };
  try {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) {
    // If we can't write to disk, refuse — Notion alone is not enough of a
    // backstop. Returns 500 so the form shows a try-again message.
    console.error('[whitelist] disk-write failed:', e);
    return NextResponse.json(
      { ok: false, errors: { _form: 'Could not save your application. Please try again or reach us via Telegram.' } },
      { status: 500 },
    );
  }

  // 2. Best-effort: push to Notion. We've already captured the data.
  const notion = await createWhitelistApplication(result.app, submittedAt);
  if (!notion.ok) {
    console.warn(`[whitelist] notion write skipped/failed: ${notion.reason}`);
  }

  const notionPageUrl = notion.ok ? notion.url : null;

  // 3. Best-effort: fire the routine that processes new applications.
  const routine = await fireWhitelistRoutine(notionPageUrl);
  if (routine.ok) {
    console.info(`[whitelist] routine fired: session=${routine.sessionId || '?'}`);
  } else {
    console.warn(`[whitelist] routine fire skipped/failed: ${routine.reason}`);
  }

  // 4. Best-effort: ping operator's Telegram so they see new applications
  //    without having to refresh Notion. Same skip-on-failure semantics.
  const tg = await sendWhitelistTelegram(result.app, notionPageUrl);
  if (tg.ok) {
    console.info('[whitelist] telegram sent');
  } else {
    console.warn(`[whitelist] telegram skipped/failed: ${tg.reason}${'detail' in tg && tg.detail ? ` — ${tg.detail}` : ''}`);
  }

  return NextResponse.json({ ok: true });
}
