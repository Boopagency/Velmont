import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.js';
import type { ServerEnv } from './env.js';

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Bypasses RLS. Server-side only, after the caller has been authorized. */
export const serviceClient = (env: ServerEnv) => createClient(env.supabaseUrl, env.serviceRoleKey, options);

/** Acts as the signed-in user: every query is still subject to RLS. */
export const userClient = (env: ServerEnv, token: string) =>
  createClient(env.supabaseUrl, env.supabaseAnonKey, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });

export const anonClient = (env: ServerEnv) => createClient(env.supabaseUrl, env.supabaseAnonKey, options);

export type Staff = { userId: string; role: 'owner' | 'editor'; client: SupabaseClient };

/**
 * Verifies the bearer token with the database itself (signature, expiry,
 * MFA level and an active admin_users row). Nothing from the browser is
 * trusted beyond the signed JWT.
 */
export async function requireStaff(request: Request, env: ServerEnv): Promise<Staff> {
  const header = request.headers.get('authorization') || '';
  const token = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(header)?.[1];
  if (!token) throw new HttpError(401, 'unauthenticated');
  const client = userClient(env, token);
  const { data, error } = await client.rpc('admin_context');
  if (error) throw new HttpError(401, 'unauthenticated');
  const context = data as { user_id?: string; is_staff?: boolean; role?: 'owner' | 'editor' } | null;
  if (!context?.user_id) throw new HttpError(401, 'unauthenticated');
  if (!context.is_staff || !context.role) throw new HttpError(403, 'forbidden');
  return { userId: context.user_id, role: context.role, client };
}
