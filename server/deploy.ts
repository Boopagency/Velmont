import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServerEnv } from './env.js';

// The deploy hook URL is a secret: only authorized server code triggers a
// new static build of the public site. Pinned to Vercel (SSRF guard).
const HOOK = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_]+\/[A-Za-z0-9_]+$/;

export const deployHookConfigured = (env: ServerEnv) => HOOK.test(env.deployHookUrl);

export async function requestDeploy(env: ServerEnv, service: SupabaseClient, userId: string, reason: string) {
  if (!deployHookConfigured(env)) return false;
  let ok = false;
  try {
    const response = await fetch(env.deployHookUrl, { method: 'POST', signal: AbortSignal.timeout(8000), redirect: 'error' });
    ok = response.ok;
  } catch {
    ok = false;
  }
  await service.from('site_builds').insert({ requested_by: userId, reason: reason.replace(/[^\p{L}\p{N} .:_/-]/gu, '').slice(0, 120) || 'manual', ok, detail: ok ? null : 'deploy hook request failed' });
  return ok;
}
