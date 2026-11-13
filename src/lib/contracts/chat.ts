import type { ChartCard } from "@/lib/contracts/chart";

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; card?: ChartCard };
