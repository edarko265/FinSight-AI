import type { ChartCard, WidgetQuery } from "@/lib/contracts/chart";

/** Where a figure came from: enough to re-run the query and list the transactions behind it. */
export interface EvidenceRef {
  startInclusive: string;
  endExclusive: string;
  periodLabel: string;
  categories?: string[];
  mccs?: string[];
  transactionCount: number;
}

/** A server-calculated amount. The UI and the model only ever repeat these. */
export interface MoneyFact {
  label: string;
  valueCents: number;
}

export type AssistantMessage = {
  id: string;
  role: "assistant";
  text: string;
  card?: ChartCard;
  /** The calculation behind the card, so it can be pinned to a dashboard and refreshed. */
  query?: WidgetQuery;
  facts?: MoneyFact[];
  evidence?: EvidenceRef;
  /** A short teaching note that goes with the answer. */
  lesson?: string;
  followUps?: string[];
  /** Whether a language model wrote the text, or the built-in templates did. */
  mode?: "ai" | "basic";
};

export type ChatMessage = { id: string; role: "user"; text: string } | AssistantMessage;

export interface ChatRequest {
  message: string;
  locale?: string;
  history?: { role: "user" | "assistant"; text: string }[];
}
