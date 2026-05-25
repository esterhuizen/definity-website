#!/usr/bin/env node
// backfill-notion-whitelist.mjs — reconcile the durable JSONL log against
// the Notion "Validator Applications" database.
//
// The /api/whitelist endpoint writes every submission to a JSONL file
// FIRST, then best-effort POSTs to Notion. When Notion is briefly down
// (or auth/schema/rate-limited), the JSONL captures the data but the
// Notion row is never created. This script finds those orphans and
// creates them.
//
// Modes:
//   --vote-id <id>         backfill a single entry by voteId (verbose)
//   --all                  scan the full JSONL, create any missing Notion rows
//   --dry-run              don't create anything, just print what would happen
//   --jsonl <path>         override $WHITELIST_LOG_PATH (default: env or
//                          /var/lib/definity/whitelist-applications.jsonl)
//
// Env required (matches the /api/whitelist runtime):
//   NOTION_TOKEN, NOTION_DATABASE_ID
//   NOTION_TITLE_PREFIX    optional, e.g. "[TEST] " on staging
//
// Designed to be safe to run repeatedly: queries Notion by voteId substring
// before creating, so re-running is a no-op for rows that already exist.

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const NOTION_VERSION = '2022-06-28';
const PAGES_ENDPOINT = 'https://api.notion.com/v1/pages';
// Notion caps a single rich_text block at 2000 chars. The form allows up to
// 4000 chars for contribution, so anything over 2000 must be split across
// multiple blocks (Notion concatenates them visually).
const RICH_TEXT_BLOCK_LIMIT = 2000;

function richText(content) {
  if (content == null || content === '') return [];
  const chunks = [];
  for (let i = 0; i < content.length; i += RICH_TEXT_BLOCK_LIMIT) {
    chunks.push({ text: { content: content.slice(i, i + RICH_TEXT_BLOCK_LIMIT) } });
  }
  return chunks;
}

function parseCli() {
  const { values } = parseArgs({
    options: {
      'vote-id': { type: 'string' },
      all:       { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      jsonl:     { type: 'string' },
      help:      { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  if (values.help) { printHelp(); process.exit(0); }
  if (!values['vote-id'] && !values.all) {
    console.error('error: pass --vote-id <id> OR --all');
    printHelp();
    process.exit(2);
  }
  return values;
}

function printHelp() {
  console.log(`backfill-notion-whitelist — reconcile whitelist JSONL against Notion

Usage:
  node scripts/backfill-notion-whitelist.mjs --vote-id <id> [--dry-run]
  node scripts/backfill-notion-whitelist.mjs --all [--dry-run]

Options:
  --vote-id <id>   backfill a single entry by voteId
  --all            scan the full JSONL, create any missing Notion rows
  --dry-run        print what would happen, don't write to Notion
  --jsonl <path>   override $WHITELIST_LOG_PATH location
`);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`error: ${name} not set`); process.exit(2); }
  return v;
}

async function readJsonlEntries(path) {
  const raw = await readFile(path, 'utf8');
  const out = [];
  let lineno = 0;
  for (const line of raw.split('\n')) {
    lineno++;
    if (!line.trim()) continue;
    try {
      out.push({ lineno, entry: JSON.parse(line) });
    } catch {
      console.warn(`  warn: line ${lineno} not valid JSON, skipping`);
    }
  }
  return out;
}

/**
 * Query Notion for an existing row whose title contains the voteId. Returns
 * true if at least one match exists. Uses POST /v1/databases/<id>/query with
 * the title-property filter — works whether the DB is single-source or
 * multi-source under the new data-sources model.
 */
async function notionRowExists(token, databaseId, voteId) {
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: {
        property: 'Operator / Vote ID',
        title: { contains: voteId },
      },
      page_size: 1,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Notion query failed: ${res.status} ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return Array.isArray(data.results) && data.results.length > 0;
}

/**
 * Create a single page in the Validator Applications DB. Mirrors the property
 * set in src/lib/notion.ts:createWhitelistApplication. Throws on HTTP failure
 * with status + Notion error body in the message.
 */
async function createNotionPage(token, databaseId, titlePrefix, entry) {
  const title = titlePrefix ? `${titlePrefix} ${entry.voteId}` : entry.voteId;
  const submittedAtIso = entry.ts ?? new Date().toISOString();
  const body = {
    parent: { database_id: databaseId },
    properties: {
      'Operator / Vote ID': { title: [{ text: { content: title } }] },
      'Country (submitted)': { rich_text: richText(entry.country) },
      'Contribution detail': { rich_text: richText(entry.contribution) },
      'Contact method': { select: { name: entry.contactMethod } },
      'Contact ID': { rich_text: richText(entry.contactId) },
      'X handles': { rich_text: richText(entry.xHandles) },
      'Submitted at': { date: { start: submittedAtIso } },
      Status: { select: { name: 'Pending' } },
    },
  };
  const res = await fetch(PAGES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Notion create failed: ${res.status} ${detail.slice(0, 500)}`);
  }
  return await res.json();
}

async function main() {
  const args = parseCli();
  const token = requireEnv('NOTION_TOKEN');
  const databaseId = requireEnv('NOTION_DATABASE_ID');
  const titlePrefix = (process.env.NOTION_TITLE_PREFIX || '').trim();
  const jsonlPath = args.jsonl
    || process.env.WHITELIST_LOG_PATH
    || '/var/lib/definity/whitelist-applications.jsonl';

  console.log(`reading ${jsonlPath}`);
  const all = await readJsonlEntries(jsonlPath);
  console.log(`  ${all.length} entries`);

  let candidates;
  if (args['vote-id']) {
    const id = args['vote-id'];
    candidates = all.filter((e) => e.entry.voteId === id);
    if (candidates.length === 0) {
      console.error(`error: no entry with voteId="${id}" found in JSONL`);
      process.exit(1);
    }
    if (candidates.length > 1) {
      console.log(`  found ${candidates.length} entries with voteId="${id}" — processing all`);
    }
  } else {
    candidates = all;
  }

  let created = 0, skipped = 0, failed = 0;
  for (const { lineno, entry } of candidates) {
    const tag = `[line ${lineno}] ${entry.voteId.slice(0, 12)}…`;
    let exists;
    try {
      exists = await notionRowExists(token, databaseId, entry.voteId);
    } catch (e) {
      console.error(`  ✗ ${tag}  ${e.message}`);
      failed++;
      continue;
    }
    if (exists) {
      console.log(`  · ${tag}  already in Notion`);
      skipped++;
      continue;
    }
    if (args['dry-run']) {
      console.log(`  ⊙ ${tag}  WOULD CREATE (submitted=${entry.ts ?? '?'})`);
      continue;
    }
    try {
      const page = await createNotionPage(token, databaseId, titlePrefix, entry);
      console.log(`  ✓ ${tag}  CREATED → ${page.url ?? page.id}`);
      created++;
    } catch (e) {
      console.error(`  ✗ ${tag}  ${e.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`done: ${created} created, ${skipped} already-present, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('fatal:', e?.message ?? e);
  process.exit(1);
});
