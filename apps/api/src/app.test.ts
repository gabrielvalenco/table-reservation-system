import pg from "pg";
import { afterAll, expect, it } from "vitest";
import { testDatabaseUrl } from "../test/database.js";
import { buildApp } from "./app.js";

const up = new pg.Pool({ connectionString: testDatabaseUrl });
const down = new pg.Pool({ connectionString: "postgres://postgres:postgres@127.0.0.1:1/x" });

afterAll(() => Promise.all([up.end(), down.end()]));

it("GET /api/health responde 200 com o banco acessível", async () => {
  const response = await buildApp(up).inject("/api/health");

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: "ok" });
});

it("GET /api/health responde 503 com o banco inacessível", async () => {
  const response = await buildApp(down).inject("/api/health");

  expect(response.statusCode).toBe(503);
  expect(response.json()).toEqual({ status: "unavailable" });
});
