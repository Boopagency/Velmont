import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.js';

/** Hashes identifiers so raw IPs are never stored. */
export const hashKey = (salt: string, ...parts: string[]) => createHash('sha256').update([salt, ...parts].join('|')).digest('hex').slice(0, 40);

/** Database-backed fixed window, shared by every function instance. Fails closed. */
export async function rateLimit(service: SupabaseClient, key: string, limit: number, windowSeconds: number) {
  const { data, error } = await service.rpc('hit_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) throw new HttpError(503, 'rate_limit_unavailable');
  if (data !== true) throw new HttpError(429, 'too_many_requests');
}
