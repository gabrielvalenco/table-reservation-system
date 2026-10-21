import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("GET /api/health", () => {
  const pools: pg.Pool[] = [];

  afterAll(async () => {
    await Promise.all(pools.map((pool) => pool.end()));
  });

  function appWith(connectionString: string | undefined) {
    const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 1000 });
    pools.push(pool);
    return buildApp({ pool });
  }

  it("responde 200 quando o banco está acessível", async () => {
    const response = await appWith(process.env.TEST_DATABASE_URL).inject("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("responde 503 quando o banco está inacessível", async () => {
    const response = await appWith("postgres://postgres:postgres@127.0.0.1:1/x").inject("/api/health");

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "unavailable" });
  });
});
