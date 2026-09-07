import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';

// Read-only feed for the unlisted /ops/payments page: per-epoch definSOL payment
// tracking for 38qTv…Xp7c, produced by definity-payment-watch (systemd, 15-min).
// Files are written atomically (state) / append-only (jsonl) by the watcher.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIR = process.env.PAYMENT_WATCH_DIR ?? '/var/lib/definity-payment-watch';

type HistoryRow = { epoch: number; received: number; spends: number; end_balance: number | null;
  paid: boolean; partial: boolean; closed_at: number | null; source: string };
type Payment = { ts: number | null; epoch: number; amount: number; balance_after: number; sig: string | null };
type State = { ata: string; last_balance: number; epoch: number; received: number; spends: number;
  epoch_partial: boolean; alerted_overdue: boolean; last_payment_at: number | null; updated_at: number };

const readJsonl = async <T,>(path: string): Promise<T[]> => {
  try {
    return (await readFile(path, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l) as T);
  } catch { return []; }
};

export async function GET() {
  let state: State | null = null;
  try { state = JSON.parse(await readFile(`${DIR}/state.json`, 'utf8')) as State; } catch { /* absent */ }
  const history = await readJsonl<HistoryRow>(`${DIR}/history.jsonl`);
  const payments = await readJsonl<Payment>(`${DIR}/payments.jsonl`);
  // Dedupe history by epoch (a re-backfill may append duplicates; last row wins), newest first.
  const byEpoch = new Map<number, HistoryRow>();
  for (const r of history) byEpoch.set(r.epoch, r);
  const rows = [...byEpoch.values()].sort((a, b) => b.epoch - a.epoch);
  return NextResponse.json(
    { state, history: rows, payments: payments.slice(-40).reverse(), now: Date.now() },
    { headers: { 'cache-control': 'no-store' } },
  );
}
