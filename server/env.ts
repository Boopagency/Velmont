// Server-only configuration. Never import this from browser code.
// NEXT_PUBLIC_* values are public by design; everything else is secret.

// Values pasted into the Vercel dashboard often carry a trailing newline or
// spaces; trim everything so a copy/paste never disables a feature.
const read = (name: string) => (process.env[name] || '').trim();

export function serverEnv() {
  return {
    siteUrl: read('NEXT_PUBLIC_SITE_URL').replace(/\/$/, ''),
    supabaseUrl: read('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, ''),
    supabaseAnonKey: read('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: read('SUPABASE_SERVICE_ROLE_KEY'),
    rateLimitSalt: read('RATE_LIMIT_SALT'),
    turnstileSecret: read('TURNSTILE_SECRET_KEY'),
    deployHookUrl: read('VERCEL_DEPLOY_HOOK_URL'),
    leadCapture: read('NEXT_PUBLIC_LEAD_CAPTURE') === 'true',
  };
}

export type ServerEnv = ReturnType<typeof serverEnv>;

/** Names (never values) of the required server settings that are missing or invalid. */
export function missingConfig(env: ServerEnv) {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!env.supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!env.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (env.rateLimitSalt.length < 16) missing.push('RATE_LIMIT_SALT');
  return missing;
}

export const isConfigured = (env: ServerEnv) => missingConfig(env).length === 0;
