import { z } from "zod";

import { THEME_KEYS } from "@/lib/admin/themes";

/** What staff submit when they teach the coach an answer. At least one language must be written. */
export const taughtInputSchema = z.object({
  theme: z.string().refine((value) => (THEME_KEYS as readonly string[]).includes(value)),
  keywords: z.array(z.string().trim().toLowerCase().min(2).max(60)).max(12),
  answers: z
    .object({
      en: z.string().trim().max(1200),
      fi: z.string().trim().max(1200),
      sv: z.string().trim().max(1200),
    })
    .refine((value) => Boolean(value.en || value.fi || value.sv)),
});
