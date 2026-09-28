import { z } from 'zod';
import { requireConfig, serverEnv } from '../../server/env.js';
import { assertSameOrigin, fail, handle, json, logEvent, readJson } from '../../server/http.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { completeFirstAccess, FirstAccessDenied, type FirstAccessState } from '../../server/staff.js';
import { bearerToken, serviceClient, userClient } from '../../server/supabase.js';

const request = z.strictObject({
  temporary_password: z.string().min(1).max(200),
  new_password: z.string().min(12).max(200),
});

/**
 * First access: the person, signed in with MFA verified (aal2), proves the
 * temporary password and chooses their own. Only this step unlocks the
 * account; the database re-checks every condition. Every session ends with
 * it: the browser signs in again with the new password and the authenticator.
 */
export function POST(req: Request) {
  return handle(req, async () => {
    const env = serverEnv();
    requireConfig(env);
    assertSameOrigin(req, env.siteUrl);
    const token = bearerToken(req);
    const parsed = request.safeParse(await readJson(req, 2048));
    if (!parsed.success) return fail(400, 'invalid_input');
    const { data, error } = await userClient(env, token).rpc('first_access_state');
    const state = data as FirstAccessState | null;
    if (error || !state?.user_id) return fail(401, 'unauthenticated');
    const service = serviceClient(env);
    await rateLimit(service, `first-access:${hashKey(env.rateLimitSalt, state.user_id)}`, 10, 900);
    await rateLimit(service, 'first-access:global', 100, 3600);
    try {
      await completeFirstAccess(service, state, { temporaryPassword: parsed.data.temporary_password, newPassword: parsed.data.new_password });
    } catch (refusal) {
      if (refusal instanceof FirstAccessDenied) {
        const logged = await service.rpc('staff_log_event', { p_actor: state.user_id, p_action: 'auth.first_access_denied', p_resource_id: state.user_id, p_metadata: { reason: refusal.code } });
        if (logged.error) logEvent('error', 'audit_failed', { event: 'auth.first_access_denied' });
      }
      throw refusal;
    }
    return json(200, { ok: true });
  });
}
