// Recency-first (LIFO) directed target — the SINGLE source shared by the
// /requests operator view (TS) and the stats collector (fetch-pool-stats.mjs),
// so the landing card's stored figure can't drift from the operator view. Pure
// (no I/O), plain .mjs so both a TS import and a Node script can use it.
//
// A wallet's current holdings back its MOST RECENT deposits first; each still-held
// deposit earns 1× principal, plus retailMultiple× matching once it has matured
// (slot < windowStartSlot). Holdings-capped.

export const SLEEVE_CAP_SOL = 100_000; // program-wide directed-matching budget (display cap; 60k→100k 2026-08-08, matches api/direct-stake/requests SLEEVE_CAP_SOL after the Aug-5 9.7k directed principal). totalSol below = principal + matured matching (uncapped), so the full-sleeve 100k basis keeps the public hero card < 100%.

/**
 * @param {{ signature: string, depositor: string, depositSol: number, slot: number }[]} deposits
 * @param {Map<string, number>} holdingsSolByWallet  current definSOL × NAV per wallet
 * @param {number} windowStartSlot  deposits with slot < this have matured
 * @param {number} [retailMultiple]
 * @returns {{ bySig: Map<string, { plannedSol: number, backedFrac: number, matured: boolean }>, totalSol: number }}
 */
export function computeDirectedPlanned(deposits, holdingsSolByWallet, windowStartSlot, retailMultiple = 3.5) {
  const bySig = new Map();
  let totalSol = 0;
  const byWallet = new Map();
  for (const d of deposits) {
    const arr = byWallet.get(d.depositor);
    if (arr) arr.push(d);
    else byWallet.set(d.depositor, [d]);
  }
  for (const [w, ds] of byWallet) {
    const totalDep = ds.reduce((a, d) => a + d.depositSol, 0);
    let remaining = Math.min(holdingsSolByWallet.get(w) ?? 0, totalDep);
    for (const d of [...ds].sort((a, b) => b.slot - a.slot)) {
      const backed = Math.min(d.depositSol, Math.max(0, remaining));
      const backedFrac = d.depositSol > 0 ? backed / d.depositSol : 0;
      const matured = d.slot > 0 && d.slot < windowStartSlot;
      const plannedSol = (1 + (matured ? retailMultiple : 0)) * d.depositSol * backedFrac;
      bySig.set(d.signature, { plannedSol, backedFrac, matured });
      totalSol += plannedSol;
      remaining -= backed;
    }
  }
  return { bySig, totalSol };
}
