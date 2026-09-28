import { requireConfig, serverEnv } from '../../server/env.js';
import { assertSameOrigin, fail, handle, isUuid, json, logEvent, readJson } from '../../server/http.js';
import { requestDeploy } from '../../server/deploy.js';
import { makeArticleMediaPublic, removeUnreferencedPublicMedia, rollbackPublicCopies } from '../../server/media.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { requireStaff, serviceClient } from '../../server/supabase.js';

// Publish, unpublish or archive an article. Publishing is checked by the
// database first (same rules as publish_article); only then are the images
// the article needs copied to the public bucket, and if the publication is
// still refused those copies are removed at once. The workflow change runs
// as the signed-in user, so the database re-checks authorization and the
// audit log names them. Afterwards unused public copies are removed and the
// static site is rebuilt.

const rpcFor = { publish: 'publish_article', unpublish: 'unpublish_article', archive: 'archive_article' } as const;
const errors: Record<string, [number, string]> = {
  PT409: [409, 'version_conflict'],
  '42501': [403, 'forbidden'],
  P0002: [404, 'not_found'],
  '22023': [422, 'invalid_article'],
};
const mediaErrors = new Set(['media_not_public', 'media_mismatch', 'media_missing']);
const refusal = (error: { code?: string; message?: string }) => {
  const [status, code] = errors[error.code || ''] || [500, 'workflow_failed'];
  return fail(status, mediaErrors.has(error.message || '') ? 'invalid_media' : code);
};

export function POST(request: Request) {
  return handle(request, async () => {
    const env = serverEnv();
    requireConfig(env);
    assertSameOrigin(request, env.siteUrl);
    const staff = await requireStaff(request, env);
    const body = (await readJson(request, 1024)) as { id?: unknown; action?: unknown; expectedVersion?: unknown };
    const action = typeof body?.action === 'string' && body.action in rpcFor ? (body.action as keyof typeof rpcFor) : null;
    if (!isUuid(body?.id) || !action) return fail(400, 'invalid_request');
    const version = Number(body.expectedVersion);
    if (action === 'publish' && !Number.isInteger(version)) return fail(400, 'invalid_request');
    const service = serviceClient(env);
    await rateLimit(service, `publish:${hashKey(env.rateLimitSalt, staff.userId)}`, 60, 3600);

    let copied: string[] = [];
    if (action === 'publish') {
      const check = await staff.client.rpc('can_publish_article', { p_id: body.id, p_expected_version: version });
      if (check.error) return refusal(check.error);
      copied = await makeArticleMediaPublic(staff.client, service, body.id, version);
    }
    const { error } = await staff.client.rpc(rpcFor[action], action === 'publish' ? { p_id: body.id, p_expected_version: version } : { p_id: body.id });
    if (error) {
      await rollbackPublicCopies(service, copied).catch((e: Error) => logEvent('error', 'media_rollback_failed', { message: e.message }));
      return refusal(error);
    }
    await removeUnreferencedPublicMedia(service).catch((e: Error) => logEvent('error', 'media_cleanup_failed', { message: e.message }));
    const site = await requestDeploy(env, service, staff.userId, `${action}: ${body.id}`);
    return json(200, { ok: true, site: site.ok ? 'updating' : 'not_updated' });
  });
}
