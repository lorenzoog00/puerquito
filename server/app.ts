import express, { type Express } from "express";
import path from "path";
import { buildSession, mountAuth } from "./auth";
import { mountAccounts } from "./routes/accounts";
import { mountCategories } from "./routes/categories";
import { mountTransactions } from "./routes/transactions";
import { mountRecurring } from "./routes/recurring";
import { mountSavings } from "./routes/savings";

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(buildSession());
  mountAuth(app);

  mountAccounts(app);
  mountCategories(app);
  mountTransactions(app);
  mountRecurring(app);
  mountSavings(app);

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
