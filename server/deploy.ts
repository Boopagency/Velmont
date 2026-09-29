import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServerEnv } from './env.js';
import { logEvent } from './http.js';

// The deploy hook URL is a secret: only authorized server code triggers a
// new static build of the public site. Pinned to Vercel (SSRF guard); the
// optional query string covers Vercel's own flags such as ?buildCache=false.
const HOOK = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+(\?[A-Za-z0-9_=&-]*)?$/;

export const deployHookConfigured = (env: ServerEnv) => HOOK.test(env.deployHookUrl);

/**
 * How long to wait for Vercel's answer. It only bounds how long the person
 * waits: a request without an answer is not a failure (see UNCONFIRMED), and
 * the Function (maxDuration 10 s) must still have time to record it.
 */
const HOOK_TIMEOUT_MS = 6000;

/**
 * site_builds.detail of a request whose answer never arrived (timeout, or the
 * connection dropped after the request was sent). Vercel may well have
 * accepted it: the row stays `pending` and the production build it started
 * settles it, like any other. admin/site-status.tsx reads the same marker.
 */
export const UNCONFIRMED = 'deploy hook unconfirmed';

/** Pending requests younger than this are still expected to be settled by a build (as in admin/site-status.tsx). */
const IN_FLIGHT_MS = { accepted: 15 * 60 * 1000, unconfirmed: 5 * 60 * 1000 };

// Errors raised before anything reached Vercel: the request was certainly not delivered.
const NOT_DELIVERED = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'UND_ERR_CONNECT_TIMEOUT',
  'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
]);

/**
 * accepted: Vercel answered 2xx. unconfirmed: no usable answer (timeout,
 * dropped connection, 1xx/3xx). refused: Vercel answered 4xx/5xx.
 * unreachable: the request never left (DNS, connection refused, TLS).
 */
export type DeployOutcome = 'accepted' | 'unconfirmed' | 'refused' | 'unreachable' | 'not_configured';
export type DeployResult = { ok: boolean; outcome: DeployOutcome; error?: 'deploy_hook_not_configured' | 'deploy_hook_failed' };

/** The error class and cause code only: messages can carry the hook URL, which is a secret. */
function errorKind(error: unknown) {
  const cause = (error as { cause?: { code?: unknown; name?: unknown } } | null)?.cause;
  const code = typeof cause?.code === 'string' ? cause.code : typeof cause?.name === 'string' ? cause.name : '';
  return { error: error instanceof Error ? error.name : 'unknown', code };
}

/**
 * Asks Vercel for a new build and records the request in site_builds:
 * `pending` when Vercel accepted it or when its answer did not arrive (the
 * production build marks it `success` or `failed` when it finishes), and
 * `failed` only when Vercel refused it or the request could not be made.
 * requested_at is the moment before asking, so the build this request starts
 * always counts as having started after it (finish_site_builds).
 */
export async function requestDeploy(env: ServerEnv, service: SupabaseClient, userId: string, reason: string): Promise<DeployResult> {
  const requestedAt = new Date().toISOString();
  let outcome: DeployOutcome = 'not_configured';
  let detail: string | null = 'deploy hook not configured';
  let job: string | null = null;
  if (deployHookConfigured(env)) {
    try {
      // Redirects are never followed (SSRF guard); one is not an acceptance either.
      const response = await fetch(env.deployHookUrl, { method: 'POST', signal: AbortSignal.timeout(HOOK_TIMEOUT_MS), redirect: 'manual' });
      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { job?: { id?: unknown } } | null;
        job = typeof body?.job?.id === 'string' ? body.job.id.slice(0, 120) : null;
        outcome = 'accepted';
        detail = null;
      } else if (response.status >= 400) {
        outcome = 'refused';
        detail = `deploy hook answered ${response.status}`;
        logEvent('error', 'deploy_hook_refused', { status: response.status });
      } else {
        outcome = 'unconfirmed';
        detail = UNCONFIRMED;
        logEvent('warn', 'deploy_hook_unconfirmed', { status: response.status });
      }
    } catch (error) {
      const kind = errorKind(error);
      outcome = NOT_DELIVERED.has(kind.code) ? 'unreachable' : 'unconfirmed';
      detail = outcome === 'unreachable' ? 'deploy hook unreachable' : UNCONFIRMED;
      logEvent(outcome === 'unreachable' ? 'error' : 'warn', `deploy_hook_${outcome}`, kind);
    }
  }
  const ok = outcome === 'accepted' || outcome === 'unconfirmed';
  const { error } = await service.from('site_builds').insert({
    requested_at: requestedAt,
    requested_by: userId,
    reason: reason.replace(/[^\p{L}\p{N} .:_/-]/gu, '').slice(0, 120) || 'manual',
    ok,
    status: ok ? 'pending' : 'failed',
    finished_at: ok ? null : new Date().toISOString(),
    deployment: job,
    detail,
  });
  if (error) logEvent('error', 'site_builds_insert_failed', { message: error.message });
  if (ok) return { ok, outcome };
  return { ok, outcome, error: outcome === 'not_configured' ? 'deploy_hook_not_configured' : 'deploy_hook_failed' };
}

export type LatestBuild = { requested_at: string; status: 'pending' | 'success' | 'failed'; detail: string | null };

/**
 * Whether the latest request already covers a new one: `in_progress` while a
 * build it asked for is still expected, `updated` once a build confirmed it.
 */
export function coveredBy(latest: LatestBuild | null, now = Date.now()): 'in_progress' | 'updated' | null {
  if (!latest) return null;
  if (latest.status === 'success') return 'updated';
  if (latest.status !== 'pending') return null;
  const window = latest.detail === UNCONFIRMED ? IN_FLIGHT_MS.unconfirmed : IN_FLIGHT_MS.accepted;
  return now - Date.parse(latest.requested_at) < window ? 'in_progress' : null;
}

export async function latestBuild(service: SupabaseClient): Promise<LatestBuild | null> {
  const { data, error } = await service.from('site_builds').select('requested_at, status, detail').order('requested_at', { ascending: false }).limit(1);
  if (error) {
    logEvent('error', 'site_builds_read_failed', { message: error.message });
    return null;
  }
  return ((data as LatestBuild[] | null) || [])[0] || null;
}
