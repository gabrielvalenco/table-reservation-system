import { z } from "zod";

export const createReservationBody = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().regex(/^\+?[\d\s()-]{10,20}$/),
  email: z.email().max(254),
  partySize: z.number().int().min(1).max(50),
  startsAt: z.iso.datetime({ offset: true }),
  notes: z.string().trim().max(500).optional(),
});

export const availabilityQuery = z.object({
  date: z.iso.date(),
  partySize: z.coerce.number().int().min(1).max(50),
});

export type CreateReservationBody = z.infer<typeof createReservationBody>;

export type AvailabilityResponse = { date: string; partySize: number; slots: string[] };

export type ReservationResponse = {
  id: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  status: string;
};
