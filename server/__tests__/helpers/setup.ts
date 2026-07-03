import { migrate } from "drizzle-orm/pglite/migrator";
import { db } from "../../db";

// Applies the generated Drizzle migrations to the in-process PGlite database.
// Runs once per test file (fresh PGlite instance per file).
await migrate(db as any, { migrationsFolder: "./drizzle" });
