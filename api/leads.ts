import { requireConfig, serverEnv } from '../server/env.js';
import { assertSameOrigin, clientIp, fail, handle, json, logEvent, rateLimitSubject, readJson } from '../server/http.js';
import { leadRow, leadSchema } from '../server/leads.js';
import { hashKey, rateLimit } from '../server/rate-limit.js';
import { serviceClient } from '../server/supabase.js';
import { verifyTurnstile } from '../server/turnstile.js';

// Public endpoint for the contact form. The browser never writes to the
// database directly: this function validates, checks Cloudflare Turnstile,
// rate limits and inserts. With lead capture on, Turnstile is mandatory:
// without its secret the endpoint refuses every lead (fail closed).
export function POST(request: Request) {
  return handle(request, async () => {
    const env = serverEnv();
    if (!env.leadCapture) return fail(404, 'not_found');
    requireConfig(env, env.turnstileSecret ? [] : ['TURNSTILE_SECRET_KEY']);
    assertSameOrigin(request, env.siteUrl);
    const parsed = leadSchema.safeParse(await readJson(request, 4096));
    if (!parsed.success) {
      // Field names only, never their values.
      logEvent('warn', 'lead_invalid', { fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0] ?? 'body')))] });
      return fail(400, 'invalid_lead');
    }
    const lead = parsed.data;
    // Honeypot filled: pretend success so bots learn nothing.
    if (lead.website) {
      logEvent('info', 'lead_honeypot');
      return json(202, { ok: true });
    }
    if (!lead.turnstileToken) return fail(403, 'verification_required');

    const service = serviceClient(env);
    const ip = clientIp(request);
    // Per network (IPv6 /64), then Cloudflare, then the global budget: only
    // verified submissions can use it up.
    await rateLimit(service, `lead:ip:${hashKey(env.rateLimitSalt, rateLimitSubject(ip))}`, 5, 600);
    if (!(await verifyTurnstile(env.turnstileSecret, lead.turnstileToken, ip))) return fail(403, 'verification_failed');
    await rateLimit(service, 'lead:global', 300, 3600);

    const { error } = await service.from('leads').insert(leadRow(lead));
    if (error) throw new Error('lead_insert_failed');
    return json(201, { ok: true });
  });
}

export function GET(request: Request) {
  return handle(request, async () => fail(405, 'method_not_allowed'));
}
