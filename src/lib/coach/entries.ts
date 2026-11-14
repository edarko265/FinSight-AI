import "server-only";

import { ENTRIES } from "@/lib/coach/personal";
import { addToTrash } from "@/lib/coach/trash";
import { ENTRY_ROW_BASE, type Entry, type EntryKind } from "@/lib/data/entries";
import { readState, writeState } from "@/lib/data/repository";

/**
 * The customer's own record of income and expenses. Stored sealed with their
 * key like everything else they own, and applied to their account's history
 * in `personalise`.
 */
const MAX = 300;

export interface EntryInput {
  kind: EntryKind;
  cents: number;
  date: string;
  category: string;
  note: string;
}

export async function listEntries(ref: string): Promise<Entry[]> {
  return (await readState<Entry[]>(ref, ENTRIES)) ?? [];
}

function freeRow(entries: readonly Entry[]): number {
  const taken = new Set(entries.map((entry) => entry.row));
  for (;;) {
    const row = ENTRY_ROW_BASE + crypto.getRandomValues(new Uint32Array(1))[0]!;
    if (!taken.has(row)) return row;
  }
}

const clean = (input: EntryInput): EntryInput => ({
  kind: input.kind,
  cents: Math.round(input.cents),
  date: input.date,
  category: input.category,
  note: input.note.trim().slice(0, 60),
});

export async function addEntry(ref: string, input: EntryInput): Promise<Entry | "too_many"> {
  const entries = await listEntries(ref);
  if (entries.length >= MAX) return "too_many";
  const entry: Entry = {
    id: `entry-${crypto.randomUUID()}`,
    row: freeRow(entries),
    ...clean(input),
  };
  await writeState(ref, ENTRIES, [...entries, entry]);
  return entry;
}

export async function updateEntry(ref: string, id: string, input: EntryInput): Promise<boolean> {
  const entries = await listEntries(ref);
  if (!entries.some((entry) => entry.id === id)) return false;
  await writeState(
    ref,
    ENTRIES,
    entries.map((entry) => (entry.id === id ? { ...entry, ...clean(input) } : entry)),
  );
  return true;
}

/** Takes the entry out of the account's history and puts it in the recycle bin. */
export async function deleteEntry(ref: string, id: string): Promise<boolean> {
  const entries = await listEntries(ref);
  const removed = entries.find((entry) => entry.id === id);
  if (!removed) return false;
  await writeState(
    ref,
    ENTRIES,
    entries.filter((entry) => entry.id !== id),
  );
  await addToTrash(ref, [
    {
      id: `trash-${crypto.randomUUID()}`,
      kind: "entry",
      deletedAt: new Date().toISOString(),
      // Kind, amount and category: the bin shows them in the customer's language.
      label: `${removed.kind}|${removed.cents}|${removed.category}`,
      item: removed,
    },
  ]);
  return true;
}

export async function restoreEntry(ref: string, entry: Entry): Promise<void> {
  const entries = await listEntries(ref);
  if (entries.some((item) => item.id === entry.id)) return;
  const row = entries.some((item) => item.row === entry.row) ? freeRow(entries) : entry.row;
  await writeState(ref, ENTRIES, [...entries, { ...entry, row }].slice(0, MAX));
}
