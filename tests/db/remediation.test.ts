import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, outcome, startDatabase, type Claims, type Database } from './harness';

// Security remediation (white-box audit): media deletion only through a
// checked function, publication checked before images become public and
// refused attempts rolled back, the legacy onboarding RPC closed, and the
// security events recorded in the audit log.

const ids = {
  owner: '00000000-0000-4000-8000-0000000000b1',
  editor: '00000000-0000-4000-8000-0000000000b2',
  outsider: '00000000-0000-4000-8000-0000000000b3',
  cover: '30000000-0000-4000-8000-0000000000b1',
  inline: '30000000-0000-4000-8000-0000000000b2',
  loose: '30000000-0000-4000-8000-0000000000b3',
  live: '30000000-0000-4000-8000-0000000000b4',
  draft: '10000000-0000-4000-8000-0000000000b1',
  published: '10000000-0000-4000-8000-0000000000b2',
};
const sessionOf = (sub: string) => `5${sub.slice(1)}`;
const claims = (sub: string): Claims => ({ sub, role: 'authenticated', aal: 'aal2', session_id: sessionOf(sub) });
const pathOf = (id: string) => `${id}.webp`;

let db: Database;
const sql = (text: string, params: unknown[] = []) => db.pool.query(text, params);
const staffCall = (who: string, text: string, params: unknown[] = [], commit = false) => as(db, 'authenticated', claims(who), (q) => q(text, params), { commit });
const service = (text: string, params: unknown[] = []) => as(db, 'service_role', null, (q) => q(text, params), { commit: true });
const lastEvent = async (action: string) => (await sql('select actor_id, resource_id, metadata from public.audit_log where action = $1 order by id desc limit 1', [action])).rows[0];

before(async () => {
  db = await startDatabase();
  await sql(`insert into auth.users (id, email) values ($1, 'owner@velmont.test'), ($2, 'editor@velmont.test'), ($3, 'fora@example.test')`, [ids.owner, ids.editor, ids.outsider]);
  await sql(`insert into auth.sessions (id, user_id) select ('5' || substr(id::text, 2))::uuid, id from auth.users`);
  await sql(`insert into public.admin_users (user_id, email, display_name, role) values ($1, 'owner@velmont.test', 'Owner', 'owner'), ($2, 'editor@velmont.test', 'Editor', 'editor')`, [ids.owner, ids.editor]);
  for (const id of [ids.cover, ids.inline, ids.loose, ids.live]) {
    await sql(`insert into public.media (id, path, mime_type, bytes, width, height, alt) values ($1, $2, 'image/webp', 10, 800, 600, 'x')`, [id, pathOf(id)]);
  }
  const content = (mediaId: string) => JSON.stringify({ version: 1, blocks: [{ type: 'paragraph', text: 'Texto do artigo.' }, { type: 'image', mediaId, path: pathOf(mediaId), alt: 'Imagem', width: 800, height: 600 }] });
  await sql(
    `insert into public.articles (id, title, slug, excerpt, content, featured_image_id) values
     ($1, 'Rascunho com imagens', 'rascunho-com-imagens', 'Resumo suficiente do rascunho.', $3, $4),
     ($2, 'Artigo publicado', 'artigo-publicado', 'Resumo suficiente do publicado.', $5, null)`,
    [ids.draft, ids.published, content(ids.inline), ids.cover, content(ids.live)],
  );
  await service('select public.media_mark_public(array[$1]::uuid[])', [ids.live]);
  await staffCall(ids.owner, 'select public.publish_article($1, 1)', [ids.published], true);
});

after(async () => {
  await db?.stop();
});

describe('media deletion (B-03)', () => {
  test('signed-in staff can no longer delete media rows directly', async () => {
    for (const who of [ids.owner, ids.editor]) {
      assert.equal(await outcome(staffCall(who, 'delete from public.media where id = $1', [ids.loose])), '42501', who);
    }
    assert.equal((await sql('select count(*)::int as n from public.media where id = $1', [ids.loose])).rows[0].n, 1);
  });

  test('delete_media refuses a cover, an image block and an image a publication uses', async () => {
    for (const id of [ids.cover, ids.inline, ids.live]) {
      assert.equal(await outcome(staffCall(ids.editor, 'select public.delete_media($1)', [id])), '23503', id);
    }
    assert.equal(await outcome(staffCall(ids.editor, 'select public.delete_media($1)', ['30000000-0000-4000-8000-0000000000ff'])), 'P0002');
  });

  test('outsiders and anonymous visitors cannot call it', async () => {
    assert.equal(await outcome(staffCall(ids.outsider, 'select public.delete_media($1)', [ids.loose])), '42501');
    assert.equal(await outcome(as(db, 'anon', null, (q) => q('select public.delete_media($1)', [ids.loose]))), '42501');
  });

  test('an unused image is deleted, audited as the person, and its path returned for the files', async () => {
    const { rows } = await staffCall(ids.editor, 'select public.delete_media($1) as r', [ids.loose], true);
    assert.deepEqual(rows[0].r, { path: pathOf(ids.loose) });
    assert.equal((await sql('select count(*)::int as n from public.media where id = $1', [ids.loose])).rows[0].n, 0);
    assert.equal((await lastEvent('media.delete')).actor_id, ids.editor);
  });
});

describe('publication checked before images become public (V-03)', () => {
  test('can_publish_article applies the publish rules without changing anything', async () => {
    assert.equal(await outcome(staffCall(ids.editor, 'select public.can_publish_article($1, 1)', [ids.draft])), 'ok');
    assert.equal(await outcome(staffCall(ids.editor, 'select public.can_publish_article($1, 2)', [ids.draft])), 'PT409');
    await sql(`update public.articles set excerpt = 'curto' where id = $1`, [ids.draft]);
    assert.equal(await outcome(staffCall(ids.editor, 'select public.can_publish_article($1, 2)', [ids.draft])), '22023', 'incomplete');
    await sql(`update public.articles set excerpt = 'Resumo suficiente do rascunho.' where id = $1`, [ids.draft]);
    assert.equal(await outcome(staffCall(ids.outsider, 'select public.can_publish_article($1, 3)', [ids.draft])), '42501');
    assert.equal((await sql('select count(*)::int as n from public.media where public_since is not null and id in ($1, $2)', [ids.cover, ids.inline])).rows[0].n, 0, 'nothing became public');
  });

  test('a mismatched or missing image is caught before any copy', async () => {
    const bad = JSON.stringify({ version: 1, blocks: [{ type: 'image', mediaId: ids.inline, path: pathOf(ids.cover), alt: 'x', width: 1, height: 1 }] });
    await sql(`update public.articles set content = $2 where id = $1`, [ids.draft, bad]);
    const version = (await sql('select version from public.articles where id = $1', [ids.draft])).rows[0].version;
    const check = await as(db, 'authenticated', claims(ids.editor), (q) => q('select public.can_publish_article($1, $2)', [ids.draft, version])).catch((e: { message: string }) => e.message);
    assert.equal(check, 'media_mismatch');
  });

  test('a refused attempt is rolled back at once, except images a publication uses', async () => {
    await service('select public.media_mark_public(array[$1, $2, $3]::uuid[])', [ids.cover, ids.inline, ids.live]);
    const { rows } = await service('select * from public.media_rollback_public(array[$1, $2, $3]::uuid[]) as path order by 1', [ids.cover, ids.inline, ids.live]);
    assert.deepEqual(rows.map((r) => r.path), [pathOf(ids.cover), pathOf(ids.inline)].sort());
    const flags = await sql('select id, public_since is not null as public from public.media where id in ($1, $2, $3) order by id', [ids.cover, ids.inline, ids.live]);
    assert.deepEqual(flags.rows.map((r) => [r.id, r.public]), [[ids.cover, false], [ids.inline, false], [ids.live, true]]);
    assert.equal(await outcome(staffCall(ids.editor, 'select public.media_rollback_public(array[$1]::uuid[])', [ids.cover])), '42501', 'service role only');
  });
});

describe('legacy onboarding closed (H-04)', () => {
  test('add_staff_member is refused even for an owner', async () => {
    assert.equal(await outcome(staffCall(ids.owner, `select public.add_staff_member('fora@example.test', 'Fora', 'owner')`)), '42501');
    assert.equal((await sql('select count(*)::int as n from public.admin_users where user_id = $1', [ids.outsider])).rows[0].n, 0);
  });
});

describe('security events in the audit log', () => {
  test('rebuild requests and failures are recorded with who asked', async () => {
    await service(`insert into public.site_builds (requested_by, reason, ok, status) values ($1, 'manual', true, 'pending')`, [ids.editor]);
    assert.equal((await lastEvent('site.rebuild_requested')).actor_id, ids.editor);
    await service(`insert into public.site_builds (requested_by, reason, ok, status, finished_at, detail) values ($1, 'manual', false, 'failed', now(), 'deploy hook unreachable')`, [ids.owner]);
    assert.equal((await lastEvent('site.rebuild_failed')).actor_id, ids.owner);
    await service(`select public.finish_site_builds(now(), false, 'build failed: x')`);
    const failed = await lastEvent('site.build_failed');
    assert.equal(failed.actor_id, null);
    assert.equal(failed.metadata.detail, 'build failed: x');
  });

  test('the server records refused attempts; only known actions, never from the browser', async () => {
    await service(`select public.staff_log_event($1, 'auth.first_access_denied', $2, '{"reason":"wrong_temporary_password"}')`, [ids.editor, ids.editor]);
    const denied = await lastEvent('auth.first_access_denied');
    assert.equal(denied.actor_id, ids.editor);
    assert.deepEqual(denied.metadata, { reason: 'wrong_temporary_password' });
    assert.equal(await outcome(service(`select public.staff_log_event($1, 'article.publish', 'x')`, [ids.editor])), '22023');
    assert.equal(await outcome(staffCall(ids.owner, `select public.staff_log_event($1, 'staff.access_denied', 'x')`, [ids.owner])), '42501');
  });

  test('authenticator enrolled or removed, and sessions ended, are recorded for team members only', async () => {
    const factor = (await sql(`insert into auth.mfa_factors (user_id) values ($1) returning id`, [ids.editor])).rows[0].id;
    await sql(`update auth.mfa_factors set status = 'verified' where id = $1`, [factor]);
    assert.equal((await lastEvent('auth.mfa_enrolled')).actor_id, ids.editor);
    await sql('delete from auth.mfa_factors where id = $1', [factor]);
    assert.equal((await lastEvent('auth.mfa_removed')).actor_id, ids.editor);

    await sql(`insert into auth.sessions (user_id) values ($1), ($1)`, [ids.editor]);
    await sql('delete from auth.sessions where user_id = $1', [ids.editor]);
    const revoked = await lastEvent('auth.sessions_revoked');
    assert.equal(revoked.actor_id, ids.editor);
    assert.equal(revoked.resource_id, ids.editor);
    assert.deepEqual(revoked.metadata, { count: 3 });

    const before = (await sql('select count(*)::int as n from public.audit_log')).rows[0].n;
    await sql('delete from auth.sessions where user_id = $1', [ids.outsider]);
    await sql(`insert into auth.mfa_factors (user_id, status) values ($1, 'verified')`, [ids.outsider]);
    await sql(`delete from auth.mfa_factors where user_id = $1`, [ids.outsider]);
    assert.equal((await sql('select count(*)::int as n from public.audit_log')).rows[0].n, before, 'non-members are not recorded');
  });
});
