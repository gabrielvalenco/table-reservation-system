import pg from "pg";
import { hashToken, newToken } from "../security.js";

export type BookingInput = {
  startsAt: Date;
  endsAt: Date;
  partySize: number;
  name: string;
  phone: string;
  email: string;
  notes?: string | undefined;
  /** Quando a equipe escolhe a mesa; sem isso, o sistema atribui a menor mesa livre que comporte o grupo. */
  tableId?: number | undefined;
};

export type BookingError = "no_table_available" | "already_reserved" | "table_unavailable" | "table_too_small";

export type BookingResult =
  | { ok: true; id: string; token: string; status: "confirmed" }
  | { ok: false; error: BookingError };

const insertSql = `INSERT INTO reservations (table_id, starts_at, ends_at, party_size, name, phone, email, notes, manage_token_hash)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, status`;

const DEADLOCK = "40P01";
const MAX_ATTEMPTS = 6;

/**
 * Insere dentro de uma transação que antes pega um lock consultivo do dia. Isso enfileira os pedidos
 * do mesmo dia (volume de restaurante, custo desprezível) e evita que o EXCLUDE e os índices únicos
 * travem uns aos outros. As restrições do banco continuam sendo quem garante a regra; o lock só tira a
 * disputa. Se ainda assim o Postgres desfizer um pedido com 40P01, tentamos de novo.
 */
async function insertWithRetry(pool: pg.Pool, day: string, values: unknown[]) {
  for (let attempt = 1; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [day]);
      const result = await client.query<{ id: string; status: "confirmed" }>(insertSql, values);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      const deadlocked = error instanceof pg.DatabaseError && error.code === DEADLOCK;
      if (!deadlocked || attempt === MAX_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 * attempt));
    } finally {
      client.release();
    }
  }
}

/**
 * Cria a reserva. Quem garante que não há sobreposição é o banco (EXCLUDE): se outra reserva
 * ocupar a mesa entre a consulta e o INSERT, o erro 23P01 manda tentar a próxima mesa.
 */
export async function bookReservation(pool: pg.Pool, input: BookingInput): Promise<BookingResult> {
  const { startsAt, endsAt, partySize, name, phone, email, notes, tableId } = input;
  const token = newToken();

  let candidates: number[];
  if (tableId !== undefined) {
    const { rows } = await pool.query<{ capacity: number; active: boolean }>(
      "SELECT capacity, active FROM tables WHERE id = $1",
      [tableId],
    );
    const table = rows[0];
    if (!table?.active) return { ok: false, error: "table_unavailable" };
    if (table.capacity < partySize) return { ok: false, error: "table_too_small" };
    candidates = [tableId];
  } else {
    const { rows } = await pool.query<{ id: number }>(
      `SELECT t.id FROM tables t
       WHERE t.active AND t.capacity >= $1
         AND NOT EXISTS (
           SELECT 1 FROM reservations r
           WHERE r.table_id = t.id AND r.status = 'confirmed'
             AND tstzrange(r.starts_at, r.ends_at) && tstzrange($2, $3)
         )
       ORDER BY t.capacity, t.number`,
      [partySize, startsAt, endsAt],
    );
    candidates = rows.map((row) => row.id);
  }

  for (const id of candidates) {
    try {
      const { rows } = await insertWithRetry(pool, startsAt.toISOString().slice(0, 10), [
        id, startsAt, endsAt, partySize, name, phone, email, notes ?? null, hashToken(token),
      ]);
      return { ok: true, id: rows[0]!.id, token, status: rows[0]!.status };
    } catch (error) {
      if (!(error instanceof pg.DatabaseError)) throw error;
      // 23505: o contato já tem reserva nesse turno. 23P01: a mesa foi ocupada agora.
      if (error.code === "23505") return { ok: false, error: "already_reserved" };
      if (error.code !== "23P01") throw error;
      if (tableId !== undefined) return { ok: false, error: "table_unavailable" };
    }
  }

  return { ok: false, error: "no_table_available" };
}
