import pg from "pg";
import { z } from "zod";
import { anonymizeOld } from "./anonymize.js";
import { buildApp } from "./app.js";
import { loggerOptions } from "./logging.js";
import { createMailer } from "./mail.js";
import { migrate } from "./migrate.js";

const env = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    PUBLIC_URL: z.url().default("http://localhost:5173"),
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().default("Pincelada <reservas@localhost>"),
  })
  .parse(process.env);

const production = env.NODE_ENV === "production";

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
await migrate(pool);

const app = buildApp(pool, {
  production,
  rateLimit: true,
  publicUrl: env.PUBLIC_URL,
  mailer: createMailer(env.SMTP_URL, env.MAIL_FROM, (message) => app.log.warn(message)),
  logger: loggerOptions,
});

async function anonymize() {
  const count = await anonymizeOld(pool, new Date());
  if (count > 0) app.log.info({ count }, "reservas anonimizadas");
}

await app.listen({ port: env.PORT, host: "0.0.0.0" });
await anonymize();
setInterval(() => void anonymize().catch((error: unknown) => app.log.error({ err: String(error) }, "falha na anonimização")), 86_400_000).unref();
