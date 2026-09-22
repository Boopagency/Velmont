import { articles } from '@/content/insights';
import type { BlogPost, Category } from './types';

// The three launch articles, in the CMS shape. Used by the build when the
// CMS is not configured yet, and as the source of the one-time import.
export const legacyPosts: BlogPost[] = articles.map((a) => ({
  slug: a.slug,
  title: a.title,
  excerpt: a.description,
  content: { version: 1, blocks: a.sections.flatMap((s) => [{ type: 'heading' as const, level: 2 as const, text: s.title }, { type: 'paragraph' as const, text: s.text }]) },
  category: a.category as Category,
  tags: [],
  author: 'velmont',
  sources: a.sources,
  featuredImage: null,
  seo: { title: null, description: null, canonical: null, ogTitle: null, ogDescription: null, ogImage: null, index: true },
  publishedAt: a.datePublished ?? null,
  modifiedAt: a.dateModified ?? null,
  readingMinutes: Number.parseInt(a.readTime, 10) || 2,
}));
