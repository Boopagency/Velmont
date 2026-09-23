import { randomUUID } from 'node:crypto';
import { serverEnv, isConfigured } from '../../server/env.js';
import { assertSameOrigin, fail, handle, HttpError, isUuid, json, readJson } from '../../server/http.js';
import { extensionMatches, MAX_IMAGE_BYTES, sniffImage } from '../../server/image.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { PRIVATE_BUCKET, PUBLIC_BUCKET } from '../../server/media.js';
import { requireStaff, serviceClient } from '../../server/supabase.js';

const columns = 'id, path, mime_type, bytes, width, height, alt, created_at';

/**
 * Upload: staff only. The file is identified by its bytes and stored in the
 * private bucket; it becomes public only if a published article uses it.
 */
export function POST(request: Request) {
  return handle(async () => {
    const env = serverEnv();
    if (!isConfigured(env)) return fail(503, 'not_configured');
    assertSameOrigin(request, env.siteUrl);
    const staff = await requireStaff(request, env);
    const service = serviceClient(env);
    await rateLimit(service, `upload:${hashKey(env.rateLimitSalt, staff.userId)}`, 60, 3600);

    if (!(request.headers.get('content-type') || '').startsWith('multipart/form-data')) return fail(415, 'unsupported_media_type');
    if (Number(request.headers.get('content-length') || 0) > MAX_IMAGE_BYTES + 64 * 1024) return fail(413, 'payload_too_large');
    const form = await request.formData().catch(() => {
      throw new HttpError(400, 'invalid_form');
    });
    const file = form.get('file');
    const rawAlt = form.get('alt');
    const alt = (typeof rawAlt === 'string' ? rawAlt : '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!(file instanceof File)) return fail(400, 'missing_file');
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) return fail(413, 'payload_too_large');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = sniffImage(bytes);
    if (!info || !extensionMatches(file.name, info)) return fail(415, 'unsupported_image');

    const path = `${randomUUID()}.${info.ext}`;
    const upload = await service.storage.from(PRIVATE_BUCKET).upload(path, bytes, { contentType: info.mime, cacheControl: '3600', upsert: false });
    if (upload.error) throw new Error('storage_upload_failed');
    // Registered as the user, so RLS applies and the audit log names them.
    const { data, error } = await staff.client.from('media').insert({ path, mime_type: info.mime, bytes: bytes.byteLength, width: info.width, height: info.height, alt }).select(columns).single();
    if (error) {
      await service.storage.from(PRIVATE_BUCKET).remove([path]);
      throw new Error('media_insert_failed');
    }
    return json(201, { media: data });
  });
}

/** Delete: refuses while any draft or published article still uses the image. */
export function DELETE(request: Request) {
  return handle(async () => {
    const env = serverEnv();
    if (!isConfigured(env)) return fail(503, 'not_configured');
    assertSameOrigin(request, env.siteUrl);
    const staff = await requireStaff(request, env);
    const body = (await readJson(request, 1024)) as { id?: unknown };
    if (!isUuid(body?.id)) return fail(400, 'invalid_id');
    const id = body.id;

    const { data: media } = await staff.client.from('media').select('id, path').eq('id', id).maybeSingle();
    if (!media) return fail(404, 'not_found');
    const usage = { blocks: [{ mediaId: id }] };
    const counts = await Promise.all([
      staff.client.from('articles').select('id', { count: 'exact', head: true }).or(`featured_image_id.eq.${id},og_image_id.eq.${id}`),
      staff.client.from('articles').select('id', { count: 'exact', head: true }).contains('content', usage),
      staff.client.from('published_articles').select('article_id', { count: 'exact', head: true }).contains('content', usage),
      staff.client.from('published_articles').select('article_id', { count: 'exact', head: true }).eq('featured_image->>path', media.path),
      staff.client.from('published_articles').select('article_id', { count: 'exact', head: true }).eq('og_image->>path', media.path),
    ]);
    if (counts.some((c) => c.error)) throw new Error('usage_check_failed');
    if (counts.some((c) => (c.count ?? 0) > 0)) return fail(409, 'media_in_use');

    const { error } = await staff.client.from('media').delete().eq('id', id);
    if (error) return fail(409, 'media_in_use');
    const service = serviceClient(env);
    await service.storage.from(PRIVATE_BUCKET).remove([media.path]);
    await service.storage.from(PUBLIC_BUCKET).remove([media.path]);
    return json(200, { ok: true });
  });
}
