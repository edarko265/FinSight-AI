import {
  balanceTool,
  basketsTool,
  fallbackResult,
  peersTool,
  profileTool,
  recurringTool,
  safeToSpendTool,
  spendingTool,
  trendTool,
  whatIfTool,
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
  recurring:
    /recurring|subscription|regular (bill|payment)|upcoming|coming up|bills?\b|salary|payday|lasku|säännölli|toistuva|tilauks|palkka|räkning|regelbund|prenumeration|lön/,
  baskets: /basket|mandatory|essential|kori|pakolli|välttämät|korg|obligatorisk|nödvändig/,
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

export function routeQuestion(ctx: CoachContext, question: string): ToolResult {
  const text = question.toLowerCase();
  const target = detectTarget(text);
  const period = detectPeriod(text);
  const percent = /(\d{1,3})\s*%/.exec(text) ?? /(\d{1,3})\s*(percent|prosent|procent)/.exec(text);

  if (PATTERNS.whatIf.test(text) || percent) {
    return whatIfTool(ctx, {
      target: target ?? "Restaurants",
      percent: percent ? Number(percent[1]) : 20,
      period,
    });
  }
  if (PATTERNS.safe.test(text)) {
    const days = /(\d{1,2})\s*(day|päiv|dag)/.exec(text);
    const month = /month|kuukau|kuun|månad/.test(text);
    return safeToSpendTool(ctx, { horizonDays: days ? Number(days[1]) : month ? 30 : 7 });
  }
  if (PATTERNS.peers.test(text)) return peersTool(ctx, { target });
  if (PATTERNS.profile.test(text)) return profileTool(ctx);
  if (PATTERNS.baskets.test(text)) return basketsTool(ctx, { period });
  if (PATTERNS.balance.test(text)) return balanceTool(ctx);
  if (PATTERNS.trend.test(text)) return trendTool(ctx, { target });
  if (target) return spendingTool(ctx, { target, period });
  if (PATTERNS.recurring.test(text)) return recurringTool(ctx);
  if (PATTERNS.where.test(text) || PATTERNS.spend.test(text)) return spendingTool(ctx, { period });
  return fallbackResult(ctx);
}
