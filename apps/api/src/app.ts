import Fastify from "fastify";
import type pg from "pg";

export function buildApp(pool: pg.Pool, { logger = false } = {}) {
  const app = Fastify({ logger });

  app.get("/api/health", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  return app;
}
