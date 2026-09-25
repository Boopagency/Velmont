import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, outcome, startDatabase, type Claims, type Database } from './harness';

// First access with a temporary password: the database decides, not the browser.

const ids = {
  owner: '00000000-0000-4000-8000-0000000000a1',
  newbie: '00000000-0000-4000-8000-0000000000a2',
  editor: '00000000-0000-4000-8000-0000000000a3',
  outsider: '00000000-0000-4000-8000-0000000000a4',
};
const sessionOf = (sub: string) => `5${sub.slice(1)}`;
const claims = (sub: string): Claims => ({ sub, role: 'authenticated', aal: 'aal2', session_id: sessionOf(sub) });

let db: Database;
const sql = (text: string, params: unknown[] = []) => db.pool.query(text, params);
const state = async (id: string) =>
  (await sql('select must_change_password, temporary_password_pending, temporary_password_expires_at from public.admin_users where user_id = $1', [id])).rows[0];
const openSession = (id: string) => sql('insert into auth.sessions (id, user_id) values ($1, $2) on conflict do nothing', [sessionOf(id), id]);
const sessions = async (id: string) => (await sql('select count(*)::int as n from auth.sessions where user_id = $1', [id])).rows[0].n as number;
/** What the Vercel Function does with the service role (committed). */
const issue = (userId: string, hours = 48, member?: [string, string, string]) =>
  as(db, 'service_role', null, (q) => q('select public.staff_issue_temporary_password($1, $2, $3, $4, $5, $6) as expires', [ids.owner, userId, hours, ...(member || [null, null, null])]), { commit: true });
/** Supabase Auth writing a new password hash (server-issued or chosen by the person). */
const authSetsPassword = (id: string, hash: string) => sql('update auth.users set encrypted_password = $2 where id = $1', [id, hash]);
const isStaff = async (id: string) => (await as(db, 'authenticated', claims(id), (q) => q('select private.is_staff() as ok'))).rows[0].ok as boolean;
const leadsSeen = async (id: string) => (await as(db, 'authenticated', claims(id), (q) => q('select count(*)::int as n from public.leads'))).rows[0].n as number;
const context = async (id: string) => (await as(db, 'authenticated', claims(id), (q) => q('select public.admin_context() as c'))).rows[0].c as Record<string, unknown>;
const lastEvents = async (resource: string, n: number) =>
  (await sql('select action, actor_id from public.audit_log where resource_id = $1 order by id desc limit $2', [resource, n])).rows.reverse();

before(async () => {
  db = await startDatabase();
  await sql(
    `insert into auth.users (id, email, encrypted_password) values ($1, 'owner@velmont.test', 'h-owner'), ($2, 'nova@velmont.test', ''),
     ($3, 'editora@velmont.test', 'h-editor'), ($4, 'fora@example.test', 'h-outsider')`,
    [ids.owner, ids.newbie, ids.editor, ids.outsider],
  );
  await sql(
    `insert into public.admin_users (user_id, email, display_name, role) values ($1, 'owner@velmont.test', 'Responsável', 'owner'),
     ($2, 'editora@velmont.test', 'Editora', 'editor')`,
    [ids.owner, ids.editor],
  );
  for (const id of Object.values(ids)) await openSession(id);
  await sql(`insert into public.leads (name, interest) values ('Maria', 'Marcas')`);
});

after(async () => {
  await db.stop();
});

describe('temporary passwords', () => {
  test('only the service role can look people up or issue them; the trigger function is not callable', async () => {
    for (const [role, who] of [['anon', null], ['authenticated', claims(ids.owner)]] as const) {
      assert.equal(await outcome(as(db, role, who, (q) => q(`select public.staff_find_user('nova@velmont.test')`))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select public.staff_issue_temporary_password($1, $2, 48)', [ids.owner, ids.editor]))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select public.staff_temporary_password_failed($1)', [ids.editor]))), '42501');
      assert.equal(await outcome(as(db, role, who, (q) => q('select private.auth_password_changed()'))), '42501');
    }
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

  test('a new member cannot read anything, even with MFA, until replacing the temporary password', async () => {
    const { rows } = await issue(ids.newbie, 48, ['Nova@velmont.test ', ' Nova Pessoa ', 'editor']);
    const hours = (new Date(rows[0].expires).getTime() - Date.now()) / 3600e3;
    assert.ok(hours > 47.9 && hours <= 48, `expires in ${hours} h`);
    assert.equal(await sessions(ids.newbie), 0, 'sessions from before are ended');
    const member = (await sql('select email, display_name, role, active from public.admin_users where user_id = $1', [ids.newbie])).rows[0];
    assert.deepEqual(member, { email: 'nova@velmont.test', display_name: 'Nova Pessoa', role: 'editor', active: true });
    assert.deepEqual(await lastEvents(ids.newbie, 2), [
      { action: 'staff.add', actor_id: ids.owner },
      { action: 'staff.temporary_password', actor_id: ids.owner },
    ]);

    // Supabase Auth stores the temporary password: the marker is consumed, the lock stays.
    await authSetsPassword(ids.newbie, 'h-temporary');
    assert.equal((await state(ids.newbie)).must_change_password, true);
    assert.equal((await state(ids.newbie)).temporary_password_pending, false);

    // Signed in with it and MFA verified: still no staff access.
    await openSession(ids.newbie);
    assert.equal(await isStaff(ids.newbie), false);
    assert.equal(await leadsSeen(ids.newbie), 0);
    assert.equal(await outcome(as(db, 'authenticated', claims(ids.newbie), (q) => q('select public.record_admin_login()'))), '42501');
    const ctx = await context(ids.newbie);
    assert.equal(ctx.is_member, true);
    assert.equal(ctx.must_change_password, true);
    assert.equal(ctx.temporary_password_expired, false);
    assert.equal(ctx.is_staff, false);

    // Chooses their own password (through Supabase Auth): unlocked, audited as themselves.
    await authSetsPassword(ids.newbie, 'h-own');
    const after = await state(ids.newbie);
    assert.equal(after.must_change_password, false);
    assert.equal(after.temporary_password_expires_at, null);
    assert.equal(await isStaff(ids.newbie), true);
    assert.equal(await leadsSeen(ids.newbie), 1);
    assert.deepEqual(await lastEvents(ids.newbie, 1), [{ action: 'auth.password_set', actor_id: ids.newbie }]);
  });

  test('a new temporary password locks an existing member at once and ends every session', async () => {
    assert.equal(await isStaff(ids.editor), true);
    await issue(ids.editor);
    assert.equal(await sessions(ids.editor), 0);
    await openSession(ids.editor);
    assert.equal(await isStaff(ids.editor), false, 'not even a new session with MFA');
    // Only its own event: the bookkeeping is not logged as a role change.
    assert.deepEqual(await lastEvents(ids.editor, 1), [{ action: 'staff.temporary_password', actor_id: ids.owner }]);
    await authSetsPassword(ids.editor, 'h-temporary-2');
    assert.equal(await isStaff(ids.editor), false, 'the server-issued password unlocks nothing');
    await authSetsPassword(ids.editor, 'h-own-2');
    assert.equal(await isStaff(ids.editor), true);
  });

  test('once expired, a temporary password unlocks nothing, not even by changing it', async () => {
    await issue(ids.editor);
    await authSetsPassword(ids.editor, 'h-temporary-3');
    await sql(`update public.admin_users set temporary_password_expires_at = now() - interval '1 minute' where user_id = $1`, [ids.editor]);
    await openSession(ids.editor);
    const ctx = await context(ids.editor);
    assert.equal(ctx.temporary_password_expired, true);
    assert.equal(ctx.is_staff, false);
    await authSetsPassword(ids.editor, 'h-own-3');
    assert.equal((await state(ids.editor)).must_change_password, true);
    assert.equal(await isStaff(ids.editor), false);
    // A new one from an owner fixes it.
    await issue(ids.editor);
    await authSetsPassword(ids.editor, 'h-temporary-4');
    await authSetsPassword(ids.editor, 'h-own-4');
    await openSession(ids.editor);
    assert.equal(await isStaff(ids.editor), true);
  });

  test('if Supabase Auth refuses the new password, the account stays locked', async () => {
    await issue(ids.editor);
    await as(db, 'service_role', null, (q) => q('select public.staff_temporary_password_failed($1)', [ids.editor]), { commit: true });
    const locked = await state(ids.editor);
    assert.equal(locked.must_change_password, true);
    assert.equal(locked.temporary_password_pending, false);
    await openSession(ids.editor);
    assert.equal(await isStaff(ids.editor), false);
    // The old password + MFA can only lead to choosing a new one.
    await authSetsPassword(ids.editor, 'h-own-5');
    assert.equal(await isStaff(ids.editor), true);
  });

  test('refuses unknown members, invalid expiry and duplicates', async () => {
    assert.equal(await outcome(issue(ids.outsider)), 'P0002');
    assert.equal(await outcome(issue(ids.editor, 0)), '22023');
    assert.equal(await outcome(issue(ids.editor, 169)), '22023');
    assert.equal(await outcome(issue(ids.newbie, 48, ['nova@velmont.test', 'Outra', 'owner'])), '23505');
    assert.equal(await sessions(ids.editor), 1, 'a refused call changes nothing');
  });

  test('password changes of people without a temporary password change nothing', async () => {
    const before = await lastEvents(ids.owner, 1);
    await authSetsPassword(ids.owner, 'h-owner-2');
    assert.equal(await isStaff(ids.owner), true);
    assert.deepEqual(await lastEvents(ids.owner, 1), before);
  });

  test('role and active changes are still audited', async () => {
    await as(db, 'authenticated', claims(ids.owner), (q) => q(`select public.update_staff_member($1, 'owner', true)`, [ids.editor]), { commit: true });
    assert.deepEqual(await lastEvents(ids.editor, 1), [{ action: 'staff.update', actor_id: ids.owner }]);
  });
});
