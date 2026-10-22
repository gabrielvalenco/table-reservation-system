import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type pg from "pg";
import type { Mailer } from "./mail.js";
import { reservationRoutes } from "./reservations/routes.js";
import { staffRoutes } from "./staff/routes.js";

export type AppOptions = {
  logger?: boolean | object;
  now?: () => Date;
  /** Sem mailer, nenhum e-mail é enviado. */
  mailer?: Mailer;
  /** Endereço público do site, usado nos links dos e-mails. */
  publicUrl?: string;
  /** Liga o rate limit. Os testes o deixam desligado. */
  rateLimit?: boolean;
  /** Confiança no proxy reverso (produção). O cookie `Secure` segue o protocolo de `publicUrl`. */
  production?: boolean;
};

export function buildApp(pool: pg.Pool, options: AppOptions = {}) {
  const {
    logger = false,
    now = () => new Date(),
    mailer = { send: async () => {} },
    publicUrl = "http://localhost:5173",
    rateLimit: limitRequests = false,
    production = false,
  } = options;

  const app = Fastify({ logger, trustProxy: production });
  app.register(cookie);
  if (limitRequests) app.register(rateLimit, { global: false });

  app.get("/api/health", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  app.register(reservationRoutes, { prefix: "/api", pool, now, mailer, publicUrl });
  app.register(staffRoutes, { prefix: "/api", pool, now, mailer, publicUrl });

  return app;
}
