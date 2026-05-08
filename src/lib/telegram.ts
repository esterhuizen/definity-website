// Server-side helper for pinging the operator's Telegram on a new whitelist
// application. Best-effort, never throws — /api/whitelist only logs on
// outcome.
//
// Why curl-via-execFile rather than native fetch: on this AWS host (Ubuntu
// 26 / kernel 7), Node's TLS layer specifically refuses Telegram's edge —
// kernel sends RST 25µs after SYN-ACK arrives, before TLS can start. curl,
// openssl s_client, and Node's raw `net.createConnection` all complete the
// same handshake fine; only Node TLS (fetch / tls.connect / https.request)
// hangs. Same Node binary reaches Notion + Anthropic without issue. Cause
// is unclear — could be a TLS fingerprint reject at Telegram's edge or a
// kernel/openssl quirk on this kernel — but the workaround is reliable.
// daily-report.mjs already uses execFile('goaccess', ...) for the same
// "shell out to a known-working tool" reason.
//
// Env it reads at runtime (set in /etc/default/definity{,-staging}.env via
// systemd EnvironmentFile=):
//
//   TELEGRAM_BOT_TOKEN     - bot token from @BotFather (e.g. "12345:ABCdef...")
//   TELEGRAM_CHAT_ID       - numeric chat id (positive=user, negative=group)
//   NOTION_TITLE_PREFIX    - reused; if set ("[TEST]") the message is marked
//                            so prod and staging notifications are visually
//                            distinguishable in the same chat
//
// First two missing → returns { ok: false, reason: 'not_configured' } and
// the caller skips silently.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WhitelistApplication } from '@/lib/notion';

const exec = promisify(execFile);

export type TelegramResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_configured' | 'http_error' | 'network_error' | 'timeout';
      detail?: string;
    };

export async function sendWhitelistTelegram(
  app: WhitelistApplication,
  notionPageUrl: string | null,
): Promise<TelegramResult> {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, reason: 'not_configured' };

  const prefix = (process.env.NOTION_TITLE_PREFIX || '').trim();
  const header = prefix
    ? `🧪 ${prefix} New whitelist application`
    : '🆕 New whitelist application';

  const lines: string[] = [
    header,
    '',
    `Vote ID: ${app.voteId}`,
    `Country: ${app.country}`,
    `Contact: ${app.contactMethod} · ${app.contactId}`,
    `X: ${app.xHandles}`,
  ];
  if (notionPageUrl) {
    lines.push('', `Notion: ${notionPageUrl}`);
  }
  // Telegram limits the text to 4096 chars; we're well under.
  const text = lines.join('\n');

  const body = JSON.stringify({
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });

  // execFile (no shell) means the JSON body is passed verbatim as one
  // argv element — no shell-injection vector even though body contains
  // user-entered values.
  let stdout: string;
  try {
    const r = await exec(
      '/usr/bin/curl',
      [
        '-sS',                 // silent + show errors on stderr only
        '-X', 'POST',
        '-H', 'Content-Type: application/json',
        '--max-time', '10',
        '-w', '\n%{http_code}',  // append HTTP code on its own line at the end of stdout
        '-d', body,
        `https://api.telegram.org/bot${token}/sendMessage`,
      ],
      { maxBuffer: 1 * 1024 * 1024, timeout: 12_000 },
    );
    stdout = r.stdout;
  } catch (e) {
    const err = e as { code?: string | number; killed?: boolean; signal?: string; message?: string };
    if (err.killed && err.signal === 'SIGTERM') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network_error', detail: err.message || String(e) };
  }

  // Last line of stdout is the HTTP code, everything before is the body.
  const lastNewline = stdout.lastIndexOf('\n');
  const httpCode = stdout.slice(lastNewline + 1).trim();
  const respBody = lastNewline >= 0 ? stdout.slice(0, lastNewline) : '';

  if (httpCode !== '200') {
    return { ok: false, reason: 'http_error', detail: `${httpCode} ${respBody.slice(0, 300)}` };
  }
  return { ok: true };
}
