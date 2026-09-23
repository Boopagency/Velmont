// Entry point of `pnpm build`: runs the static build and, on Vercel production
// builds, records the outcome of pending "update the site" requests in
// site_builds. Reporting never changes the build result.
import { createClient } from '@supabase/supabase-js';

const startedAt = new Date().toISOString();
let failure = null;
try {
  await import('./build-static.mjs');
} catch (error) {
  failure = error;
}

async function report(success, detail) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (process.env.VERCEL_ENV !== 'production' || !url || !key) return;
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await Promise.race([
      client.rpc('finish_site_builds', { p_started_at: startedAt, p_success: success, p_detail: detail }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
    if (error) console.warn(`site_builds not updated: ${error.message}`);
    else console.log(`site_builds: ${data} request(s) marked ${success ? 'success' : 'failed'}.`);
  } catch (error) {
    console.warn(`site_builds not updated: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

await report(!failure, failure ? `build failed: ${String(failure?.message || failure).slice(0, 200)}` : null);
if (failure) throw failure;
