// Express app (kept separate from server.js so tests can import it without opening a port).
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errors.js";

export function createApp() {
  const app = express();
  // Local single-user demo: no authentication. Do NOT expose this server publicly as-is.
  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
