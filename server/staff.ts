import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.js';

// Access for the team without e-mail links: a unique random temporary
// password, shown once to the owner who asked for it. It only opens the
// first access: the database grants nothing until the person has set up MFA
// and replaced it with their own password, before it expires.

/** How long a temporary password can be used for the first access. */
export const TEMPORARY_PASSWORD_HOURS = 48;
// No look-alikes (0/O, 1/l/I): the password is often read from a phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
// Bans the Auth user while the password is being replaced. Lifted in the
// last step; if something fails midway it expires on its own.
const LOCK = '1h';

/** 4 groups of 5 characters (about 116 bits), with upper and lower case letters and digits. */
export function temporaryPassword() {
  for (;;) {
    const value = Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')).join('-');
    if (/[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value)) return value;
  }
}

export type Role = 'owner' | 'editor';
export type NewMember = { email: string; name: string; role: Role };
export type TemporaryAccess = { userId: string; password: string; expiresAt: string };
type Found = { user_id: string; is_member: boolean } | null;

export async function findUser(service: SupabaseClient, email: string): Promise<Found> {
  const { data, error } = await service.rpc('staff_find_user', { p_email: email });
  if (error) throw new HttpError(500, 'lookup_failed');
  return (data as Found) ?? null;
}

/**
 * Race-free, in this order:
 * 1. ban the Auth user: no sign-in or token refresh while this runs;
 * 2. lock the account in the database (no staff access until the person sets
 *    their own password) and end every session;
 * 3. remove the authenticator apps: the first access sets up a new one;
 * 4. set the new password and lift the ban in a single Auth update.
 * A failure leaves the account locked, never open; issuing again repairs it.
 */
async function issue(service: SupabaseClient, actor: string | null, userId: string, member?: NewMember, banned = false): Promise<TemporaryAccess> {
  const auth = service.auth.admin;
  if (!banned && (await auth.updateUserById(userId, { ban_duration: LOCK })).error) throw new HttpError(502, 'auth_update_failed');
  const { data: expiresAt, error } = await service.rpc('staff_issue_temporary_password', {
    p_actor: actor,
    p_user_id: userId,
    p_hours: TEMPORARY_PASSWORD_HOURS,
    ...(member ? { p_email: member.email, p_display_name: member.name, p_role: member.role } : {}),
  });
  if (error) throw error.code === '23505' ? new HttpError(409, 'already_member') : error.code === 'P0002' ? new HttpError(404, 'not_found') : new HttpError(500, 'issue_failed');
  const password = temporaryPassword();
  try {
    const { data: list, error: listError } = await auth.mfa.listFactors({ userId });
    if (listError || !list) throw listError;
    for (const factor of list.factors) {
      const { error: deleteError } = await auth.mfa.deleteFactor({ id: factor.id, userId });
      if (deleteError) throw deleteError;
    }
    const { error: passwordError } = await auth.updateUserById(userId, { password, email_confirm: true, ban_duration: 'none' });
    if (passwordError) throw passwordError;
  } catch {
    await service.rpc('staff_temporary_password_failed', { p_user_id: userId });
    throw new HttpError(502, 'auth_update_failed');
  }
  return { userId, password, expiresAt: String(expiresAt) };
}

/**
 * New member. An Auth user that already exists (e.g. an earlier e-mail
 * invitation) is reused; one that is already staff is refused.
 */
export async function createAccess(service: SupabaseClient, actor: string | null, member: NewMember): Promise<TemporaryAccess> {
  const found = await findUser(service, member.email);
  if (found?.is_member) throw new HttpError(409, 'already_member');
  if (found) return issue(service, actor, found.user_id, member);
  // Created already banned: nobody can sign in before the password is set.
  const { data, error } = await service.auth.admin.createUser({ email: member.email, email_confirm: true, ban_duration: LOCK });
  if (error || !data.user) throw new HttpError(502, 'auth_create_failed');
  return issue(service, actor, data.user.id, member, true);
}

/** Existing member: a new temporary password, a new authenticator and no open sessions. */
export async function resetAccess(service: SupabaseClient, actor: string | null, userId: string): Promise<TemporaryAccess> {
  // Checked before the Auth ban, so no other account is ever touched.
  const { data, error } = await service.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw new HttpError(500, 'lookup_failed');
  if (!data) throw new HttpError(404, 'not_found');
  return issue(service, actor, userId);
}
