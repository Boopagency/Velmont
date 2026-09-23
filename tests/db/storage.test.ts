import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, outcome, startDatabase, type Claims, type Database } from './harness';

// Draft media lives in the private bucket; only staff can read it (which is
// what creating signed URLs requires). Only the service role makes an image
// public, and publish_article refuses images that are not public yet.

const ids = {
  owner: '00000000-0000-4000-8000-0000000000a1',
  editor: '00000000-0000-4000-8000-0000000000a2',
  outsider: '00000000-0000-4000-8000-0000000000a3',
  cover: '30000000-0000-4000-8000-0000000000b1',
  inline: '30000000-0000-4000-8000-0000000000b2',
  article: '10000000-0000-4000-8000-0000000000c1',
};
const coverPath = `${ids.cover}.webp`;
const inlinePath = `${ids.inline}.webp`;
const sessionOf = (sub: string) => `5${sub.slice(1)}`;
const claims = (sub: string, aal: 'aal1' | 'aal2' = 'aal2'): Claims => ({ sub, role: 'authenticated', aal, session_id: sessionOf(sub) });
const editor = claims(ids.editor);
const outsider = claims(ids.outsider);
const editorWithoutMfa = claims(ids.editor, 'aal1');
const content = (blocks: unknown[]) => JSON.stringify({ version: 1, blocks: [{ type: 'paragraph', text: 'Texto do artigo.' }, ...blocks] });

let db: Database;

before(async () => {
  db = await startDatabase();
  await db.pool.query(`insert into auth.users (id, email) values ($1, 'o@v.test'), ($2, 'e@v.test'), ($3, 'x@example.test')`, [ids.owner, ids.editor, ids.outsider]);
  await db.pool.query(`insert into auth.sessions (id, user_id) select ('5' || substr(id::text, 2))::uuid, id from auth.users`);
  await db.pool.query(`insert into public.admin_users (user_id, email, display_name, role) values ($1, 'o@v.test', 'Owner', 'owner'), ($2, 'e@v.test', 'Editor', 'editor')`, [ids.owner, ids.editor]);
  await db.pool.query(
    `insert into public.media (id, path, mime_type, bytes, width, height, alt) values
     ($1, $3, 'image/webp', 1000, 1600, 900, 'Capa'), ($2, $4, 'image/webp', 1000, 800, 600, 'Figura')`,
    [ids.cover, ids.inline, coverPath, inlinePath],
  );
  await db.pool.query(`insert into storage.objects (bucket_id, name) values ('media-private', $1), ('media-private', $2)`, [coverPath, inlinePath]);
  await db.pool.query(
    `insert into public.articles (id, title, slug, excerpt, content, featured_image_id) values ($1, 'Com imagem', 'com-imagem', 'Resumo do artigo com imagem.', $2, $3)`,
    [ids.article, content([{ type: 'image', mediaId: ids.inline, path: inlinePath, alt: 'Figura', width: 800, height: 600 }]), ids.cover],
  );
});

after(async () => {
  await db?.stop();
});

const privateObjects = (who: Claims | null) =>
  as(db, who ? 'authenticated' : 'anon', who, (q) => q(`select name from storage.objects where bucket_id = 'media-private'`));

describe('private media bucket', () => {
  test('buckets: draft media is private, published copies are public', async () => {
    const rows = await db.pool.query(`select id, public from storage.buckets where id in ('media', 'media-private') order by id`);
    assert.deepEqual(rows.rows, [{ id: 'media', public: true }, { id: 'media-private', public: false }]);
  });

  test('anonymous visitors cannot read or list private objects, despite a permissive project-wide policy', async () => {
    assert.equal((await privateObjects(null)).rowCount, 0);
  });

  test('signed-in users who are not staff, or lack MFA, cannot read private objects (no signed URLs)', async () => {
    assert.equal((await privateObjects(outsider)).rowCount, 0);
    assert.equal((await privateObjects(editorWithoutMfa)).rowCount, 0);
    const ended = await as(db, 'authenticated', editor, async (q) => {
      await q('set local role postgres');
      await q('delete from auth.sessions where id = $1', [sessionOf(ids.editor)]);
      await q('set local role authenticated');
      return (await q(`select name from storage.objects where bucket_id = 'media-private'`)).rowCount;
    });
    assert.equal(ended, 0, 'signed-out session');
  });

  test('staff can read private objects (required to create signed URLs)', async () => {
    assert.equal((await privateObjects(editor)).rowCount, 2);
  });

  test('nobody writes private or public objects from the browser, staff included', async () => {
    for (const who of [null, outsider, editor]) {
      const role = who ? 'authenticated' : 'anon';
      for (const bucket of ['media-private', 'media']) {
        assert.equal(await outcome(as(db, role, who, (q) => q(`insert into storage.objects (bucket_id, name) values ($1, 'x.webp')`, [bucket]))), '42501', `${role} insert ${bucket}`);
        const updated = await as(db, role, who, (q) => q(`update storage.objects set name = 'y.webp' where bucket_id = $1 returning id`, [bucket]));
        assert.equal(updated.rowCount, 0, `${role} update ${bucket}`);
        const deleted = await as(db, role, who, (q) => q(`delete from storage.objects where bucket_id = $1 returning id`, [bucket]));
        assert.equal(deleted.rowCount, 0, `${role} delete ${bucket}`);
      }
    }
  });
});

describe('publishing images', () => {
  test('staff cannot make media public themselves', async () => {
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`update public.media set public_since = now() where id = $1`, [ids.cover]))), '42501');
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`select public.media_mark_public(array[$1]::uuid[])`, [ids.cover]))), '42501');
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`select public.media_unpublish_unreferenced(0)`))), '42501');
    const alt = await as(db, 'authenticated', editor, (q) => q(`update public.media set alt = 'Nova' where id = $1 returning public_since`, [ids.cover]));
    assert.equal(alt.rows[0].public_since, null);
  });

  test('publish is refused while referenced images are still private', async () => {
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`select public.publish_article($1, 1)`, [ids.article]))), '22023');
    await as(db, 'service_role', null, (q) => q(`select public.media_mark_public(array[$1]::uuid[])`, [ids.cover]), { commit: true });
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`select public.publish_article($1, 1)`, [ids.article]))), '22023', 'inline image still private');
  });

  test('image blocks must point at the media row they name', async () => {
    const result = await outcome(as(db, 'authenticated', editor, async (q) => {
      await q(`update public.articles set content = $2 where id = $1`, [ids.article, content([{ type: 'image', mediaId: ids.inline, path: coverPath, alt: '', width: 1, height: 1 }])]);
      await q('set local role postgres');
      await q(`update public.media set public_since = now()`);
      await q('set local role authenticated');
      await q(`select public.publish_article($1, 2)`, [ids.article]);
    }));
    assert.equal(result, '22023');
    const unknown = await outcome(as(db, 'authenticated', editor, async (q) => {
      await q(`update public.articles set content = $2 where id = $1`, [ids.article, content([{ type: 'image', mediaId: '30000000-0000-4000-8000-00000000ffff', path: '30000000-0000-4000-8000-00000000ffff.webp', alt: '', width: 1, height: 1 }])]);
      await q(`select public.publish_article($1, 2)`, [ids.article]);
    }));
    assert.equal(unknown, '22023');
  });

  test('publishes once the service role copied every referenced image', async () => {
    await as(db, 'service_role', null, (q) => q(`select public.media_mark_public(array[$1, $2]::uuid[])`, [ids.cover, ids.inline]), { commit: true });
    await as(db, 'authenticated', editor, (q) => q(`select public.publish_article($1, 1)`, [ids.article]), { commit: true });
    const snapshot = await as(db, 'anon', null, (q) => q(`select featured_image->>'path' as cover from public.published_articles where article_id = $1`, [ids.article]));
    assert.equal(snapshot.rows[0].cover, coverPath);
  });

  test('cleanup keeps referenced images public and respects the grace period', async () => {
    const kept = await as(db, 'service_role', null, (q) => q(`select * from public.media_unpublish_unreferenced(0)`));
    assert.equal(kept.rowCount, 0);
    await as(db, 'authenticated', editor, (q) => q(`select public.unpublish_article($1)`, [ids.article]), { commit: true });
    const fresh = await as(db, 'service_role', null, (q) => q(`select * from public.media_unpublish_unreferenced(3600)`));
    assert.equal(fresh.rowCount, 0, 'images published moments ago stay during the grace period');
    const removed = await as(db, 'service_role', null, (q) => q(`select * from public.media_unpublish_unreferenced(0) as path order by 1`), { commit: true });
    assert.deepEqual(removed.rows.map((r) => r.path), [coverPath, inlinePath].sort());
    const flags = await db.pool.query(`select count(*)::int as n from public.media where public_since is not null`);
    assert.equal(flags.rows[0].n, 0);
  });
});
