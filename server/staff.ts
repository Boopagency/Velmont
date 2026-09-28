import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.js';

// Access for the team without e-mail links: a unique random temporary
// password, shown once to the owner who asked for it. It only opens the
// first access, and the first access only ends through completeFirstAccess:
// the server checks the temporary password itself, the database a verified
// authenticator on an aal2 session. Changing the password any other way
// (recovery e-mail, magic link, updateUser) unlocks nothing.

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

const derive = (password: string, salt: Buffer, length: number) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password.normalize('NFC'), salt, length, (error, key) => (error ? reject(error) : resolve(key))));

/** Salted scrypt digest: the only form in which a temporary password is ever stored. */
export async function passwordDigest(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${(await derive(password, salt, 32)).toString('base64url')}`;
}

export async function matchesDigest(password: string, digest: string) {
  const parts = /^scrypt\$([A-Za-z0-9_-]{16,64})\$([A-Za-z0-9_-]{32,128})$/.exec(digest);
  if (!parts) return false;
  const expected = Buffer.from(parts[2], 'base64url');
  return timingSafeEqual(await derive(password, Buffer.from(parts[1], 'base64url'), expected.length), expected);
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

const issueErrors: Record<string, HttpError> = {
  '23505': new HttpError(409, 'already_member'),
  P0002: new HttpError(404, 'not_found'),
  '55000': new HttpError(409, 'inactive'),
};

/**
 * Race-free, in this order:
 * 1. ban the Auth user: no sign-in or token refresh while this runs;
 * 2. lock the account in the database (no staff access until the first
 *    access is completed), store the digest of the new password and end
 *    every session;
 * 3. remove the authenticator apps: the first access sets up a new one;
 * 4. set the new password and lift the ban in a single Auth update.
 * A failure leaves the account locked and this password void, never open;
 * issuing again repairs it.
 */
async function issue(service: SupabaseClient, actor: string | null, userId: string, member?: NewMember, banned = false): Promise<TemporaryAccess> {
  const auth = service.auth.admin;
  const password = temporaryPassword();
  const digest = await passwordDigest(password);
  if (!banned && (await auth.updateUserById(userId, { ban_duration: LOCK })).error) throw new HttpError(502, 'auth_update_failed');
  const { data, error } = await service.rpc('staff_issue_temporary_access', {
    p_actor: actor,
    p_user_id: userId,
    p_hours: TEMPORARY_PASSWORD_HOURS,
    p_digest: digest,
    ...(member ? { p_email: member.email, p_display_name: member.name, p_role: member.role } : {}),
  });
  if (error) throw issueErrors[error.code || ''] || new HttpError(500, 'issue_failed');
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
  const expiresAt = (data as { expires_at?: unknown } | null)?.expires_at;
  return { userId, password, expiresAt: typeof expiresAt === 'string' ? expiresAt : '' };
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

/** Existing, active member: a new temporary password, a new authenticator and no open sessions. */
export async function resetAccess(service: SupabaseClient, actor: string | null, userId: string): Promise<TemporaryAccess> {
  // Checked before the Auth ban, so no other account is ever touched.
  const { data, error } = await service.from('admin_users').select('user_id, active').eq('user_id', userId).maybeSingle();
  if (error) throw new HttpError(500, 'lookup_failed');
  if (!data) throw new HttpError(404, 'not_found');
  if (!(data as { active: boolean }).active) throw new HttpError(409, 'inactive');
  return issue(service, actor, userId);
}

/** What the database says about the caller of the first-access step (first_access_state). */
export type FirstAccessState = { user_id: string | null; session_id: string | null; aal2: boolean; member: boolean; pending: boolean; expired: boolean; mfa_verified: boolean };

/** A refusal worth recording in the audit log (the reason only, never a password). */
export class FirstAccessDenied extends HttpError {}

const completeErrors: Record<string, HttpError> = {
  P0002: new HttpError(409, 'not_pending'),
  '22023': new FirstAccessDenied(403, 'expired'),
  PT409: new HttpError(409, 'stale'),
  '42501': new FirstAccessDenied(403, 'mfa_required'),
};

/**
 * Ends the first access, in this order:
 * 1. aal2 on a live session with a verified authenticator (first_access_state);
 * 2. the temporary password itself, checked against its digest (not against
 *    the account's current password, which a recovery e-mail could have
 *    changed), and a new password that differs from it;
 * 3. the database confirms the session and the authenticator for this issue;
 * 4. the person's own password, set by the server (Supabase Auth ends every
 *    session here, this one included: the person signs in again);
 * 5. the database unlocks the account only if the password changed after its
 *    own check in step 3.
 * Any failure leaves the account locked.
 */
export async function completeFirstAccess(service: SupabaseClient, state: FirstAccessState, input: { temporaryPassword: string; newPassword: string }) {
  if (!state.user_id) throw new HttpError(401, 'unauthenticated');
  if (!state.member) throw new HttpError(403, 'forbidden');
  if (state.expired) throw new FirstAccessDenied(403, 'expired');
  if (!state.pending) throw new HttpError(409, 'not_pending');
  if (!state.aal2 || !state.session_id || !state.mfa_verified) throw new FirstAccessDenied(403, 'mfa_required');
  const { data, error } = await service.rpc('staff_first_access_secret', { p_user_id: state.user_id });
  if (error) throw new HttpError(500, 'lookup_failed');
  const secret = data as { issue_id: string; digest: string } | null;
  if (!secret) throw new HttpError(409, 'not_pending');
  if (!(await matchesDigest(input.temporaryPassword, secret.digest))) throw new FirstAccessDenied(403, 'wrong_temporary_password');
  // It matched the digest, so this compares against the temporary password itself.
  if (input.newPassword.normalize('NFC') === input.temporaryPassword.normalize('NFC')) throw new HttpError(422, 'same_as_temporary');
  const step = { p_user_id: state.user_id, p_issue_id: secret.issue_id };
  const { error: beginError } = await service.rpc('staff_begin_first_access', { ...step, p_session_id: state.session_id });
  if (beginError) throw completeErrors[beginError.code || ''] || new HttpError(500, 'complete_failed');
  const { error: passwordError } = await service.auth.admin.updateUserById(state.user_id, { password: input.newPassword });
  if (passwordError) throw passwordError.code === 'weak_password' || passwordError.status === 422 ? new HttpError(422, 'weak_password') : new HttpError(502, 'auth_update_failed');
  const { error: completeError } = await service.rpc('staff_complete_first_access', step);
  // The new password is already set; the account stays locked until this step succeeds.
  if (completeError) throw completeErrors[completeError.code || ''] || new HttpError(500, 'not_completed');
}
