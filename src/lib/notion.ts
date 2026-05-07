// Server-side Notion client for the validator-whitelist application flow.
//
// Why minimal: we only ever do one thing — create a page in the
// "Validator Applications" database. No reads, no updates, no deletes,
// no SDK. Native fetch (Node 22) is enough.
//
// Env it reads at runtime (set in /etc/default/definity{,-staging}.env via
// systemd EnvironmentFile=). All optional — if any are missing, callers
// should fall back to JSONL-only and the /api/whitelist endpoint will
// still return 200 to the user.
//
//   NOTION_TOKEN          - integration secret (`ntn_…`)
//   NOTION_DATABASE_ID    - hex DB id from the page URL
//   NOTION_TITLE_PREFIX   - prepended to the title; staging sets "[TEST] "
//                           so we can mark test submissions in the same DB

const NOTION_VERSION = '2022-06-28';
const NOTION_PAGES_ENDPOINT = 'https://api.notion.com/v1/pages';

export type ContactMethod = 'Email' | 'Telegram' | 'X / Twitter' | 'Discord';

export type WhitelistApplication = {
  voteId: string;
  country: string;
  contribution: string;
  contactMethod: ContactMethod;
  contactId: string;
  xHandles: string;
};

export type NotionResult =
  | { ok: true; pageId: string; url: string }
  | { ok: false; reason: 'not_configured' | 'http_error' | 'network_error'; detail?: string };

export async function createWhitelistApplication(
  app: WhitelistApplication,
  submittedAtIso: string,
): Promise<NotionResult> {
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!token || !databaseId) return { ok: false, reason: 'not_configured' };

  const titlePrefix = (process.env.NOTION_TITLE_PREFIX || '').trim();
  const title = titlePrefix ? `${titlePrefix} ${app.voteId}` : app.voteId;

  const body = {
    parent: { database_id: databaseId },
    properties: {
      'Operator / Vote ID': { title: [{ text: { content: title } }] },
      'Country (submitted)': { rich_text: [{ text: { content: app.country } }] },
      'Contribution detail': { rich_text: [{ text: { content: app.contribution } }] },
      'Contact method': { select: { name: app.contactMethod } },
      'Contact ID': { rich_text: [{ text: { content: app.contactId } }] },
      'X handles': { rich_text: [{ text: { content: app.xHandles } }] },
      'Submitted at': { date: { start: submittedAtIso } },
      Status: { select: { name: 'Pending' } },
    },
  };

  let res: Response;
  try {
    res = await fetch(NOTION_PAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, reason: 'network_error', detail: e instanceof Error ? e.message : String(e) };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, reason: 'http_error', detail: `${res.status} ${detail.slice(0, 300)}` };
  }

  const data = (await res.json()) as { id: string; url: string };
  return { ok: true, pageId: data.id, url: data.url };
}
