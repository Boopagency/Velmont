import { serverEnv, isConfigured } from '../../server/env.js';
import { assertSameOrigin, fail, handle, isUuid, json, readJson } from '../../server/http.js';
import { requestDeploy } from '../../server/deploy.js';
import { makeArticleMediaPublic, removeUnreferencedPublicMedia } from '../../server/media.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { requireStaff, serviceClient } from '../../server/supabase.js';

// Publish, unpublish or archive an article. Publishing first copies the
// images the article needs to the public bucket; the workflow change itself
// runs as the signed-in user, so the database re-checks authorization and
// the audit log names them. Afterwards unused public copies are removed and
// the static site is rebuilt.

const rpcFor = { publish: 'publish_article', unpublish: 'unpublish_article', archive: 'archive_article' } as const;
const errors: Record<string, [number, string]> = {
  '40001': [409, 'version_conflict'],
  '42501': [403, 'forbidden'],
  P0002: [404, 'not_found'],
  '22023': [422, 'invalid_article'],
};

export function POST(request: Request) {
  return handle(async () => {
    const env = serverEnv();
    if (!isConfigured(env)) return fail(503, 'not_configured');
    assertSameOrigin(request, env.siteUrl);
    const staff = await requireStaff(request, env);
    const body = (await readJson(request, 1024)) as { id?: unknown; action?: unknown; expectedVersion?: unknown };
    const action = typeof body?.action === 'string' && body.action in rpcFor ? (body.action as keyof typeof rpcFor) : null;
    if (!isUuid(body?.id) || !action) return fail(400, 'invalid_request');
    const version = Number(body.expectedVersion);
    if (action === 'publish' && !Number.isInteger(version)) return fail(400, 'invalid_request');
    const service = serviceClient(env);
    await rateLimit(service, `publish:${hashKey(env.rateLimitSalt, staff.userId)}`, 60, 3600);

    if (action === 'publish') await makeArticleMediaPublic(staff.client, service, body.id, version);
    const { error } = await staff.client.rpc(rpcFor[action], action === 'publish' ? { p_id: body.id, p_expected_version: version } : { p_id: body.id });
    if (error) {
      const [status, code] = errors[error.code || ''] || [500, 'workflow_failed'];
      return fail(status, error.message === 'media_not_public' || error.message === 'media_mismatch' ? 'invalid_media' : code);
    }
    await removeUnreferencedPublicMedia(service).catch((e: Error) => console.error('api_error', e.message));
    const site = await requestDeploy(env, service, staff.userId, `${action}: ${body.id}`);
    return json(200, { ok: true, site: site ? 'updating' : 'not_updated' });
  });
}
