import { z } from "zod";

/**
 * Server-side configuration, validated once on first use. Values are never
 * logged; validation errors name the variable only.
 */
const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const optional = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== "" ? value.trim() : undefined));

const schema = z.object({
  DATABASE_URL: optional,
  DATA_ENCRYPTION_KEY: z.string().min(1),
  DATA_ENCRYPTION_KEY_ID: z.string().min(1).default("k1"),
  BLIND_INDEX_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(1),

  AI_PROCESSING_ALLOWED: flag,
  AI_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  OPENAI_API_KEY: optional,
  OPENAI_MODEL: optional,
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: optional,
  ELEVENLABS_API_KEY: optional,
  ELEVENLABS_AGENT_ID: optional,
  ELEVENLABS_VOICE_ID: optional,
  CHAT_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  CHAT_MAX_TOOL_STEPS: z.coerce.number().int().min(1).max(8).default(4),

  DEMO_MODE: flag,
  DEMO_AS_OF_DATE: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default("2026-09-15"),
  DEMO_LOGIN_PASSWORD: optional,
  ADMIN_PASSWORD: optional,
  APP_BASE_URL: optional,

  /** Web Push keys for device notifications. Generate with: npx web-push generate-vapid-keys */
  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  cached = parsed.data;
  return cached;
}
