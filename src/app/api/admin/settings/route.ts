import { isAdmin } from "@/lib/admin/auth";
import {
  audit,
  getSettings,
  saveSettings,
  settingsSchema,
  type AppSettings,
} from "@/lib/admin/settings";

/** Describes what changed, for the audit log, without dumping the whole document. */
function describe(before: AppSettings, after: AppSettings): string {
  const changes: string[] = [];
  for (const key of Object.keys(after.features) as (keyof AppSettings["features"])[]) {
    if (before.features[key] !== after.features[key])
      changes.push(`${key} ${after.features[key] ? "on" : "off"}`);
  }
  if (before.aiProvider !== after.aiProvider) changes.push(`AI provider ${after.aiProvider}`);
  if (before.advisorFeeCents !== after.advisorFeeCents) {
    changes.push(`adviser fee ${(after.advisorFeeCents / 100).toFixed(2)} EUR`);
  }
  if (before.aiDailyRequestLimit !== after.aiDailyRequestLimit) {
    changes.push(`AI daily limit ${after.aiDailyRequestLimit}`);
  }
  if (JSON.stringify(before.rewards) !== JSON.stringify(after.rewards))
    changes.push("reward rules");
  return changes.join(", ");
}

export async function PUT(request: Request): Promise<Response> {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const before = await getSettings();
  const saved = await saveSettings(parsed.data);
  await audit("settings.update", describe(before, saved));
  return Response.json({ settings: saved });
}
