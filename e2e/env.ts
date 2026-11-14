import path from "node:path";

/**
 * The environment the browser tests run in: an embedded database in a
 * throw-away folder, made-up customers, AI off. The keys below protect
 * nothing: they exist so the tests exercise the real encryption code.
 */
export const E2E_PORT = 3100;
export const E2E_DEMO_PASSWORD = "e2e-demo-password";
export const E2E_ADMIN_PASSWORD = "e2e-admin-password";
export const E2E_CUSTOMER = "E2E00001";
export const E2E_CUSTOMER_TIGHT = "E2E00002";

export const E2E_ENV: Record<string, string> = {
  DATABASE_URL: "",
  PGLITE_DIR: path.join(process.cwd(), ".e2e", "pglite"),
  NEXT_DIST_DIR: ".next-e2e",
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  DATA_ENCRYPTION_KEY_ID: "e2e",
  BLIND_INDEX_KEY: Buffer.alloc(32, 9).toString("base64"),
  SESSION_SECRET: Buffer.alloc(32, 11).toString("base64"),
  DEMO_MODE: "true",
  DEMO_AS_OF_DATE: "2026-09-15",
  DEMO_LOGIN_PASSWORD: E2E_DEMO_PASSWORD,
  ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
  AI_PROCESSING_ALLOWED: "false",
  OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
  ELEVENLABS_API_KEY: "",
  ELEVENLABS_AGENT_ID: "",
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  CRON_SECRET: "",
  APP_BASE_URL: `http://localhost:${E2E_PORT}`,
};
