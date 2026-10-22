import { describe, expect, it } from "vitest";
import { addDays, dateOf, isLunch, minutesOfDay, people, slotTimes, zonedIso } from "./format";

const config = {
  slotMinutes: 30,
  durationMinutes: 120,
  shifts: [
    { start: "11:30", end: "15:00" },
    { start: "18:00", end: "23:00" },
  ],
};

describe("zonedIso", () => {
  it("converte o horário de São Paulo para o instante UTC (UTC-3)", () => {
    expect(zonedIso("2026-11-10", "19:00")).toBe("2026-11-10T22:00:00.000Z");
    expect(zonedIso("2026-11-10", "00:00")).toBe("2026-11-10T03:00:00.000Z");
  });

  it("vira o dia quando o horário local passa das 21h", () => {
    expect(zonedIso("2026-11-10", "22:30")).toBe("2026-11-11T01:30:00.000Z");
  });
});

describe("fuso de São Paulo", () => {
  it("minutesOfDay e dateOf usam o horário local, não o UTC", () => {
    const iso = "2026-11-11T01:30:00.000Z";

    expect(minutesOfDay(iso)).toBe(22 * 60 + 30);
    expect(dateOf(iso)).toBe("2026-11-10");
  });

  it("isLunch separa almoço (antes das 17h) de jantar", () => {
    expect(isLunch("2026-11-10T15:00:00.000Z")).toBe(true); // 12:00 em SP
    expect(isLunch("2026-11-10T22:00:00.000Z")).toBe(false); // 19:00 em SP
  });
});

describe("slotTimes", () => {
  it("gera os inícios de cada turno de 30 em 30 min, com a duração cabendo no turno", () => {
    expect(slotTimes(config)).toEqual([
      "11:30", "12:00", "12:30", "13:00",
      "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00",
    ]);
  });
});

describe("addDays", () => {
  it("soma dias atravessando o fim do mês e do ano", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("people", () => {
  it("usa o singular só para 1", () => {
    expect(people(1)).toBe("1 pessoa");
    expect(people(2)).toBe("2 pessoas");
  });
});
