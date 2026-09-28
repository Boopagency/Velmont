import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, outcome, startDatabase, type Claims, type Database } from './harness';

// First access with a temporary password: the database decides, not the
// browser, and a password change made through Supabase Auth (recovery
// e-mail, magic link, updateUser) never unlocks anything. Only the explicit
// server steps do: staff_begin_first_access (the database checks MFA on a live
// aal2 session), the server's password change, then
// staff_complete_first_access.

const ids = {
  owner: '00000000-0000-4000-8000-0000000000a1',
  newbie: '00000000-0000-4000-8000-0000000000a2',
  editor: '00000000-0000-4000-8000-0000000000a3',
  outsider: '00000000-0000-4000-8000-0000000000a4',
  inactive: '00000000-0000-4000-8000-0000000000a5',
};
const DIGEST = 'scrypt$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';
const sessionOf = (sub: string) => `5${sub.slice(1)}`;
const otherSessionOf = (sub: string) => `6${sub.slice(1)}`;
const claims = (sub: string, aal: 'aal1' | 'aal2' = 'aal2'): Claims => ({ sub, role: 'authenticated', aal, session_id: sessionOf(sub) });

let db: Database;
const sql = (text: string, params: unknown[] = []) => db.pool.query(text, params);
const state = async (id: string) =>
  (await sql('select must_change_password, temporary_password_pending, temporary_password_expires_at from public.admin_users where user_id = $1', [id])).rows[0];
const openSession = (id: string, aal = 'aal2', session = sessionOf(id)) => sql('insert into auth.sessions (id, user_id, aal) values ($1, $2, $3) on conflict (id) do update set aal = excluded.aal', [session, id, aal]);
const sessions = async (id: string) => (await sql('select id from auth.sessions where user_id = $1 order by id', [id])).rows.map((r) => r.id as string);
const verifiedFactor = (id: string) => sql(`insert into auth.mfa_factors (user_id, status) values ($1, 'verified')`, [id]);
const service = <T>(text: string, params: unknown[] = []) => as(db, 'service_role', null, (q) => q(text, params) as Promise<T>, { commit: true });
/** What the Vercel Function does with the service role (committed). */
const issue = async (userId: string, hours = 48, member?: [string, string, string], digest = DIGEST) => {
  const { rows } = await service<{ rows: { result: { expires_at: string; issue_id: string } }[] }>(
    'select public.staff_issue_temporary_access($1, $2, $3, $4, $5, $6, $7) as result',
    [ids.owner, userId, hours, digest, ...(member || [null, null, null])],
  );
  return rows[0].result;
};
const secret = async (userId: string) => (await service<{ rows: { s: { issue_id: string; digest: string } | null }[] }>('select public.staff_first_access_secret($1) as s', [userId])).rows[0].s;
const begin = (userId: string, issueId: string, session = sessionOf(userId)) => service('select public.staff_begin_first_access($1, $2, $3)', [userId, issueId, session]);
const complete = (userId: string, issueId: string) => service('select public.staff_complete_first_access($1, $2)', [userId, issueId]);
/** Supabase Auth writing a new password hash (server-issued, recovery e-mail, updateUser…). */
const authSetsPassword = (id: string, hash: string) => sql('update auth.users set encrypted_password = $2 where id = $1', [id, hash]);
/** The whole server step on a live aal2 session: database check, the person's password, completion. */
const finish = async (userId: string, issueId: string) => {
  await begin(userId, issueId);
  await authSetsPassword(userId, `h-own-${issueId}`);
  await complete(userId, issueId);
};
const isStaff = async (id: string, aal: 'aal1' | 'aal2' = 'aal2') => (await as(db, 'authenticated', claims(id, aal), (q) => q('select private.is_staff() as ok'))).rows[0].ok as boolean;
const leadsSeen = async (id: string) => (await as(db, 'authenticated', claims(id), (q) => q('select count(*)::int as n from public.leads'))).rows[0].n as number;
const firstAccess = async (id: string, aal: 'aal1' | 'aal2' = 'aal2') => (await as(db, 'authenticated', claims(id, aal), (q) => q('select public.first_access_state() as s'))).rows[0].s as Record<string, unknown>;
const lastEvents = async (resource: string, n: number) =>
  (await sql('select action, actor_id, metadata from public.audit_log where resource_id = $1 order by id desc limit $2', [resource, n])).rows.reverse().map(({ action, actor_id }) => ({ action, actor_id }));

before(async () => {
  db = await startDatabase();
  await sql(
    `insert into auth.users (id, email, encrypted_password) values ($1, 'owner@velmont.test', 'h-owner'), ($2, 'nova@velmont.test', ''),
     ($3, 'editora@velmont.test', 'h-editor'), ($4, 'fora@example.test', 'h-outsider'), ($5, 'inativa@velmont.test', 'h-inactive')`,
    [ids.owner, ids.newbie, ids.editor, ids.outsider, ids.inactive],
  );
  await sql(
    `insert into public.admin_users (user_id, email, display_name, role, active) values ($1, 'owner@velmont.test', 'Responsável', 'owner', true),
     ($2, 'editora@velmont.test', 'Editora', 'editor', true), ($3, 'inativa@velmont.test', 'Inativa', 'editor', false)`,
    [ids.owner, ids.editor, ids.inactive],
  );
  for (const id of Object.values(ids)) await openSession(id);
  await sql(`insert into public.leads (name, interest) values ('Maria', 'Marcas')`);
});

after(async () => {
  await db.stop();
});

describe('temporary passwords', () => {
  test('only the service role issues, reads or completes them; the digest table is out of every API role', async () => {
    for (const [role, who] of [['anon', null], ['authenticated', claims(ids.owner)]] as const) {
      assert.equal(await outcome(as(db, role, who, (q) => q(`select public.staff_find_user('nova@velmont.test')`))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select public.staff_issue_temporary_access($1, $2, 48, $3)', [ids.owner, ids.editor, DIGEST]))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select public.staff_first_access_secret($1)', [ids.editor]))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select public.staff_begin_first_access($1, gen_random_uuid(), $2)', [ids.editor, sessionOf(ids.editor)]))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select public.staff_complete_first_access($1, gen_random_uuid())', [ids.editor]))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select private.lock_first_access($1, gen_random_uuid())', [ids.editor]))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select public.staff_temporary_password_failed($1)', [ids.editor]))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select private.auth_password_changed()'))), '42501');
    }
    for (const role of ['anon', 'authenticated', 'service_role'] as const) {
      assert.equal(await outcome(as(db, role, role === 'authenticated' ? claims(ids.owner) : null, (q) => q('select * from private.staff_first_access'))), '42501', role);
    }
    // The superseded function stored no digest: nobody may call it any more.
    assert.equal(await outcome(as(db, 'service_role', null, (q) => q('select public.staff_issue_temporary_password($1, $2, 48)', [ids.owner, ids.editor]))), '42501');
    assert.equal(await isStaff(ids.editor), true, 'nothing changed');
  });

  test('finds Auth users by e-mail, case-insensitively, and says whether they are staff', async () => {
    const { rows } = await as(db, 'service_role', null, (q) =>
      q(`select public.staff_find_user(' NOVA@velmont.test ') as newbie, public.staff_find_user('editora@velmont.test') as editor, public.staff_find_user('ninguem@x.test') as none`),
    );
    assert.deepEqual(rows[0].newbie, { user_id: ids.newbie, is_member: false });
    assert.deepEqual(rows[0].editor, { user_id: ids.editor, is_member: true });
    assert.equal(rows[0].none, null);
  });

  test('a new member stays locked through any password change made in Supabase Auth, even with MFA', async () => {
    const issued = await issue(ids.newbie, 48, ['Nova@velmont.test ', ' Nova Pessoa ', 'editor']);
    const hours = (new Date(issued.expires_at).getTime() - Date.now()) / 3600e3;
    assert.ok(hours > 47.9 && hours <= 48, `expires in ${hours} h`);
    assert.deepEqual(await sessions(ids.newbie), [], 'sessions from before are ended');
    const member = (await sql('select email, display_name, role, active from public.admin_users where user_id = $1', [ids.newbie])).rows[0];
    assert.deepEqual(member, { email: 'nova@velmont.test', display_name: 'Nova Pessoa', role: 'editor', active: true });
    assert.deepEqual(await secret(ids.newbie), { issue_id: issued.issue_id, digest: DIGEST });
    assert.ok(!JSON.stringify(await sql('select * from public.admin_users where user_id = $1', [ids.newbie])).includes('scrypt'), 'the digest is not in admin_users');
    assert.deepEqual(await lastEvents(ids.newbie, 3), [
      { action: 'staff.add', actor_id: ids.owner },
      { action: 'auth.sessions_revoked', actor_id: ids.owner },
      { action: 'staff.temporary_password', actor_id: ids.owner },
    ]);

    // Supabase Auth stores the temporary password: the marker is consumed, nothing is logged as the person's.
    await authSetsPassword(ids.newbie, 'h-temporary');
    assert.equal((await state(ids.newbie)).must_change_password, true);
    assert.equal((await state(ids.newbie)).temporary_password_pending, false);
    assert.equal((await lastEvents(ids.newbie, 1))[0].action, 'staff.temporary_password');

    // A recovery e-mail (or updateUser, magic link, OTP) changes the password: recorded, still locked.
    await authSetsPassword(ids.newbie, 'h-chosen-through-recovery');
    assert.equal((await state(ids.newbie)).must_change_password, true, 'V-01: a password change never unlocks');
    assert.deepEqual(await lastEvents(ids.newbie, 1), [{ action: 'auth.password_changed', actor_id: ids.newbie }]);
    assert.deepEqual((await sql(`select metadata from public.audit_log where action = 'auth.password_changed' and resource_id = $1 order by id desc limit 1`, [ids.newbie])).rows[0].metadata, { locked: true, first_access: false });
    await openSession(ids.newbie);
    await verifiedFactor(ids.newbie);
    assert.equal(await isStaff(ids.newbie), false, 'MFA verified: still nothing');
    assert.equal(await leadsSeen(ids.newbie), 0);
    assert.equal(await outcome(as(db, 'authenticated', claims(ids.newbie), (q) => q('select public.record_admin_login()'))), '42501');
    assert.deepEqual(await firstAccess(ids.newbie), {
      user_id: ids.newbie, session_id: sessionOf(ids.newbie), aal2: true, member: true, pending: true, expired: false, mfa_verified: true,
    });
  });

  test('the explicit steps unlock only after the password changed; every session ends; audited as the person', async () => {
    const { issue_id } = (await secret(ids.newbie))!;
    await openSession(ids.newbie, 'aal2', otherSessionOf(ids.newbie));
    assert.equal(await outcome(complete(ids.newbie, issue_id)), '42501', 'never without the database check');
    await begin(ids.newbie, issue_id);
    assert.equal(await outcome(complete(ids.newbie, issue_id)), '55000', 'the temporary password never stays: the password must change after the check');
    assert.equal(await isStaff(ids.newbie), false);
    await authSetsPassword(ids.newbie, 'h-own-password');
    const change = (await sql(`select metadata from public.audit_log where action = 'auth.password_changed' and resource_id = $1 order by id desc limit 1`, [ids.newbie])).rows[0];
    assert.deepEqual(change.metadata, { locked: true, first_access: true }, 'recorded as the first-access step');
    await complete(ids.newbie, issue_id);
    const after = await state(ids.newbie);
    assert.equal(after.must_change_password, false);
    assert.equal(after.temporary_password_expires_at, null);
    assert.equal(await secret(ids.newbie), null, 'the digest is gone');
    assert.deepEqual(await sessions(ids.newbie), [], 'every session ends: the person signs in again');
    assert.deepEqual(await lastEvents(ids.newbie, 1), [{ action: 'auth.password_set', actor_id: ids.newbie }]);
    await openSession(ids.newbie);
    assert.equal(await isStaff(ids.newbie), true);
    assert.equal(await leadsSeen(ids.newbie), 1);
    assert.equal(await outcome(complete(ids.newbie, issue_id)), 'P0002', 'cannot complete twice');
    assert.equal(await outcome(begin(ids.newbie, issue_id)), 'P0002');
  });

  test('the database check refuses without a verified authenticator on a live aal2 session, a stale issue, an old check or an expired password', async () => {
    const first = await issue(ids.editor);
    await authSetsPassword(ids.editor, 'h-temporary-1');
    await openSession(ids.editor, 'aal1');
    assert.equal(await outcome(begin(ids.editor, first.issue_id)), '42501', 'no verified authenticator');
    await verifiedFactor(ids.editor);
    assert.equal(await outcome(begin(ids.editor, first.issue_id)), '42501', 'session is still aal1');
    assert.equal((await firstAccess(ids.editor, 'aal1')).aal2, false);
    await openSession(ids.newbie, 'aal2', otherSessionOf(ids.newbie));
    assert.equal(await outcome(begin(ids.editor, first.issue_id, otherSessionOf(ids.newbie))), '42501', 'someone else’s aal2 session');
    await openSession(ids.editor, 'aal2');
    await begin(ids.editor, first.issue_id);
    // A newer temporary password voids the older one, even after the database check.
    const second = await issue(ids.editor);
    await authSetsPassword(ids.editor, 'h-temporary-2');
    assert.equal(await outcome(complete(ids.editor, first.issue_id)), 'PT409');
    assert.equal(await outcome(begin(ids.editor, first.issue_id)), 'PT409');
    // A check older than five minutes does not count, nor does a change after it.
    await openSession(ids.editor, 'aal2');
    await begin(ids.editor, second.issue_id);
    await sql(`update private.staff_first_access set verified_at = now() - interval '6 minutes' where user_id = $1`, [ids.editor]);
    await authSetsPassword(ids.editor, 'h-too-late');
    assert.equal(await outcome(complete(ids.editor, second.issue_id)), '42501');
    await sql(`update public.admin_users set temporary_password_expires_at = now() - interval '1 minute' where user_id = $1`, [ids.editor]);
    assert.equal(await outcome(begin(ids.editor, second.issue_id)), '22023', 'expired never unlocks');
    assert.equal(await outcome(complete(ids.editor, second.issue_id)), '22023');
    assert.equal(await secret(ids.editor), null);
    assert.equal((await firstAccess(ids.editor)).expired, true);
    await authSetsPassword(ids.editor, 'h-own-after-expiry');
    assert.equal(await isStaff(ids.editor), false);
    // A new, complete issue repairs it.
    const third = await issue(ids.editor);
    await authSetsPassword(ids.editor, 'h-temporary-3');
    await openSession(ids.editor, 'aal2');
    await finish(ids.editor, third.issue_id);
    await openSession(ids.editor);
    assert.equal(await isStaff(ids.editor), true);
  });

  test('a new temporary password locks an existing member at once and ends every session', async () => {
    assert.equal(await isStaff(ids.editor), true);
    await openSession(ids.editor, 'aal2', otherSessionOf(ids.editor));
    await issue(ids.editor);
    assert.deepEqual(await sessions(ids.editor), []);
    await openSession(ids.editor);
    assert.equal(await isStaff(ids.editor), false, 'not even a new session with MFA');
    assert.equal((await lastEvents(ids.editor, 1))[0].action, 'staff.temporary_password');
    await authSetsPassword(ids.editor, 'h-temporary-4');
    await authSetsPassword(ids.editor, 'h-own-4');
    assert.equal(await isStaff(ids.editor), false, 'a password change of its own unlocks nothing');
  });

  test('if Supabase Auth refuses the new password, that temporary password is void and the account stays locked', async () => {
    const issued = await issue(ids.editor);
    await service('select public.staff_temporary_password_failed($1)', [ids.editor]);
    const locked = await state(ids.editor);
    assert.equal(locked.must_change_password, true);
    assert.equal(locked.temporary_password_pending, false);
    assert.ok(new Date(locked.temporary_password_expires_at).getTime() <= Date.now(), 'marked expired');
    assert.equal(await secret(ids.editor), null);
    await openSession(ids.editor);
    assert.equal(await outcome(begin(ids.editor, issued.issue_id)), '22023');
    assert.equal(await outcome(complete(ids.editor, issued.issue_id)), '22023');
    // The old password (and even a new authenticator) leads nowhere.
    await authSetsPassword(ids.editor, 'h-own-5');
    assert.equal(await isStaff(ids.editor), false);
    assert.equal((await firstAccess(ids.editor)).expired, true);
  });

  test('password changes racing with a new issue end locked (B-02)', async () => {
    const issued = await issue(ids.editor);
    // The person's own change lands between the issue and the server's password: it consumes the marker…
    await authSetsPassword(ids.editor, 'h-racing-change');
    // …and the server then sets the temporary password: still locked.
    await authSetsPassword(ids.editor, 'h-temporary-6');
    assert.equal((await state(ids.editor)).must_change_password, true);
    assert.equal(await isStaff(ids.editor), false);
    // The database checked a first access, then an owner issues a new temporary password
    // before the person's password and the completion land.
    await openSession(ids.editor);
    await begin(ids.editor, issued.issue_id);
    const reissued = await issue(ids.editor);
    await authSetsPassword(ids.editor, 'h-own-6');
    await authSetsPassword(ids.editor, 'h-temporary-7');
    assert.equal(await outcome(complete(ids.editor, issued.issue_id)), 'PT409');
    assert.equal((await state(ids.editor)).must_change_password, true);
    await openSession(ids.editor);
    assert.equal(await isStaff(ids.editor), false, 'final state: locked');
    // The newest issue completes normally.
    await finish(ids.editor, reissued.issue_id);
    await openSession(ids.editor);
    assert.equal(await isStaff(ids.editor), true, 'only the explicit steps open it');
  });

  test('refuses unknown or inactive members, invalid expiry or digest, and duplicates', async () => {
    assert.equal(await outcome(issue(ids.outsider)), 'P0002');
    assert.equal(await outcome(issue(ids.inactive)), '55000', 'a deactivated person is reactivated first');
    assert.equal(await outcome(issue(ids.editor, 0)), '22023');
    assert.equal(await outcome(issue(ids.editor, 169)), '22023');
    assert.equal(await outcome(issue(ids.editor, 48, undefined, 'short')), '22023');
    assert.equal(await outcome(issue(ids.newbie, 48, ['nova@velmont.test', 'Outra', 'owner'])), '23505');
    assert.deepEqual(await sessions(ids.editor), [sessionOf(ids.editor)], 'a refused call changes nothing');
    assert.equal((await state(ids.inactive)).must_change_password, false);
  });

  test('password changes of members without a temporary password are recorded and change no access', async () => {
    await authSetsPassword(ids.owner, 'h-owner-2');
    assert.equal(await isStaff(ids.owner), true);
    assert.deepEqual(await lastEvents(ids.owner, 1), [{ action: 'auth.password_changed', actor_id: ids.owner }]);
    const outsiderBefore = (await sql('select count(*)::int as n from public.audit_log')).rows[0].n;
    await authSetsPassword(ids.outsider, 'h-outsider-2');
    assert.equal((await sql('select count(*)::int as n from public.audit_log')).rows[0].n, outsiderBefore, 'non-members are not logged');
  });

  test('role and active changes are still audited', async () => {
    await as(db, 'authenticated', claims(ids.owner), (q) => q(`select public.update_staff_member($1, 'owner', true)`, [ids.editor]), { commit: true });
    assert.deepEqual(await lastEvents(ids.editor, 1), [{ action: 'staff.update', actor_id: ids.owner }]);
  });
});
