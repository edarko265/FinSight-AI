import { applyChart, runTool } from "@/lib/coach/registry";
import type { ChartStyle } from "@/lib/contracts/chart";
import {
  fallbackResult,
  type CoachContext,
  type PeriodKey,
  type TargetKey,
  type ToolResult,
} from "@/lib/coach/tools";

/**
 * Basic mode: answers the supported questions with no language model, by
 * matching keywords in English, Finnish and Swedish. Used when AI is switched
 * off, unavailable or times out, so the coach never dead-ends.
 */
const TARGET_WORDS: [TargetKey, RegExp][] = [
  ["taxi", /\btaxi|\btaks|\bcab\b/],
  ["cafes", /coffee|caf[eé]|kahvi|kaffe|fast food|pikaruo|snabbmat/],
  ["Restaurants", /restaurant|dining|eating out|eat out|ravintol|ulkona syö|restaurang|äta ute/],
  ["Groceries", /grocer|supermarket|\bfood\b|ruoka|ruokakaup|livsmedel|\bmat\b|matbutik/],
  ["Housing", /\brent\b|housing|mortgage|vuokra|asumi|asunto|hyra|boende/],
  ["Utilities", /utilit|electric|\bbills?\b.*(power|water)|sähkö|vesi|\bel\b|vatten/],
  ["Health", /health|doctor|pharmac|dentist|tervey|lääk|apteek|hammas|hälsa|läkare|apotek|tandläk/],
  [
    "Home & Tech",
    /home.*tech|furniture|electronics|repair|koti|huonekalu|elektroniik|korjau|möbler|elektronik|reparation/,
  ],
  [
    "Transportation",
    /transport|fuel|petrol|parking|\bbus\b|train|liikenne|bensa|pysäk|juna|bussi|bensin|parkering|tåg|buss/,
  ],
  ["Entertainment", /entertain|cinema|movie|viihde|elokuv|nöje|\bbio\b/],
  ["Lifestyle", /lifestyle|shopping|cloth|hobb|vaatte|ostoks|harrast|kläder|fritid/],
  [
    "Travel",
    /travel|flight|hotel|holiday|vacation|matk|lento|hotelli|loma|resor|resa|flyg|hotell|semester/,
  ],
];

const PATTERNS = {
  whatIf:
    /what if|reduce|cut\b|cut back|save if|less on|entä jos|vähen|jos säästä|tänk om|minska|dra ner|spara om/,
  safe: /safe to|can i (spend|afford)|afford|how much can i|turvallis|voinko|paljonko voin|varaa|käytettäviss|tryggt|har jag råd|kan jag (lägga|spendera|använda)/,
  profile:
    /kind of spender|what kind|spender|habit|pattern|millainen|kuluttaja|tottumu|vilken sorts|konsument|vanor|mönster/,
  peers:
    /compar|people my age|my age|average person|others|peers|benchmark|ikäis|vertaa|vertaudu|keskiver|muihin|jämför|jämnårig|genomsnitt|andra/,
  recommend:
    /recommend|advice|advise|suggest|tips?\b|improve|better with|what should i|suosit|neuvo|vinkk|paranta|mitä minun|rekommend|råd\b|tips|förbättra|vad borde/,
  recurring:
    /recurring|subscription|regular (bill|payment)|upcoming|coming up|bills?\b|salary|payday|lasku|säännölli|toistuva|tilauks|palkka|räkning|regelbund|prenumeration|lön/,
  baskets: /basket|mandatory|essential|kori|pakolli|välttämät|korg|obligatorisk|nödvändig/,
  flow: /flow|income go|sankey|diagram|virta|tuloni|kaavio|flöde|min inkomst/,
  balance:
    /balance|saldo|how much (money )?do i have|paljonko (minulla|rahaa)|hur mycket (har jag|pengar)/,
  trend:
    /trend|over time|month by month|each month|per month|kuukausittain|kehity|ajan mittaan|per månad|utveckling|över tid/,
  where: /where|go(es)?\b|breakdown|categor|mihin|menevät|luoki|erittely|vart|kategori|fördel/,
  spend: /spen[dt]|paid|cost|käyti|käytin|kulut|maksoi|lade|spender|betal|kosta/,
} as const;

function detectTarget(text: string): TargetKey | undefined {
  return TARGET_WORDS.find(([, pattern]) => pattern.test(text))?.[0];
}

function detectPeriod(text: string): PeriodKey | undefined {
  if (/this month|tässä kuussa|tämän kuun|den här månaden|denna månad/.test(text))
    return "this_month";
  if (
    /(last|past) (year|12 months|twelve months)|viime vuo|12 kuukau|senaste året|12 månader/.test(
      text,
    )
  ) {
    return "last_12_months";
  }
  if (
    /(six|6) months|half year|6 kuukau|kuuden kuukau|puoli vuot|sex månader|6 månader|halvår/.test(
      text,
    )
  ) {
    return "last_6_months";
  }
  if (/(three|3) months|quarter|3 kuukau|kolmen kuukau|tre månader|3 månader|kvartal/.test(text)) {
    return "last_3_months";
  }
  if (/last month|viime kuu|förra månaden/.test(text)) return "last_month";
  const explicit = /\b(20\d{2})-(0[1-9]|1[0-2])\b/.exec(text);
  return explicit ? (`${explicit[1]}-${explicit[2]}` as PeriodKey) : undefined;
}

function route(ctx: CoachContext, question: string): ToolResult {
  const text = question.toLowerCase();
  const target = detectTarget(text);
  const period = detectPeriod(text);
  const percent = /(\d{1,3})\s*%/.exec(text) ?? /(\d{1,3})\s*(percent|prosent|procent)/.exec(text);

  if (PATTERNS.whatIf.test(text) || percent) {
    return runTool(ctx, "what_if", {
      target: target ?? "Restaurants",
      percent: Math.min(100, percent ? Number(percent[1]) : 20),
      period,
    });
  }
  if (PATTERNS.safe.test(text)) {
    const days = /(\d{1,2})\s*(day|päiv|dag)/.exec(text);
    const month = /month|kuukau|kuun|månad/.test(text);
    return runTool(ctx, "safe_to_spend", {
      horizonDays: Math.min(31, Math.max(1, days ? Number(days[1]) : month ? 30 : 7)),
    });
  }
  if (PATTERNS.flow.test(text)) return runTool(ctx, "flow", { period });
  if (PATTERNS.peers.test(text)) return runTool(ctx, "peers", { target });
  if (PATTERNS.profile.test(text)) return runTool(ctx, "profile", {});
  if (PATTERNS.baskets.test(text)) return runTool(ctx, "baskets", { period });
  if (PATTERNS.balance.test(text)) return runTool(ctx, "balance", {});
  if (PATTERNS.trend.test(text)) return runTool(ctx, "trend", { target });
  if (target) return runTool(ctx, "spending", { target, period });
  if (PATTERNS.recommend.test(text)) return runTool(ctx, "recommend", {});
  if (PATTERNS.recurring.test(text)) return runTool(ctx, "recurring", {});
  if (PATTERNS.where.test(text) || PATTERNS.spend.test(text))
    return runTool(ctx, "spending", { period });
  return fallbackResult(ctx);
}

const CHART_WORDS: [ChartStyle, RegExp][] = [
  ["donut", /\bpie\b|donut|doughnut|piirakka|ympyrä|cirkel|tårt/],
  ["line", /line (chart|graph)|as a line|viiva|linje/],
  ["bar", /bar (chart|graph)|as bars|pylväs|palkki|stapel/],
];

/** The chart type the user asked for by name, if any. */
export function detectChart(question: string): ChartStyle | undefined {
  const text = question.toLowerCase();
  return CHART_WORDS.find(([, pattern]) => pattern.test(text))?.[0];
}

/** Basic mode: picks the calculation by keywords and draws it in the chart type asked for. */
export function routeQuestion(ctx: CoachContext, question: string): ToolResult {
  return applyChart(route(ctx, question), detectChart(question));
}

const GOAL_WORDS =
  /\b(save|saving|goal|put aside|set aside)\b|säästä|säästö|tavoit|spara|sparmål|\bmål\b/;
const AMOUNT = /(?:€\s*)?(\d[\d\s.,]*\d|\d)\s*(?:€|eur\w*|e\b)|€\s*(\d[\d\s.,]*\d|\d)/;

/**
 * Basic-mode reading of a savings goal from free text, e.g. "I want to save
 * 1 200 € for a trip in 8 months". Returns "list" when goals are mentioned
 * without an amount.
 */
export function detectGoal(
  question: string,
): { targetCents: number; months?: number } | "list" | null {
  const text = question.toLowerCase();
  if (!GOAL_WORDS.test(text) || /%|percent|prosent|procent/.test(text)) return null;
  const amount = AMOUNT.exec(text);
  const raw = (amount?.[1] ?? amount?.[2] ?? "").replace(/[\s.]/g, "").replace(",", ".");
  const euros = Number(raw);
  if (!amount || !Number.isFinite(euros) || euros <= 0) {
    return /goal|tavoit|sparmål|\bmål\b/.test(text) ? "list" : null;
  }
  const span =
    /(\d{1,3})\s*(month|kuukau|kk\b|mån)/.exec(text) ?? /(\d{1,2})\s*(year|vuo|år)/.exec(text);
  const months = span ? Number(span[1]) * (/year|vuo|år/.test(span[2] ?? "") ? 12 : 1) : undefined;
  return { targetCents: Math.round(euros * 100), months };
}
