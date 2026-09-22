import { z } from 'zod';

// Normalizes free text: Unicode NFC, no control characters, collapsed spaces.
export const clean = (value: string) =>
  value
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const text = (max: number) => z.string().max(max * 4).transform(clean).pipe(z.string().max(max));
const optional = (max: number) => text(max).optional().transform((v) => v || null);

export const interests = ['Marcas', 'Patentes', 'Software', 'Outros ativos', 'Preciso de orientação'] as const;

// Strict: unknown keys (status, notes, id...) are rejected, preventing mass assignment.
export const leadSchema = z.strictObject({
  name: text(100).pipe(z.string().min(1)),
  company: optional(150),
  interest: z.enum(interests),
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
  landing_page: z.string().max(500).regex(/^\/[^\s<>"'\\]*$/).optional(),
  referrer: z.string().max(500).regex(/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i).optional(),
  utm_source: optional(150),
  utm_medium: optional(150),
  utm_campaign: optional(150),
  utm_content: optional(150),
  utm_term: optional(150),
});

export type LeadInput = z.infer<typeof leadSchema>;

/** The only columns a public submission can write. */
export const leadRow = (lead: LeadInput) => ({
  name: lead.name,
  company: lead.company,
  interest: lead.interest,
  landing_page: lead.landing_page ?? null,
  referrer: lead.referrer ?? null,
  utm_source: lead.utm_source,
  utm_medium: lead.utm_medium,
  utm_campaign: lead.utm_campaign,
  utm_content: lead.utm_content,
  utm_term: lead.utm_term,
});
