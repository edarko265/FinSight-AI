import "server-only";

import type { Goal } from "@/lib/coach/advice";
import type { Budget } from "@/lib/coach/budgets";
import type { SetAside } from "@/lib/coach/personal";
import type { ChatMessage } from "@/lib/contracts/chat";
import type { Plan } from "@/lib/coach/plans";
import type { LinkedAccount } from "@/lib/data/linked-accounts";
import type { DashboardState, DashboardView } from "@/lib/contracts/chart";
import { readState, writeState } from "@/lib/data/repository";

/**
 * The customer's recycle bin. Deleting a goal, a view or a widget moves it
 * here; it can be restored or deleted for good. Sealed with the customer's
 * key like everything else they own.
 */
export type TrashItem =
  | { id: string; kind: "goal"; deletedAt: string; label: string; item: Goal }
  | { id: string; kind: "plan"; deletedAt: string; label: string; item: Plan }
  | { id: string; kind: "account"; deletedAt: string; label: string; item: LinkedAccount }
  | { id: string; kind: "budget"; deletedAt: string; label: string; item: Budget }
  | { id: string; kind: "chat"; deletedAt: string; label: string; item: ChatMessage[] }
  | { id: string; kind: "setaside"; deletedAt: string; label: string; item: SetAside }
  | { id: string; kind: "view"; deletedAt: string; label: string; item: DashboardView }
  | {
      id: string;
      kind: "widget";
      deletedAt: string;
      label: string;
      item: DashboardView["widgets"][number];
      viewId: string;
    };

const KIND = "trash";
const LIMIT = 40;

export async function listTrash(customerRef: string): Promise<TrashItem[]> {
  return (await readState<TrashItem[]>(customerRef, KIND)) ?? [];
}

export async function addToTrash(customerRef: string, items: TrashItem[]): Promise<void> {
  if (items.length === 0) return;
  await writeState(
    customerRef,
    KIND,
    [...items, ...(await listTrash(customerRef))].slice(0, LIMIT),
  );
}

/** Removes an item from the bin and returns it, for restoring or deleting permanently. */
export async function takeFromTrash(customerRef: string, id: string): Promise<TrashItem | null> {
  const items = await listTrash(customerRef);
  const found = items.find((item) => item.id === id) ?? null;
  if (found) {
    await writeState(
      customerRef,
      KIND,
      items.filter((item) => item.id !== id),
    );
  }
  return found;
}

export async function emptyTrash(customerRef: string): Promise<void> {
  await writeState(customerRef, KIND, []);
}

const stamp = (): string => new Date().toISOString();
const trashId = (): string => `trash-${crypto.randomUUID()}`;

export function goalToTrash(goal: Goal): TrashItem {
  return { id: trashId(), kind: "goal", deletedAt: stamp(), label: goal.name, item: goal };
}

/** Works out what a dashboard save removed, so it lands in the bin instead of vanishing. */
export function removedFromDashboard(before: DashboardState, after: DashboardState): TrashItem[] {
  const removed: TrashItem[] = [];
  for (const view of before.views) {
    const kept = after.views.find((candidate) => candidate.id === view.id);
    if (!kept) {
      removed.push({
        id: trashId(),
        kind: "view",
        deletedAt: stamp(),
        label: view.name || view.preset || view.id,
        item: view,
      });
      continue;
    }
    for (const widget of view.widgets) {
      if (!kept.widgets.some((candidate) => candidate.id === widget.id)) {
        removed.push({
          id: trashId(),
          kind: "widget",
          deletedAt: stamp(),
          label: widget.query.tool,
          item: widget,
          viewId: view.id,
        });
      }
    }
  }
  return removed;
}
