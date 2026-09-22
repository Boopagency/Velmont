import { serverEnv, isConfigured } from '../server/env.js';
import { assertSameOrigin, clientIp, fail, handle, json, readJson } from '../server/http.js';
import { leadRow, leadSchema } from '../server/leads.js';
import { hashKey, rateLimit } from '../server/rate-limit.js';
import { serviceClient } from '../server/supabase.js';
import { verifyTurnstile } from '../server/turnstile.js';

// Public endpoint for the contact form. The browser never writes to the
// database directly: this function validates, rate limits and inserts.
export function POST(request: Request) {
  return handle(async () => {
    const env = serverEnv();
    if (!env.leadCapture || !isConfigured(env)) return fail(404, 'not_found');
    assertSameOrigin(request, env.siteUrl);
    const parsed = leadSchema.safeParse(await readJson(request, 4096));
    if (!parsed.success) return fail(400, 'invalid_lead');
    const lead = parsed.data;
    // Honeypot filled: pretend success so bots learn nothing.
    if (lead.website) return json(202, { ok: true });

    const service = serviceClient(env);
    const ip = clientIp(request);
    await rateLimit(service, `lead:ip:${hashKey(env.rateLimitSalt, ip)}`, 5, 600);
    await rateLimit(service, 'lead:global', 300, 3600);
    if (env.turnstileSecret && !(await verifyTurnstile(env.turnstileSecret, lead.turnstileToken, ip))) return fail(403, 'verification_failed');

    const { error } = await service.from('leads').insert(leadRow(lead));
    if (error) throw new Error('lead_insert_failed');
    return json(201, { ok: true });
  });
}

export function GET() {
  return fail(405, 'method_not_allowed');
}
