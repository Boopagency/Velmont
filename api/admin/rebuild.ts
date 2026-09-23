import { serverEnv, isConfigured } from '../../server/env.js';
import { assertSameOrigin, fail, handle, json, readJson } from '../../server/http.js';
import { deployHookConfigured, requestDeploy } from '../../server/deploy.js';
import { removeUnreferencedPublicMedia } from '../../server/media.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { requireStaff, serviceClient } from '../../server/supabase.js';

/** Manual "update the site": cleans up public media, then triggers a build. */
export function POST(request: Request) {
  return handle(async () => {
    const env = serverEnv();
    if (!isConfigured(env)) return fail(503, 'not_configured');
    assertSameOrigin(request, env.siteUrl);
    const staff = await requireStaff(request, env);
    const body = (await readJson(request, 1024)) as { reason?: unknown };
    const reason = typeof body?.reason === 'string' ? body.reason : 'manual';
    const service = serviceClient(env);
    await rateLimit(service, `rebuild:${hashKey(env.rateLimitSalt, staff.userId)}`, 30, 3600);
    await rateLimit(service, 'rebuild:global', 60, 3600);
    await removeUnreferencedPublicMedia(service).catch((error: Error) => console.error('api_error', error.message));
    if (!deployHookConfigured(env)) return fail(503, 'deploy_hook_not_configured');
    return (await requestDeploy(env, service, staff.userId, reason)) ? json(202, { ok: true }) : fail(502, 'deploy_hook_failed');
  });
}
