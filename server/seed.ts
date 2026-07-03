import "dotenv/config";
import { db } from "./db";
import { savingsGoal } from "@shared/schema";

async function main() {
  const existing = await db.select().from(savingsGoal).limit(1);
  if (existing.length === 0) {
    await db.insert(savingsGoal).values({ quincenaTarget: 0 });
    console.log("seeded savings_goal");
  } else {
    console.log("savings_goal already present");
  }
  process.exit(0);
}
main();
