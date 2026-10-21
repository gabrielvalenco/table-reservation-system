import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

const envFile = "../../.env";
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({});
