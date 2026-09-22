import { serverEnv, isConfigured } from '../../server/env.js';
import { assertSameOrigin, fail, handle, json, readJson } from '../../server/http.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { requireStaff, serviceClient } from '../../server/supabase.js';

// The deploy hook URL is a secret: only this function (after authorization)
// can trigger a new static build of the public site.
const HOOK = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+$/;

export function POST(request: Request) {
  return handle(async () => {
    const env = serverEnv();
    if (!isConfigured(env)) return fail(503, 'not_configured');
    assertSameOrigin(request, env.siteUrl);
    const staff = await requireStaff(request, env);
    const body = (await readJson(request, 1024)) as { reason?: unknown };
    const reason = typeof body?.reason === 'string' ? body.reason.replace(/[^\p{L}\p{N} .:_/-]/gu, '').slice(0, 120) : 'manual';
    const service = serviceClient(env);
    await rateLimit(service, `rebuild:${hashKey(env.rateLimitSalt, staff.userId)}`, 30, 3600);
    await rateLimit(service, 'rebuild:global', 60, 3600);
    if (!HOOK.test(env.deployHookUrl)) return fail(503, 'deploy_hook_not_configured');

    let ok = false;
    try {
      const response = await fetch(env.deployHookUrl, { method: 'POST', signal: AbortSignal.timeout(8000), redirect: 'error' });
      ok = response.ok;
    } catch {
      ok = false;
    }
    await service.from('site_builds').insert({ requested_by: staff.userId, reason: reason || 'manual', ok, detail: ok ? null : 'deploy hook request failed' });
    return ok ? json(202, { ok: true }) : fail(502, 'deploy_hook_failed');
  });
}
