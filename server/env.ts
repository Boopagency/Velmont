// Server-only configuration. Never import this from browser code.
// NEXT_PUBLIC_* values are public by design; everything else is secret.

export function serverEnv() {
  const e = process.env;
  return {
    siteUrl: (e.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, ''),
    supabaseUrl: (e.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, ''),
    supabaseAnonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY || '',
    rateLimitSalt: e.RATE_LIMIT_SALT || '',
    turnstileSecret: e.TURNSTILE_SECRET_KEY || '',
    deployHookUrl: e.VERCEL_DEPLOY_HOOK_URL || '',
    leadCapture: e.NEXT_PUBLIC_LEAD_CAPTURE === 'true',
  };
}

export type ServerEnv = ReturnType<typeof serverEnv>;

export const isConfigured = (env: ServerEnv) => Boolean(env.supabaseUrl && env.supabaseAnonKey && env.serviceRoleKey && env.rateLimitSalt.length >= 16);
