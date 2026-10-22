import pg from "pg";
import { buildApp } from "../src/app.js";
import type { Email, Mailer } from "../src/mail.js";
import { hashPassword } from "../src/security.js";
import { testDatabaseUrl } from "./database.js";

/** Domingo, 8 de novembro de 2026, meio-dia em São Paulo. Terça, 10/11, é um dia aberto. */
export const NOW = new Date("2026-11-08T12:00:00-03:00");

export function createTestApp(now: () => Date = () => NOW) {
  const pool = new pg.Pool({ connectionString: testDatabaseUrl });
  const sent: Email[] = [];
  const mailer: Mailer = { send: async (email) => void sent.push(email) };
  const app = buildApp(pool, { now, mailer, publicUrl: "https://reservas.test" });
  return {
    app,
    pool,
    sent,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

export async function resetDatabase(pool: pg.Pool) {
  await pool.query("TRUNCATE reservations, tables, staff_sessions, staff_users RESTART IDENTITY");
}

let contact = 0;

/** Contato novo a cada chamada: o mesmo contato só pode ter 1 reserva ativa por turno. */
export function newContact() {
  contact += 1;
  return { email: `cliente${contact}@example.com`, phone: `(11) 9${String(contact).padStart(4, "0")}-0000` };
}

export const reservationBody = (overrides: object = {}) => ({
  name: "Ana Souza",
  partySize: 2,
  startsAt: "2026-11-10T19:00:00-03:00",
  ...newContact(),
  ...overrides,
});

export const STAFF = { email: "equipe@example.com", name: "Equipe", password: "senha-de-teste-123" };

export async function createStaff(pool: pg.Pool, { email, name, password } = STAFF) {
  await pool.query("INSERT INTO staff_users (email, name, password_hash) VALUES ($1, $2, $3)", [
    email,
    name,
    await hashPassword(password),
  ]);
}
