import { z } from 'zod';
import { isConfigured, serverEnv } from '../../server/env.js';
import { assertSameOrigin, fail, handle, isUuid, json, readJson } from '../../server/http.js';
import { clean } from '../../server/leads.js';
import { hashKey, rateLimit } from '../../server/rate-limit.js';
import { createAccess, resetAccess } from '../../server/staff.js';
import { requireStaff, serviceClient } from '../../server/supabase.js';

// Strict: unknown keys are rejected.
const request = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('create'),
    email: z.string().max(320).transform((v) => v.trim().toLowerCase()).pipe(z.email().max(254)),
    name: z.string().max(480).transform(clean).pipe(z.string().min(1).max(120)),
    role: z.enum(['owner', 'editor']),
  }),
  z.strictObject({ action: z.literal('reset'), user_id: z.string().refine(isUuid) }),
]);

/**
 * Owner only (MFA verified): access for a new member, or a new temporary
 * password for an existing one. The password is returned once; it is never
 * stored by this function or written to the logs.
 */
export function POST(req: Request) {
  return handle(async () => {
    const env = serverEnv();
    if (!isConfigured(env)) return fail(503, 'not_configured');
    assertSameOrigin(req, env.siteUrl);
    const staff = await requireStaff(req, env);
    if (staff.role !== 'owner') return fail(403, 'forbidden');
    const parsed = request.safeParse(await readJson(req, 2048));
    if (!parsed.success) return fail(400, 'invalid_input');
    const input = parsed.data;
    // Your own access is changed in Conta; this would also remove your authenticator.
    if (input.action === 'reset' && input.user_id === staff.userId) return fail(400, 'cannot_reset_self');
    const service = serviceClient(env);
    await rateLimit(service, `staff:${hashKey(env.rateLimitSalt, staff.userId)}`, 20, 3600);
    await rateLimit(service, 'staff:global', 60, 3600);
    const access =
      input.action === 'create'
        ? await createAccess(service, staff.userId, { email: input.email, name: input.name, role: input.role })
        : await resetAccess(service, staff.userId, input.user_id);
    return json(input.action === 'create' ? 201 : 200, { user_id: access.userId, password: access.password, expires_at: access.expiresAt });
  });
}
