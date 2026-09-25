import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { POST as submitLead } from '../../api/leads';
import { DELETE as deleteMedia, POST as uploadMedia } from '../../api/admin/media';
import { POST as rebuild } from '../../api/admin/rebuild';
import { POST as publish } from '../../api/admin/publish';
import { POST as staffAccess } from '../../api/admin/staff';
import { GET as blogFallback } from '../../api/blog-fallback';
import { sniffImage } from '../../server/image';
import { clean } from '../../server/leads';
import { temporaryPassword } from '../../server/staff';

// The Supabase client talks HTTP; these tests stand in for PostgREST,
// Storage, Turnstile and the deploy hook by intercepting fetch.

const SITE = 'https://www.velmont.test';
const SUPABASE = 'https://project.supabase.co';
type Call = { method: string; url: URL; body: string; auth: string | null };
let calls: Call[] = [];
let context: Record<string, unknown> | 'invalid' = { user_id: 'u1', is_staff: true, role: 'editor', aal: 'aal2' };
let rateAllowed = true;
let turnstileOk = true;
let hookOk = true;
let usageCount = 0;
let publishError: { code: string; message: string } | null = null;
let unreferenced: string[] = [];
let foundUser: { user_id: string; is_member: boolean } | null = null;
let members: { user_id: string }[] = [];
let authRefuses: 'create' | 'password' | null = null;
const COVER = '0f8fad5b-d9cb-469f-a165-70867728950e';
const INLINE = '1f8fad5b-d9cb-469f-a165-70867728950e';
const OTHER = '2f8fad5b-d9cb-469f-a165-70867728950e';
const ARTICLE = '3f8fad5b-d9cb-469f-a165-70867728950e';
const OWNER = '4f8fad5b-d9cb-469f-a165-70867728950e';
const PERSON = '5f8fad5b-d9cb-469f-a165-70867728950e';
const FACTOR = '6f8fad5b-d9cb-469f-a165-70867728950e';
const realFetch = globalThis.fetch;

function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

beforeEach(() => {
  calls = [];
  context = { user_id: 'u1', is_staff: true, role: 'editor', aal: 'aal2' };
  rateAllowed = true;
  turnstileOk = true;
  hookOk = true;
  usageCount = 0;
  publishError = null;
  unreferenced = [];
  foundUser = null;
  members = [];
  authRefuses = null;
  Object.assign(process.env, {
    NEXT_PUBLIC_SITE_URL: SITE,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    RATE_LIMIT_SALT: 'a-long-random-test-salt',
    NEXT_PUBLIC_LEAD_CAPTURE: 'true',
    TURNSTILE_SECRET_KEY: '',
    VERCEL_DEPLOY_HOOK_URL: 'https://api.vercel.com/v1/integrations/deploy/prj_abc/hook123',
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text().catch(() => '');
    calls.push({ method: request.method, url, body, auth: request.headers.get('authorization') });
    const path = url.pathname;
    if (url.host === 'challenges.cloudflare.com') return reply(200, { success: turnstileOk });
    if (url.host === 'api.vercel.com') return reply(hookOk ? 201 : 500, hookOk ? { job: { id: 'job_1', state: 'PENDING' } } : {});
    if (path === '/rest/v1/rpc/admin_context') return context === 'invalid' ? reply(401, { message: 'JWT expired' }) : reply(200, context);
    if (path === '/rest/v1/rpc/hit_rate_limit') return reply(200, rateAllowed);
    if (path === '/rest/v1/rpc/staff_find_user') return reply(200, foundUser);
    if (path === '/rest/v1/rpc/staff_issue_temporary_password') return JSON.parse(body).p_email === 'duplicada@velmont.test' ? reply(409, { code: '23505', message: 'duplicate key' }) : reply(200, '2026-09-27T18:00:00+00:00');
    if (path === '/rest/v1/rpc/staff_temporary_password_failed') return reply(200, null);
    if (path === '/rest/v1/admin_users' && request.method === 'GET') return reply(200, members);
    if (path === '/auth/v1/admin/users' && request.method === 'POST') return authRefuses === 'create' ? reply(422, { code: 422, msg: 'refused' }) : reply(200, { id: PERSON, email: JSON.parse(body).email, aud: 'authenticated' });
    if (/^\/auth\/v1\/admin\/users\/[0-9a-f-]{36}\/factors$/.test(path)) return reply(200, [{ id: FACTOR, factor_type: 'totp', status: 'verified' }]);
    if (/^\/auth\/v1\/admin\/users\/[0-9a-f-]{36}\/factors\/[0-9a-f-]{36}$/.test(path) && request.method === 'DELETE') return reply(200, {});
    if (/^\/auth\/v1\/admin\/users\/[0-9a-f-]{36}$/.test(path) && request.method === 'PUT')
      return authRefuses === 'password' && JSON.parse(body).password ? reply(422, { code: 422, msg: 'refused' }) : reply(200, { id: path.split('/').pop(), aud: 'authenticated' });
    if (path === '/rest/v1/rpc/resolve_slug_redirect') return reply(200, JSON.parse(body).p_slug === 'nome-antigo' ? 'nome-novo' : null);
    if (path === '/rest/v1/leads' && request.method === 'POST') return reply(201, null);
    if (path === '/rest/v1/site_builds') return reply(201, null);
    if (path === '/storage/v1/object/copy') return reply(200, { Key: 'media/x' });
    if (/^\/storage\/v1\/object\/(media|media-private)\/./.test(path)) return reply(200, { Key: 'x' });
    if (/^\/storage\/v1\/object\/(media|media-private)$/.test(path) && request.method === 'DELETE') return reply(200, []);
    if (path === '/rest/v1/rpc/media_mark_public') return reply(200, null);
    if (path === '/rest/v1/rpc/media_unpublish_unreferenced') return reply(200, unreferenced);
    if (path === '/rest/v1/rpc/publish_article') return publishError ? reply(400, publishError) : reply(200, 'artigo');
    if (path === '/rest/v1/rpc/unpublish_article' || path === '/rest/v1/rpc/archive_article') return reply(200, null);
    if (path === '/rest/v1/articles' && request.method === 'GET')
      return reply(200, { id: ARTICLE, version: 3, featured_image_id: COVER, og_image_id: null, content: { version: 1, blocks: [{ type: 'paragraph', text: 'x' }, { type: 'image', mediaId: INLINE, path: `${INLINE}.webp` }] } });
    if (path === '/rest/v1/media' && request.method === 'GET' && url.searchParams.get('id')?.startsWith('in.'))
      return reply(200, [COVER, INLINE].filter((id) => url.searchParams.get('id')!.includes(id)).map((id) => ({ id, path: `${id}.webp` })));
    if (path === '/rest/v1/media' && request.method === 'POST') return reply(201, { id: '0f8fad5b-d9cb-469f-a165-70867728950e', path: 'x.webp' });
    if (path === '/rest/v1/media' && request.method === 'GET') return reply(200, { id: '0f8fad5b-d9cb-469f-a165-70867728950e', path: '0f8fad5b-d9cb-469f-a165-70867728950e.webp' });
    if (path === '/rest/v1/media' && request.method === 'DELETE') return reply(204, null);
    if ((path === '/rest/v1/articles' || path === '/rest/v1/published_articles') && request.method === 'HEAD') return reply(200, null, { 'content-range': `*/${usageCount}` });
    if (url.origin === SITE) return new Response('<!doctype html><title>Página não encontrada | Velmont</title>', { status: 200 });
    return reply(404, { message: `unmocked ${request.method} ${path}` });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const leadRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/leads`, { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE, 'x-real-ip': '203.0.113.9', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const validLead = { name: '  Maria\u0000  da   Silva ', company: 'Empresa', interest: 'Marcas', website: '', landing_page: '/blog/x', referrer: 'https://www.google.com', utm_source: 'google' };
const inserted = () => calls.filter((c) => c.url.pathname === '/rest/v1/leads');

describe('POST /api/leads', () => {
  test('stores a normalized lead with only whitelisted columns', async () => {
    const res = await submitLead(leadRequest(validLead));
    assert.equal(res.status, 201);
    const row = JSON.parse(inserted()[0].body);
    assert.deepEqual(Object.keys(row).sort(), ['company', 'interest', 'landing_page', 'name', 'referrer', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term']);
    assert.equal(row.name, 'Maria da Silva');
    assert.equal(inserted()[0].auth, 'Bearer service-key');
    const rate = calls.find((c) => c.url.pathname === '/rest/v1/rpc/hit_rate_limit');
    assert.ok(rate && !rate.body.includes('203.0.113.9'), 'IP is hashed before storage');
  });

  test('rejects mass assignment of status, notes or ids', async () => {
    for (const extra of [{ status: 'converted' }, { notes: 'x' }, { id: '0f8fad5b-d9cb-469f-a165-70867728950e' }, { created_at: '2020-01-01' }]) {
      assert.equal((await submitLead(leadRequest({ ...validLead, ...extra }))).status, 400, JSON.stringify(extra));
    }
    assert.equal(inserted().length, 0);
  });

  test('rejects unexpected input', async () => {
    const cases: unknown[] = [
      { ...validLead, name: '' },
      { ...validLead, name: 'x'.repeat(101) },
      { ...validLead, interest: "Marcas'; drop table leads;--" },
      { ...validLead, landing_page: 'javascript:alert(1)' },
      { ...validLead, referrer: 'https://evil.test/path?email=a@b.c' },
      { ...validLead, name: { $ne: null } },
      [validLead],
      'null',
      '{"name":',
    ];
    for (const body of cases) assert.equal((await submitLead(leadRequest(body))).status, 400, JSON.stringify(body));
    assert.equal(inserted().length, 0);
  });

  test('keeps script payloads as inert text', async () => {
    const res = await submitLead(leadRequest({ ...validLead, name: '<script>alert(1)</script>' }));
    assert.equal(res.status, 201);
    assert.equal(JSON.parse(inserted()[0].body).name, '<script>alert(1)</script>');
  });

  test('blocks cross-site and non-JSON requests, and oversized bodies', async () => {
    assert.equal((await submitLead(leadRequest(validLead, { origin: 'https://evil.test' }))).status, 403);
    assert.equal((await submitLead(new Request(`${SITE}/api/leads`, { method: 'POST', headers: { origin: SITE, 'content-type': 'text/plain' }, body: 'x' }))).status, 415);
    assert.equal((await submitLead(leadRequest({ ...validLead, company: 'x'.repeat(10_000) }))).status, 413);
  });

  test('honeypot submissions are accepted silently and never stored', async () => {
    const res = await submitLead(leadRequest({ ...validLead, website: 'https://spam.test' }));
    assert.equal(res.status, 202);
    assert.equal(inserted().length, 0);
  });

  test('rate limits excessive requests', async () => {
    rateAllowed = false;
    assert.equal((await submitLead(leadRequest(validLead))).status, 429);
    assert.equal(inserted().length, 0);
  });

  test('requires a valid Turnstile token when configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    turnstileOk = false;
    assert.equal((await submitLead(leadRequest({ ...validLead, turnstileToken: 'bad' }))).status, 403);
    turnstileOk = true;
    assert.equal((await submitLead(leadRequest({ ...validLead, turnstileToken: 'good' }))).status, 201);
  });

  test('is disabled unless lead capture is switched on', async () => {
    process.env.NEXT_PUBLIC_LEAD_CAPTURE = 'false';
    assert.equal((await submitLead(leadRequest(validLead))).status, 404);
  });
});

const webp = () => {
  const b = new Uint8Array(64);
  b.set(new TextEncoder().encode('RIFF'), 0);
  b.set(new TextEncoder().encode('WEBPVP8X'), 8);
  b.set([0x7f, 0x06, 0x00], 24); // width 1664 - 1
  b.set([0x7f, 0x03, 0x00], 27); // height 896 - 1
  return b;
};
const upload = (file: Blob, name: string, headers: Record<string, string> = {}) => {
  const form = new FormData();
  form.set('file', file, name);
  form.set('alt', 'Descrição');
  return new Request(`${SITE}/api/admin/media`, { method: 'POST', headers: { origin: SITE, authorization: 'Bearer header.payload.signature-long-enough', ...headers }, body: form });
};

describe('admin APIs: authentication and authorization', () => {
  test('reject requests without a bearer token', async () => {
    assert.equal((await uploadMedia(upload(new Blob([webp()]), 'a.webp', { authorization: '' }))).status, 401);
    assert.equal((await rebuild(new Request(`${SITE}/api/admin/rebuild`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json' }, body: '{}' }))).status, 401);
    assert.equal(calls.filter((c) => c.url.host === 'api.vercel.com').length, 0);
  });

  test('reject expired or forged tokens', async () => {
    context = 'invalid';
    assert.equal((await uploadMedia(upload(new Blob([webp()]), 'a.webp'))).status, 401);
  });

  test('reject signed-in users who are not active staff or lack MFA', async () => {
    context = { user_id: 'u2', is_staff: false, role: null, aal: 'aal1' };
    assert.equal((await uploadMedia(upload(new Blob([webp()]), 'a.webp'))).status, 403);
    assert.equal(calls.filter((c) => c.url.pathname.startsWith('/storage')).length, 0);
  });

  test('reject cross-origin calls even with a token', async () => {
    assert.equal((await uploadMedia(upload(new Blob([webp()]), 'a.webp', { origin: 'https://evil.test' }))).status, 403);
  });
});

describe('POST /api/admin/media', () => {
  test('stores a real image under a random name', async () => {
    const res = await uploadMedia(upload(new Blob([webp()]), '../../etc/passwd.webp'));
    assert.equal(res.status, 201);
    const stored = calls.find((c) => c.url.pathname.startsWith('/storage/v1/object/'))!;
    assert.match(stored.url.pathname, /^\/storage\/v1\/object\/media-private\/[0-9a-f-]{36}\.webp$/, 'uploads land in the private bucket');
    assert.equal(stored.auth, 'Bearer service-key');
    const row = JSON.parse(calls.find((c) => c.url.pathname === '/rest/v1/media' && c.method === 'POST')!.body);
    assert.equal(row.width, 1664);
    assert.equal(row.height, 896);
    assert.equal(calls.find((c) => c.url.pathname === '/rest/v1/media')!.auth, 'Bearer header.payload.signature-long-enough', 'row is written as the user (RLS + audit)');
  });

  test('rejects SVG, HTML disguised as an image, GIF and mismatched extensions', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>';
    assert.equal((await uploadMedia(upload(new Blob([svg], { type: 'image/svg+xml' }), 'a.svg'))).status, 415);
    assert.equal((await uploadMedia(upload(new Blob(['<html><script>alert(1)</script>'], { type: 'image/png' }), 'a.png'))).status, 415);
    assert.equal((await uploadMedia(upload(new Blob(['GIF89a......'], { type: 'image/gif' }), 'a.gif'))).status, 415);
    assert.equal((await uploadMedia(upload(new Blob([webp()], { type: 'image/webp' }), 'a.png'))).status, 415);
    assert.equal((await uploadMedia(upload(new Blob([webp()]), 'a.webp.html'))).status, 415);
    assert.equal(calls.filter((c) => c.url.pathname.startsWith('/storage')).length, 0);
  });

  test('rejects files over the size limit', async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(webp());
    assert.equal((await uploadMedia(upload(new Blob([big]), 'a.webp'))).status, 413);
  });

  test('rate limits uploads', async () => {
    rateAllowed = false;
    assert.equal((await uploadMedia(upload(new Blob([webp()]), 'a.webp'))).status, 429);
  });
});

describe('DELETE /api/admin/media', () => {
  const del = (id: unknown) => new Request(`${SITE}/api/admin/media`, { method: 'DELETE', headers: { origin: SITE, 'content-type': 'application/json', authorization: 'Bearer header.payload.signature-long-enough' }, body: JSON.stringify({ id }) });

  test('validates the id (no injection into filters)', async () => {
    assert.equal((await deleteMedia(del("x',featured_image_id.neq.null"))).status, 400);
  });

  test('refuses to delete an image still in use', async () => {
    usageCount = 1;
    assert.equal((await deleteMedia(del('0f8fad5b-d9cb-469f-a165-70867728950e'))).status, 409);
    assert.equal(calls.filter((c) => c.method === 'DELETE').length, 0);
  });

  test('deletes unused images from the table and storage', async () => {
    assert.equal((await deleteMedia(del('0f8fad5b-d9cb-469f-a165-70867728950e'))).status, 200);
    assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.pathname === '/storage/v1/object/media-private'));
    assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.pathname === '/storage/v1/object/media'), 'public copy removed too');
  });
});

describe('POST /api/admin/rebuild', () => {
  const req = () => new Request(`${SITE}/api/admin/rebuild`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', authorization: 'Bearer header.payload.signature-long-enough' }, body: JSON.stringify({ reason: 'publish: artigo' }) });

  test('triggers the deploy hook for staff and records it', async () => {
    assert.equal((await rebuild(req())).status, 202);
    assert.ok(calls.some((c) => c.url.host === 'api.vercel.com'));
    assert.ok(calls.some((c) => c.url.pathname === '/rest/v1/site_builds'));
  });

  const build = () => JSON.parse(calls.filter((c) => c.url.pathname === '/rest/v1/site_builds').at(-1)!.body);

  test('records an accepted request as pending with the Vercel job id', async () => {
    assert.equal((await rebuild(req())).status, 202);
    assert.deepEqual({ ...build(), finished_at: undefined }, { requested_by: 'u1', reason: 'publish: artigo', ok: true, status: 'pending', finished_at: undefined, deployment: 'job_1', detail: null });
  });

  test('records a rejected hook call as failed', async () => {
    hookOk = false;
    assert.equal((await rebuild(req())).status, 502);
    assert.equal(build().status, 'failed');
    assert.ok(build().finished_at);
    assert.equal(build().detail, 'deploy hook answered 500');
  });

  test('accepts a pasted hook URL with whitespace or Vercel query flags', async () => {
    for (const url of ['https://api.vercel.com/v1/integrations/deploy/prj_abc/hook-123\n', '  https://api.vercel.com/v1/integrations/deploy/prj_abc/hook123?buildCache=false ']) {
      process.env.VERCEL_DEPLOY_HOOK_URL = url;
      assert.equal((await rebuild(req())).status, 202, JSON.stringify(url));
    }
  });

  test('a missing hook answers 503, names the setting and records a failed build', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = '';
    const res = await rebuild(req());
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'deploy_hook_not_configured', missing: ['VERCEL_DEPLOY_HOOK_URL'] });
    assert.equal(build().status, 'failed');
  });

  test('missing server settings answer 503 with their names only', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    process.env.RATE_LIMIT_SALT = 'short';
    const res = await rebuild(req());
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'not_configured', missing: ['SUPABASE_SERVICE_ROLE_KEY', 'RATE_LIMIT_SALT'] });
  });

  test('never calls a hook URL outside api.vercel.com (SSRF guard)', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'http://169.254.169.254/latest/meta-data';
    assert.equal((await rebuild(req())).status, 503);
    assert.ok(!calls.some((c) => c.url.host === '169.254.169.254'));
  });
});

describe('GET /api/blog-fallback', () => {
  test('redirects a renamed article permanently to a relative URL', async () => {
    const res = await blogFallback(new Request(`${SITE}/api/blog-fallback?slug=nome-antigo`));
    assert.equal(res.status, 301);
    assert.equal(res.headers.get('location'), '/blog/nome-novo');
  });

  test('returns 404 without querying for malformed slugs (no open redirect)', async () => {
    for (const slug of ['//evil.test', 'https:%2F%2Fevil.test', '../admin', 'A', 'x'.repeat(121)]) {
      const res = await blogFallback(new Request(`${SITE}/api/blog-fallback?slug=${encodeURIComponent(slug)}`));
      assert.equal(res.status, 404, slug);
      assert.equal(res.headers.get('location'), null);
    }
    assert.ok(!calls.some((c) => c.url.pathname === '/rest/v1/rpc/resolve_slug_redirect'));
  });

  test('unknown slugs get the site 404 page', async () => {
    const res = await blogFallback(new Request(`${SITE}/api/blog-fallback?slug=nao-existe`));
    assert.equal(res.status, 404);
    assert.match(await res.text(), /Página não encontrada/);
  });
});

describe('helpers', () => {
  test('clean() strips control and bidi characters', () => {
    assert.equal(clean('a‮b​c\u0007d'), 'a b c d');
  });
  test('sniffImage validates real headers and dimension bombs', () => {
    assert.equal(sniffImage(webp())?.mime, 'image/webp');
    const png = new Uint8Array(32);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    png.set([0, 0, 0xff, 0xff, 0, 0, 0xff, 0xff], 16); // 65535 x 65535
    assert.equal(sniffImage(png), null);
  });
});

describe('POST /api/admin/publish', () => {
  const req = (body: unknown, headers: Record<string, string> = {}) =>
    new Request(`${SITE}/api/admin/publish`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', authorization: 'Bearer header.payload.signature-long-enough', ...headers }, body: JSON.stringify(body) });
  const copies = () => calls.filter((c) => c.url.pathname === '/storage/v1/object/copy').map((c) => JSON.parse(c.body));

  test('copies exactly the images the article uses from the private to the public bucket, then publishes as the user', async () => {
    const res = await publish(req({ id: ARTICLE, action: 'publish', expectedVersion: 3 }));
    assert.equal(res.status, 200);
    assert.deepEqual(copies().map((c) => [c.bucketId, c.sourceKey, c.destinationBucket, c.destinationKey]).sort((a, b) => a[1].localeCompare(b[1])), [
      ['media-private', `${COVER}.webp`, 'media', `${COVER}.webp`],
      ['media-private', `${INLINE}.webp`, 'media', `${INLINE}.webp`],
    ]);
    assert.ok(!copies().some((c) => c.sourceKey.includes(OTHER)), 'unrelated private media is never copied');
    const copy = calls.find((c) => c.url.pathname === '/storage/v1/object/copy')!;
    assert.equal(copy.auth, 'Bearer service-key');
    const mark = calls.find((c) => c.url.pathname === '/rest/v1/rpc/media_mark_public')!;
    assert.deepEqual(JSON.parse(mark.body).p_ids.sort(), [COVER, INLINE].sort());
    const rpc = calls.find((c) => c.url.pathname === '/rest/v1/rpc/publish_article')!;
    assert.equal(rpc.auth, 'Bearer header.payload.signature-long-enough', 'status change runs as the user');
    const order = calls.map((c) => c.url.pathname);
    assert.ok(order.indexOf('/rest/v1/rpc/media_mark_public') < order.indexOf('/rest/v1/rpc/publish_article'));
  });

  test('refuses stale versions before copying anything', async () => {
    assert.equal((await publish(req({ id: ARTICLE, action: 'publish', expectedVersion: 2 }))).status, 409);
    assert.equal(copies().length, 0);
  });

  test('removes public copies no published article references anymore', async () => {
    unreferenced = [`${OTHER}.webp`];
    assert.equal((await publish(req({ id: ARTICLE, action: 'unpublish' }))).status, 200);
    const removal = calls.find((c) => c.method === 'DELETE' && c.url.pathname === '/storage/v1/object/media')!;
    assert.deepEqual(JSON.parse(removal.body).prefixes, [`${OTHER}.webp`]);
    assert.equal(copies().length, 0, 'unpublish copies nothing');
  });

  test('maps database refusals (e.g. private media) to a clear error', async () => {
    publishError = { code: '22023', message: 'media_not_public' };
    const res = await publish(req({ id: ARTICLE, action: 'publish', expectedVersion: 3 }));
    assert.equal(res.status, 422);
    assert.equal(((await res.json()) as { error: string }).error, 'invalid_media');
  });

  test('requires staff, same origin and a valid request', async () => {
    assert.equal((await publish(req({ id: ARTICLE, action: 'publish', expectedVersion: 3 }, { authorization: '' }))).status, 401);
    context = { user_id: 'u2', is_staff: false, role: null, aal: 'aal1' };
    assert.equal((await publish(req({ id: ARTICLE, action: 'publish', expectedVersion: 3 }))).status, 403);
    context = { user_id: 'u1', is_staff: true, role: 'editor', aal: 'aal2' };
    assert.equal((await publish(req({ id: ARTICLE, action: 'publish', expectedVersion: 3 }, { origin: 'https://evil.test' }))).status, 403);
    assert.equal((await publish(req({ id: 'x', action: 'publish', expectedVersion: 3 }))).status, 400);
    assert.equal((await publish(req({ id: ARTICLE, action: 'delete' }))).status, 400);
    assert.equal(copies().length, 0);
  });
});

describe('POST /api/admin/staff (team access with temporary passwords)', () => {
  const req = (body: unknown, headers: Record<string, string> = {}) =>
    new Request(`${SITE}/api/admin/staff`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', authorization: 'Bearer header.payload.signature-long-enough', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const create = { action: 'create', email: ' Nova.Pessoa@Velmont.test ', name: '  Nova\u0000  Pessoa ', role: 'editor' };
  const auth = () => calls.filter((c) => c.url.pathname.startsWith('/auth/v1/admin'));
  const step = (c: Call) => `${c.method} ${c.url.pathname.replace(/[0-9a-f-]{36}/g, ':id')}${c.url.pathname.startsWith('/rest') ? '' : ` ${c.body}`}`;
  const asOwner = () => {
    context = { user_id: OWNER, is_staff: true, role: 'owner', aal: 'aal2' };
  };
  const pattern = /^[A-HJ-NP-Za-km-z2-9]{5}(-[A-HJ-NP-Za-km-z2-9]{5}){3}$/;

  test('temporary passwords are long, random, readable and have every character class', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const value = temporaryPassword();
      assert.match(value, pattern);
      assert.match(value, /[A-Z]/);
      assert.match(value, /[a-z]/);
      assert.match(value, /[0-9]/);
      seen.add(value);
    }
    assert.equal(seen.size, 2000);
  });

  test('editors (and anyone who is not an MFA-verified owner) are refused before anything is touched', async () => {
    assert.equal((await staffAccess(req(create))).status, 403);
    context = { user_id: 'u2', is_staff: false, role: null, aal: 'aal1' };
    assert.equal((await staffAccess(req(create))).status, 403);
    assert.equal((await staffAccess(req(create, { authorization: '' }))).status, 401);
    asOwner();
    assert.equal((await staffAccess(req(create, { origin: 'https://evil.test' }))).status, 403);
    assert.equal(auth().length, 0);
    assert.equal(calls.filter((c) => c.url.pathname.includes('staff_')).length, 0);
  });

  test('creates access for a new person: locked and banned first, then the password is set and the ban lifted', async () => {
    asOwner();
    const logs: string[] = [];
    const [log, error] = [console.log, console.error];
    console.log = console.error = (...args: unknown[]) => void logs.push(args.join(' '));
    let response: Response;
    try {
      response = await staffAccess(req(create));
    } finally {
      [console.log, console.error] = [log, error];
    }
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = (await response.json()) as { user_id: string; password: string; expires_at: string };
    assert.equal(body.user_id, PERSON);
    assert.match(body.password, pattern);
    assert.equal(body.expires_at, '2026-09-27T18:00:00+00:00');

    const issued = JSON.parse(calls.find((c) => c.url.pathname === '/rest/v1/rpc/staff_issue_temporary_password')!.body);
    assert.deepEqual(issued, { p_actor: OWNER, p_user_id: PERSON, p_hours: 48, p_email: 'nova.pessoa@velmont.test', p_display_name: 'Nova Pessoa', p_role: 'editor' });
    const flow = calls.filter((c) => c.url.pathname.startsWith('/auth') || c.url.pathname.includes('staff_')).map(step);
    assert.deepEqual(flow, [
      'POST /rest/v1/rpc/staff_find_user',
      `POST /auth/v1/admin/users ${JSON.stringify({ email: 'nova.pessoa@velmont.test', email_confirm: true, ban_duration: '1h' })}`,
      'POST /rest/v1/rpc/staff_issue_temporary_password',
      'GET /auth/v1/admin/users/:id/factors ',
      'DELETE /auth/v1/admin/users/:id/factors/:id ',
      `PUT /auth/v1/admin/users/:id ${JSON.stringify({ password: body.password, email_confirm: true, ban_duration: 'none' })}`,
    ]);
    // The password goes to Supabase Auth only, and is never logged.
    assert.equal(calls.filter((c) => c.body.includes(body.password)).length, 1);
    assert.ok(!logs.join('\n').includes(body.password));
  });

  test('reuses an Auth user that already exists (for example an old e-mail invitation), banning it first', async () => {
    asOwner();
    foundUser = { user_id: PERSON, is_member: false };
    const response = await staffAccess(req(create));
    assert.equal(response.status, 201);
    const flow = auth().map((c) => `${c.method} ${c.body}`);
    assert.equal(flow[0], `PUT ${JSON.stringify({ ban_duration: '1h' })}`);
    assert.equal(calls.filter((c) => c.url.pathname === '/auth/v1/admin/users' && c.method === 'POST').length, 0);
  });

  test('refuses people who are already on the team', async () => {
    asOwner();
    foundUser = { user_id: PERSON, is_member: true };
    const response = await staffAccess(req(create));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'already_member' });
    assert.equal(auth().length, 0);
  });

  test('a new temporary password for a member: checked first, then banned, locked, authenticator removed, password set', async () => {
    asOwner();
    members = [{ user_id: PERSON }];
    const response = await staffAccess(req({ action: 'reset', user_id: PERSON }));
    assert.equal(response.status, 200);
    const body = (await response.json()) as { password: string };
    assert.match(body.password, pattern);
    const issued = JSON.parse(calls.find((c) => c.url.pathname === '/rest/v1/rpc/staff_issue_temporary_password')!.body);
    assert.deepEqual(issued, { p_actor: OWNER, p_user_id: PERSON, p_hours: 48 });
    const flow = calls.filter((c) => c.url.pathname.startsWith('/auth') || c.url.pathname.includes('staff_') || c.url.pathname === '/rest/v1/admin_users').map((c) => `${c.method} ${c.url.pathname.replace(/[0-9a-f-]{36}/g, ':id')}`);
    assert.deepEqual(flow, [
      'GET /rest/v1/admin_users',
      'PUT /auth/v1/admin/users/:id',
      'POST /rest/v1/rpc/staff_issue_temporary_password',
      'GET /auth/v1/admin/users/:id/factors',
      'DELETE /auth/v1/admin/users/:id/factors/:id',
      'PUT /auth/v1/admin/users/:id',
    ]);
  });

  test('never for yourself or for someone who is not on the team (Auth untouched)', async () => {
    asOwner();
    assert.equal((await staffAccess(req({ action: 'reset', user_id: OWNER }))).status, 400);
    members = [];
    assert.equal((await staffAccess(req({ action: 'reset', user_id: PERSON }))).status, 404);
    assert.equal(auth().length, 0);
  });

  test('validates input strictly', async () => {
    asOwner();
    for (const body of [
      { ...create, email: 'sem-arroba' },
      { ...create, email: 'a@b' },
      { ...create, name: '   ' },
      { ...create, name: 'x'.repeat(121) },
      { ...create, role: 'admin' },
      { ...create, active: true },
      { action: 'reset', user_id: 'x' },
      { action: 'reset', user_id: PERSON, role: 'owner' },
      { action: 'delete', user_id: PERSON },
      [],
    ])
      assert.equal((await staffAccess(req(body))).status, 400, JSON.stringify(body));
    assert.equal((await staffAccess(req('{', { 'content-type': 'text/plain' }))).status, 415);
    assert.equal(auth().length, 0);
  });

  test('rate limited per owner and globally', async () => {
    asOwner();
    rateAllowed = false;
    assert.equal((await staffAccess(req(create))).status, 429);
    assert.equal(auth().length, 0);
  });

  test('if Supabase Auth refuses the password, the account stays locked and no password is returned', async () => {
    asOwner();
    authRefuses = 'password';
    const response = await staffAccess(req(create));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'auth_update_failed' });
    assert.equal(calls.filter((c) => c.url.pathname === '/rest/v1/rpc/staff_temporary_password_failed').length, 1);
    authRefuses = 'create';
    assert.equal((await staffAccess(req(create))).status, 502);
  });

  test('a duplicate caught by the database is reported as such', async () => {
    asOwner();
    assert.equal((await staffAccess(req({ ...create, email: 'duplicada@velmont.test' }))).status, 409);
  });
});
