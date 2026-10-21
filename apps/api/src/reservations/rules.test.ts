import { describe, expect, it } from "vitest";
import { checkSlot, endOf, slotsOf } from "./rules.js";

const now = new Date("2026-11-08T12:00:00-03:00");
const tuesday = (time: string) => new Date(`2026-11-10T${time}:00-03:00`);

describe("checkSlot", () => {
  it.each(["11:30", "13:00", "18:00", "21:00"])("aceita início às %s", (time) => {
    expect(checkSlot(tuesday(time), now)).toBeNull();
  });

  it.each(["19:15", "19:45"])("rejeita %s fora do intervalo de 30 min", (time) => {
    expect(checkSlot(tuesday(time), now)).toBe("invalid_slot");
  });

  it.each([
    ["13:30", "termina depois do fim do almoço"],
    ["16:00", "entre turnos"],
    ["21:30", "termina depois do fim do jantar"],
    ["10:00", "antes de abrir"],
  ])("rejeita %s: %s", (time) => {
    expect(checkSlot(tuesday(time), now)).toBe("closed");
  });

  it("rejeita segunda-feira", () => {
    expect(checkSlot(new Date("2026-11-09T19:00:00-03:00"), now)).toBe("closed");
  });

  it("rejeita com menos de 1h de antecedência", () => {
    expect(checkSlot(new Date("2026-11-08T12:30:00-03:00"), now)).toBe("too_soon");
  });

  it("rejeita horário no passado", () => {
    expect(checkSlot(new Date("2026-11-07T19:00:00-03:00"), now)).toBe("too_soon");
  });

  it("rejeita com mais de 30 dias de antecedência", () => {
    expect(checkSlot(new Date("2026-12-15T19:00:00-03:00"), now)).toBe("too_far");
  });

  it("interpreta o horário no fuso do restaurante", () => {
    expect(checkSlot(new Date("2026-11-10T22:00:00Z"), now)).toBeNull();
  });
});

it("endOf soma a duração da reserva", () => {
  expect(endOf(tuesday("19:00"))).toEqual(tuesday("21:00"));
});

it("slotsOf lista os inícios possíveis do dia no fuso do restaurante", () => {
  expect(slotsOf("2026-11-10")).toEqual(
    ["11:30", "12:00", "12:30", "13:00", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"].map(tuesday),
  );
});
