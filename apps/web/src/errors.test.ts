import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("traduz os códigos da API", () => {
    expect(errorMessage(new ApiError(409, "no_table_available"))).toMatch(/ocupado/);
    expect(errorMessage(new ApiError(409, "already_reserved"))).toMatch(/turno/);
    expect(errorMessage(new ApiError(409, "too_late_to_cancel"))).toMatch(/prazo/);
  });

  it("o 429 do rate limit vira um pedido para esperar, qualquer que seja o código", () => {
    expect(errorMessage(new ApiError(429, "unknown"))).toMatch(/Aguarde/);
  });

  it("código desconhecido e falha de rede têm mensagens genéricas diferentes", () => {
    expect(errorMessage(new ApiError(500, "algo"))).toMatch(/Algo deu errado/);
    expect(errorMessage(new TypeError("Failed to fetch"))).toMatch(/conectar/);
  });
});
