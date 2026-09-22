import { plainText } from './inline';
import type { ArticleContent, BlogPost } from './types';
import type { PublishedRow } from './schema';

const WORDS_PER_MINUTE = 200;

export function readingMinutes(content: ArticleContent, excerpt = '') {
  const parts: string[] = [excerpt];
  for (const b of content.blocks) {
    if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote' || b.type === 'callout') parts.push(b.text);
    else if (b.type === 'list') parts.push(...b.items);
    else if (b.type === 'faq') parts.push(b.question, b.answer);
    else if (b.type === 'table') parts.push(...b.header, ...b.rows.flat());
  }
  const words = plainText(parts.join(' ')).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function postFromRow(row: PublishedRow): BlogPost {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content as ArticleContent,
    category: row.category,
    tags: row.tags,
    author: row.author_key,
    sources: row.sources,
    featuredImage: row.featured_image,
    seo: {
      title: row.seo_title,
      description: row.seo_description,
      canonical: row.canonical_url,
      ogTitle: row.og_title,
      ogDescription: row.og_description,
      ogImage: row.og_image,
      index: row.robots_index,
    },
    publishedAt: row.published_at,
    modifiedAt: row.modified_at,
    readingMinutes: row.reading_minutes ?? readingMinutes(row.content as ArticleContent, row.excerpt),
  };
}
