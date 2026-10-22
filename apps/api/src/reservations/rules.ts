export const rules = {
  timeZone: "America/Sao_Paulo",
  durationMinutes: 120,
  slotMinutes: 30,
  minAdvanceMinutes: 60,
  maxAdvanceDays: 30,
  cancelMinAdvanceMinutes: 120,
  closedWeekdays: ["Mon"],
  shifts: [
    { start: "11:30", end: "15:00" },
    { start: "18:00", end: "23:00" },
  ],
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Dias de folga como números de 0 (domingo) a 6 (sábado), o formato do JavaScript e do front. */
export const closedWeekdayNumbers = rules.closedWeekdays.map((day) => weekdays.indexOf(day));

export type SlotError = "invalid_slot" | "closed" | "too_soon" | "too_far";

const MINUTE = 60_000;

const wallClock = new Intl.DateTimeFormat("en-US", {
  timeZone: rules.timeZone,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
}

function localParts(instant: Date) {
  return Object.fromEntries(wallClock.formatToParts(instant).map((part) => [part.type, part.value]));
}

function offsetMs(instant: Date) {
  const parts = localParts(instant);
  const local = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!);
  return local - instant.getTime();
}

function atLocalTime(date: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(year!, month! - 1, day!, 0, minutes));
  return new Date(guess.getTime() - offsetMs(guess));
}

export function slotsOf(date: string) {
  return rules.shifts.flatMap((shift) => {
    const slots: Date[] = [];
    for (let start = toMinutes(shift.start); start + rules.durationMinutes <= toMinutes(shift.end); start += rules.slotMinutes) {
      slots.push(atLocalTime(date, start));
    }
    return slots;
  });
}

export function endOf(startsAt: Date) {
  return new Date(startsAt.getTime() + rules.durationMinutes * MINUTE);
}

export function checkSlot(startsAt: Date, now: Date, { ignoreAdvance = false } = {}): SlotError | null {
  const parts = localParts(startsAt);
  const start = toMinutes(`${parts.hour}:${parts.minute}`);

  if (startsAt.getUTCSeconds() !== 0 || startsAt.getUTCMilliseconds() !== 0 || start % rules.slotMinutes !== 0) {
    return "invalid_slot";
  }

  const fitsShift = rules.shifts.some(
    (shift) => start >= toMinutes(shift.start) && start + rules.durationMinutes <= toMinutes(shift.end),
  );
  if (rules.closedWeekdays.includes(parts.weekday!) || !fitsShift) return "closed";

  if (ignoreAdvance) return null;

  const advance = startsAt.getTime() - now.getTime();
  if (advance < rules.minAdvanceMinutes * MINUTE) return "too_soon";
  if (advance > rules.maxAdvanceDays * 24 * 60 * MINUTE) return "too_far";

  return null;
}

/** Início e fim (exclusivo) de um dia no horário de São Paulo, para consultar o banco. */
export function dayRange(date: string) {
  const start = atLocalTime(date, 0);
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
  return { start, end: atLocalTime(next, 0) };
}

/** O cliente só cancela até 2h antes do início; a equipe cancela quando quiser. */
export function cancelDeadline(startsAt: Date) {
  return new Date(startsAt.getTime() - rules.cancelMinAdvanceMinutes * MINUTE);
}
