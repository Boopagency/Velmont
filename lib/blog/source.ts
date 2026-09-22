import { z } from 'zod';
import { legacyPosts } from './legacy';
import { postFromRow } from './posts';
import { publishedRowSchema } from './schema';
import type { BlogPost, BlogSummary } from './types';
import { summarize } from './types';

// Build-time only. Reads the public snapshot table with the public (anon) key;
// drafts are never readable with that key, so they can't reach the static site.

const columns = Object.keys(publishedRowSchema.shape).join(',');

export type PostSource = { posts: BlogPost[]; origin: 'cms' | 'launch-content' };

export async function loadPublishedPosts(env: { url: string; anonKey: string }, fetcher: typeof fetch = fetch): Promise<PostSource> {
  if (!env.url || !env.anonKey) return { posts: legacyPosts, origin: 'launch-content' };
  const endpoint = `${env.url}/rest/v1/published_articles?select=${columns}&limit=1000`;
  const response = await fetcher(endpoint, { headers: { apikey: env.anonKey, authorization: `Bearer ${env.anonKey}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`CMS request failed (${response.status}). Refusing to build without published articles.`);
  const rows = z.array(publishedRowSchema).parse(await response.json());
  const sortKey = (r: (typeof rows)[number]) => Date.parse(r.published_at || r.created_at);
  rows.sort((a, b) => sortKey(b) - sortKey(a));
  return { posts: rows.map(postFromRow), origin: 'cms' };
}

/** Up to three other articles, same category first. */
export function relatedPosts(post: BlogPost, posts: BlogPost[]): BlogSummary[] {
  const others = posts.filter((p) => p.slug !== post.slug);
  return [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)].slice(0, 3).map(summarize);
}
