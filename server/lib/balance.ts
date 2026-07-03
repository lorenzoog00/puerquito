export function applyTxn(
  starting: number,
  txns: { amount: number; type: string }[]
): number {
  return txns.reduce((bal, t) => {
    if (t.type === "income") return bal + t.amount;
    return bal - t.amount; // expense or transfer
  }, starting);
}
