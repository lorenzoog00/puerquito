import "dotenv/config";
import pg from "pg";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// In tests we use PGlite (in-process Postgres, no server needed).
// In dev/production we use node-postgres against DATABASE_URL.
let db: ReturnType<typeof pgDrizzle> | any;
let pool: pg.Pool | null = null;

if (process.env.NODE_ENV === "test") {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite();
  db = drizzle(client, { schema });
} else {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  db = pgDrizzle(pool, { schema });
}

export { db, pool };
