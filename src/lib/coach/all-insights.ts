import "server-only";

import { activeAnnouncements } from "@/lib/admin/announcements";
import { buildInsights, type Insight } from "@/lib/coach/insights";
import type { CoachContext } from "@/lib/coach/tools";

/** Staff announcements first, then the insights calculated from the customer's own data. */
export async function allInsights(ctx: CoachContext): Promise<Insight[]> {
  const notices: Insight[] = (await activeAnnouncements()).map((notice) => ({
    id: `announcement-${notice.id}-${notice.updatedAt}`,
    severity: notice.severity,
    title: notice.title,
    body: notice.body,
    ask: "",
  }));
  return [...notices, ...buildInsights(ctx)];
}
