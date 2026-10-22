import type { ConfigResponse } from "@reservas/shared";

const timeZone = "America/Sao_Paulo";

const time = new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" });
const dateLong = new Intl.DateTimeFormat("pt-BR", {
  timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dateShort = new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "short", day: "2-digit", month: "2-digit" });
const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone });
const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatDate = (iso: string) => dateLong.format(new Date(iso));
export const formatShortDate = (iso: string) => dateShort.format(new Date(iso));
export const todayInSaoPaulo = () => isoDate.format(new Date());
export const dateOf = (iso: string) => isoDate.format(new Date(iso));
export const addDays = (date: string, days: number) => {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" });
export const isLunch = (iso: string) => Number(hour.format(new Date(iso))) < 17;

/** Minutos desde a meia-noite, no horário de São Paulo. */
export function minutesOfDay(iso: string) {
  const values = Object.fromEntries(parts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

/** O instante (ISO) em que, em São Paulo, é `date` às `clock` ("HH:MM"). */
export function zonedIso(date: string, clock: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = clock.split(":").map(Number);
  const guess = Date.UTC(year!, month! - 1, day!, hours!, minutes!);
  const values = Object.fromEntries(parts.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
  const shown = Date.UTC(+values.year!, +values.month! - 1, +values.day!, +values.hour!, +values.minute!);
  return new Date(guess - (shown - guess)).toISOString();
}

const toMinutes = (clock: string) => {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours! * 60 + minutes!;
};

/** Horários de início possíveis ("HH:MM"): os turnos, de slotMinutes em slotMinutes, deixando caber a duração. */
export function slotTimes(config: Pick<ConfigResponse, "shifts" | "slotMinutes" | "durationMinutes">) {
  return config.shifts.flatMap((shift) => {
    const slots: string[] = [];
    for (let start = toMinutes(shift.start); start + config.durationMinutes <= toMinutes(shift.end); start += config.slotMinutes) {
      slots.push(`${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`);
    }
    return slots;
  });
}

export const people = (count: number) => `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
