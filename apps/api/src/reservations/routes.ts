import type { FastifyPluginAsync } from "fastify";
import pg from "pg";
import { availabilityQuery, createReservationBody, type ConfigResponse } from "@reservas/shared";
import { cancellationEmail, confirmationEmail, sendInBackground as sendMail, type Email, type Mailer } from "../mail.js";
import { hashToken } from "../security.js";
import { bookReservation } from "./booking.js";
import { cancelDeadline, checkSlot, closedWeekdayNumbers, endOf, rules, slotsOf } from "./rules.js";

type Options = { pool: pg.Pool; now: () => Date; mailer: Mailer; publicUrl: string };

const manageParams = { type: "object", properties: { token: { type: "string", minLength: 20, maxLength: 64 } } };

// Limites por IP: a disponibilidade é consultada com frequência; reservar e mexer em link, não.
const limits = {
  availability: { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
  reserve: { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
  manage: { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
};

export const reservationRoutes: FastifyPluginAsync<Options> = async (app, { pool, now, mailer, publicUrl }) => {
  const sendInBackground = (email: Email) => sendMail(mailer, app.log, email);

  app.get("/config", async (): Promise<ConfigResponse> => {
    const { rows } = await pool.query<{ max: number | null }>("SELECT max(capacity) AS max FROM tables WHERE active");
    return {
      timeZone: rules.timeZone,
      durationMinutes: rules.durationMinutes,
      slotMinutes: rules.slotMinutes,
      minAdvanceMinutes: rules.minAdvanceMinutes,
      maxAdvanceDays: rules.maxAdvanceDays,
      cancelMinAdvanceMinutes: rules.cancelMinAdvanceMinutes,
      closedWeekdays: closedWeekdayNumbers,
      shifts: rules.shifts,
      maxPartySize: rows[0]?.max ?? 0,
    };
  });

  app.get("/availability", limits.availability, async (request, reply) => {
    const query = availabilityQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_query", issues: query.error.issues });

    const { date, partySize } = query.data;
    const slots = slotsOf(date).filter((slot) => checkSlot(slot, now()) === null);

    const { rows } = await pool.query<{ startsAt: Date }>(
      `SELECT s.starts_at AS "startsAt" FROM unnest($1::timestamptz[]) AS s (starts_at)
       WHERE EXISTS (
         SELECT 1 FROM tables t
         WHERE t.active AND t.capacity >= $2
           AND NOT EXISTS (
             SELECT 1 FROM reservations r
             WHERE r.table_id = t.id AND r.status = 'confirmed'
               AND tstzrange(r.starts_at, r.ends_at) && tstzrange(s.starts_at, s.starts_at + make_interval(mins => $3))
           )
       )
       ORDER BY 1`,
      [slots, partySize, rules.durationMinutes],
    );

    return { date, partySize, slots: rows.map((row) => row.startsAt) };
  });

  app.post("/reservations", limits.reserve, async (request, reply) => {
    const body = createReservationBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", issues: body.error.issues });

    const { name, phone, email, partySize, notes } = body.data;
    const startsAt = new Date(body.data.startsAt);
    const endsAt = endOf(startsAt);

    const slotError = checkSlot(startsAt, now());
    if (slotError) return reply.code(400).send({ error: slotError });

    const result = await bookReservation(pool, { startsAt, endsAt, partySize, name, phone, email, notes });
    if (!result.ok) return reply.code(409).send({ error: result.error });

    sendInBackground(
      confirmationEmail({ name, email, startsAt, endsAt, partySize }, result.id, `${publicUrl}/reserva/${result.token}`),
    );
    return reply.code(201).send({
      id: result.id,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      partySize,
      status: result.status,
      manageToken: result.token,
    });
  });

  app.get<{ Params: { token: string } }>(
    "/reservations/manage/:token",
    { schema: { params: manageParams }, ...limits.manage },
    async (request, reply) => {
      const { rows } = await pool.query(
        `SELECT status, starts_at AS "startsAt", ends_at AS "endsAt", party_size AS "partySize", name
         FROM reservations WHERE manage_token_hash = $1 AND anonymized_at IS NULL`,
        [hashToken(request.params.token)],
      );
      const reservation = rows[0];
      if (!reservation) return reply.code(404).send({ error: "not_found" });

      const deadline = cancelDeadline(reservation.startsAt);
      return {
        ...reservation,
        canCancel: reservation.status === "confirmed" && now() <= deadline,
        cancelDeadline: deadline,
      };
    },
  );

  app.post<{ Params: { token: string } }>(
    "/reservations/manage/:token/cancel",
    { schema: { params: manageParams }, ...limits.manage },
    async (request, reply) => {
      const tokenHash = hashToken(request.params.token);
      const { rows } = await pool.query(
        `SELECT id, status, starts_at AS "startsAt", ends_at AS "endsAt", party_size AS "partySize", name, email
         FROM reservations WHERE manage_token_hash = $1 AND anonymized_at IS NULL`,
        [tokenHash],
      );
      const reservation = rows[0];
      if (!reservation) return reply.code(404).send({ error: "not_found" });
      if (reservation.status !== "confirmed") return reply.code(409).send({ error: "not_active" });
      if (now() > cancelDeadline(reservation.startsAt)) return reply.code(409).send({ error: "too_late_to_cancel" });

      const { rowCount } = await pool.query(
        `UPDATE reservations SET status = 'cancelled', cancelled_at = $2, cancelled_by = 'customer'
         WHERE id = $1 AND status = 'confirmed'`,
        [reservation.id, now()],
      );
      if (rowCount === 0) return reply.code(409).send({ error: "not_active" });

      sendInBackground(cancellationEmail(reservation));
      return { status: "cancelled" };
    },
  );
};
