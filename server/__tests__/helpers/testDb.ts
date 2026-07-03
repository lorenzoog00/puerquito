import { sql } from "drizzle-orm";
import { db } from "../../db";

export async function resetDb() {
  await db.execute(
    sql`TRUNCATE transactions, recurring, presets, settings, savings_entries, savings_goal, categories, accounts RESTART IDENTITY CASCADE`
  );
}

export { db };
