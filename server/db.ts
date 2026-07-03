import "dotenv/config";
import pg from "pg";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// PGlite (in-process Postgres, no server needed) is used when:
//   - NODE_ENV=test  -> in-memory, fresh per run
//   - PGLITE_DIR set -> persisted to that folder (local standalone test mode)
// Otherwise node-postgres against DATABASE_URL (dev/production).
let db: ReturnType<typeof pgDrizzle> | any;
let pool: pg.Pool | null = null;

const usePglite = process.env.NODE_ENV === "test" || !!process.env.PGLITE_DIR;

if (usePglite) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = process.env.NODE_ENV === "test" ? undefined : process.env.PGLITE_DIR;
  const client = new PGlite(dir);
  db = drizzle(client, { schema });
} else {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  db = pgDrizzle(pool, { schema });
}

export { db, pool };
