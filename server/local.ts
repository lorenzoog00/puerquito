// Standalone local test mode: runs the whole app with an in-process,
// file-persisted PGlite database. No Postgres, no domain, no setup.
//   npm run local  ->  open http://localhost:5002
//
// Env is set BEFORE importing ./db (which reads it at load), so all
// app modules are pulled in via dynamic import after this point.
process.env.PGLITE_DIR ||= ".localdb";
process.env.SERVE_STATIC = "true";
process.env.SEED_EMAIL ||= "test@puerquito.local";
process.env.SEED_PASSWORD ||= "puerquito";
process.env.SESSION_SECRET ||= "local-dev-secret";
process.env.PORT ||= "5002";

const { migrate } = await import("drizzle-orm/pglite/migrator");
const { db } = await import("./db");
const { savingsGoal } = await import("@shared/schema");
const { createApp } = await import("./app");

await migrate(db as any, { migrationsFolder: "./drizzle" });
const existing = await db.select().from(savingsGoal).limit(1);
if (existing.length === 0) {
  await db.insert(savingsGoal).values({ quincenaTarget: 0 });
}

const port = Number(process.env.PORT);
createApp().listen(port, () => {
  console.log(`\n🐷  Puerquito (local) -> http://localhost:${port}`);
  console.log(`    Login: ${process.env.SEED_EMAIL} / ${process.env.SEED_PASSWORD}`);
  console.log(`    Data persists in ./${process.env.PGLITE_DIR}\n`);
});
