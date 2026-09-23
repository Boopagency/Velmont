import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServerEnv } from './env.js';

// The deploy hook URL is a secret: only authorized server code triggers a
// new static build of the public site. Pinned to Vercel (SSRF guard); the
// optional query string covers Vercel's own flags such as ?buildCache=false.
const HOOK = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+(\?[A-Za-z0-9_=&-]*)?$/;

export const deployHookConfigured = (env: ServerEnv) => HOOK.test(env.deployHookUrl);

export type DeployResult = { ok: boolean; error?: 'deploy_hook_not_configured' | 'deploy_hook_failed' };

/**
 * Asks Vercel for a new build and records it in site_builds: `pending` once
 * Vercel accepted the request (the production build marks it `success` or
 * `failed` when it finishes), `failed` right away when the request could not
 * be made.
 */
export async function requestDeploy(env: ServerEnv, service: SupabaseClient, userId: string, reason: string): Promise<DeployResult> {
  let result: DeployResult = { ok: false, error: 'deploy_hook_not_configured' };
  let detail: string | null = 'deploy hook not configured';
  let job: string | null = null;
  if (deployHookConfigured(env)) {
    try {
      const response = await fetch(env.deployHookUrl, { method: 'POST', signal: AbortSignal.timeout(8000), redirect: 'error' });
      const body = (await response.json().catch(() => null)) as { job?: { id?: unknown } } | null;
      job = typeof body?.job?.id === 'string' ? body.job.id.slice(0, 120) : null;
      result = response.ok ? { ok: true } : { ok: false, error: 'deploy_hook_failed' };
      detail = response.ok ? null : `deploy hook answered ${response.status}`;
    } catch {
      result = { ok: false, error: 'deploy_hook_failed' };
      detail = 'deploy hook unreachable';
    }
  }
  const { error } = await service.from('site_builds').insert({
    requested_by: userId,
    reason: reason.replace(/[^\p{L}\p{N} .:_/-]/gu, '').slice(0, 120) || 'manual',
    ok: result.ok,
    status: result.ok ? 'pending' : 'failed',
    finished_at: result.ok ? null : new Date().toISOString(),
    deployment: job,
    detail,
  });
  if (error) console.error('api_error', `site_builds: ${error.message}`);
  return result;
}
