import express, { type Express } from "express";
import path from "path";
import { buildSession, mountAuth } from "./auth";
import { mountAccounts } from "./routes/accounts";
import { mountCategories } from "./routes/categories";
import { mountTransactions } from "./routes/transactions";
import { mountRecurring } from "./routes/recurring";
import { mountSavings } from "./routes/savings";
import { mountPresets } from "./routes/presets";
import { mountSettings } from "./routes/settings";
import { mountGoals } from "./routes/goals";

export function createApp(): Express {
  const app = express();
  // Behind nginx (which terminates HTTPS): trust the proxy so secure session
  // cookies are set. nginx forwards X-Forwarded-Proto.
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(buildSession());
  mountAuth(app);

  mountAccounts(app);
  mountCategories(app);
  mountTransactions(app);
  mountRecurring(app);
  mountSavings(app);
  mountPresets(app);
  mountSettings(app);
  mountGoals(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV === "production" || process.env.SERVE_STATIC === "true") {
    const clientDir = path.resolve(process.cwd(), "dist/client");
    app.use(express.static(clientDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }
  return app;
}
