import { db } from "./db";
import { accounts, categories, recurring, presets, settings, savingsGoal } from "@shared/schema";

// Idempotent personalized seed for Lorenzo. Safe to run on every boot:
// it only creates rows that don't exist yet.
export async function seedPersonalData() {
  // Owner name
  const s = await db.select().from(settings).limit(1);
  if (s.length === 0) await db.insert(settings).values({ ownerName: "Lorenzo" });

  // Savings goal: $14,500 / quincena target
  const g = await db.select().from(savingsGoal).limit(1);
  if (g.length === 0) await db.insert(savingsGoal).values({ quincenaTarget: 1450000, overallGoal: null });

  // Only seed the starter dataset on a fresh database (no accounts yet).
  const existingAccounts = await db.select().from(accounts);
  if (existingAccounts.length > 0) return;

  const [credit] = await db.insert(accounts)
    .values({ name: "Tarjeta de crédito", type: "card", startingBalance: 0, currency: "MXN" }).returning();
  const [debit] = await db.insert(accounts)
    .values({ name: "Débito", type: "bank", startingBalance: 0, currency: "MXN" }).returning();
  await db.insert(accounts)
    .values({ name: "Ahorro (inversión)", type: "savings", startingBalance: 0, currency: "MXN" }).returning();

  const cats = await db.insert(categories).values([
    { name: "Restaurantes", type: "expense", monthlyBudget: null },
    { name: "Café", type: "expense", monthlyBudget: null },
    { name: "Ropa", type: "expense", monthlyBudget: null },
    { name: "Entretenimiento", type: "expense", monthlyBudget: null },
    { name: "Gym", type: "expense", monthlyBudget: null },
    { name: "Suscripciones", type: "expense", monthlyBudget: null },
    { name: "Salario", type: "income", monthlyBudget: null },
  ]).returning();
  const cat = (n: string) => cats.find((c) => c.name === n)?.id ?? null;

  // Subscriptions as editable recurring bills (charged to credit card)
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(recurring).values([
    { name: "Netflix", amount: 21900, categoryId: cat("Suscripciones"), accountId: credit.id, frequency: "monthly", nextDueDate: today, active: true },
    { name: "Spotify", amount: 11500, categoryId: cat("Suscripciones"), accountId: credit.id, frequency: "monthly", nextDueDate: today, active: true },
  ]);

  // One-tap presets (editable). Expenses hit the credit card; salary hits debit.
  await db.insert(presets).values([
    { label: "Quincena", amount: 2600000, type: "income", accountId: debit.id, categoryId: cat("Salario"), sort: 0 },
    { label: "Restaurante", amount: 15000, type: "expense", accountId: credit.id, categoryId: cat("Restaurantes"), sort: 1 },
    { label: "Entretenimiento", amount: 20000, type: "expense", accountId: credit.id, categoryId: cat("Entretenimiento"), sort: 2 },
  ]);
}
