import { eq } from "drizzle-orm";
import { db } from "../db";
import { accounts, transactions } from "@shared/schema";

// The account money is pulled FROM when you save/contribute (your Débito).
async function mainAccountId(): Promise<number | null> {
  const rows = await db.select().from(accounts);
  const bank = rows.find((a) => a.type === "bank");
  const nonSavings = rows.find((a) => a.type !== "savings");
  return (bank ?? nonSavings)?.id ?? null;
}

// Records money leaving your spendable accounts (a "transfer" reduces Disponible).
// Returns the transaction id, or null if there's no account or amount <= 0.
export async function createSavingsTransfer(amountCents: number, note: string): Promise<number | null> {
  if (amountCents <= 0) return null;
  const accId = await mainAccountId();
  if (accId == null) return null;
  const [row] = await db.insert(transactions).values({
    date: new Date().toISOString().slice(0, 10),
    amount: amountCents,
    accountId: accId,
    categoryId: null,
    note,
    type: "transfer",
  }).returning();
  return row.id;
}

export async function updateTransferAmount(txnId: number | null, amountCents: number) {
  if (txnId == null) return;
  await db.update(transactions).set({ amount: amountCents }).where(eq(transactions.id, txnId));
}

export async function deleteTransfer(txnId: number | null) {
  if (txnId == null) return;
  await db.delete(transactions).where(eq(transactions.id, txnId));
}
