import { z } from "zod";

const name = z.string().trim().min(1).max(100);
const phone = z.string().trim().regex(/^\+?[\d\s()-]{10,20}$/);
const email = z.email().max(254);
const partySize = z.number().int().min(1).max(50);
const startsAt = z.iso.datetime({ offset: true });
const notes = z.string().trim().max(500);

export const createReservationBody = z.object({
  name,
  phone,
  email,
  partySize,
  startsAt,
  notes: notes.optional(),
});

export const availabilityQuery = z.object({
  date: z.iso.date(),
  partySize: z.coerce.number().int().min(1).max(50),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const reservationStatuses = ["confirmed", "cancelled", "completed", "no_show"] as const;
export type ReservationStatus = (typeof reservationStatuses)[number];

/** A equipe cria reservas como o cliente, mas pode escolher a mesa. */
export const staffCreateReservationBody = createReservationBody.extend({
  tableId: z.number().int().positive().optional(),
});

export const updateReservationBody = z
  .object({
    name,
    phone,
    email,
    partySize,
    startsAt,
    notes: notes.nullable(),
    tableId: z.number().int().positive(),
    status: z.enum(["cancelled", "completed", "no_show"]),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "Informe ao menos um campo." });

export const staffReservationsQuery = z
  .object({
    date: z.iso.date().optional(),
    status: z.enum(reservationStatuses).optional(),
    q: z.string().trim().min(1).max(100).optional(),
  })
  .refine((query) => query.date || query.q, { message: "Informe a data ou um termo de busca." });

export const createTableBody = z.object({
  number: z.number().int().min(1).max(9999),
  capacity: z.number().int().min(1).max(50),
});

export const updateTableBody = createTableBody
  .extend({ active: z.boolean() })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "Informe ao menos um campo." });

export type CreateReservationBody = z.infer<typeof createReservationBody>;
export type StaffCreateReservationBody = z.infer<typeof staffCreateReservationBody>;
export type UpdateReservationBody = z.infer<typeof updateReservationBody>;
export type LoginBody = z.infer<typeof loginBody>;
export type CreateTableBody = z.infer<typeof createTableBody>;
export type UpdateTableBody = z.infer<typeof updateTableBody>;

export type AvailabilityResponse = { date: string; partySize: number; slots: string[] };

export type ReservationResponse = {
  id: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  status: ReservationStatus;
  /** Segredo do link de gerenciamento. Só aparece na resposta da criação e no e-mail. */
  manageToken: string;
};

/** Regras públicas, para o front não duplicar valores que a API decide. */
export type ConfigResponse = {
  timeZone: string;
  durationMinutes: number;
  slotMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
  cancelMinAdvanceMinutes: number;
  /** 0 = domingo ... 6 = sábado. */
  closedWeekdays: number[];
  shifts: { start: string; end: string }[];
  /** Maior mesa ativa; 0 quando não há mesas. Grupos maiores precisam falar com o restaurante. */
  maxPartySize: number;
};

export type ManagedReservation = {
  status: ReservationStatus;
  startsAt: string;
  endsAt: string;
  partySize: number;
  name: string;
  canCancel: boolean;
  cancelDeadline: string;
};

export type StaffUser = { id: number; email: string; name: string };

export type StaffReservation = {
  id: string;
  tableId: number;
  tableNumber: number;
  tableCapacity: number;
  tableActive: boolean;
  startsAt: string;
  endsAt: string;
  partySize: number;
  name: string;
  phone: string;
  email: string;
  notes: string | null;
  status: ReservationStatus;
  cancelledBy: "customer" | "staff" | null;
  createdAt: string;
};

export type StaffTable = {
  id: number;
  number: number;
  capacity: number;
  active: boolean;
  upcomingReservations: number;
};

export type StatsResponse = {
  days: number;
  totals: Record<ReservationStatus, number>;
  noShowRate: number | null;
  cancellationRate: number | null;
  byShift: { shift: "lunch" | "dinner"; reservations: number; guests: number }[];
  byWeekday: { weekday: number; reservations: number }[];
};
