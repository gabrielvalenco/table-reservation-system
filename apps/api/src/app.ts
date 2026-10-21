import Fastify from "fastify";
import type pg from "pg";
import { healthRoutes } from "./health/health.routes.js";

type AppOptions = {
  pool: pg.Pool;
  logger?: boolean;
};

export function buildApp({ pool, logger = false }: AppOptions) {
  const app = Fastify({ logger });
  app.register(healthRoutes, { prefix: "/api", pool });
  return app;
}
