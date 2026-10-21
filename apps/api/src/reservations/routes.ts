import type { FastifyPluginAsync } from "fastify";
import pg from "pg";
import { z } from "zod";
import { checkSlot, endOf } from "./rules.js";

const createReservationBody = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().regex(/^\+?[\d\s()-]{10,20}$/),
  email: z.email().max(254),
  partySize: z.number().int().min(1).max(50),
  startsAt: z.iso.datetime({ offset: true }),
  notes: z.string().trim().max(500).optional(),
});

type Options = { pool: pg.Pool; now: () => Date };

export const reservationRoutes: FastifyPluginAsync<Options> = async (app, { pool, now }) => {
  app.post("/reservations", async (request, reply) => {
    const body = createReservationBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });

    const { name, phone, email, partySize, notes } = body.data;
    const startsAt = new Date(body.data.startsAt);
    const endsAt = endOf(startsAt);

    const slotError = checkSlot(startsAt, now());
    if (slotError) return reply.code(400).send({ error: slotError });

    const { rows: candidates } = await pool.query<{ id: number }>(
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

    for (const table of candidates) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO reservations (table_id, starts_at, ends_at, party_size, name, phone, email, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, starts_at AS "startsAt", ends_at AS "endsAt", party_size AS "partySize", status`,
          [table.id, startsAt, endsAt, partySize, name, phone, email, notes ?? null],
        );
        return reply.code(201).send(rows[0]);
      } catch (error) {
        if (!(error instanceof pg.DatabaseError && error.code === "23P01")) throw error;
      }
    }

    return reply.code(409).send({ error: "no_table_available" });
  });
};
