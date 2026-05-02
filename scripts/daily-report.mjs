#!/usr/bin/env node
//
// daily-report.mjs — aggregates the previous day's events and writes an HTML
// report. Optionally appends GoAccess output for nginx-side traffic stats if
// goaccess is installed and the access log is readable.
//
// Run by deploy/daily-report.timer at 02:13 UTC. Manual:
//   node scripts/daily-report.mjs                # report for yesterday (UTC)
//   node scripts/daily-report.mjs 2026-05-02     # report for a specific day
//
// Configurable via env:
//   EVENTS_LOG_PATH   /var/lib/definity/events.jsonl
//   NGINX_ACCESS_LOG  /var/log/nginx/access.log
//   REPORTS_DIR       /var/www/definity/reports
//
// Outputs:
//   $REPORTS_DIR/YYYY-MM-DD.html         (full report)
//   $REPORTS_DIR/latest.html             (symlink to most recent)
//   $REPORTS_DIR/latest-summary.txt      (one-screen summary, also stdout)

import { readFile, writeFile, mkdir, symlink, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const EVENTS_LOG_PATH = process.env.EVENTS_LOG_PATH  || '/var/lib/definity/events.jsonl';
const NGINX_ACCESS    = process.env.NGINX_ACCESS_LOG || '/var/log/nginx/access.log';
const REPORTS_DIR     = resolve(process.env.REPORTS_DIR || '/var/www/definity/reports');

const PRIMARY_EVENTS = [
  'pageview',
  'cta_stake_jupiter',
  'cta_stake_sanctum',
  'cta_whitelist_apply',
  'whitelist_form_open',
  'outbound_solscan',
  'outbound_telegram',
  'outbound_twitter',
  'outbound_github',
];

function yesterdayUtc() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function loadEvents(date) {
  if (!existsSync(EVENTS_LOG_PATH)) {
    return { lines: [], available: false };
  }
  const raw = await readFile(EVENTS_LOG_PATH, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      const o = JSON.parse(line);
      if (typeof o?.ts === 'string' && o.ts.slice(0, 10) === date) out.push(o);
    } catch { /* skip malformed */ }
  }
  return { lines: out, available: true };
}

function aggregate(rows) {
  const eventCounts = new Map();
  const pageViews   = new Map();
  const refHosts    = new Map();
  const eventByPage = new Map(); // event -> Map(page -> count)

  for (const r of rows) {
    const ev = r.event || 'unknown';
    eventCounts.set(ev, (eventCounts.get(ev) || 0) + 1);

    if (ev === 'pageview') {
      const p = r.page || '/';
      pageViews.set(p, (pageViews.get(p) || 0) + 1);
      if (r.refHost) refHosts.set(r.refHost, (refHosts.get(r.refHost) || 0) + 1);
    } else {
      const map = eventByPage.get(ev) || new Map();
      const p = r.page || '/';
      map.set(p, (map.get(p) || 0) + 1);
      eventByPage.set(ev, map);
    }
  }

  return {
    total: rows.length,
    eventCounts: [...eventCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ event: k, count: v })),
    pageViews: [...pageViews.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([page, count]) => ({ page, count })),
    referrers: [...refHosts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([host, count]) => ({ host, count })),
    eventByPage: [...eventByPage.entries()].map(([event, m]) => ({
      event,
      breakdown: [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([page, count]) => ({ page, count })),
    })),
  };
}

function funnel(agg) {
  const get = (ev) => agg.eventCounts.find((e) => e.event === ev)?.count || 0;
  const pageviews = get('pageview');
  const stakeClicks = get('cta_stake_jupiter') + get('cta_stake_sanctum');
  const whitelistClicks = get('cta_whitelist_apply');
  const formOpens = get('whitelist_form_open');
  const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—');
  return [
    { step: 'Page views',                       value: pageviews,        rate: '100%' },
    { step: 'Clicked Stake on Jupiter/Sanctum', value: stakeClicks,      rate: pct(stakeClicks, pageviews) },
    { step: 'Clicked Apply for whitelisting',   value: whitelistClicks,  rate: pct(whitelistClicks, pageviews) },
    { step: 'Opened whitelist form',            value: formOpens,        rate: pct(formOpens, whitelistClicks) },
  ];
}

async function maybeGoaccess(date) {
  try {
    await exec('which', ['goaccess']);
  } catch {
    return null;
  }
  if (!existsSync(NGINX_ACCESS)) return null;
  try {
    const { stdout } = await exec('goaccess', [
      NGINX_ACCESS,
      '--log-format=COMBINED',
      '-o', '-',
      '--no-global-config',
      '--ignore-crawlers',
      '--anonymize-ip',
      '--html-report-title=Definity nginx ' + date,
    ], { maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    return `<!-- goaccess failed: ${escapeHtml(err.message || String(err))} -->`;
  }
}

function renderHtml({ date, total, agg, funnelRows, goaccessHtml, eventsAvailable }) {
  const css = `
    :root { color-scheme: light; }
    body { font: 15px/1.5 -apple-system, system-ui, sans-serif; color: #0d1014; background: #fff; max-width: 960px; margin: 32px auto; padding: 0 20px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    h2 { font-size: 18px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #ecedf3; }
    .meta { color: #52566a; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f0f1f5; font-variant-numeric: tabular-nums; }
    th { font-weight: 600; color: #52566a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
    td.num { text-align: right; font-feature-settings: 'tnum'; }
    .empty { color: #8a8e9e; font-style: italic; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: linear-gradient(135deg, #14F195, #9945FF); color: white; font-size: 11px; font-weight: 600; }
    details { margin: 12px 0; }
    summary { cursor: pointer; padding: 8px 0; font-weight: 600; color: #52566a; }
  `;

  const eventCountsTable = agg.eventCounts.length
    ? `<table>
        <thead><tr><th>Event</th><th class="num">Count</th></tr></thead>
        <tbody>${agg.eventCounts.map((r) =>
          `<tr><td>${escapeHtml(r.event)}</td><td class="num">${r.count}</td></tr>`,
        ).join('')}</tbody>
       </table>`
    : '<p class="empty">No events recorded for this day.</p>';

  const pageViewsTable = agg.pageViews.length
    ? `<table>
        <thead><tr><th>Page</th><th class="num">Views</th></tr></thead>
        <tbody>${agg.pageViews.map((r) =>
          `<tr><td>${escapeHtml(r.page)}</td><td class="num">${r.count}</td></tr>`,
        ).join('')}</tbody>
       </table>`
    : '<p class="empty">No page views recorded.</p>';

  const referrersTable = agg.referrers.length
    ? `<table>
        <thead><tr><th>Referrer host</th><th class="num">Visits</th></tr></thead>
        <tbody>${agg.referrers.map((r) =>
          `<tr><td>${escapeHtml(r.host)}</td><td class="num">${r.count}</td></tr>`,
        ).join('')}</tbody>
       </table>`
    : '<p class="empty">No external referrers (most visits were direct or had referrers stripped).</p>';

  const funnelTable = `<table>
    <thead><tr><th>Step</th><th class="num">Count</th><th class="num">Rate</th></tr></thead>
    <tbody>${funnelRows.map((r) =>
      `<tr><td>${escapeHtml(r.step)}</td><td class="num">${r.value}</td><td class="num">${r.rate}</td></tr>`,
    ).join('')}</tbody>
  </table>`;

  const eventByPageDetails = agg.eventByPage.length
    ? agg.eventByPage.map((bucket) => `
        <details>
          <summary>${escapeHtml(bucket.event)} — by page</summary>
          <table>
            <thead><tr><th>Page</th><th class="num">Count</th></tr></thead>
            <tbody>${bucket.breakdown.map((r) =>
              `<tr><td>${escapeHtml(r.page)}</td><td class="num">${r.count}</td></tr>`,
            ).join('')}</tbody>
          </table>
        </details>`).join('')
    : '<p class="empty">No event breakdowns.</p>';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Definity — Daily report ${escapeHtml(date)}</title>
<style>${css}</style>
</head><body>
  <h1><span class="pill">DAILY</span> Definity report</h1>
  <p class="meta">${escapeHtml(date)} (UTC) · ${total} total events ${eventsAvailable ? '' : '· events log not yet present'}</p>

  <h2>Conversion funnel</h2>
  ${funnelTable}

  <h2>Top pages</h2>
  ${pageViewsTable}

  <h2>Top referrers</h2>
  ${referrersTable}

  <h2>All events</h2>
  ${eventCountsTable}

  <h2>Event breakdown by page</h2>
  ${eventByPageDetails}

  ${goaccessHtml ? `<h2>Server traffic (GoAccess)</h2><iframe srcdoc="${escapeHtml(goaccessHtml)}" style="width:100%;height:1200px;border:1px solid #ecedf3;border-radius:8px;"></iframe>` : ''}
</body></html>`;
}

function renderText({ date, total, agg, funnelRows, eventsAvailable }) {
  const lines = [];
  lines.push(`Definity daily report — ${date} (UTC)`);
  lines.push(`==========================================`);
  if (!eventsAvailable) lines.push('NOTE: events log not yet present.');
  lines.push(`Total events: ${total}`);
  lines.push('');
  lines.push('Conversion funnel:');
  for (const r of funnelRows) {
    lines.push(`  ${r.step.padEnd(40)} ${String(r.value).padStart(6)}   ${r.rate.padStart(7)}`);
  }
  lines.push('');
  lines.push('Top pages:');
  if (!agg.pageViews.length) lines.push('  (none)');
  for (const r of agg.pageViews.slice(0, 10)) {
    lines.push(`  ${r.page.padEnd(40)} ${String(r.count).padStart(6)}`);
  }
  lines.push('');
  lines.push('Top referrers:');
  if (!agg.referrers.length) lines.push('  (none)');
  for (const r of agg.referrers.slice(0, 10)) {
    lines.push(`  ${r.host.padEnd(40)} ${String(r.count).padStart(6)}`);
  }
  lines.push('');
  lines.push('All events:');
  for (const r of agg.eventCounts) {
    lines.push(`  ${r.event.padEnd(40)} ${String(r.count).padStart(6)}`);
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const date = process.argv[2] || yesterdayUtc();
  await mkdir(REPORTS_DIR, { recursive: true });

  const { lines, available: eventsAvailable } = await loadEvents(date);
  const agg = aggregate(lines);
  const funnelRows = funnel(agg);

  const goaccessHtml = await maybeGoaccess(date);

  const html = renderHtml({ date, total: lines.length, agg, funnelRows, goaccessHtml, eventsAvailable });
  const text = renderText({ date, total: lines.length, agg, funnelRows, eventsAvailable });

  const htmlPath = `${REPORTS_DIR}/${date}.html`;
  await writeFile(htmlPath, html, 'utf8');

  // Update latest.html (real file, not symlink — easier to serve via nginx static)
  await writeFile(`${REPORTS_DIR}/latest.html`, html, 'utf8');
  await writeFile(`${REPORTS_DIR}/latest-summary.txt`, text, 'utf8');

  // Emit summary to stdout so journalctl shows it
  process.stdout.write(text);
}

main().catch((err) => {
  console.error('daily-report:', err);
  process.exit(1);
});
