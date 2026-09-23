import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError, isUuid } from './http.js';

// Two buckets: uploads land in the private bucket; only images referenced by
// a published article are copied to the public one, under the same path.
export const PRIVATE_BUCKET = 'media-private';
export const PUBLIC_BUCKET = 'media';
/** A copy made moments ago for an in-flight publish is never cleaned up. */
const GRACE_SECONDS = 120;

type ArticleRefs = { id: string; version: number; featured_image_id: string | null; og_image_id: string | null; content: { blocks?: { type?: string; mediaId?: unknown }[] } };

/**
 * Copies every image the article references to the public bucket and records
 * it, so publish_article (which re-checks this) can publish the snapshot.
 * Reads go through the staff client, so RLS still applies.
 */
export async function makeArticleMediaPublic(staff: SupabaseClient, service: SupabaseClient, articleId: string, expectedVersion: number) {
  const { data, error } = await staff.from('articles').select('id, version, featured_image_id, og_image_id, content').eq('id', articleId).maybeSingle();
  if (error || !data) throw new HttpError(404, 'not_found');
  const article = data as ArticleRefs;
  if (article.version !== expectedVersion) throw new HttpError(409, 'version_conflict');
  const ids = [...new Set([article.featured_image_id, article.og_image_id, ...(article.content.blocks || []).filter((b) => b?.type === 'image').map((b) => b.mediaId)].filter(isUuid))];
  if (!ids.length) return 0;
  const { data: media, error: mediaError } = await staff.from('media').select('id, path').in('id', ids);
  if (mediaError || (media || []).length !== ids.length) throw new HttpError(422, 'media_missing');
  for (const item of media as { id: string; path: string }[]) {
    const copy = await service.storage.from(PRIVATE_BUCKET).copy(item.path, item.path, { destinationBucket: PUBLIC_BUCKET });
    if (copy.error && !/exist|duplicate/i.test(copy.error.message)) throw new HttpError(502, 'media_copy_failed');
  }
  const mark = await service.rpc('media_mark_public', { p_ids: ids });
  if (mark.error) throw new Error('media_mark_failed');
  return ids.length;
}

/**
 * Removes from the public bucket every image no published article references.
 * If deleting the objects fails they are flagged public again, so the next
 * run retries instead of forgetting them.
 */
export async function removeUnreferencedPublicMedia(service: SupabaseClient) {
  const { data, error } = await service.rpc('media_unpublish_unreferenced', { p_grace_seconds: GRACE_SECONDS });
  if (error) throw new Error('media_sync_failed');
  const paths = ((data as string[] | null) || []).filter((p) => typeof p === 'string');
  if (!paths.length) return 0;
  const removal = await service.storage.from(PUBLIC_BUCKET).remove(paths);
  if (removal.error) {
    await service.from('media').update({ public_since: new Date().toISOString() }).in('path', paths);
    throw new Error('media_remove_failed');
  }
  return paths.length;
}
