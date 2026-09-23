import { missingConfig, serverEnv } from '../../server/env.js';
import { assertSameOrigin, fail, handle, json, readJson } from '../../server/http.js';
import { requestDeploy } from '../../server/deploy.js';
import { removeUnreferencedPublicMedia } from '../../server/media.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { requireStaff, serviceClient } from '../../server/supabase.js';

/** Manual "update the site": cleans up public media, then triggers a build. */
export function POST(request: Request) {
  return handle(async () => {
    const env = serverEnv();
    // Names of missing settings (never values) make a misconfigured deploy obvious.
    const missing = missingConfig(env);
    if (missing.length) {
      console.error('api_error', `not_configured: ${missing.join(', ')}`);
      return json(503, { error: 'not_configured', missing });
    }
    assertSameOrigin(request, env.siteUrl);
    const staff = await requireStaff(request, env);
    const body = (await readJson(request, 1024)) as { reason?: unknown };
    const reason = typeof body?.reason === 'string' ? body.reason : 'manual';
    const service = serviceClient(env);
    await rateLimit(service, `rebuild:${hashKey(env.rateLimitSalt, staff.userId)}`, 30, 3600);
    await rateLimit(service, 'rebuild:global', 60, 3600);
    await removeUnreferencedPublicMedia(service).catch((error: Error) => console.error('api_error', error.message));
    const deploy = await requestDeploy(env, service, staff.userId, reason);
    if (deploy.ok) return json(202, { ok: true });
    if (deploy.error === 'deploy_hook_not_configured') {
      console.error('api_error', 'not_configured: VERCEL_DEPLOY_HOOK_URL');
      return json(503, { error: 'deploy_hook_not_configured', missing: ['VERCEL_DEPLOY_HOOK_URL'] });
    }
    return fail(502, 'deploy_hook_failed');
  });
}
