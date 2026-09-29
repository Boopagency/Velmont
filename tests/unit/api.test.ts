import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, test } from 'node:test';
import { POST as submitLead } from '../../api/leads';
import { DELETE as deleteMedia, POST as uploadMedia } from '../../api/admin/media';
import { POST as rebuild } from '../../api/admin/rebuild';
import { POST as publish } from '../../api/admin/publish';
import { POST as staffAccess } from '../../api/admin/staff';
import { GET as blogFallback } from '../../api/blog-fallback';
import { POST as firstAccess } from '../../api/admin/first-access';
import { rateLimitSubject } from '../../server/http';
import { hasMetadata, sniffImage } from '../../server/image';
import { clean } from '../../server/leads';
import { matchesDigest, passwordDigest, temporaryPassword } from '../../server/staff';

// The Supabase client talks HTTP; these tests stand in for PostgREST,
// Storage, Turnstile and the deploy hook by intercepting fetch.

const SITE = 'https://www.velmont.test';
const SUPABASE = 'https://project.supabase.co';
type Call = { method: string; url: URL; body: string; auth: string | null };
let calls: Call[] = [];
let context: Record<string, unknown> | 'invalid' = { user_id: 'u1', is_staff: true, role: 'editor', aal: 'aal2' };
let rateAllowed = true;
let turnstileOk = true;
/** How the deploy hook behaves: answers, refuses, or leaves the request without an answer. */
let hookMode: 'accepted' | 'refused' | 'forbidden' | 'redirect' | 'timeout' | 'wait' | 'reset' | 'dns' = 'accepted';
let hookCalledAt = 0;
/** The latest site_builds row, as read by /api/admin/rebuild before asking for a build. */
let latestRow: { requested_at: string; status: string; detail: string | null } | null = null;
let usageCount = 0;
let publishError: { code: string; message: string } | null = null;
let unreferenced: string[] = [];
let foundUser: { user_id: string; is_member: boolean } | null = null;
let members: { user_id: string; active: boolean }[] = [];
let authRefuses: 'create' | 'password' | 'weak' | null = null;
let publishCheck: { code: string; message: string } | null = null;
let deleteRefusal: { code: string; message: string } | null = null;
let firstState: Record<string, unknown> = {};
let firstSecret: { issue_id: string; digest: string } | null = null;
let completeError: { code: string; message: string } | null = null;
let beginError: { code: string; message: string } | null = null;
const TEMPORARY = 'Abcde-fghij-kmn23-45678';
let TEMPORARY_DIGEST = '';
const COVER = '0f8fad5b-d9cb-469f-a165-70867728950e';
const INLINE = '1f8fad5b-d9cb-469f-a165-70867728950e';
const OTHER = '2f8fad5b-d9cb-469f-a165-70867728950e';
const ARTICLE = '3f8fad5b-d9cb-469f-a165-70867728950e';
const OWNER = '4f8fad5b-d9cb-469f-a165-70867728950e';
const PERSON = '5f8fad5b-d9cb-469f-a165-70867728950e';
const FACTOR = '6f8fad5b-d9cb-469f-a165-70867728950e';
const SESSION = '7f8fad5b-d9cb-469f-a165-70867728950e';
const ISSUE = '8f8fad5b-d9cb-469f-a165-70867728950e';
const realFetch = globalThis.fetch;

before(async () => {
  TEMPORARY_DIGEST = await passwordDigest(TEMPORARY);
});

/** Runs fn and returns what it wrote to the console (structured logs). */
async function captureLogs<T>(fn: () => Promise<T>) {
  const lines: string[] = [];
  const saved = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = (...args: unknown[]) => void lines.push(args.map(String).join(' '));
  try {
    return { result: await fn(), logs: lines.join('\n') };
  } finally {
    [console.log, console.warn, console.error] = saved;
  }
}

function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

beforeEach(() => {
  calls = [];
  context = { user_id: 'u1', is_staff: true, role: 'editor', aal: 'aal2' };
  rateAllowed = true;
  turnstileOk = true;
  hookMode = 'accepted';
  hookCalledAt = 0;
  latestRow = null;
  usageCount = 0;
  publishError = null;
  unreferenced = [];
  foundUser = null;
  members = [];
  authRefuses = null;
  publishCheck = null;
  deleteRefusal = null;
  firstState = { user_id: PERSON, session_id: SESSION, aal2: true, member: true, pending: true, expired: false, mfa_verified: true };
  firstSecret = { issue_id: ISSUE, digest: TEMPORARY_DIGEST };
  completeError = null;
  beginError = null;
  Object.assign(process.env, {
    NEXT_PUBLIC_SITE_URL: SITE,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    RATE_LIMIT_SALT: 'a-long-random-test-salt',
    NEXT_PUBLIC_LEAD_CAPTURE: 'true',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    VERCEL_DEPLOY_HOOK_URL: 'https://api.vercel.com/v1/integrations/deploy/prj_abc/hook123',
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const body = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text().catch(() => '');
    calls.push({ method: request.method, url, body, auth: request.headers.get('authorization') });
    const path = url.pathname;
    if (url.host === 'challenges.cloudflare.com') return reply(200, { success: turnstileOk });
    if (url.host === 'api.vercel.com') {
      hookCalledAt = Date.now();
      const failure = (code: string) => new TypeError('fetch failed', { cause: Object.assign(new Error(code), { code }) });
      if (hookMode === 'refused') return reply(500, {});
      if (hookMode === 'forbidden') return reply(404, { error: { code: 'not_found' } });
      if (hookMode === 'redirect') return reply(308, {}, { location: 'https://example.test/elsewhere' });
      // The request reached Vercel, but its answer never came back in time.
      if (hookMode === 'timeout') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      if (hookMode === 'wait')
        return new Promise<Response>((_, reject) => {
          // AbortSignal.timeout does not keep Node alive by itself; a serving Function is kept alive by its request.
          const alive = setTimeout(() => undefined, 15_000);
          request.signal.addEventListener('abort', () => {
            clearTimeout(alive);
            reject(request.signal.reason);
          });
        });
      if (hookMode === 'reset') throw failure('UND_ERR_SOCKET');
      if (hookMode === 'dns') throw failure('ENOTFOUND');
      return reply(201, { job: { id: 'job_1', state: 'PENDING' } });
    }
    if (path === '/rest/v1/rpc/admin_context') return context === 'invalid' ? reply(401, { message: 'JWT expired' }) : reply(200, context);
    if (path === '/rest/v1/rpc/hit_rate_limit') return reply(200, rateAllowed);
    if (path === '/rest/v1/rpc/staff_find_user') return reply(200, foundUser);
    if (path === '/rest/v1/rpc/staff_issue_temporary_access') return JSON.parse(body).p_email === 'duplicada@velmont.test' ? reply(409, { code: '23505', message: 'duplicate key' }) : reply(200, { expires_at: '2026-09-27T18:00:00+00:00', issue_id: ISSUE });
    if (path === '/rest/v1/rpc/staff_temporary_password_failed') return reply(200, null);
    if (path === '/rest/v1/rpc/staff_log_event') return reply(200, null);
    if (path === '/rest/v1/rpc/first_access_state') return reply(200, firstState);
    if (path === '/rest/v1/rpc/staff_first_access_secret') return reply(200, firstSecret);
    if (path === '/rest/v1/rpc/staff_begin_first_access') return beginError ? reply(400, beginError) : reply(200, null);
    if (path === '/rest/v1/rpc/staff_complete_first_access') return completeError ? reply(400, completeError) : reply(200, null);
    if (path === '/rest/v1/rpc/can_publish_article') return publishCheck ? reply(400, publishCheck) : reply(200, null);
    if (path === '/rest/v1/rpc/media_rollback_public') return reply(200, (JSON.parse(body).p_ids as string[]).map((id) => `${id}.webp`));
    if (path === '/rest/v1/rpc/delete_media') return deleteRefusal ? reply(409, deleteRefusal) : reply(200, { path: `${JSON.parse(body).p_id}.webp` });
    if (path === '/rest/v1/admin_users' && request.method === 'GET') return reply(200, members);
    if (path === '/auth/v1/admin/users' && request.method === 'POST') return authRefuses === 'create' ? reply(422, { code: 422, msg: 'refused' }) : reply(200, { id: PERSON, email: JSON.parse(body).email, aud: 'authenticated' });
    if (/^\/auth\/v1\/admin\/users\/[0-9a-f-]{36}\/factors$/.test(path)) return reply(200, [{ id: FACTOR, factor_type: 'totp', status: 'verified' }]);
    if (/^\/auth\/v1\/admin\/users\/[0-9a-f-]{36}\/factors\/[0-9a-f-]{36}$/.test(path) && request.method === 'DELETE') return reply(200, {});
    if (/^\/auth\/v1\/admin\/users\/[0-9a-f-]{36}$/.test(path) && request.method === 'PUT') {
      if (authRefuses === 'weak' && JSON.parse(body).password) return reply(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 12 characters.' }, { 'x-supabase-api-version': '2024-01-01' });
      return authRefuses === 'password' && JSON.parse(body).password ? reply(500, { code: 500, msg: 'refused' }) : reply(200, { id: path.split('/').pop(), aud: 'authenticated' });
    }
    if (path === '/rest/v1/rpc/resolve_slug_redirect') return reply(200, JSON.parse(body).p_slug === 'nome-antigo' ? 'nome-novo' : null);
    if (path === '/rest/v1/leads' && request.method === 'POST') return reply(201, null);
    if (path === '/rest/v1/site_builds' && request.method === 'GET') return reply(200, latestRow ? [latestRow] : []);
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
const validLead = { name: '  Maria\u0000  da   Silva ', company: 'Empresa', interest: 'Marcas', website: '', landing_page: '/blog/x', referrer: 'https://www.google.com', utm_source: 'google', turnstileToken: 'token-from-the-widget' };
const rateKeys = () => calls.filter((c) => c.url.pathname === '/rest/v1/rpc/hit_rate_limit').map((c) => JSON.parse(c.body).p_key as string);
const cloudflare = () => calls.filter((c) => c.url.host === 'challenges.cloudflare.com');
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

  test('requires a valid Turnstile token, checked by the server with the secret', async () => {
    const { turnstileToken: _omit, ...withoutToken } = validLead;
    const missing = await submitLead(leadRequest(withoutToken));
    assert.equal(missing.status, 403);
    assert.deepEqual(await missing.json(), { error: 'verification_required' });
    assert.equal(cloudflare().length, 0, 'no token: refused before calling Cloudflare');
    turnstileOk = false;
    assert.equal((await submitLead(leadRequest({ ...validLead, turnstileToken: 'forged' }))).status, 403);
    const verify = new URLSearchParams(cloudflare()[0].body);
    assert.equal(verify.get('secret'), 'turnstile-secret');
    assert.equal(verify.get('response'), 'forged');
    turnstileOk = true;
    assert.equal((await submitLead(leadRequest(validLead))).status, 201);
    assert.equal(inserted().length, 1);
  });

  test('fails closed when lead capture is on but Turnstile is not configured (the Origin header is no bot protection)', async () => {
    process.env.TURNSTILE_SECRET_KEY = '';
    const { result, logs } = await captureLogs(() => submitLead(leadRequest(validLead)));
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { error: 'not_configured' }, 'the caller never learns which setting is missing');
    assert.match(logs, /"event":"not_configured".*TURNSTILE_SECRET_KEY/, 'the Runtime Logs name it');
    assert.equal(inserted().length, 0);
  });

  test('only verified submissions reach the global budget; unverified ones cannot use it up', async () => {
    const { turnstileToken: _omit, ...withoutToken } = validLead;
    await submitLead(leadRequest(withoutToken));
    assert.deepEqual(rateKeys(), [], 'no token: no database work at all');
    turnstileOk = false;
    await submitLead(leadRequest(validLead));
    assert.equal(rateKeys().length, 1);
    assert.match(rateKeys()[0], /^lead:ip:[0-9a-f]{40}$/);
    turnstileOk = true;
    calls = [];
    await submitLead(leadRequest(validLead));
    assert.deepEqual(rateKeys().map((k) => k.replace(/[0-9a-f]{40}$/, '…')), ['lead:ip:…', 'lead:global']);
  });

  test('IPv6 addresses of one /64 share a counter; another /64 does not', async () => {
    const keyFor = async (ip: string) => {
      calls = [];
      await submitLead(leadRequest(validLead, { 'x-real-ip': ip }));
      return rateKeys()[0];
    };
    const a = await keyFor('2001:db8:abcd:12::1');
    assert.equal(await keyFor('2001:0db8:abcd:0012:ffff:ffff:ffff:ffff'), a);
    assert.equal(await keyFor('2001:db8:abcd:12:1:2:3:4'), a);
    assert.notEqual(await keyFor('2001:db8:abcd:13::1'), a);
    assert.notEqual(await keyFor('203.0.113.9'), await keyFor('203.0.113.10'));
    assert.equal(await keyFor('::ffff:203.0.113.9'), await keyFor('203.0.113.9'));
  });

  test('refusals leave one structured log line with no personal data', async () => {
    rateAllowed = false;
    const { result, logs } = await captureLogs(() => submitLead(leadRequest({ ...validLead, name: 'Fulana Sigilosa', company: 'Empresa Secreta' })));
    assert.equal(result.status, 429);
    const line = JSON.parse(logs.split('\n').find((l) => l.includes('api_refused'))!);
    assert.deepEqual(line, { level: 'warn', event: 'api_refused', route: '/api/leads', method: 'POST', status: 429, error: 'too_many_requests' });
    rateAllowed = true;
    const invalid = await captureLogs(() => submitLead(leadRequest({ ...validLead, name: 'Fulana Sigilosa', interest: 'x' })));
    assert.equal(invalid.result.status, 400);
    assert.match(invalid.logs, /"event":"lead_invalid","fields":\["interest"\]/);
    for (const text of [logs, invalid.logs]) {
      assert.ok(!/Fulana|Sigilosa|Empresa|203\.0\.113|token-from-the-widget|turnstile-secret/.test(text), text);
    }
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

  test('strips EXIF and GPS from a JPEG sent straight to the API (not only in the browser)', async () => {
    const { default: sharp } = (await import('sharp')) as unknown as { default: (options: object) => { jpeg(): { withExif(exif: object): { toBuffer(): Promise<Buffer> } } } };
    const original = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 20, b: 20 } } })
      .jpeg()
      .withExif({ IFD0: { Make: 'GPS-TEST-CAM' }, IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '25/1 25/1 0/1' } })
      .toBuffer();
    const bytes = new Uint8Array(original);
    assert.ok(hasMetadata(bytes, sniffImage(bytes)!), 'the test image carries EXIF');
    assert.equal((await uploadMedia(upload(new Blob([bytes], { type: 'image/jpeg' }), 'foto.jpg'))).status, 201);
    const stored = calls.find((c) => /^\/storage\/v1\/object\/media-private\/.+\.jpg$/.test(c.url.pathname))!;
    assert.ok(stored, 'stored in the private bucket');
    assert.ok(!stored.body.includes('Exif') && !stored.body.includes('GPS-TEST-CAM'), 'no EXIF/GPS left');
    const row = JSON.parse(calls.find((c) => c.url.pathname === '/rest/v1/media' && c.method === 'POST')!.body);
    assert.deepEqual([row.mime_type, row.width, row.height], ['image/jpeg', 64, 48]);
  });

  test('keeps clean images byte for byte (no needless re-encoding)', async () => {
    assert.equal((await uploadMedia(upload(new Blob([webp()]), 'a.webp'))).status, 201);
    const stored = calls.find((c) => c.url.pathname.startsWith('/storage/v1/object/media-private/'))!;
    assert.equal(stored.body.length, new TextDecoder().decode(webp()).length);
  });
});

describe('DELETE /api/admin/media', () => {
  const del = (id: unknown) => new Request(`${SITE}/api/admin/media`, { method: 'DELETE', headers: { origin: SITE, 'content-type': 'application/json', authorization: 'Bearer header.payload.signature-long-enough' }, body: JSON.stringify({ id }) });

  test('validates the id (no injection into filters)', async () => {
    assert.equal((await deleteMedia(del("x',featured_image_id.neq.null"))).status, 400);
  });

  test('refuses to delete an image still in use (checked by the database, not only here)', async () => {
    deleteRefusal = { code: '23503', message: 'media_in_use' };
    assert.equal((await deleteMedia(del('0f8fad5b-d9cb-469f-a165-70867728950e'))).status, 409);
    assert.equal(calls.filter((c) => c.method === 'DELETE').length, 0);
  });

  test('deletes through the database function as the user, then removes both stored copies', async () => {
    assert.equal((await deleteMedia(del('0f8fad5b-d9cb-469f-a165-70867728950e'))).status, 200);
    const rpc = calls.find((c) => c.url.pathname === '/rest/v1/rpc/delete_media')!;
    assert.equal(rpc.auth, 'Bearer header.payload.signature-long-enough', 'runs as the user (RLS + audit)');
    assert.ok(!calls.some((c) => c.url.pathname === '/rest/v1/media' && c.method === 'DELETE'), 'never a direct table delete');
    assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.pathname === '/storage/v1/object/media-private'));
    assert.ok(calls.some((c) => c.method === 'DELETE' && c.url.pathname === '/storage/v1/object/media'), 'public copy removed too');
  });
});

describe('POST /api/admin/rebuild', () => {
  const req = (reason = 'publish: artigo') =>
    new Request(`${SITE}/api/admin/rebuild`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', authorization: 'Bearer header.payload.signature-long-enough' }, body: JSON.stringify({ reason }) });
  const hookCalls = () => calls.filter((c) => c.url.host === 'api.vercel.com');
  const inserts = () => calls.filter((c) => c.url.pathname === '/rest/v1/site_builds' && c.method === 'POST');

  test('triggers the deploy hook for staff and records it', async () => {
    assert.equal((await rebuild(req())).status, 202);
    assert.equal(hookCalls().length, 1);
    assert.equal(inserts().length, 1);
  });

  const build = () => JSON.parse(inserts().at(-1)!.body);

  test('Vercel answers 2xx quickly: pending with the job id, requested before the hook was called', async () => {
    const before = Date.now();
    const res = await rebuild(req());
    assert.equal(res.status, 202);
    assert.deepEqual(await res.json(), { ok: true });
    const row = build();
    assert.deepEqual({ ...row, requested_at: undefined, finished_at: undefined }, { requested_at: undefined, requested_by: 'u1', reason: 'publish: artigo', ok: true, status: 'pending', finished_at: undefined, deployment: 'job_1', detail: null });
    const requestedAt = Date.parse(row.requested_at);
    assert.ok(requestedAt >= before - 5 && requestedAt <= hookCalledAt, 'taken before asking Vercel, so the build it starts always counts it (finish_site_builds)');
    assert.equal(row.finished_at, null);
  });

  test('Vercel answers 4xx or 5xx: the request is recorded as failed', async () => {
    for (const [mode, status] of [['refused', 500], ['forbidden', 404]] as const) {
      calls = [];
      hookMode = mode;
      const { result, logs } = await captureLogs(() => rebuild(req()));
      assert.equal(result.status, 502, mode);
      assert.deepEqual(await result.json(), { error: 'deploy_hook_failed' });
      assert.equal(build().status, 'failed');
      assert.equal(build().ok, false);
      assert.ok(build().finished_at);
      assert.equal(build().detail, `deploy hook answered ${status}`);
      assert.match(logs, new RegExp(`"event":"deploy_hook_refused","status":${status}`));
    }
  });

  test('no answer within the timeout after the POST: pending and unconfirmed, never failed', async () => {
    hookMode = 'wait';
    const started = Date.now();
    const { result, logs } = await captureLogs(() => rebuild(req()));
    const took = Date.now() - started;
    assert.equal(result.status, 202);
    assert.deepEqual(await result.json(), { ok: true, confirmed: false });
    assert.equal(hookCalls().length, 1, 'the request was sent once');
    const row = build();
    assert.equal(row.status, 'pending', 'the production build it may have started settles it');
    assert.equal(row.ok, true);
    assert.equal(row.finished_at, null);
    assert.equal(row.detail, 'deploy hook unconfirmed');
    assert.ok(took >= 5900 && took < 8000, `answers within the Function limit (10 s): ${took} ms`);
    assert.match(logs, /"event":"deploy_hook_unconfirmed","error":"TimeoutError"/);
    assert.ok(!logs.includes('hook123') && !logs.includes('prj_abc'), 'never the hook URL (a secret)');
  });

  test('a dropped connection or a redirect after the POST is unconfirmed too; redirects are not followed', async () => {
    for (const mode of ['timeout', 'reset', 'redirect'] as const) {
      calls = [];
      hookMode = mode;
      const res = await rebuild(req());
      assert.equal(res.status, 202, mode);
      assert.equal(build().status, 'pending', mode);
      assert.equal(build().detail, 'deploy hook unconfirmed', mode);
      assert.equal(hookCalls().length, 1, `${mode}: one request, nothing followed`);
    }
  });

  test('a request that never left (DNS, connection refused) is failed: Vercel was not contacted', async () => {
    hookMode = 'dns';
    const { result, logs } = await captureLogs(() => rebuild(req()));
    assert.equal(result.status, 502);
    assert.equal(build().status, 'failed');
    assert.equal(build().detail, 'deploy hook unreachable');
    assert.match(logs, /"event":"deploy_hook_unreachable","error":"TypeError","code":"ENOTFOUND"/);
  });

  test('a retry does not ask for another build once the latest one was confirmed', async () => {
    latestRow = { requested_at: new Date(Date.now() - 60_000).toISOString(), status: 'success', detail: null };
    const res = await rebuild(req('retry: dashboard'));
    assert.equal(res.status, 202);
    assert.deepEqual(await res.json(), { ok: true, skipped: 'updated' });
    assert.equal(hookCalls().length, 0, 'no duplicate build');
    assert.equal(inserts().length, 0);
    // An explicit "update now" still asks for one.
    assert.equal((await rebuild(req('manual: dashboard'))).status, 202);
    assert.equal(hookCalls().length, 1);
  });

  test('no second build while the latest request is still on its way; a stalled or failed one can be retried', async () => {
    latestRow = { requested_at: new Date(Date.now() - 60_000).toISOString(), status: 'pending', detail: null };
    for (const reason of ['manual: dashboard', 'retry: editor']) {
      const res = await rebuild(req(reason));
      assert.deepEqual(await res.json(), { ok: true, skipped: 'in_progress' }, reason);
    }
    latestRow = { requested_at: new Date(Date.now() - 60_000).toISOString(), status: 'pending', detail: 'deploy hook unconfirmed' };
    assert.deepEqual(await (await rebuild(req('retry: dashboard'))).json(), { ok: true, skipped: 'in_progress' });
    assert.equal(hookCalls().length, 0);
    for (const row of [
      { requested_at: new Date(Date.now() - 6 * 60_000).toISOString(), status: 'pending', detail: 'deploy hook unconfirmed' },
      { requested_at: new Date(Date.now() - 16 * 60_000).toISOString(), status: 'pending', detail: null },
      { requested_at: new Date(Date.now() - 60_000).toISOString(), status: 'failed', detail: 'build failed: x' },
    ]) {
      calls = [];
      latestRow = row;
      assert.deepEqual(await (await rebuild(req('retry: dashboard'))).json(), { ok: true }, JSON.stringify(row));
      assert.equal(hookCalls().length, 1);
    }
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

  test('anonymous callers never learn which settings are missing (V-04)', async () => {
    process.env.RATE_LIMIT_SALT = 'short';
    const anonymous = new Request(`${SITE}/api/admin/rebuild`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const { result, logs } = await captureLogs(() => rebuild(anonymous));
    assert.ok([401, 403, 503].includes(result.status));
    assert.ok(!JSON.stringify(await result.json()).includes('RATE_LIMIT_SALT'));
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
    const unconfigured = await captureLogs(() => rebuild(new Request(`${SITE}/api/admin/rebuild`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json' }, body: '{}' })));
    assert.equal(unconfigured.result.status, 503);
    assert.deepEqual(await unconfigured.result.json(), { error: 'not_configured' });
    assert.match(unconfigured.logs, /NEXT_PUBLIC_SUPABASE_ANON_KEY/, 'the name goes to the Runtime Logs');
    assert.ok(!logs.includes('a-long-random-test-salt') && !unconfigured.logs.includes('service-key'), 'never a value');
  });

  test('missing server settings answer 503 with their names only to MFA-verified staff', async () => {
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
    assert.ok(order.indexOf('/rest/v1/rpc/can_publish_article') < order.indexOf('/storage/v1/object/copy'), 'checked before any copy');
    assert.ok(order.indexOf('/rest/v1/rpc/media_mark_public') < order.indexOf('/rest/v1/rpc/publish_article'));
    assert.ok(!order.includes('/rest/v1/rpc/media_rollback_public'));
  });

  test('publishing: an answer that does not arrive in time still reports the site as updating, never as failed', async () => {
    const lastBuild = () => JSON.parse(calls.filter((c) => c.url.pathname === '/rest/v1/site_builds' && c.method === 'POST').at(-1)!.body);
    for (const action of ['publish', 'archive'] as const) {
      calls = [];
      hookMode = 'timeout';
      const res = await publish(req({ id: ARTICLE, action, expectedVersion: 3 }));
      assert.equal(res.status, 200, action);
      assert.deepEqual(await res.json(), { ok: true, site: 'updating' }, action);
      assert.equal(lastBuild().status, 'pending');
      assert.equal(lastBuild().detail, 'deploy hook unconfirmed');
    }
    calls = [];
    hookMode = 'refused';
    const refused = await publish(req({ id: ARTICLE, action: 'publish', expectedVersion: 3 }));
    assert.deepEqual(await refused.json(), { ok: true, site: 'not_updated' }, 'an explicit refusal is still reported');
    assert.equal(lastBuild().status, 'failed');
  });

  test('an article the database would refuse is refused before any image is copied (V-03)', async () => {
    for (const [code, message, status, error] of [
      ['22023', 'incomplete', 422, 'invalid_article'],
      ['22023', 'archived', 422, 'invalid_article'],
      ['22023', 'media_missing', 422, 'invalid_media'],
      ['PT409', 'version_conflict', 409, 'version_conflict'],
    ] as const) {
      calls = [];
      publishCheck = { code, message };
      const res = await publish(req({ id: ARTICLE, action: 'publish', expectedVersion: 3 }));
      assert.equal(res.status, status, message);
      assert.equal(((await res.json()) as { error: string }).error, error);
      assert.equal(copies().length, 0, `${message}: nothing copied`);
      assert.ok(!calls.some((c) => c.url.pathname === '/rest/v1/rpc/publish_article'));
    }
  });

  test('if publishing is refused after the copies, the copies made by this attempt are removed at once', async () => {
    publishError = { code: 'PT409', message: 'version_conflict' };
    const res = await publish(req({ id: ARTICLE, action: 'publish', expectedVersion: 3 }));
    assert.equal(res.status, 409);
    const rollback = calls.find((c) => c.url.pathname === '/rest/v1/rpc/media_rollback_public')!;
    assert.deepEqual(JSON.parse(rollback.body).p_ids.sort(), [COVER, INLINE].sort());
    const removal = calls.find((c) => c.method === 'DELETE' && c.url.pathname === '/storage/v1/object/media')!;
    assert.deepEqual(JSON.parse(removal.body).prefixes.sort(), [`${COVER}.webp`, `${INLINE}.webp`].sort());
    assert.ok(!calls.some((c) => c.url.host === 'api.vercel.com'), 'no rebuild for a refused publish');
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
    assert.ok(calls.some((c) => c.url.pathname === '/rest/v1/rpc/media_rollback_public'));
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
    assert.deepEqual(calls.filter((c) => c.url.pathname.includes('staff_')).map((c) => c.url.pathname), ['/rest/v1/rpc/staff_log_event'], 'only the refusal is recorded');
    const denied = JSON.parse(calls.find((c) => c.url.pathname === '/rest/v1/rpc/staff_log_event')!.body);
    assert.deepEqual(denied, { p_actor: 'u1', p_action: 'staff.access_denied', p_resource_id: 'u1', p_metadata: {} });
  });

  test('a refused editor is rate limited per person before anything is recorded', async () => {
    rateAllowed = false;
    assert.equal((await staffAccess(req(create))).status, 429);
    assert.ok(!calls.some((c) => c.url.pathname === '/rest/v1/rpc/staff_log_event'), 'nothing written once the limit is reached');
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

    const { p_digest, ...issued } = JSON.parse(calls.find((c) => c.url.pathname === '/rest/v1/rpc/staff_issue_temporary_access')!.body);
    assert.deepEqual(issued, { p_actor: OWNER, p_user_id: PERSON, p_hours: 48, p_email: 'nova.pessoa@velmont.test', p_display_name: 'Nova Pessoa', p_role: 'editor' });
    assert.match(p_digest, /^scrypt\$/, 'only a salted digest reaches the database');
    assert.ok(await matchesDigest(body.password, p_digest));
    const flow = calls.filter((c) => c.url.pathname.startsWith('/auth') || c.url.pathname.includes('staff_')).map(step);
    assert.deepEqual(flow, [
      'POST /rest/v1/rpc/staff_find_user',
      `POST /auth/v1/admin/users ${JSON.stringify({ email: 'nova.pessoa@velmont.test', email_confirm: true, ban_duration: '1h' })}`,
      'POST /rest/v1/rpc/staff_issue_temporary_access',
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
    members = [{ user_id: PERSON, active: true }];
    const response = await staffAccess(req({ action: 'reset', user_id: PERSON }));
    assert.equal(response.status, 200);
    const body = (await response.json()) as { password: string };
    assert.match(body.password, pattern);
    const { p_digest, ...issued } = JSON.parse(calls.find((c) => c.url.pathname === '/rest/v1/rpc/staff_issue_temporary_access')!.body);
    assert.deepEqual(issued, { p_actor: OWNER, p_user_id: PERSON, p_hours: 48 });
    assert.ok(await matchesDigest(body.password, p_digest));
    const flow = calls.filter((c) => c.url.pathname.startsWith('/auth') || c.url.pathname.includes('staff_') || c.url.pathname === '/rest/v1/admin_users').map((c) => `${c.method} ${c.url.pathname.replace(/[0-9a-f-]{36}/g, ':id')}`);
    assert.deepEqual(flow, [
      'GET /rest/v1/admin_users',
      'PUT /auth/v1/admin/users/:id',
      'POST /rest/v1/rpc/staff_issue_temporary_access',
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

  test('never for a deactivated member: reactivate first (H-02)', async () => {
    asOwner();
    members = [{ user_id: PERSON, active: false }];
    const response = await staffAccess(req({ action: 'reset', user_id: PERSON }));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'inactive' });
    assert.equal(auth().length, 0);
    assert.ok(!calls.some((c) => c.url.pathname === '/rest/v1/rpc/staff_issue_temporary_access'));
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

describe('POST /api/admin/first-access (V-01, H-03)', () => {
  const NEW = 'minha-senha-pessoal-2026';
  const req = (body: unknown, headers: Record<string, string> = {}) =>
    new Request(`${SITE}/api/admin/first-access`, { method: 'POST', headers: { origin: SITE, 'content-type': 'application/json', authorization: 'Bearer header.payload.signature-long-enough', ...headers }, body: JSON.stringify(body) });
  const valid = { temporary_password: TEMPORARY, new_password: NEW };
  const path = (c: Call) => c.url.pathname;
  const passwordSet = () => calls.filter((c) => /^\/auth\/v1\/admin\/users\/[0-9a-f-]{36}$/.test(path(c)) && c.method === 'PUT');
  const deniedWith = () => calls.filter((c) => path(c) === '/rest/v1/rpc/staff_log_event').map((c) => JSON.parse(c.body).p_metadata.reason);

  test('unlocks only after the temporary password matches and the database checked MFA, then sets the own password and lets the database decide', async () => {
    const res = await firstAccess(req(valid));
    assert.equal(res.status, 200);
    const flow = calls.map((c) => `${c.method} ${path(c).replace(/[0-9a-f-]{36}/g, ':id')}`).filter((s) => !s.includes('hit_rate_limit'));
    assert.deepEqual(flow, [
      'POST /rest/v1/rpc/first_access_state',
      'POST /rest/v1/rpc/staff_first_access_secret',
      'POST /rest/v1/rpc/staff_begin_first_access',
      'PUT /auth/v1/admin/users/:id',
      'POST /rest/v1/rpc/staff_complete_first_access',
    ]);
    assert.equal(calls[0].auth, 'Bearer header.payload.signature-long-enough', 'state read with the person’s own token');
    assert.deepEqual(JSON.parse(calls.find((c) => path(c) === '/rest/v1/rpc/staff_begin_first_access')!.body), { p_user_id: PERSON, p_issue_id: ISSUE, p_session_id: SESSION });
    assert.deepEqual(JSON.parse(passwordSet()[0].body), { password: NEW });
    assert.deepEqual(JSON.parse(calls.find((c) => path(c) === '/rest/v1/rpc/staff_complete_first_access')!.body), { p_user_id: PERSON, p_issue_id: ISSUE });
    assert.equal(calls.filter((c) => c.body.includes(TEMPORARY)).length, 0, 'the temporary password is compared on the server, never sent anywhere');
  });

  test('a password changed through a recovery e-mail does not help: the temporary password itself is required', async () => {
    const { result, logs } = await captureLogs(() => firstAccess(req({ temporary_password: 'the-password-the-attacker-set', new_password: NEW })));
    assert.equal(result.status, 403);
    assert.deepEqual(await result.json(), { error: 'wrong_temporary_password' });
    assert.equal(passwordSet().length, 0);
    assert.ok(!calls.some((c) => path(c) === '/rest/v1/rpc/staff_complete_first_access'));
    assert.deepEqual(deniedWith(), ['wrong_temporary_password'], 'recorded in the audit log');
    assert.ok(!logs.includes('the-password-the-attacker-set') && !logs.includes(NEW));
  });

  test('without MFA (aal1, no verified authenticator or no live session) nothing happens', async () => {
    for (const change of [{ aal2: false }, { mfa_verified: false }, { session_id: null }]) {
      calls = [];
      firstState = { ...firstState, aal2: true, mfa_verified: true, session_id: SESSION, ...change };
      const res = await firstAccess(req(valid));
      assert.equal(res.status, 403, JSON.stringify(change));
      assert.deepEqual(await res.json(), { error: 'mfa_required' });
      assert.ok(!calls.some((c) => path(c) === '/rest/v1/rpc/staff_first_access_secret'));
      assert.equal(passwordSet().length, 0);
    }
  });

  test('an expired or no longer pending temporary password never unlocks', async () => {
    firstState = { ...firstState, pending: false, expired: true };
    assert.deepEqual(await (await firstAccess(req(valid))).json(), { error: 'expired' });
    firstState = { ...firstState, pending: false, expired: false };
    assert.equal((await firstAccess(req(valid))).status, 409);
    firstState = { ...firstState, pending: true };
    firstSecret = null;
    assert.deepEqual(await (await firstAccess(req(valid))).json(), { error: 'not_pending' });
    assert.equal(passwordSet().length, 0);
  });

  test('the temporary password cannot become the definitive one', async () => {
    const res = await firstAccess(req({ temporary_password: TEMPORARY, new_password: TEMPORARY }));
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { error: 'same_as_temporary' });
    assert.equal(passwordSet().length, 0);
  });

  test('a weak password is refused by Supabase Auth and the account stays locked', async () => {
    authRefuses = 'weak';
    const res = await firstAccess(req(valid));
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { error: 'weak_password' });
    assert.ok(!calls.some((c) => path(c) === '/rest/v1/rpc/staff_complete_first_access'));
  });

  test('the database has the final word (a newer temporary password, or MFA gone meanwhile)', async () => {
    beginError = { code: '42501', message: 'mfa_required' };
    assert.deepEqual(await (await firstAccess(req(valid))).json(), { error: 'mfa_required' });
    assert.equal(passwordSet().length, 0, 'the database check comes before any password change');
    beginError = { code: 'PT409', message: 'stale' };
    assert.deepEqual(await (await firstAccess(req(valid))).json(), { error: 'stale' });
    assert.equal(passwordSet().length, 0);
    beginError = null;
    completeError = { code: 'PT409', message: 'stale' };
    assert.deepEqual(await (await firstAccess(req(valid))).json(), { error: 'stale' });
    completeError = { code: '42501', message: 'mfa_required' };
    assert.deepEqual(await (await firstAccess(req(valid))).json(), { error: 'mfa_required' });
    completeError = { code: '55000', message: 'password_not_set' };
    const res = await firstAccess(req(valid));
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: 'not_completed' }, 'the password was set but the account stays locked, and the person is told so');
  });

  test('requires the same origin, a token, strict input and is rate limited', async () => {
    assert.equal((await firstAccess(req(valid, { origin: 'https://evil.test' }))).status, 403);
    assert.equal((await firstAccess(req(valid, { authorization: '' }))).status, 401);
    for (const body of [{ ...valid, new_password: 'curta' }, { ...valid, extra: 1 }, { new_password: NEW }]) assert.equal((await firstAccess(req(body))).status, 400, JSON.stringify(body));
    rateAllowed = false;
    assert.equal((await firstAccess(req(valid))).status, 429);
    assert.equal(passwordSet().length, 0);
  });
});

describe('remediation helpers', () => {
  test('rateLimitSubject groups IPv6 by /64 and keeps IPv4', () => {
    assert.equal(rateLimitSubject('2001:db8:abcd:12::1'), '2001:0db8:abcd:0012::/64');
    assert.equal(rateLimitSubject('2001:DB8:ABCD:12:FFFF:1:2:3'), '2001:0db8:abcd:0012::/64');
    assert.equal(rateLimitSubject('::1'), '0000:0000:0000:0000::/64');
    assert.equal(rateLimitSubject('fe80::1%eth0'), 'fe80:0000:0000:0000::/64');
    assert.equal(rateLimitSubject('::ffff:198.51.100.7'), '198.51.100.7');
    assert.equal(rateLimitSubject('198.51.100.7'), '198.51.100.7');
    assert.equal(rateLimitSubject('not-an-ip'), 'not-an-ip');
  });

  test('temporary-password digests are salted and verify only the right password', async () => {
    const a = await passwordDigest(TEMPORARY);
    assert.notEqual(a, await passwordDigest(TEMPORARY), 'salted');
    assert.ok(!a.includes(TEMPORARY));
    assert.ok(await matchesDigest(TEMPORARY, a));
    assert.ok(!(await matchesDigest(`${TEMPORARY}x`, a)));
    assert.ok(!(await matchesDigest(TEMPORARY, 'not-a-digest')));
  });

  test('hasMetadata spots EXIF/XMP/text chunks and leaves clean images alone', () => {
    const png = (chunk: string) => {
      const b = new Uint8Array(33 + 12 + 1);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1]);
      b.set([0, 0, 0, 1, ...new TextEncoder().encode(chunk)], 33);
      return b;
    };
    assert.equal(hasMetadata(png('tEXt'), sniffImage(png('tEXt'))!), true);
    assert.equal(hasMetadata(png('IEND'), sniffImage(png('IEND'))!), false);
    assert.equal(hasMetadata(webp(), sniffImage(webp())!), false);
  });
});
