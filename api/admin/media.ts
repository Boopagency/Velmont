import { randomUUID } from 'node:crypto';
import { requireConfig, serverEnv } from '../../server/env.js';
import { assertSameOrigin, fail, handle, HttpError, isUuid, json, readJson } from '../../server/http.js';
import { extensionMatches, hasMetadata, MAX_IMAGE_BYTES, sniffImage, withoutMetadata } from '../../server/image.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { PRIVATE_BUCKET, PUBLIC_BUCKET } from '../../server/media.js';
import { requireStaff, serviceClient } from '../../server/supabase.js';

const columns = 'id, path, mime_type, bytes, width, height, alt, created_at';

/**
 * Upload: staff only. The file is identified by its bytes, stripped of
 * metadata (EXIF, GPS, XMP…) whoever sent it, and stored in the private
 * bucket; it becomes public only if a published article uses it.
 */
export function POST(request: Request) {
  return handle(request, async () => {
    const env = serverEnv();
    requireConfig(env);
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
    let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
    let info = sniffImage(bytes);
    if (!info || !extensionMatches(file.name, info)) return fail(415, 'unsupported_image');
    if (hasMetadata(bytes, info)) {
      const clean = await withoutMetadata(bytes, info).catch(() => null);
      if (!clean) return fail(415, 'unsupported_image');
      ({ bytes, info } = clean);
    }

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

/**
 * Delete: only through the database function, which refuses images a draft
 * or a publication still uses (the table itself no longer accepts DELETE
 * from signed-in users). Then both stored copies are removed.
 */
export function DELETE(request: Request) {
  return handle(request, async () => {
    const env = serverEnv();
    requireConfig(env);
    assertSameOrigin(request, env.siteUrl);
    const staff = await requireStaff(request, env);
    const body = (await readJson(request, 1024)) as { id?: unknown };
    if (!isUuid(body?.id)) return fail(400, 'invalid_id');

    const { data, error } = await staff.client.rpc('delete_media', { p_id: body.id });
    if (error) {
      if (error.code === 'P0002') return fail(404, 'not_found');
      if (error.code === '23503') return fail(409, 'media_in_use');
      if (error.code === '42501') return fail(403, 'forbidden');
      throw new Error('media_delete_failed');
    }
    const path = (data as { path?: unknown } | null)?.path;
    if (typeof path !== 'string') throw new Error('media_delete_failed');
    const service = serviceClient(env);
    await service.storage.from(PRIVATE_BUCKET).remove([path]);
    await service.storage.from(PUBLIC_BUCKET).remove([path]);
    return json(200, { ok: true });
  });
}
