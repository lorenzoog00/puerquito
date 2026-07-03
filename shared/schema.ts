import { pgTable, serial, text, integer, date, boolean, timestamp } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // cash | bank | card | savings
  startingBalance: integer("starting_balance").notNull().default(0), // cents
  currency: text("currency").notNull().default("MXN"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // expense | income
  monthlyBudget: integer("monthly_budget"), // cents, nullable
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  amount: integer("amount").notNull(), // cents, always positive
  accountId: integer("account_id").notNull().references(() => accounts.id),
  categoryId: integer("category_id").references(() => categories.id),
  note: text("note"),
  type: text("type").notNull(), // expense | income | transfer
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recurring = pgTable("recurring", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(), // cents
  categoryId: integer("category_id").references(() => categories.id),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  frequency: text("frequency").notNull(), // weekly | monthly
  nextDueDate: date("next_due_date").notNull(),
  active: boolean("active").notNull().default(true),
});

export const savingsGoal = pgTable("savings_goal", {
  id: serial("id").primaryKey(),
  quincenaTarget: integer("quincena_target").notNull().default(0), // cents
  overallGoal: integer("overall_goal"), // cents, nullable
});

export const presets = pgTable("presets", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  amount: integer("amount").notNull(), // cents
  type: text("type").notNull(), // expense | income
  accountId: integer("account_id").notNull().references(() => accounts.id),
  categoryId: integer("category_id").references(() => categories.id),
  sort: integer("sort").notNull().default(0),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  ownerName: text("owner_name"),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  monthlyAmount: integer("monthly_amount").notNull().default(0), // cents/month
  targetAmount: integer("target_amount"), // cents, nullable
  saved: integer("saved").notNull().default(0), // cents accumulated (= sum of contributions)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// One row per (goal, month) the user has contributed. Drives the monthly
// check-off, history dots and streak.
export const goalContributions = pgTable("goal_contributions", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").notNull().references(() => goals.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  amount: integer("amount").notNull(), // cents contributed that month
  txnId: integer("txn_id"), // linked transfer transaction (money leaving Débito)
});

export const savingsEntries = pgTable("savings_entries", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  quincenaHalf: integer("quincena_half").notNull(), // 1 | 2
  amountSaved: integer("amount_saved").notNull(), // cents
  goalOverride: integer("goal_override"), // cents, nullable
  note: text("note"),
  txnId: integer("txn_id"), // linked transfer transaction (money leaving Débito)
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Recurring = typeof recurring.$inferSelect;
export type SavingsEntry = typeof savingsEntries.$inferSelect;
export type Preset = typeof presets.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalContribution = typeof goalContributions.$inferSelect;
