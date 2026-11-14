/**
 * Sorts a question the coach could not calculate into a broad theme, so staff
 * can see what customers want next without the question being stored. Only
 * the theme name is ever counted.
 */
const THEMES: [string, RegExp][] = [
  [
    "loans",
    /loan|mortgage|credit|debt|interest rate|laina|asuntolain|luotto|velka|korko|lån|bolån|kredit|skuld|ränta/,
  ],
  [
    "investing",
    /invest|fund|stock|share|etf|portfolio|sijoit|rahasto|osake|salkku|aktie|fond|portfölj/,
  ],
  ["insurance", /insur|vakuutu|försäkr/],
  [
    "cards",
    /\bcard\b|payment|transfer|refund|kortti|maksu|tilisiirto|hyvitys|kort\b|betalning|överföring/,
  ],
  ["taxes", /\btax|vero|skatt/],
  ["pension", /pension|retire|eläke|pensionär/],
  ["benefits", /benefit|allowance|kela|tuki\b|bidrag|förmån/],
  ["account", /password|log ?in|account|app\b|salasana|kirjautu|tili\b|lösenord|logga in|konto/],
  ["budgeting", /budget|plan|budjet|suunnitel/],
];

export const THEME_KEYS = [...THEMES.map(([name]) => name), "other"] as const;

export function themeOf(question: string): string {
  const text = question.toLowerCase();
  return THEMES.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}

/** Subjects the coach cannot calculate from account data, whatever calculation a keyword or the model reached for. */
export const OUTSIDE_THEMES: ReadonlySet<string> = new Set([
  "loans",
  "investing",
  "insurance",
  "cards",
  "taxes",
  "pension",
  "benefits",
  "account",
]);
