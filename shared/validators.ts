import { z } from "zod";

const money = z.coerce.number().nonnegative();

export const accountInput = z.object({
  name: z.string().min(1),
  type: z.enum(["cash", "bank", "card", "savings"]),
  startingBalance: money.default(0),
  currency: z.string().default("MXN"),
});

export const categoryInput = z.object({
  name: z.string().min(1),
  type: z.enum(["expense", "income"]),
  monthlyBudget: money.nullish(),
});

export const transactionInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: money,
  accountId: z.number().int().positive(),
  categoryId: z.number().int().positive().nullish(),
  note: z.string().nullish(),
  type: z.enum(["expense", "income", "transfer"]),
});

export const recurringInput = z.object({
  name: z.string().min(1),
  amount: money,
  categoryId: z.number().int().positive().nullish(),
  accountId: z.number().int().positive(),
  frequency: z.enum(["weekly", "monthly"]),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean().default(true),
});

export const savingsEntryInput = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  quincenaHalf: z.union([z.literal(1), z.literal(2)]),
  amountSaved: money,
  goalOverride: money.nullish(),
  note: z.string().nullish(),
});

export const savingsGoalInput = z.object({
  quincenaTarget: money,
  overallGoal: money.nullish(),
});

export const presetInput = z.object({
  label: z.string().min(1),
  amount: money,
  type: z.enum(["expense", "income"]),
  accountId: z.number().int().positive(),
  categoryId: z.number().int().positive().nullish(),
  sort: z.number().int().default(0),
});

export const settingsInput = z.object({
  ownerName: z.string().nullish(),
});

export const goalInput = z.object({
  name: z.string().min(1),
  monthlyAmount: money,
  targetAmount: money.nullish(),
});

export const contributeInput = z.object({
  amount: z.coerce.number(), // may be negative to withdraw
});

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
