import Fastify from "fastify";
import type pg from "pg";
import { reservationRoutes } from "./reservations/routes.js";

type Options = { logger?: boolean; now?: () => Date };

export function buildApp(pool: pg.Pool, { logger = false, now = () => new Date() }: Options = {}) {
  const app = Fastify({ logger });

  app.get("/api/health", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  app.register(reservationRoutes, { prefix: "/api", pool, now });

  return app;
}
