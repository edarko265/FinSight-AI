import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Loads .env.local into process.env for scripts, without printing any value. */
export function loadEnv(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, name = "", value = ""] = match;
    if (process.env[name] === undefined) process.env[name] = value.replace(/^["']|["']$/g, "");
  }
}
