import { z } from 'zod';
import { authorKeys, categories } from './types';

// Mirrors private.valid_article_content() in the database migration.
// Used by the build, the admin editor and the server functions.

export const MEDIA_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|avif)$/;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const text = (max: number, min = 1) => z.string().min(min).max(max);
const optionalText = (max: number) => z.string().max(max).nullish();
const id = optionalText(40);
const dimension = z.number().min(1).max(10000);

export const blockSchema = z.discriminatedUnion('type', [
  z.strictObject({ id, type: z.literal('paragraph'), text: text(5000) }),
  z.strictObject({ id, type: z.literal('heading'), level: z.union([z.literal(2), z.literal(3)]), text: text(200) }),
  z.strictObject({ id, type: z.literal('list'), style: z.enum(['bullet', 'ordered']), items: z.array(text(1000)).min(1).max(50) }),
  z.strictObject({ id, type: z.literal('quote'), text: text(2000), cite: optionalText(200) }),
  z.strictObject({ id, type: z.literal('callout'), title: optionalText(120), text: text(2000) }),
  z.strictObject({ id, type: z.literal('faq'), question: text(300), answer: text(3000) }),
  z
    .strictObject({
      id,
      type: z.literal('table'),
      caption: optionalText(200),
      header: z.array(text(200, 0)).min(1).max(6),
      rows: z.array(z.array(text(500, 0))).min(1).max(30),
    })
    .refine((t) => t.rows.every((r) => r.length === t.header.length), 'Todas as linhas precisam ter o mesmo número de colunas.'),
  z.strictObject({
    id,
    type: z.literal('image'),
    mediaId: z.string().length(36),
    path: z.string().regex(MEDIA_PATH_RE),
    alt: text(300, 0),
    caption: optionalText(300),
    width: dimension,
    height: dimension,
  }),
]);

export const contentSchema = z.strictObject({ version: z.literal(1), blocks: z.array(blockSchema).max(400) });

export const sourceSchema = z.strictObject({
  title: text(200),
  url: z.string().max(500).regex(/^https?:\/\/[^\s<>"]+$/, 'Use um endereço que comece com https://'),
});

export const imageRefSchema = z.object({
  path: z.string().regex(MEDIA_PATH_RE),
  width: dimension,
  height: dimension,
  alt: z.string().max(300),
});

/** Row shape of public.published_articles, as read by the static build. */
export const publishedRowSchema = z.object({
  slug: z.string().regex(SLUG_RE).max(120),
  title: text(200),
  excerpt: text(400),
  content: contentSchema,
  category: z.enum(categories),
  tags: z.array(text(40)).max(12),
  author_key: z.enum(authorKeys),
  sources: z.array(sourceSchema).max(20),
  featured_image: imageRefSchema.nullable(),
  seo_title: z.string().max(120).nullable(),
  seo_description: z.string().max(320).nullable(),
  canonical_url: z.string().max(500).regex(/^https:\/\/[^\s<>"]+$/).nullable(),
  og_title: z.string().max(120).nullable(),
  og_description: z.string().max(320).nullable(),
  og_image: imageRefSchema.nullable(),
  robots_index: z.boolean(),
  reading_minutes: z.number().int().min(1).max(120).nullable(),
  published_at: z.string().nullable(),
  modified_at: z.string().nullable(),
  created_at: z.string(),
});
export type PublishedRow = z.infer<typeof publishedRowSchema>;
