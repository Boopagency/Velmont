import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { as, outcome, startDatabase, type Claims, type Database } from './harness';

const ids = {
  owner: '00000000-0000-4000-8000-000000000001',
  editor: '00000000-0000-4000-8000-000000000002',
  outsider: '00000000-0000-4000-8000-000000000003',
  inactive: '00000000-0000-4000-8000-000000000004',
  draft: '10000000-0000-4000-8000-000000000001',
  published: '10000000-0000-4000-8000-000000000002',
  lead: '20000000-0000-4000-8000-000000000001',
  media: '30000000-0000-4000-8000-000000000001',
};
const claims = (sub: string, aal: 'aal1' | 'aal2' = 'aal2'): Claims => ({ sub, role: 'authenticated', aal });
const owner = claims(ids.owner);
const editor = claims(ids.editor);
const editorWithoutMfa = claims(ids.editor, 'aal1');
const outsider = claims(ids.outsider);
const inactive = claims(ids.inactive);
const content = JSON.stringify({ version: 1, blocks: [{ type: 'paragraph', text: 'Conteúdo do artigo.' }] });

let db: Database;

before(async () => {
  db = await startDatabase();
  await db.pool.query(
    `insert into auth.users (id, email) values ($1, 'owner@velmont.test'), ($2, 'editor@velmont.test'),
     ($3, 'outsider@example.test'), ($4, 'inactive@velmont.test')`,
    [ids.owner, ids.editor, ids.outsider, ids.inactive],
  );
  await db.pool.query(
    `insert into public.admin_users (user_id, email, display_name, role, active) values
     ($1, 'owner@velmont.test', 'Owner', 'owner', true), ($2, 'editor@velmont.test', 'Editor', 'editor', true),
     ($3, 'inactive@velmont.test', 'Inactive', 'editor', false)`,
    [ids.owner, ids.editor, ids.inactive],
  );
  await db.pool.query(
    `insert into public.media (id, path, mime_type, bytes, width, height, alt)
     values ($1, '30000000-0000-4000-8000-000000000001.webp', 'image/webp', 1000, 800, 600, 'Imagem')`,
    [ids.media],
  );
  await db.pool.query(
    `insert into public.articles (id, title, slug, excerpt, content) values
     ($1, 'Rascunho secreto', 'rascunho-secreto', 'Resumo do rascunho secreto.', $3),
     ($2, 'Artigo publicado', 'artigo-publicado', 'Resumo do artigo publicado.', $3)`,
    [ids.draft, ids.published, content],
  );
  await as(db, 'authenticated', owner, (q) => q('select public.publish_article($1, 1)', [ids.published]), { commit: true });
  await db.pool.query(
    `insert into public.leads (id, name, company, interest, utm_source) values ($1, 'Maria Cliente', 'Empresa X', 'Marcas', 'google')`,
    [ids.lead],
  );
});

after(async () => {
  await db?.stop();
});

describe('public (anon) access', () => {
  test('reads published articles only', async () => {
    const rows = await as(db, 'anon', null, (q) => q('select slug from public.published_articles order by slug'));
    assert.deepEqual(rows.rows.map((r) => r.slug), ['antes-de-registrar-sua-marca', 'artigo-publicado', 'inovacao-e-patente', 'software-tambem-e-patrimonio']);
  });

  test('launch articles are imported without invented dates', async () => {
    const rows = await as(db, 'anon', null, (q) => q(`select published_at, modified_at, reading_minutes from public.published_articles where slug = 'inovacao-e-patente'`));
    assert.deepEqual(rows.rows[0], { published_at: null, modified_at: null, reading_minutes: 2 });
  });

  for (const table of ['articles', 'leads', 'media', 'audit_log', 'admin_users', 'article_revisions', 'slug_redirects', 'rate_limits', 'site_builds']) {
    test(`cannot read ${table}`, async () => {
      assert.equal(await outcome(as(db, 'anon', null, (q) => q(`select * from public.${table}`))), '42501');
    });
  }

  test('cannot insert leads directly (must use the validated API)', async () => {
    const result = await outcome(as(db, 'anon', null, (q) => q(`insert into public.leads (name, interest) values ('x', 'Marcas')`)));
    assert.equal(result, '42501');
  });

  test('cannot write published articles', async () => {
    assert.equal(await outcome(as(db, 'anon', null, (q) => q(`delete from public.published_articles`))), '42501');
    assert.equal(await outcome(as(db, 'anon', null, (q) => q(`update public.published_articles set title = 'hacked'`))), '42501');
  });

  test('cannot call privileged functions', async () => {
    for (const sql of [
      `select public.publish_article('${ids.draft}', 1)`,
      `select public.admin_context()`,
      `select public.hit_rate_limit('x', 1, 60)`,
      `select public.update_staff_member('${ids.outsider}', 'owner', true)`,
      `select private.is_staff()`,
    ]) {
      assert.equal(await outcome(as(db, 'anon', null, (q) => q(sql))), '42501', sql);
    }
  });

  test('cannot enumerate or write storage objects in the media bucket', async () => {
    await db.pool.query(`insert into storage.objects (bucket_id, name) values ('media', 'existing.webp')`);
    const listed = await as(db, 'anon', null, (q) => q(`select name from storage.objects where bucket_id = 'media'`));
    assert.equal(listed.rowCount, 0);
    const insert = await outcome(as(db, 'anon', null, (q) => q(`insert into storage.objects (bucket_id, name) values ('media', 'evil.html')`)));
    assert.equal(insert, '42501');
    const del = await as(db, 'anon', null, (q) => q(`delete from storage.objects where bucket_id = 'media' returning id`));
    assert.equal(del.rowCount, 0);
  });

  test('draft is not reachable by id or slug through any public surface', async () => {
    const bySlug = await as(db, 'anon', null, (q) => q(`select * from public.published_articles where slug = 'rascunho-secreto' or article_id = $1`, [ids.draft]));
    assert.equal(bySlug.rowCount, 0);
    const redirect = await as(db, 'anon', null, (q) => q(`select public.resolve_slug_redirect('rascunho-secreto') as slug`));
    assert.equal(redirect.rows[0].slug, null);
  });
});

describe('authenticated users without a staff role', () => {
  for (const [label, who] of [['outsider', outsider], ['inactive staff', inactive], ['editor without MFA (aal1)', editorWithoutMfa]] as const) {
    test(`${label} sees no private rows`, async () => {
      for (const table of ['articles', 'leads', 'media', 'audit_log', 'admin_users', 'article_revisions']) {
        const rows = await as(db, 'authenticated', who, (q) => q(`select * from public.${table}`));
        assert.equal(rows.rowCount, 0, `${label} read ${table}`);
      }
    });

    test(`${label} cannot publish, create or modify`, async () => {
      assert.equal(await outcome(as(db, 'authenticated', who, (q) => q(`select public.publish_article($1, 1)`, [ids.draft]))), '42501');
      assert.equal(await outcome(as(db, 'authenticated', who, (q) => q(`insert into public.articles (title, slug) values ('x', 'invasao')`))), '42501');
      const updated = await as(db, 'authenticated', who, (q) => q(`update public.leads set status = 'archived' returning id`));
      assert.equal(updated.rowCount, 0);
    });
  }

  test('outsider cannot promote themselves', async () => {
    assert.equal(await outcome(as(db, 'authenticated', outsider, (q) => q(`insert into public.admin_users (user_id, email, display_name, role) values ($1, 'o@x', 'O', 'owner')`, [ids.outsider]))), '42501');
    assert.equal(await outcome(as(db, 'authenticated', outsider, (q) => q(`select public.add_staff_member('outsider@example.test', 'O', 'owner')`))), '42501');
  });

  test('admin_context reports MFA requirement without exposing data', async () => {
    const ctx = await as(db, 'authenticated', editorWithoutMfa, (q) => q('select public.admin_context() as c'));
    assert.equal(ctx.rows[0].c.is_member, true);
    assert.equal(ctx.rows[0].c.is_staff, false);
    assert.equal(ctx.rows[0].c.aal, 'aal1');
  });

  test('forged user_metadata role claims are ignored', async () => {
    const forged = { ...outsider, user_metadata: { role: 'owner' }, app_metadata: { role: 'owner' } } as Claims;
    const rows = await as(db, 'authenticated', forged, (q) => q('select * from public.leads'));
    assert.equal(rows.rowCount, 0);
  });
});

describe('editor', () => {
  test('reads drafts, leads and media', async () => {
    const articles = await as(db, 'authenticated', editor, (q) => q('select slug from public.articles where not legacy_import order by slug'));
    assert.deepEqual(articles.rows.map((r) => r.slug), ['artigo-publicado', 'rascunho-secreto']);
    const leads = await as(db, 'authenticated', editor, (q) => q('select name, utm_source from public.leads'));
    assert.equal(leads.rows[0].name, 'Maria Cliente');
  });

  test('creates drafts; server fields cannot be spoofed (mass assignment)', async () => {
    const spoof = await outcome(as(db, 'authenticated', editor, (q) => q(`insert into public.articles (title, slug, status) values ('x', 'spoof', 'published')`)));
    assert.equal(spoof, '42501');
    const spoofOwner = await outcome(as(db, 'authenticated', editor, (q) => q(`insert into public.articles (title, slug, created_by) values ('x', 'spoof', $1)`, [ids.owner])));
    assert.equal(spoofOwner, '42501');
    const created = await as(db, 'authenticated', editor, (q) => q(`insert into public.articles (title, slug) values ('Novo', 'novo-artigo') returning status, created_by, version`));
    assert.deepEqual(created.rows[0], { status: 'draft', created_by: ids.editor, version: 1 });
  });

  test('cannot change status directly, only through workflow functions', async () => {
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`update public.articles set status = 'published' where id = $1`, [ids.draft]))), '42501');
  });

  test('editing bumps version and stores a revision of the previous state', async () => {
    const result = await as(db, 'authenticated', editor, async (q) => {
      await q(`update public.articles set title = 'Rascunho revisado' where id = $1 and version = 1`, [ids.draft]);
      const article = await q('select version, updated_by from public.articles where id = $1', [ids.draft]);
      const revision = await q(`select snapshot->>'title' as title from public.article_revisions where article_id = $1 and kind = 'edit'`, [ids.draft]);
      return { article: article.rows[0], revision: revision.rows[0] };
    });
    assert.deepEqual(result.article, { version: 2, updated_by: ids.editor });
    assert.equal(result.revision.title, 'Rascunho secreto');
  });

  test('stale version updates nothing (optimistic concurrency)', async () => {
    const stale = await as(db, 'authenticated', editor, (q) => q(`update public.articles set title = 'x' where id = $1 and version = 99 returning id`, [ids.draft]));
    assert.equal(stale.rowCount, 0);
  });

  test('editing a published article does not change the live snapshot', async () => {
    const live = await as(db, 'authenticated', editor, async (q) => {
      await q(`update public.articles set title = 'Mudança em andamento' where id = $1`, [ids.published]);
      return (await q('select title from public.published_articles where article_id = $1', [ids.published])).rows[0].title;
    });
    assert.equal(live, 'Artigo publicado');
  });

  test('publish rejects stale versions and incomplete articles', async () => {
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`select public.publish_article($1, 42)`, [ids.draft]))), '40001');
    const incomplete = await outcome(as(db, 'authenticated', editor, async (q) => {
      const row = await q(`insert into public.articles (title, slug) values ('Oi', 'vazio') returning id`);
      await q(`select public.publish_article($1, 1)`, [row.rows[0].id]);
    }));
    assert.equal(incomplete, '22023');
  });

  test('renaming a published slug keeps a permanent redirect', async () => {
    const slug = await as(db, 'authenticated', editor, async (q) => {
      await q(`update public.articles set slug = 'novo-endereco' where id = $1`, [ids.published]);
      const version = (await q('select version from public.articles where id = $1', [ids.published])).rows[0].version;
      await q('select public.publish_article($1, $2)', [ids.published, version]);
      await q(`set local role anon`);
      await q(`select set_config('request.jwt.claims', '', true)`);
      return (await q(`select public.resolve_slug_redirect('artigo-publicado') as slug`)).rows[0].slug;
    });
    assert.equal(slug, 'novo-endereco');
  });

  test('republishing a launch article records an update date but never invents a publication date', async () => {
    const row = await as(db, 'authenticated', editor, async (q) => {
      const a = (await q(`select id, version from public.articles where slug = 'inovacao-e-patente'`)).rows[0];
      await q('select public.publish_article($1, $2)', [a.id, a.version]);
      return (await q(`select published_at, modified_at from public.published_articles where article_id = $1`, [a.id])).rows[0];
    });
    assert.equal(row.published_at, null);
    assert.ok(row.modified_at instanceof Date);
  });

  test('unpublish removes the public snapshot', async () => {
    const rows = await as(db, 'authenticated', editor, async (q) => {
      await q('select public.unpublish_article($1)', [ids.published]);
      return (await q('select * from public.published_articles where article_id = $1', [ids.published])).rowCount;
    });
    assert.equal(rows, 0);
  });

  test('may update lead status and notes but never submitted data', async () => {
    const ok = await as(db, 'authenticated', editor, (q) => q(`update public.leads set status = 'contacted', notes = 'Retornar' where id = $1 returning status`, [ids.lead]));
    assert.equal(ok.rows[0].status, 'contacted');
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`update public.leads set name = 'Outro' where id = $1`, [ids.lead]))), '42501');
  });

  test('cannot delete leads or articles, read the audit log, or manage roles', async () => {
    const leads = await as(db, 'authenticated', editor, (q) => q('delete from public.leads returning id'));
    assert.equal(leads.rowCount, 0);
    const articles = await as(db, 'authenticated', editor, (q) => q('delete from public.articles returning id'));
    assert.equal(articles.rowCount, 0);
    const audit = await as(db, 'authenticated', editor, (q) => q('select * from public.audit_log'));
    assert.equal(audit.rowCount, 0);
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`select public.update_staff_member($1, 'owner', true)`, [ids.editor]))), '42501');
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`update public.admin_users set role = 'owner' where user_id = $1`, [ids.editor]))), '42501');
    assert.equal(await outcome(as(db, 'authenticated', editor, (q) => q(`select public.add_staff_member('outsider@example.test', 'O', 'editor')`))), '42501');
  });

  test('cannot bypass the upload API by writing storage objects', async () => {
    const insert = await outcome(as(db, 'authenticated', editor, (q) => q(`insert into storage.objects (bucket_id, name) values ('media', 'x.svg')`)));
    assert.equal(insert, '42501');
  });

  test('rejects malicious article content at the database', async () => {
    const payloads = [
      { version: 1, blocks: [{ type: 'html', html: '<script>alert(1)</script>' }] },
      { version: 1, blocks: [{ type: 'heading', text: 'Sem nível' }] },
      { version: 1, blocks: [{ type: 'image', mediaId: ids.media, path: '../../etc/passwd', alt: '', width: 1, height: 1 }] },
      { version: 1, blocks: [{ type: 'image', mediaId: ids.media, path: 'https://evil.test/x.svg', alt: '', width: 1, height: 1 }] },
      { version: 2, blocks: [] },
      { version: 1, blocks: [{ type: 'paragraph', text: 'x'.repeat(5001) }] },
      { version: 1, blocks: 'not-an-array' },
    ];
    for (const payload of payloads) {
      const result = await outcome(as(db, 'authenticated', editor, (q) => q(`update public.articles set content = $1 where id = $2`, [JSON.stringify(payload), ids.draft])));
      assert.equal(result, '23514', JSON.stringify(payload));
    }
    const badSource = await outcome(as(db, 'authenticated', editor, (q) => q(`update public.articles set sources = $1 where id = $2`, [JSON.stringify([{ title: 'x', url: 'javascript:alert(1)' }]), ids.draft])));
    assert.equal(badSource, '23514');
  });
});

describe('owner', () => {
  test('reads the audit log with actor ids and no lead personal data', async () => {
    const rows = await as(db, 'authenticated', owner, async (q) => {
      await q(`update public.leads set status = 'qualified' where id = $1`, [ids.lead]);
      return (await q(`select action, actor_id, metadata from public.audit_log order by id`)).rows;
    });
    const publish = rows.find((r) => r.action === 'article.publish');
    assert.equal(publish?.actor_id, ids.owner);
    const leadUpdate = rows.find((r) => r.action === 'lead.update');
    assert.ok(leadUpdate);
    assert.ok(!JSON.stringify(leadUpdate.metadata).includes('Maria'));
  });

  test('audit log is append-only even for the owner and the service role', async () => {
    assert.equal(await outcome(as(db, 'authenticated', owner, (q) => q('delete from public.audit_log'))), '42501');
    assert.equal(await outcome(as(db, 'service_role', null, (q) => q('delete from public.audit_log'))), '42501');
  });

  test('can manage roles but never remove the last owner', async () => {
    await as(db, 'authenticated', owner, async (q) => {
      await q(`select public.update_staff_member($1, 'editor', true)`, [ids.editor]);
    });
    assert.equal(await outcome(as(db, 'authenticated', owner, (q) => q(`select public.update_staff_member($1, 'editor', true)`, [ids.owner]))), '23514');
  });

  test('can delete leads (LGPD requests)', async () => {
    const deleted = await as(db, 'authenticated', owner, (q) => q('delete from public.leads where id = $1 returning id', [ids.lead]));
    assert.equal(deleted.rowCount, 1);
  });
});

describe('service role helpers', () => {
  test('rate limit allows up to the limit within a window', async () => {
    const results = await as(db, 'service_role', null, async (q) => {
      const out: boolean[] = [];
      for (let i = 0; i < 4; i++) out.push((await q(`select public.hit_rate_limit('lead:abc', 3, 60) as ok`)).rows[0].ok);
      return out;
    });
    assert.deepEqual(results, [true, true, true, false]);
  });
});
