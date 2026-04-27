import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, ensureRostersExist } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth, bootstrapDefaultAdmin } from "./auth";
import { seedComprehensiveTestData } from "./seed-comprehensive";
import { fixupTestData } from "./seed-fixup";
import { ensureBossSuperAdmin } from "./ensure-boss-admin";
import { ensureHeroRoleConfigs } from "./ensure-hero-role-configs";
import { ensureOverwatchHeroes } from "./ensure-overwatch-heroes";
import { ensureOpponents } from "./ensure-opponents";
import { runHealthCheck } from "./health-check";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("OK");
});
app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("OK");
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  setupAuth(app);
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Defer ALL seed/bootstrap work to a background task so the server can
    // respond to deployment health checks immediately. We delay slightly past
    // the listen callback to ensure the event loop has fully drained the
    // initial accept queue before heavy DB work starts.
    setTimeout(() => {
      bootstrapDefaultAdmin()
        .then(() => ensureRostersExist())
        .then(() => seedComprehensiveTestData())
        .then(() => fixupTestData())
        .then(() => ensureBossSuperAdmin())
        .then(() => ensureOverwatchHeroes())
        .then(() => ensureHeroRoleConfigs())
        .then(() => ensureOpponents())
        .then(() => runHealthCheck())
        .catch(err => {
          const msg = err?.message || String(err);
          console.error("[boot-bg] Error:", msg);
          if (msg.includes("[SECURITY]")) {
            console.error("[boot-bg] Critical security configuration error — shutting down.");
            process.exit(1);
          }
        });
    }, 250);
  });
})();
