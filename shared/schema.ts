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

export const savingsEntries = pgTable("savings_entries", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  quincenaHalf: integer("quincena_half").notNull(), // 1 | 2
  amountSaved: integer("amount_saved").notNull(), // cents
  goalOverride: integer("goal_override"), // cents, nullable
  note: text("note"),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Recurring = typeof recurring.$inferSelect;
export type SavingsEntry = typeof savingsEntries.$inferSelect;
