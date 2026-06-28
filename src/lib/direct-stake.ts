// Canonical message for a direct-stake request. The wallet signs EXACTLY this
// string; the server reconstructs it from the submitted fields and verifies the
// signature against it. Because every field is part of the signed bytes, a
// tampered amount/validator/wallet breaks the signature — the structured fields
// can't drift from what the user authorised. Client and server MUST build it
// identically, so this lives in one shared module.

export function canonicalDirectStakeMessage(
  wallet: string,
  validators: readonly string[],
  amountSol: number,
  ts: string,
): string {
  return [
    'Definity — Direct-Stake Request',
    `wallet: ${wallet}`,
    `validators: ${[...validators].join(', ')}`,
    `amount: ${amountSol} SOL`,
    `time: ${ts}`,
    'This records my intent to direct-stake. No funds move now.',
  ].join('\n');
}
