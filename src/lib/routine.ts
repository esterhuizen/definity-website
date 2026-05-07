// Server-side helper for firing the Anthropic Claude Code Routine that
// processes new validator-whitelist applications.
//
// Same minimal-fetch pattern as src/lib/notion.ts — best-effort, never
// throws. The /api/whitelist endpoint calls this AFTER it has already
// captured the application durably (JSONL on disk + Notion page) so a
// failure here is non-fatal.
//
// Env it reads at runtime (set in /etc/default/definity{,-staging}.env via
// systemd EnvironmentFile=):
//
//   WHITELIST_ROUTINE_TOKEN  - Anthropic API token with routine-fire scope
//                              (sk-ant-oat01-... or similar)
//   WHITELIST_ROUTINE_ID     - the trig_xxx... id, e.g. trig_0173pKnxbQKJuDD6JZNbYXMR
//   NOTION_TITLE_PREFIX      - reused from the Notion integration; if set
//                              (staging only, to "[TEST]") it's prepended
//                              to the text payload so the routine can tell
//                              which environment fired it
//
// All three optional. If WHITELIST_ROUTINE_TOKEN or WHITELIST_ROUTINE_ID
// is missing, fireRoutine() returns { ok: false, reason: 'not_configured' }
// and the caller continues without firing.

const API_BASE = 'https://api.anthropic.com/v1/claude_code/routines';

export type RoutineFireResult =
  | { ok: true; status: number; sessionId?: string; sessionUrl?: string }
  | {
      ok: false;
      reason: 'not_configured' | 'http_error' | 'network_error' | 'timeout';
      detail?: string;
    };

export async function fireWhitelistRoutine(notionPageUrl: string | null): Promise<RoutineFireResult> {
  const token = process.env.WHITELIST_ROUTINE_TOKEN;
  const triggerId = process.env.WHITELIST_ROUTINE_ID;
  if (!token || !triggerId) return { ok: false, reason: 'not_configured' };

  const prefix = (process.env.NOTION_TITLE_PREFIX || '').trim();
  const subject = notionPageUrl
    ? `New whitelist application: ${notionPageUrl}`
    : 'New whitelist application (Notion page URL not available; see /var/lib/definity/whitelist-applications.jsonl).';
  const text = prefix ? `${prefix} ${subject}` : subject;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(triggerId)}/fire`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    const isAbort = e instanceof DOMException && e.name === 'TimeoutError';
    return {
      ok: false,
      reason: isAbort ? 'timeout' : 'network_error',
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, reason: 'http_error', detail: `${res.status} ${detail.slice(0, 300)}` };
  }

  // Best-effort: parse the response so we can log the spawned session for traceability.
  let sessionId: string | undefined;
  let sessionUrl: string | undefined;
  try {
    const data = (await res.json()) as { claude_code_session_id?: string; claude_code_session_url?: string };
    sessionId  = data.claude_code_session_id;
    sessionUrl = data.claude_code_session_url;
  } catch { /* ignore */ }

  return { ok: true, status: res.status, sessionId, sessionUrl };
}
