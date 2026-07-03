import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/puerquito" },
} satisfies Config;
