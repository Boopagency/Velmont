import { missingConfig, serverEnv } from '../../server/env.js';
import { assertSameOrigin, fail, handle, json, logEvent, readJson } from '../../server/http.js';
import { requestDeploy } from '../../server/deploy.js';
import { removeUnreferencedPublicMedia } from '../../server/media.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { requireStaff, serviceClient } from '../../server/supabase.js';

/** Manual "update the site": cleans up public media, then triggers a build. */
export function POST(request: Request) {
  return handle(request, async () => {
    const env = serverEnv();
    // Nobody learns which settings are missing before being authorized: the
    // names go to the Runtime Logs, callers get a generic answer.
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      logEvent('error', 'not_configured', { missing: missingConfig(env) });
      return fail(503, 'not_configured');
    }
    assertSameOrigin(request, env.siteUrl);
    const staff = await requireStaff(request, env);
    // Staff (MFA verified) see which settings are missing, to fix the deploy.
    const missing = missingConfig(env);
    if (missing.length) {
      logEvent('error', 'not_configured', { missing });
      return json(503, { error: 'not_configured', missing });
    }
    const body = (await readJson(request, 1024)) as { reason?: unknown };
    const reason = typeof body?.reason === 'string' ? body.reason : 'manual';
    const service = serviceClient(env);
    await rateLimit(service, `rebuild:${hashKey(env.rateLimitSalt, staff.userId)}`, 30, 3600);
    await rateLimit(service, 'rebuild:global', 60, 3600);
    await removeUnreferencedPublicMedia(service).catch((error: Error) => logEvent('error', 'media_cleanup_failed', { message: error.message }));
    const deploy = await requestDeploy(env, service, staff.userId, reason);
    if (deploy.ok) return json(202, { ok: true });
    if (deploy.error === 'deploy_hook_not_configured') {
      logEvent('error', 'not_configured', { missing: ['VERCEL_DEPLOY_HOOK_URL'] });
      return json(503, { error: 'deploy_hook_not_configured', missing: ['VERCEL_DEPLOY_HOOK_URL'] });
    }
    return fail(502, 'deploy_hook_failed');
  });
}
