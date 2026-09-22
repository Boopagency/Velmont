// Values replaced at build time. Only public, non-secret configuration may be
// listed here: this module ships to the browser.
export const publicEnv = {
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, ''),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  leadCapture: process.env.NEXT_PUBLIC_LEAD_CAPTURE === 'true',
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '',
};
