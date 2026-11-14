export interface QueueEntry {
  id: string;
  status: "open" | "active" | "closed";
  deleted: boolean;
}

export type QueueAction = "close" | "reopen" | "trash" | "restore" | "purge";

/** Applies an action to the local queue, for when the server accepted it but the refresh failed. */
export function applyQueueAction<T extends QueueEntry>(
  queue: T[],
  id: string,
  action: QueueAction,
): T[] {
  if (action === "purge") return queue.filter((item) => item.id !== id);
  return queue.map((item) => {
    if (item.id !== id) return item;
    if (action === "trash") return { ...item, deleted: true };
    if (action === "restore") return { ...item, deleted: false };
    if (action === "close") return { ...item, status: "closed" };
    return { ...item, status: "open" };
  });
}
