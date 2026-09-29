import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startStack, totp, type Stack } from './stack';
import { TURNSTILE_PASS, turnstileScript } from './turnstile-stub';

// End-to-end: real Auth/PostgREST/Postgres, the real build, the Vercel
// emulation and Chromium. Run: GOTRUE_BIN=… POSTGREST_BIN=… pnpm test:e2e

type PW = typeof import('playwright');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright') as PW;
const root = path.resolve(import.meta.dirname, '../..');
const out = '.static-build/e2e-dist';
const shots = process.env.E2E_SCREENSHOTS || path.join(root, '.static-build/e2e-shots');
const PASSWORD = 'uma-senha-bem-longa-2026';
const results: string[] = [];
const ok = (label: string) => {
  results.push(label);
  console.log(`  ✓ ${label}`);
};
/** The control is inside the viewport, no toast overlaps any part of it, and it is on top across its face. */
const uncovered = async (target: import('playwright').Locator, label: string) => {
  const hits = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const inside = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    const overlap = [...document.querySelectorAll('[data-sonner-toast]')].some((t) => {
      const b = t.getBoundingClientRect();
      return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top;
    });
    // Probes inset from the rounded corners (hit testing follows border-radius).
    const points = [8, r.width / 2, r.width - 8].flatMap((dx) => [r.height * 0.3, r.height * 0.7].map((dy) => [r.left + dx, r.top + dy]));
    return [inside, !overlap, ...points.map(([x, y]) => el.contains(document.elementFromPoint(x, y)))];
  });
  assert.ok(hits.every(Boolean), `${label}: covered or out of view ${JSON.stringify(hits)}`);
};

const stack: Stack = await startStack();
let server: ReturnType<typeof spawn> | null = null;
const cspErrors: string[] = [];
const serverLog: string[] = [];
try {
  const env = {
    ...process.env, VERCEL: '', VELMONT_OUTPUT: out, PORT: '3100', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100', NEXT_PUBLIC_SUPABASE_URL: stack.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
    NEXT_PUBLIC_LEAD_CAPTURE: 'true', SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey, RATE_LIMIT_SALT: 'e2e-salt-e2e-salt-e2e-salt', VERCEL_DEPLOY_HOOK_URL: '',
    // Turnstile is mandatory with lead capture on; the stub answers Cloudflare's siteverify locally.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'e2e-site-key', TURNSTILE_SECRET_KEY: 'e2e-turnstile-secret',
  };
  // Async: the gateway lives in this process and must keep answering during the build.
  const build = () => promisify(execFile)(process.execPath, ['scripts/build-static.mjs'], { cwd: root, env });
  await build();
  server = spawn(process.execPath, ['--import', 'tsx', '--import', pathToFileURL(path.join(root, 'tests/e2e/turnstile-stub.ts')).href, 'scripts/dev-server.ts'], { cwd: root, env, stdio: 'pipe' });
  await new Promise<void>((resolve) => server!.stdout!.on('data', (d: Buffer) => d.toString().includes('http://') && resolve()));
  server.stderr!.on('data', (d: Buffer) => serverLog.push(d.toString()));
  const site = 'http://127.0.0.1:3100';

  const lisandra = await stack.createUser('lisandra@velmont.test', PASSWORD);
  const owner = await stack.createUser('owner@velmont.test', PASSWORD);
  await stack.createUser('estranho@example.test', PASSWORD);
  await stack.db.query(`insert into public.admin_users (user_id, email, display_name, role) values ($1, 'lisandra@velmont.test', 'Lisandra Ferreira', 'editor'), ($2, 'owner@velmont.test', 'Responsável', 'owner')`, [lisandra, owner]);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/.test(m.text())) cspErrors.push(`${page.url()}: ${m.text()}`);
  });
  await page.route('https://wa.me/**', (route) => route.fulfill({ status: 200, body: 'whatsapp' }));
  await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) => route.fulfill({ contentType: 'text/javascript', body: turnstileScript }));
  fs.mkdirSync(shots, { recursive: true });

  // 1. The public form, end to end: page with campaign tags → form → /api/leads
  //    (Turnstile, validation, limits) → database → (later, section 7) the panel.
  const qa = { name: 'QA Velmont Lead Test', company: 'Empresa QA <b>teste</b>', interest: 'Patentes' };
  const utms = { utm_source: 'qa', utm_medium: 'test', utm_campaign: 'velmont_lead_test', utm_content: 'form', utm_term: 'marca' };
  await page.goto(`${site}/?${new URLSearchParams(utms)}`, { referer: 'https://www.google.com/search?q=velmont' });
  await page.fill('#name', qa.name);
  await page.fill('#company', qa.company);
  await page.locator('#interest').click();
  await page.getByRole('option', { name: qa.interest, exact: true }).click();
  // WhatsApp opens only after the API stored the lead: the server's 201 is held
  // back from the page for a moment, and the page must still be here meanwhile.
  const leadCall: { status: number; token?: string; cta?: string } = { status: 0 };
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`${site}/api/leads`, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    [leadCall.token, leadCall.cta] = [body.turnstileToken, body.cta_source];
    const response = await route.fetch();
    leadCall.status = response.status();
    await held;
    await route.fulfill({ response });
  });
  await page.click('button.form-submit');
  for (let i = 0; i < 50 && !leadCall.status; i++) await page.waitForTimeout(100);
  assert.equal(leadCall.status, 201, 'the API stored the lead');
  assert.equal(leadCall.token, TURNSTILE_PASS, 'sent with the Turnstile token');
  assert.equal(leadCall.cta, 'contact-section');
  await page.locator('button.form-submit[disabled]', { hasText: 'Enviando…' }).waitFor();
  await page.waitForTimeout(800);
  assert.ok(!page.url().includes('wa.me'), 'WhatsApp waits for the confirmation');
  const wa = page.waitForURL(/wa\.me/);
  release();
  await wa;
  await page.unroute(`${site}/api/leads`);
  const whatsapp = decodeURIComponent(page.url());
  assert.match(whatsapp, /Nome: QA Velmont Lead Test/);
  assert.match(whatsapp, /Interesse: Patentes/);
  const [stored] = (
    await stack.db.query(
      `select id, name, company, interest, cta_source, landing_page, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, status, source, channel,
       created_at > now() - interval '5 minutes' as recent from public.leads`,
    )
  ).rows;
  const leadId = stored.id as string;
  assert.deepEqual({ ...stored, id: undefined }, {
    id: undefined, name: qa.name, company: qa.company, interest: qa.interest, cta_source: 'contact-section', landing_page: '/', referrer: 'https://www.google.com', ...utms,
    status: 'new', source: 'site-contact-form', channel: 'whatsapp', recent: true,
  });
  ok('public form → API (201, Turnstile) → database: every field, UTM and the call to action stored; WhatsApp opens only after the 201');

  const post = (body: Record<string, unknown>) =>
    fetch(`${site}/api/leads`, { method: 'POST', headers: { origin: site, 'content-type': 'application/json' }, body: JSON.stringify({ interest: 'Marcas', ...body }) }).then((r) => r.status);
  assert.equal(await post({ name: 'Sem Token' }), 403, 'Origin alone is no bot protection');
  assert.equal(await post({ name: 'Token Forjado', turnstileToken: 'forged' }), 403);
  const burst: number[] = [];
  for (let i = 0; i < 5; i++) burst.push(await post({ name: `Spam ${i}`, turnstileToken: TURNSTILE_PASS }));
  // This network may send 5 per 10 minutes: the form, the forged token and three more.
  assert.deepEqual(burst, [201, 201, 201, 429, 429]);
  await stack.db.query(`delete from public.leads where name like 'Spam %'`);
  const refusals = serverLog.join('');
  assert.match(refusals, /"event":"api_refused","route":"\/api\/leads","method":"POST","status":429,"error":"too_many_requests"/);
  assert.match(refusals, /"status":403,"error":"verification_required"/);
  assert.ok(!/Spam|Token Forjado|Sem Token|QA Velmont|Empresa QA/.test(refusals), 'no personal data in the logs');
  ok('Turnstile is mandatory (no or forged token: 403), limits answer 429, every refusal is logged without personal data');

  // No WhatsApp without the record: a refusal or a failure keeps the visitor on the
  // form with a message and the button ready again; a new token for every attempt.
  await stack.db.query('delete from public.rate_limits'); // the burst above used up this network's limit
  await page.goto(`${site}/`);
  await page.fill('#name', 'QA Falha');
  const failures: [number | 'offline', RegExp][] = [[500, /Não foi possível enviar agora/], [403, /Não conseguimos confirmar o envio/], [429, /Muitas tentativas/], [400, /Revise os campos/], ['offline', /Não foi possível enviar agora/]];
  for (const [status, message] of failures) {
    await page.route(`${site}/api/leads`, (route) => (status === 'offline' ? route.abort('internetdisconnected') : route.fulfill({ status, contentType: 'application/json', body: '{"error":"x"}' })));
    await page.click('button.form-submit');
    await page.locator('.form-error[role=alert]', { hasText: message }).waitFor();
    await page.locator('button.form-submit:not([disabled])', { hasText: 'Preparar minha conversa' }).waitFor();
    assert.ok(!page.url().includes('wa.me'), `${status}: WhatsApp stays closed`);
    await page.unroute(`${site}/api/leads`);
  }
  assert.equal(await page.evaluate(() => (window as unknown as { __turnstile: { resets: number } }).__turnstile.resets), failures.length, 'every attempt asks for a new token');
  // A double click sends a single request and stores a single lead.
  let requests = 0;
  await page.route(`${site}/api/leads`, async (route) => {
    requests++;
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.fill('#name', 'QA Duplo Clique');
  const waOnce = page.waitForURL(/wa\.me/);
  await page.locator('button.form-submit').dblclick();
  await waOnce;
  await page.unroute(`${site}/api/leads`);
  assert.equal(requests, 1, 'one request for a double click');
  assert.equal((await stack.db.query(`select count(*)::int as n from public.leads where name = 'QA Duplo Clique'`)).rows[0].n, 1);
  await stack.db.query(`delete from public.leads where name in ('QA Duplo Clique', 'QA Falha')`);
  ok('the page form never opens WhatsApp without the record: 500, 403, 429, 400 and offline keep the visitor on the form with a message; new token per attempt; a double click sends one request');

  // 2. Admin is private and not indexable.
  const adminResponse = await page.goto(`${site}/admin`);
  assert.match(adminResponse!.headers()['x-robots-tag'] || '', /noindex/);
  assert.equal(adminResponse!.headers()['cache-control'], 'no-store');
  await page.getByRole('heading', { name: 'Entrar' }).waitFor();
  assert.ok(!(await page.content()).includes('Maria'));
  const deep = await page.goto(`${site}/admin/leads`);
  assert.equal(deep!.status(), 200);
  await page.getByRole('heading', { name: 'Entrar' }).waitFor();
  ok('unauthenticated /admin and deep links show only the login, with noindex + no-store');

  const anonLeads = await fetch(`${stack.url}/rest/v1/leads?select=*`, { headers: { apikey: stack.anonKey } });
  assert.equal(anonLeads.status, 401);
  const anonDraft = await fetch(`${stack.url}/rest/v1/articles?select=*`, { headers: { apikey: stack.anonKey } });
  assert.equal(anonDraft.status, 401);
  ok('public API key cannot read leads or drafts');

  // Black-box probes an unauthenticated attacker would try with the public key.
  const api = (p: string, init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {}) => fetch(`${stack.url}${p}`, { ...init, headers: { apikey: stack.anonKey, 'content-type': 'application/json', ...init.headers } });
  const denied = async (label: string, r: Response) => assert.ok([401, 403, 404].includes(r.status) || (r.ok && JSON.stringify(await r.json()) === '[]'), `${label}: ${r.status}`);
  await denied('publish rpc', await api('/rest/v1/rpc/publish_article', { method: 'POST', body: JSON.stringify({ p_id: '00000000-0000-4000-8000-000000000000', p_expected_version: 1 }) }));
  await denied('rate limit rpc', await api('/rest/v1/rpc/hit_rate_limit', { method: 'POST', body: JSON.stringify({ p_key: 'x', p_limit: 1, p_window_seconds: 1 }) }));
  await denied('insert lead', await api('/rest/v1/leads', { method: 'POST', body: JSON.stringify({ name: 'x', interest: 'Marcas' }) }));
  await denied('insert media', await api('/rest/v1/media', { method: 'POST', body: JSON.stringify({ path: '0f8fad5b-d9cb-469f-a165-70867728950e.webp', mime_type: 'image/webp', bytes: 1, width: 1, height: 1 }) }));
  await denied('update published', await api('/rest/v1/published_articles?slug=eq.inovacao-e-patente', { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ title: 'hacked' }) }));
  await denied('delete published', await api('/rest/v1/published_articles?slug=neq.x', { method: 'DELETE', headers: { prefer: 'return=representation' } }));
  const embed = await api('/rest/v1/published_articles?select=slug,articles(title,status,created_by)');
  assert.ok(!embed.ok || !JSON.stringify(await embed.json()).includes('status'), 'drafts via embedding');
  await denied('audit log', await api('/rest/v1/audit_log?select=*'));
  await denied('admin users', await api('/rest/v1/admin_users?select=*'));
  const signup = await fetch(`${stack.url}/auth/v1/signup`, { method: 'POST', headers: { apikey: stack.anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'invasor@example.test', password: 'senha-invasor-123456' }) });
  assert.ok(!signup.ok, 'public sign-up must be disabled');
  const injected = await api('/rest/v1/rpc/resolve_slug_redirect', { method: 'POST', body: JSON.stringify({ p_slug: "x' or 1=1 --" }) });
  assert.equal(await injected.json(), null);
  const unpublished = (await fetch(`${site}/blog/nao-existe-ainda`)).status;
  assert.equal(unpublished, 404);
  ok('attacker probes with the public key: privileged RPCs, writes, draft embedding, audit/team reads, sign-up and SQL injection all fail');

  // 3. Wrong password, then an outsider with a valid account.
  await page.goto(`${site}/admin`);
  await page.fill('#email', 'lisandra@velmont.test');
  await page.fill('#password', 'senha-errada-123456');
  await page.click('button[type=submit]');
  await page.getByText('E-mail ou senha incorretos.').waitFor();
  ok('wrong password shows a generic message');

  const enroll = async (p = page) => {
    await p.getByRole('heading', { name: 'Proteja sua conta' }).waitFor();
    await p.getByText('Não consegue escanear?').click();
    const secret = (await p.locator('.secret code').textContent())!.trim();
    await p.fill('#code', totp(secret));
    await p.click('button[type=submit]');
    return secret;
  };
  const tokenOf = (p: typeof page) => p.evaluate(() => JSON.parse(localStorage.getItem('velmont-admin') || '{}').access_token as string);
  const leadsWith = async (token: string) => (await (await fetch(`${stack.url}/rest/v1/leads?select=id`, { headers: { apikey: stack.anonKey, authorization: `Bearer ${token}` } })).json()) as { id: string }[];
  await page.fill('#email', 'estranho@example.test');
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await enroll();
  await page.getByRole('heading', { name: 'Acesso não liberado' }).waitFor();
  const outsiderToken = await page.evaluate(() => JSON.parse(localStorage.getItem('velmont-admin') || '{}').access_token as string);
  const outsiderLeads = await fetch(`${stack.url}/rest/v1/leads?select=*`, { headers: { apikey: stack.anonKey, authorization: `Bearer ${outsiderToken}` } });
  assert.deepEqual(await outsiderLeads.json(), []);
  const outsiderUpload = await fetch(`${site}/api/admin/media`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${outsiderToken}`, 'content-type': 'multipart/form-data; boundary=x' }, body: '--x--' });
  assert.equal(outsiderUpload.status, 403);
  const promote = await fetch(`${stack.url}/rest/v1/rpc/update_staff_member`, { method: 'POST', headers: { apikey: stack.anonKey, authorization: `Bearer ${outsiderToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_user_id: owner, p_role: 'editor', p_active: false }) });
  assert.notEqual(promote.status, 200);
  await page.getByRole('button', { name: 'Sair' }).click();
  ok('signed-in outsider (MFA verified) sees "Acesso não liberado", reads no leads, cannot upload or change roles');

  // 4. Editor: password + mandatory TOTP enrollment.
  await page.getByRole('heading', { name: 'Entrar' }).waitFor();
  await page.fill('#email', 'lisandra@velmont.test');
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  const aal1Token = await page.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const s = JSON.parse(localStorage.getItem('velmont-admin') || '{}');
      if (s.access_token) return s.access_token as string;
      await new Promise((r) => setTimeout(r, 100));
    }
    return '';
  });
  const aal1Leads = await fetch(`${stack.url}/rest/v1/leads?select=*`, { headers: { apikey: stack.anonKey, authorization: `Bearer ${aal1Token}` } });
  assert.deepEqual(await aal1Leads.json(), []);
  ok('staff password alone (aal1) reads nothing: MFA is enforced by RLS');
  const secret = await enroll();
  await page.getByRole('heading', { name: /Olá, Lisandra/ }).waitFor();
  await page.screenshot({ path: path.join(shots, 'admin-dashboard.png'), fullPage: true });
  const stats = await page.locator('.stat strong').allTextContents();
  assert.deepEqual(stats, ['3', '0', '1']);
  ok('editor enrolls TOTP and reaches the dashboard (3 published, 0 drafts, 1 new lead)');

  // The dashboard counts through the real PostgREST: HEAD with count=exact, answered 200 with the
  // total in Content-Range; no 5xx and no retry (supabase-js repeats a 503 with X-Retry-Count).
  const restCalls: { method: string; url: string; status: number; range: string | null; retry: string | null }[] = [];
  const onRest = async (response: import('playwright').Response) => {
    const request = response.request();
    if (!request.url().startsWith(`${stack.url}/rest/v1/`)) return;
    restCalls.push({ method: request.method(), url: request.url().slice(stack.url.length), status: response.status(), range: response.headers()['content-range'] ?? null, retry: (await request.allHeaders())['x-retry-count'] ?? null });
  };
  page.on('response', onRest);
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await page.locator('.stat strong').first().waitFor();
    assert.deepEqual(await page.locator('.stat strong').allTextContents(), ['3', '0', '1']);
  }
  page.off('response', onRest);
  const heads = restCalls.filter((c) => c.method === 'HEAD');
  assert.deepEqual([...new Set(heads.map((c) => c.url))].sort(), ['/rest/v1/articles?select=id&status=eq.published', '/rest/v1/articles?select=id&status=in.%28draft%2Creview%29', '/rest/v1/leads?select=id&status=eq.new']);
  assert.equal(heads.length, 12, 'per load: the three dashboard counts and the sidebar badge of new leads (same request as the third)');
  assert.deepEqual(restCalls.filter((c) => c.status >= 500 || c.retry), [], 'no 5xx and no retry');
  assert.deepEqual([...new Set(heads.map((c) => `${c.status} ${c.range?.split('/')[1]}`))].sort(), ['200 0', '200 1', '200 3']);
  // A count that cannot be read shows "—", never a false 0 (a 400 is not retried).
  await page.route(`${stack.url}/rest/v1/leads?select=id&status=eq.new`, (route) => (route.request().method() === 'HEAD' ? route.fulfill({ status: 400, headers: { 'access-control-allow-origin': '*', 'proxy-status': 'PostgREST; error=PGRST100' } }) : route.continue()));
  await page.reload();
  await page.locator('.stat strong').first().waitFor();
  assert.deepEqual(await page.locator('.stat strong').allTextContents(), ['3', '0', '—']);
  await page.unroute(`${stack.url}/rest/v1/leads?select=id&status=eq.new`);
  ok('dashboard counts against the real PostgREST: 12 HEAD count=exact requests (3 loads) answered 200 with the right totals, no 5xx, no retry; an unreadable count shows "—"');

  assert.equal(await page.getByRole('link', { name: 'Equipe' }).count(), 0);
  await page.goto(`${site}/admin/equipe`);
  await page.getByText('Área restrita à pessoa responsável.').waitFor();
  ok('editor has no team management');

  // 5. Create, preview and publish an article.
  await page.goto(`${site}/admin/artigos/novo`);
  await page.fill('#title', 'Marca e nome empresarial: qual a diferença?');
  await page.fill('#excerpt', 'Entenda por que o registro na Junta Comercial não protege sua marca e o que fazer antes de investir.');
  await page.getByRole('textbox', { name: 'Parágrafo', exact: true }).fill('<img src=x onerror=alert(1)> O **nome empresarial** identifica a empresa. Veja [nossos serviços](/#marcas) e [link perigoso](javascript:alert(1)).');
  await page.locator('.block .add-toggle').first().click();
  await page.getByRole('menuitem', { name: /Resumo em destaque/ }).click();
  await page.getByRole('textbox', { name: 'Texto do destaque', exact: true }).fill('Registro de marca e nome empresarial são proteções diferentes.');
  await page.click('button:has-text("Salvar")');
  await page.waitForURL(/\/admin\/artigos\/[0-9a-f-]{36}$/);
  await page.getByText('Rascunho salvo.').waitFor();
  const articleId = page.url().split('/').pop()!;
  const draft = await fetch(`${stack.url}/rest/v1/published_articles?select=slug&article_id=eq.${articleId}`, { headers: { apikey: stack.anonKey } });
  assert.deepEqual(await draft.json(), []);
  ok('draft saved; not visible through the public API');

  const [preview] = await Promise.all([context.waitForEvent('page'), page.click('button:has-text("Visualizar")')]);
  preview.on('console', (m) => { if (/Content Security Policy/.test(m.text())) cspErrors.push(`preview: ${m.text()}`); });
  await preview.getByRole('heading', { level: 1, name: 'Marca e nome empresarial: qual a diferença?' }).waitFor();
  const previewHtml = await preview.content();
  assert.ok(!previewHtml.includes('<img src="x"'));
  assert.ok(!/href="javascript:/i.test(previewHtml));
  assert.match(previewHtml, /class="article-callout"/);
  assert.match(previewHtml, /noindex/);
  await preview.locator('.article-body').waitFor();
  await preview.screenshot({ path: path.join(shots, 'admin-preview.png'), fullPage: true });
  await preview.close();
  const anonPreview = await browser.newPage();
  await anonPreview.goto(`${site}/admin/preview?id=${articleId}`);
  await anonPreview.getByText('Pré-visualização indisponível').waitFor();
  await anonPreview.close();
  ok('preview renders the draft with public components for staff, is noindex, and is unavailable without a session');

  await page.screenshot({ path: path.join(shots, 'admin-editor.png'), fullPage: true });
  await page.click('button:has-text("Publicar")');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publicar' }).click();
  await page.getByText(/atualização automática do site falhou|site será atualizado/).waitFor();
  const live = await fetch(`${stack.url}/rest/v1/published_articles?select=slug,title&article_id=eq.${articleId}`, { headers: { apikey: stack.anonKey } });
  const [published] = (await live.json()) as { slug: string }[];
  assert.equal(published.slug, 'marca-e-nome-empresarial-qual-a-diferenca');
  ok('publish creates the public snapshot (deploy hook not configured locally: reported, not hidden)');

  // Edit after publishing: the live version stays until "Publicar alterações".
  await page.fill('#title', 'Marca e nome empresarial: diferenças essenciais');
  await page.click('button:has-text("Salvar")');
  await page.getByText(/continua mostrando a versão publicada/).waitFor();
  const stillLive = await fetch(`${stack.url}/rest/v1/published_articles?select=title&article_id=eq.${articleId}`, { headers: { apikey: stack.anonKey } });
  assert.equal(((await stillLive.json()) as { title: string }[])[0].title, 'Marca e nome empresarial: qual a diferença?');
  ok('saving a published article never changes the live version silently');

  // Concurrent edit from another session is detected.
  await stack.db.query(`update public.articles set excerpt = excerpt || ' Atualizado.' where id = $1`, [articleId]);
  await page.fill('#excerpt', 'Outra alteração feita ao mesmo tempo, que não pode sobrescrever a primeira sem aviso.');
  await page.click('button:has-text("Salvar")');
  await page.getByText(/alterado por outra pessoa/).waitFor();
  ok('concurrent edits are detected (optimistic locking) instead of overwritten');

  // Unsaved work: in-app navigation asks first, and a local backup is offered
  // (and restorable) after a reload instead of leaving the editor on "Carregando…".
  await page.goto(`${site}/admin/artigos`);
  await page.locator('.content').getByRole('link', { name: /diferenças essenciais/ }).first().click();
  await page.waitForURL(new RegExp(`/admin/artigos/${articleId}$`));
  await page.fill('#title', 'Título ainda não salvo');
  const navArticles = page.locator('#admin-nav').getByRole('link', { name: 'Artigos', exact: true });
  await navArticles.click();
  await page.getByRole('alertdialog').getByText('Sair sem salvar?').waitFor();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  assert.match(page.url(), new RegExp(`/admin/artigos/${articleId}$`));
  await page.goBack();
  await page.getByRole('alertdialog').getByText('Sair sem salvar?').waitFor();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  assert.match(page.url(), new RegExp(`/admin/artigos/${articleId}$`));
  await page.waitForTimeout(1200);
  await page.reload();
  await page.getByRole('alertdialog').getByText('Alterações não salvas').waitFor({ timeout: 5000 });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Recuperar' }).click();
  assert.equal(await page.inputValue('#title'), 'Título ainda não salvo');
  await navArticles.click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sair sem salvar' }).click();
  await page.waitForURL(/\/admin\/artigos$/);
  await page.evaluate((id) => localStorage.removeItem(`vm-draft:${id}`), articleId);
  ok('unsaved edits: leaving asks first (links and back button); a local backup is recovered after reload');

  // A new article is published with a single click: saved, confirmed, published.
  await page.goto(`${site}/admin/artigos/novo`);
  await page.fill('#title', 'Publicado com um clique');
  await page.fill('#excerpt', 'Um artigo novo publicado direto do editor, sem salvar antes: um clique em Publicar basta.');
  await page.getByRole('textbox', { name: 'Parágrafo', exact: true }).fill('Conteúdo mínimo para publicar.');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const confirmPublish = page.getByRole('alertdialog');
  await confirmPublish.getByText('Publicar artigo?').waitFor();
  assert.match(page.url(), /\/admin\/artigos\/novo$/, 'the confirmation opens on the same editor');
  const [newArticle] = (await stack.db.query(`select id, status from public.articles where title = 'Publicado com um clique'`)).rows;
  assert.equal(newArticle.status, 'draft', 'saved first, so the article exists before publishing');
  await confirmPublish.getByRole('button', { name: 'Publicar' }).click();
  await page.getByText(/atualização automática do site falhou|site será atualizado/).waitFor();
  await page.waitForURL(new RegExp(`/admin/artigos/${newArticle.id}$`));
  const [oneClick] = (await stack.db.query(`select a.status, p.slug, (select count(*)::int from public.articles where title = 'Publicado com um clique') as copies from public.articles a join public.published_articles p on p.article_id = a.id where a.id = $1`, [newArticle.id])).rows;
  assert.deepEqual(oneClick, { status: 'published', slug: 'publicado-com-um-clique', copies: 1 });
  await page.getByRole('button', { name: /^Publicar/ }).waitFor({ state: 'detached' });
  ok('a new article is published with ONE click on "Publicar": saved, the confirmation appears, then it is published (no second click, no duplicate)');

  // 6. Rebuild the static site from the CMS and check the public article.
  await build();
  const html = await (await fetch(`${site}/blog/marca-e-nome-empresarial-qual-a-diferenca`)).text();
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.ok(!html.includes('<img src="x"') && !/href="javascript:/i.test(html));
  assert.match(html, /BlogPosting/);
  assert.match(html, /"datePublished":"\d{4}-/);
  assert.match(await (await fetch(`${site}/sitemap.xml`)).text(), /marca-e-nome-empresarial-qual-a-diferenca<\/loc><lastmod>/);
  const home = await (await fetch(`${site}/`)).text();
  assert.match(home, /Marca e nome empresarial: qual a diferença\?/);
  ok('rebuilt site serves the article as static HTML (escaped, JSON-LD, sitemap lastmod, home card)');

  // 7. Leads area: the lead from the public form, exactly as stored.
  await page.goto(`${site}/admin/leads`);
  await page.getByRole('link', { name: /QA Velmont Lead Test/ }).click();
  await page.waitForURL(new RegExp(`/admin/leads/${leadId}$`));
  const sheet = page.getByRole('dialog');
  const detail = async (label: string) => ((await sheet.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]').textContent()) || '').trim();
  await sheet.locator('dt', { hasText: /^Nome$/ }).waitFor();
  assert.equal(await detail('Nome'), stored.name);
  assert.equal(await detail('Origem no site'), 'Formulário de contato');
  assert.equal(await detail('Empresa ou projeto'), stored.company);
  assert.equal(await detail('Interesse'), stored.interest);
  assert.equal(await detail('Página de entrada'), stored.landing_page);
  assert.equal(await detail('Site de origem'), stored.referrer);
  for (const key of Object.keys(utms)) assert.equal(await detail(key), stored[key], key);
  assert.ok((await detail('Recebido em')).length > 0, 'date and time shown');
  await sheet.getByText('Novo', { exact: true }).first().waitFor();
  assert.equal(await sheet.locator('b').count(), 0, 'markup typed in the form is shown as text');
  ok('the same lead in /admin/leads: name, company, interest, landing page, referrer, every UTM, date and status "Novo" match the database');
  await page.selectOption('#lead-status', 'contacted');
  await page.fill('#lead-notes', 'Retornar na segunda.');
  await page.click('button:has-text("Salvar")');
  await page.getByText('Lead atualizado.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Excluir lead' }).count(), 0);
  const audit = await stack.db.query(`select action from public.audit_log where actor_id = $1 order by id`, [lisandra]);
  const actions = audit.rows.map((r) => r.action);
  for (const a of ['auth.login', 'article.create', 'article.publish', 'article.update', 'lead.update']) assert.ok(actions.includes(a), `audit ${a}`);
  ok('lead opened, status/notes updated; editor cannot delete leads; audit log records the actions');

  // 8. Private draft media: uploads, signed URLs, publish copies, cleanup.
  await page.goto(`${site}/admin/midia`);
  const png = fs.readFileSync(path.join(root, 'public/images/velmont-icon.png'));
  for (const name of ['capa.png', 'nao-usada.png']) {
    await page.setInputFiles('input[type=file]', { name, mimeType: 'image/png', buffer: png });
    await page.locator('.toast', { hasText: 'Imagem enviada' }).last().waitFor();
    await page.waitForTimeout(300);
  }
  const keys = () => [...stack.storage.keys()];
  assert.equal(keys().filter((k) => k.startsWith('media-private/')).length, 2);
  assert.equal(keys().filter((k) => k.startsWith('media/')).length, 0, 'nothing is public before publishing');
  for (const k of keys()) assert.match(k, /^media-private\/[0-9a-f-]{36}\.(webp|jpg)$/);
  ok('uploads are re-encoded, validated server-side and stored only in the private bucket');

  // No notification covers the actions of the image details: with a toast on screen ("Imagem enviada",
  // then "Descrição salva"), "Excluir imagem" stays entirely visible and clickable, on a desktop and on a phone.
  await page.setInputFiles('input[type=file]', { name: 'engano.png', mimeType: 'image/png', buffer: png });
  await page.locator('.toast', { hasText: 'Imagem enviada' }).last().waitFor();
  await page.getByRole('button', { name: /^Abrir detalhes/ }).first().click();
  await page.getByRole('heading', { name: 'Detalhes da imagem' }).waitFor();
  const deleteImage = page.getByRole('button', { name: 'Excluir imagem' });
  await page.waitForTimeout(600);
  await uncovered(deleteImage, 'with "Imagem enviada" on screen');
  for (const [width, height] of [[1510, 889], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.fill('#media-alt', `Ícone da Velmont em ${width}px`);
    await page.getByRole('button', { name: 'Salvar descrição' }).click();
    const saved = page.locator('.toast', { hasText: 'Descrição salva' }).last();
    await saved.waitFor();
    await page.waitForTimeout(600);
    const [toastBox, footerBox] = [await saved.boundingBox(), await page.locator('[data-slot="sheet-footer"]').boundingBox()];
    assert.ok(toastBox && footerBox && toastBox.y + toastBox.height <= footerBox.y, `${width}px: the toast sits above the sheet footer`);
    await uncovered(deleteImage, `${width}px with "Descrição salva" on screen`);
    await deleteImage.click({ trial: true });
    await page.screenshot({ path: path.join(shots, `admin-media-toast-${width}.png`) });
  }
  await page.setViewportSize({ width: 1360, height: 900 });
  await deleteImage.click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
  await page.locator('.toast', { hasText: 'Imagem excluída' }).waitFor();
  assert.equal(keys().filter((k) => k.startsWith('media-private/')).length, 2, 'the image sent by mistake is gone');
  ok('toasts never cover the image actions: with "Imagem enviada" or "Descrição salva" on screen, "Excluir imagem" stays fully visible and clickable at 1510×889 and 390×844');

  await page.locator('.media-card img').nth(1).waitFor();
  const thumbs = await page.locator('.media-card img').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src));
  assert.ok(thumbs.every((src) => src.includes('/storage/v1/object/sign/media-private/') && src.includes('token=')), thumbs.join('\n'));
  assert.ok(await page.locator('.media-card img').first().evaluate((img) => (img as HTMLImageElement).naturalWidth > 0), 'signed thumbnail loads');
  const [first] = (await stack.db.query('select id, path from public.media order by created_at limit 1')).rows as { id: string; path: string }[];
  const privateKey = first.path;
  assert.notEqual((await fetch(`${stack.url}/storage/v1/object/public/media-private/${privateKey}`)).status, 200);
  assert.equal((await fetch(`${stack.url}/storage/v1/object/public/media/${privateKey}`)).status, 404);
  const staffToken = await page.evaluate(() => JSON.parse(localStorage.getItem('velmont-admin') || '{}').access_token as string);
  const sign = (token: string, expiresIn = 60) => fetch(`${stack.url}/storage/v1/object/sign/media-private`, { method: 'POST', headers: { apikey: stack.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn, paths: [privateKey] }) }).then((r) => r.json() as Promise<{ signedURL: string | null }[]>);
  assert.equal((await sign(stack.anonKey))[0].signedURL, null, 'anonymous cannot get a signed URL');
  assert.equal((await sign(outsiderToken))[0].signedURL, null, 'non-staff cannot get a signed URL');
  const shortLived = (await sign(staffToken, 1))[0].signedURL!;
  assert.equal((await fetch(`${stack.url}/storage/v1${shortLived}`)).status, 200);
  await page.waitForTimeout(2100);
  assert.equal((await fetch(`${stack.url}/storage/v1${shortLived}`)).status, 400, 'signed URL expires');
  ok('private media is reachable only through expiring signed URLs issued to staff (anon, outsider and public URLs refused)');

  await page.goto(`${site}/admin/artigos/novo`);
  await page.fill('#title', 'Artigo com imagem de capa');
  await page.fill('#excerpt', 'Um artigo para verificar como a imagem de capa sai do bucket privado ao ser publicada.');
  await page.getByRole('textbox', { name: 'Parágrafo', exact: true }).fill('Conteúdo com imagem.');
  await page.getByRole('button', { name: 'Escolher imagem' }).click();
  await page.locator('.media-grid button').last().click();
  await page.click('button:has-text("Salvar")');
  await page.waitForURL(/\/admin\/artigos\/[0-9a-f-]{36}$/);
  const imageArticle = page.url().split('/').pop()!;
  const [cover] = (await stack.db.query('select m.path from public.articles a join public.media m on m.id = a.featured_image_id where a.id = $1', [imageArticle])).rows as { path: string }[];
  assert.equal(cover.path, privateKey);
  await page.locator('.cover-preview img').waitFor();
  assert.match(await page.locator('.cover-preview img').getAttribute('src') || '', /\/object\/sign\/media-private\/.+token=/);
  const [imagePreview] = await Promise.all([context.waitForEvent('page'), page.click('button:has-text("Visualizar")')]);
  await imagePreview.locator('img.article-cover').waitFor();
  assert.match(await imagePreview.locator('img.article-cover').getAttribute('src') || '', /\/object\/sign\/media-private\/.+token=/);
  assert.ok(await imagePreview.locator('img.article-cover').evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0));
  await imagePreview.close();
  ok('editor and preview show draft images through signed URLs');

  await page.click('button:has-text("Publicar")');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publicar' }).click();
  await page.getByText(/atualização automática do site falhou|site será atualizado/).waitFor();
  assert.ok(keys().includes(`media/${cover.path}`), 'cover copied to the public bucket');
  assert.equal(keys().filter((k) => k.startsWith('media/')).length, 1, 'unused private media stays private');
  await build();
  const imageHtml = await (await fetch(`${site}/blog/artigo-com-imagem-de-capa`)).text();
  const publicUrl = `${stack.url}/storage/v1/object/public/media/${cover.path}`;
  assert.ok(imageHtml.includes(publicUrl));
  assert.ok(!imageHtml.includes('media-private') && !imageHtml.includes('token='), 'public page never references private media');
  assert.equal((await fetch(publicUrl)).status, 200);
  ok('publishing copies only the images the article uses to the public bucket; the static page serves them normally');

  await page.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('menuitem', { name: 'Despublicar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Despublicar' }).click();
  await page.getByText(/atualização automática do site falhou|site será atualizado/).waitFor();
  assert.equal((await fetch(publicUrl)).status, 200, 'grace period keeps a just-published copy');
  await stack.db.query(`update public.media set public_since = now() - interval '10 minutes' where public_since is not null`);
  await fetch(`${site}/api/admin/rebuild`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' }, body: '{}' });
  assert.equal((await fetch(publicUrl)).status, 404);
  assert.ok(keys().includes(`media-private/${cover.path}`), 'the private original is kept');
  ok('after unpublishing, the public copy is removed and the image is private again');

  // Media and publication hardening, through the real APIs.
  const rest = (p: string, token: string, init: RequestInit = {}) =>
    fetch(`${stack.url}/rest/v1${p}`, { ...init, headers: { apikey: stack.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json', prefer: 'return=representation', ...(init.headers as Record<string, string>) } });
  const directDelete = await rest(`/media?id=eq.${first.id}`, staffToken, { method: 'DELETE' });
  assert.ok([401, 403].includes(directDelete.status), `direct DELETE -> ${directDelete.status}`);
  assert.equal((await stack.db.query('select count(*)::int as n from public.media where id = $1', [first.id])).rows[0].n, 1);
  const apiDelete = await fetch(`${site}/api/admin/media`, { method: 'DELETE', headers: { origin: site, authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: first.id }) });
  assert.equal(apiDelete.status, 409, 'still the cover of a draft');
  ok('media rows cannot be deleted directly through the API key; deletion goes through the checked function (in use: 409)');

  const publicBefore = keys().filter((k) => k.startsWith('media/')).length;
  const [refused] = (await (await rest('/articles', staffToken, { method: 'POST', body: JSON.stringify({ title: 'Incompleto', slug: 'incompleto-com-imagem', excerpt: 'curto', featured_image_id: first.id }) })).json()) as { id: string }[];
  const refusedPublish = await fetch(`${site}/api/admin/publish`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: refused.id, action: 'publish', expectedVersion: 1 }) });
  assert.equal(refusedPublish.status, 422);
  assert.equal(keys().filter((k) => k.startsWith('media/')).length, publicBefore, 'no new public object');
  assert.equal((await fetch(`${stack.url}/storage/v1/object/public/media/${first.path}`)).status, 404);
  assert.equal((await stack.db.query('select public_since from public.media where id = $1', [first.id])).rows[0].public_since, null);
  ok('a publication the database refuses never exposes the draft image (no public copy, not marked public)');

  // A stale version is answered at once (with SQLSTATE 40001, PostgREST retried the call without end).
  const quick = { signal: AbortSignal.timeout(15000) };
  const stalePublish = await fetch(`${site}/api/admin/publish`, { ...quick, method: 'POST', headers: { origin: site, authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: refused.id, action: 'publish', expectedVersion: 99 }) });
  assert.equal(stalePublish.status, 409);
  assert.deepEqual(await stalePublish.json(), { error: 'version_conflict' });
  const staleRpc = await rest('/rpc/publish_article', staffToken, { ...quick, method: 'POST', body: JSON.stringify({ p_id: refused.id, p_expected_version: 99 }) });
  assert.equal(staleRpc.status, 409, 'the database function itself');
  ok('a stale version is refused with 409 at once, by the API and by the database function itself');

  const { default: sharp } = (await import('sharp')) as unknown as { default: (options: object) => { jpeg(): { withExif(exif: object): { toBuffer(): Promise<Buffer> } } } };
  const exifJpeg = await sharp({ create: { width: 320, height: 200, channels: 3, background: { r: 90, g: 26, b: 44 } } })
    .jpeg()
    .withExif({ IFD0: { Make: 'GPS-TEST-CAM' }, IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '25/1 25/1 0/1' } })
    .toBuffer();
  assert.ok(exifJpeg.includes('Exif') && exifJpeg.includes('GPS-TEST-CAM'));
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(exifJpeg)], { type: 'image/jpeg' }), 'foto-com-gps.jpg');
  form.set('alt', 'Foto de teste');
  const uploaded = await fetch(`${site}/api/admin/media`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${staffToken}` }, body: form });
  assert.equal(uploaded.status, 201);
  const gpsMedia = ((await uploaded.json()) as { media: { id: string; path: string } }).media;
  const [withPhoto] = (await (await rest('/articles', staffToken, { method: 'POST', body: JSON.stringify({ title: 'Artigo com foto', slug: 'artigo-com-foto', excerpt: 'Um artigo para conferir a foto publicada sem metadados.', featured_image_id: gpsMedia.id, content: { version: 1, blocks: [{ type: 'paragraph', text: 'Texto.' }] } }) })).json()) as { id: string }[];
  const photoPublish = await fetch(`${site}/api/admin/publish`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: withPhoto.id, action: 'publish', expectedVersion: 1 }) });
  assert.equal(photoPublish.status, 200);
  const publicPhoto = stack.storage.get(`media/${gpsMedia.path}`)!;
  assert.ok(publicPhoto, 'published copy exists');
  assert.ok(!publicPhoto.body.includes('Exif') && !publicPhoto.body.includes('GPS-TEST-CAM'), 'no EXIF/GPS in the public object');
  assert.equal((await fetch(`${stack.url}/storage/v1/object/public/media/${gpsMedia.path}`)).status, 200);
  ok('a JPEG with EXIF/GPS sent straight to the API is stored and published without its metadata');

  // Site status: never "Falha" for an update that is on the air; an unanswered request waits for its build.
  await build();
  const liveBuild = (await (await fetch(`${site}/build-info.json`)).json()) as { startedAt: string };
  const statusPanel = page.getByRole('region', { name: 'Status do site' });
  const siteBuilds = async () => (await stack.db.query('select count(*)::int as n from public.site_builds')).rows[0].n as number;
  // Recorded as failed by the old 8-second timeout, although the live version began after it.
  await stack.db.query(`insert into public.site_builds (requested_at, requested_by, reason, ok, status, finished_at, detail) values ($1, $2, 'publish: antigo', false, 'failed', $1, 'deploy hook unreachable')`, [new Date(Date.parse(liveBuild.startedAt) - 200).toISOString(), lisandra]);
  await page.goto(`${site}/admin`);
  await statusPanel.getByText(/já mostra o conteúdo publicado mais recente/).waitFor();
  assert.equal(await statusPanel.getByText(/Falha|Não foi possível contatar/).count(), 0, 'already on the air: not a failure');
  // Asked now, Vercel's answer never arrived: awaiting confirmation, and a retry asks for nothing new.
  await stack.db.query(`insert into public.site_builds (requested_at, requested_by, reason, ok, status, detail) values (now(), $1, 'publish: sem resposta', true, 'pending', 'deploy hook unconfirmed')`, [lisandra]);
  await page.reload();
  await statusPanel.getByText('Aguardando confirmação').waitFor();
  await statusPanel.getByText(/ainda não confirmou o recebimento/).waitFor();
  await statusPanel.screenshot({ path: path.join(shots, 'admin-site-status-unconfirmed.png') });
  const retryWhilePending = await fetch(`${site}/api/admin/rebuild`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'retry: dashboard' }) });
  assert.deepEqual(await retryWhilePending.json(), { ok: true, skipped: 'in_progress' });
  const before = await siteBuilds();
  // The production build reports success when it ends, before Vercel deploys it and moves the domain:
  // still "Atualizando site…" until the site serves that build (its build-info.json), then "Atualizado".
  await stack.db.query('select public.finish_site_builds(now(), true)');
  await statusPanel.getByText('Atualizando site…').waitFor({ timeout: 25000 });
  assert.equal(await statusPanel.getByText('Atualizado', { exact: true }).count(), 0, 'built, not served yet');
  await build();
  await statusPanel.getByText(/já mostra o conteúdo publicado mais recente/).waitFor({ timeout: 25000 });
  await statusPanel.getByText(/Em outros acessos, pode levar alguns segundos/).waitFor();
  await page.getByText('Site atualizado').first().waitFor();
  const retryAfterConfirmed = await fetch(`${site}/api/admin/rebuild`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'retry: dashboard' }) });
  assert.deepEqual(await retryAfterConfirmed.json(), { ok: true, skipped: 'updated' });
  assert.equal(await siteBuilds(), before, 'no duplicate request or build');
  ok('site status: a live update is never shown as a failure; an unanswered request waits; a finished build stays "Atualizando site…" until the site serves it, then "Atualizado"; retries do not duplicate it');

  // Coming back to a hidden tab checks at once; while hidden, the panel asks nothing. The page clock is
  // paused, so no polling round can fire: only the return to the tab can bring the new state.
  await stack.db.query(`insert into public.site_builds (requested_at, requested_by, reason, ok, status) values (now(), $1, 'publish: aba oculta', true, 'pending')`, [lisandra]);
  const clockContext = await browser.newContext({ viewport: { width: 1360, height: 900 }, storageState: await context.storageState() });
  await clockContext.clock.install({ time: new Date(Date.now() - 2000) });
  const tab = await clockContext.newPage();
  await tab.goto(`${site}/admin`);
  const tabPanel = tab.getByRole('region', { name: 'Status do site' });
  await tabPanel.getByText('Atualizando site…').waitFor();
  await clockContext.clock.pauseAt(new Date(Date.now() + 1000));
  let checks = 0;
  tab.on('request', (r) => {
    if (r.url().includes('/rest/v1/site_builds')) checks++;
  });
  const visibility = (hidden: boolean) =>
    tab.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: h });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: h ? 'hidden' : 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await visibility(true);
  // The build ends and goes live while the tab is hidden; three polling rounds pass.
  await stack.db.query('select public.finish_site_builds(now(), true)');
  await build();
  await clockContext.clock.runFor(35_000);
  await tab.waitForTimeout(500);
  assert.equal(checks, 0, 'a hidden tab is not polled');
  await tabPanel.getByText('Atualizando site…').waitFor();
  const back = Date.now();
  await visibility(false);
  await tabPanel.getByText(/já mostra o conteúdo publicado mais recente/).waitFor({ timeout: 5000 });
  const took = Date.now() - back;
  assert.equal(checks, 1, 'one check on return');
  await clockContext.close();
  ok(`back to a hidden tab: the status refreshes at once (${took} ms, polling paused), and nothing is polled while it is hidden`);

  // 9. Session: token reuse after sign-out is rejected by the API.
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('velmont-admin') || '{}').access_token as string);
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByRole('heading', { name: 'Entrar' }).waitFor();
  const reuse = await fetch(`${site}/api/admin/rebuild`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' });
  assert.ok([401, 403].includes(reuse.status), `reuse after logout -> ${reuse.status}`);
  ok('access token is rejected by the admin API after sign-out');

  // 10. Returning login asks for the TOTP code; then the owner.
  await page.fill('#email', 'lisandra@velmont.test');
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.getByRole('heading', { name: 'Verificação em duas etapas' }).waitFor();
  await page.fill('#code', '000000');
  await page.click('button[type=submit]');
  await page.getByText(/Código inválido|Muitas tentativas/).waitFor();
  await page.fill('#code', totp(secret));
  await page.click('button[type=submit]');
  await page.getByRole('button', { name: 'Sair' }).waitFor();
  await page.getByRole('button', { name: 'Sair' }).click();
  ok('returning login requires the current TOTP code; a wrong code is refused');
  await page.fill('#email', 'owner@velmont.test');
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await enroll();
  await page.getByRole('link', { name: 'Equipe' }).click();
  await page.getByRole('heading', { name: 'Equipe' }).waitFor();
  await page.getByText(/publicou “/).first().waitFor();
  ok('owner sees team management and the activity log');

  // 10b. Team access without e-mail links: temporary password -> MFA -> personal password.
  await page.getByRole('button', { name: 'Criar acesso' }).click();
  await page.fill('#member-name', 'Nova Pessoa');
  await page.fill('#member-email', 'Nova@Velmont.test');
  await page.getByRole('dialog').getByRole('button', { name: 'Criar acesso' }).click();
  const temporary = (await page.locator('#temporary-password').textContent())!.trim();
  assert.match(temporary, /^[A-HJ-NP-Za-km-z2-9]{5}(-[A-HJ-NP-Za-km-z2-9]{5}){3}$/);
  await page.screenshot({ path: path.join(shots, 'admin-temporary-password.png') });
  const issuedRow = (await stack.db.query(`select user_id, must_change_password, temporary_password_expires_at > now() + interval '47 hours' as fresh from public.admin_users where email = 'nova@velmont.test'`)).rows[0];
  assert.equal(issuedRow.must_change_password, true);
  assert.equal(issuedRow.fresh, true);
  const newbieId = issuedRow.user_id as string;
  assert.equal((await stack.db.query(`select count(*)::int as n from public.audit_log where metadata::text like $1`, [`%${temporary}%`])).rows[0].n, 0, 'never in the audit log');
  assert.equal((await stack.db.query(`select count(*)::int as n from auth.users where id = $1 and banned_until > now()`, [newbieId])).rows[0].n, 0, 'ban lifted');
  await page.getByRole('dialog').getByRole('button', { name: 'Concluir' }).click();
  // The status is rendered twice (table column and, on small screens, under the name): the visible one.
  await page.getByText('Aguardando primeiro acesso').filter({ visible: true }).first().waitFor();

  const second = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const newbie = await second.newPage();
  newbie.on('console', (msg) => {
    if (/Content Security Policy|Refused to/.test(msg.text())) cspErrors.push(`${newbie.url()}: ${msg.text()}`);
  });
  const signIn = async (password: string) => {
    await newbie.goto(`${site}/admin`);
    await newbie.evaluate(() => localStorage.clear());
    await newbie.reload();
    await newbie.getByRole('heading', { name: 'Entrar' }).waitFor();
    await newbie.fill('#email', 'nova@velmont.test');
    await newbie.fill('#password', password);
    await newbie.click('button[type=submit]');
  };
  await signIn(temporary);
  const newbieSecret = await enroll(newbie);
  await newbie.getByRole('heading', { name: 'Crie sua senha' }).waitFor();
  const lockedToken = await tokenOf(newbie);
  assert.deepEqual(await leadsWith(lockedToken), [], 'MFA verified, temporary password: nothing readable');
  const lockedApi = await fetch(`${site}/api/admin/rebuild`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${lockedToken}`, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(lockedApi.status, 403);
  await newbie.fill('#temporary-password-current', 'Errada-errad-errad-12345');
  await newbie.fill('#new-password', 'minha-senha-pessoal-2026');
  await newbie.fill('#new-password-confirm', 'minha-senha-pessoal-2026');
  await newbie.click('button[type=submit]');
  await newbie.getByText('A senha temporária não confere').waitFor();
  await newbie.screenshot({ path: path.join(shots, 'admin-first-access.png') });
  assert.equal((await stack.db.query('select must_change_password from public.admin_users where user_id = $1', [newbieId])).rows[0].must_change_password, true);
  await newbie.fill('#temporary-password-current', temporary);
  await newbie.fill('#new-password', temporary);
  await newbie.fill('#new-password-confirm', temporary);
  await newbie.click('button[type=submit]');
  await newbie.getByText('diferente da senha temporária').waitFor();
  await newbie.fill('#new-password', 'minha-senha-pessoal-2026');
  await newbie.fill('#new-password-confirm', 'minha-senha-pessoal-2026');
  await newbie.click('button[type=submit]');
  // Setting the password ended every session: the browser signs in again with it and asks for the code.
  await newbie.getByRole('heading', { name: 'Verificação em duas etapas' }).waitFor();
  await newbie.getByText('Senha criada.').waitFor();
  await newbie.screenshot({ path: path.join(shots, 'admin-first-access-sign-in-again.png') });
  assert.deepEqual(await leadsWith(lockedToken), [], 'the session of the first access was ended');
  await newbie.fill('#code', totp(newbieSecret));
  await newbie.click('button[type=submit]');
  await newbie.getByRole('heading', { name: /Olá, Nova/ }).waitFor();
  assert.equal((await stack.db.query('select must_change_password from public.admin_users where user_id = $1', [newbieId])).rows[0].must_change_password, false);
  assert.deepEqual((await stack.db.query(`select actor_id from public.audit_log where action = 'auth.password_set' and resource_id = $1`, [newbieId])).rows, [{ actor_id: newbieId }]);
  assert.deepEqual((await stack.db.query(`select metadata from public.audit_log where action = 'auth.first_access_denied' and resource_id = $1`, [newbieId])).rows, [{ metadata: { reason: 'wrong_temporary_password' } }]);
  assert.ok((await leadsWith(await tokenOf(newbie))).length >= 1, 'reads leads once unlocked');
  const signedIn = await fetch(`${stack.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: stack.anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nova@velmont.test', password: 'minha-senha-pessoal-2026' }) });
  assert.equal(signedIn.status, 200, 'the personal password is the account password now');
  ok('first access: MFA, then the temporary password and a personal one (checked by the server), then a new sign-in with both; nothing is readable before that');

  // A new temporary password from an owner: sessions end, the authenticator and the old password stop working.
  const liveToken = await tokenOf(newbie);
  await page.reload();
  await page.getByRole('button', { name: 'Ações para Nova Pessoa' }).click();
  await page.getByRole('menuitem', { name: 'Gerar nova senha temporária' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Gerar senha' }).click();
  const again = (await page.locator('#temporary-password').textContent())!.trim();
  assert.notEqual(again, temporary);
  await page.getByRole('dialog').getByRole('button', { name: 'Concluir' }).click();
  assert.deepEqual(await leadsWith(liveToken), [], 'the open session reads nothing');
  assert.equal((await stack.db.query('select count(*)::int as n from auth.mfa_factors where user_id = $1', [newbieId])).rows[0].n, 0, 'authenticator removed');
  await newbie.reload();
  await newbie.getByRole('heading', { name: 'Entrar' }).waitFor({ timeout: 15000 });
  await signIn('minha-senha-pessoal-2026');
  await newbie.getByText('E-mail ou senha incorretos.').waitFor();
  await page.getByRole('button', { name: 'Ações para Responsável' }).click();
  assert.equal(await page.getByRole('menuitem', { name: 'Gerar nova senha temporária' }).count(), 0, 'never for yourself');
  await page.keyboard.press('Escape');
  ok('a new temporary password ends every session, removes the authenticator and the old password (never offered for yourself)');

  // Expired: refused before any MFA setup, and changing the password in Supabase Auth unlocks nothing.
  await stack.db.query(`update public.admin_users set temporary_password_expires_at = now() - interval '1 minute' where user_id = $1`, [newbieId]);
  await signIn(again);
  await newbie.getByRole('heading', { name: 'Senha temporária expirada' }).waitFor();
  const direct = await fetch(`${stack.url}/auth/v1/user`, { method: 'PUT', headers: { apikey: stack.anonKey, authorization: `Bearer ${await tokenOf(newbie)}`, 'content-type': 'application/json' }, body: JSON.stringify({ password: 'outra-senha-pessoal-2026' }) });
  assert.equal(direct.status, 200);
  assert.equal((await stack.db.query('select must_change_password from public.admin_users where user_id = $1', [newbieId])).rows[0].must_change_password, true);
  await second.close();
  ok('an expired temporary password unlocks nothing, not even by changing it directly in Supabase Auth');

  // 10c. Attacks on the first access, against real Supabase Auth (V-01, H-03, B-02, B-05).
  const ownerToken = await tokenOf(page);
  const auth = (p: string, body: unknown, token?: string, key = stack.anonKey) =>
    fetch(`${stack.url}/auth/v1${p}`, { method: p === '/user' ? 'PUT' : 'POST', headers: { apikey: key, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
      .then(async (r) => ({ status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, unknown> & { access_token?: string } }));
  const adminPost = (p: string, token: string, body: unknown) =>
    fetch(`${site}${p}`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const grantAccess = async (email: string, name: string, role: 'owner' | 'editor') => {
    const r = await adminPost('/api/admin/staff', ownerToken, { action: 'create', email, name, role });
    assert.equal(r.status, 201, `create ${email}`);
    return (await r.json()) as { user_id: string; password: string };
  };
  const passwordToken = async (email: string, password: string) => (await auth('/token?grant_type=password', { email, password })).body.access_token!;
  const enrollTotp = async (token: string) => {
    const factor = (await auth('/factors', { factor_type: 'totp' }, token)).body as { id: string; totp: { secret: string } };
    const challenge = (await auth(`/factors/${factor.id}/challenge`, {}, token)).body as { id: string };
    return (await auth(`/factors/${factor.id}/verify`, { challenge_id: challenge.id, code: totp(factor.totp.secret) }, token)).body.access_token!;
  };
  const locked = async (userId: string) => (await stack.db.query('select must_change_password from public.admin_users where user_id = $1', [userId])).rows[0].must_change_password as boolean;

  // An attacker controls the person's inbox: recovery link → new password → own authenticator.
  const target = await grantAccess('alvo@velmont.test', 'Alvo Responsável', 'owner');
  const link = await auth('/admin/generate_link', { type: 'recovery', email: 'alvo@velmont.test' }, stack.serviceKey, stack.serviceKey);
  const recovery = await auth('/verify', { type: 'recovery', token_hash: link.body.hashed_token });
  assert.equal(recovery.status, 200, 'the recovery link gives a session (as it did before)');
  assert.equal((await auth('/user', { password: 'senha-do-atacante-2026' }, recovery.body.access_token)).status, 200, 'no authenticator yet: Auth lets the password change');
  assert.equal(await locked(target.user_id), true, 'V-01: the password change does not unlock the account');
  const attackerAal2 = await enrollTotp(recovery.body.access_token!);
  assert.ok(attackerAal2, 'the attacker reached aal2 with their own authenticator');
  assert.deepEqual(await leadsWith(attackerAal2), [], 'still reads nothing');
  assert.equal((await adminPost('/api/admin/staff', attackerAal2, { action: 'reset', user_id: owner })).status, 403, 'cannot take over other accounts');
  for (const guess of ['senha-do-atacante-2026', 'Abcde-fghij-kmn23-45678']) {
    const attempt = await adminPost('/api/admin/first-access', attackerAal2, { temporary_password: guess, new_password: 'outra-senha-do-atacante' });
    assert.equal(attempt.status, 403);
    assert.deepEqual(await attempt.json(), { error: 'wrong_temporary_password' });
  }
  assert.equal(await locked(target.user_id), true);
  ok('recovery e-mail + updateUser + the attacker’s own MFA: the account stays locked; only the temporary password completes the first access (V-01)');

  // Without MFA: the step is refused, and a direct password change unlocks nothing.
  const noMfa = await grantAccess('sem-mfa@velmont.test', 'Sem MFA', 'editor');
  const aal1 = await passwordToken('sem-mfa@velmont.test', noMfa.password);
  const refusedAal1 = await adminPost('/api/admin/first-access', aal1, { temporary_password: noMfa.password, new_password: 'b-senha-pessoal-2026' });
  assert.equal(refusedAal1.status, 403);
  assert.deepEqual(await refusedAal1.json(), { error: 'mfa_required' });
  assert.equal((await auth('/user', { password: 'b-direta-senha-2026' }, aal1)).status, 200);
  assert.equal(await locked(noMfa.user_id), true);
  assert.deepEqual(await leadsWith(aal1), []);
  ok('without MFA the first access cannot be completed, and a direct password change unlocks nothing (H-03)');

  // A first access racing with a new temporary password from an owner ends locked.
  const racer = await grantAccess('corrida@velmont.test', 'Corrida', 'editor');
  const racerAal2 = await enrollTotp(await passwordToken('corrida@velmont.test', racer.password));
  const [finish, reissue] = await Promise.all([
    adminPost('/api/admin/first-access', racerAal2, { temporary_password: racer.password, new_password: 'corrida-senha-pessoal-2026' }),
    adminPost('/api/admin/staff', ownerToken, { action: 'reset', user_id: racer.user_id }),
  ]);
  assert.equal(reissue.status, 200);
  assert.ok([200, 403, 409].includes(finish.status), `first access -> ${finish.status}`);
  assert.equal(await locked(racer.user_id), true, 'final state: locked');
  assert.deepEqual(await leadsWith(racerAal2), []);
  ok('a first access racing with a new temporary password always ends locked (B-02)');

  // The Auth update fails after the authenticator was removed: that temporary password is void.
  const { passwordDigest } = await import('../../server/staff');
  const service = (fn: string, args: Record<string, unknown>) =>
    fetch(`${stack.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: stack.serviceKey, authorization: `Bearer ${stack.serviceKey}`, 'content-type': 'application/json' }, body: JSON.stringify(args) }).then((r) => r.status);
  const lost = 'Perdi-daaaa-seeee-nhaaa';
  assert.equal(await service('staff_issue_temporary_access', { p_actor: owner, p_user_id: noMfa.user_id, p_hours: 48, p_digest: await passwordDigest(lost) }), 200);
  assert.equal(await service('staff_temporary_password_failed', { p_user_id: noMfa.user_id }), 204);
  const oldPasswordAal2 = await enrollTotp(await passwordToken('sem-mfa@velmont.test', 'b-direta-senha-2026'));
  const afterFailure = await adminPost('/api/admin/first-access', oldPasswordAal2, { temporary_password: lost, new_password: 'b-senha-pessoal-2026' });
  assert.equal(afterFailure.status, 403);
  assert.deepEqual(await afterFailure.json(), { error: 'expired' });
  assert.equal(await locked(noMfa.user_id), true);
  assert.deepEqual(await leadsWith(oldPasswordAal2), []);
  ok('if the Auth update fails after the authenticator is removed, the account stays inaccessible until a new, complete issue (B-05)');

  // 11. Responsive checks.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const m = await mobile.newPage();
  await m.goto(`${site}/blog/marca-e-nome-empresarial-qual-a-diferenca`);
  await m.screenshot({ path: path.join(shots, 'blog-article-mobile.png'), fullPage: true });
  assert.ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll on article');
  await m.goto(`${site}/admin`);
  await m.screenshot({ path: path.join(shots, 'admin-login-mobile.png') });
  assert.ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll on admin');
  ok('public article and admin fit a 390px screen without horizontal scroll');
  await browser.close();

  assert.deepEqual(cspErrors, [], cspErrors.join('\n'));
  ok('no Content-Security-Policy violations on public, admin or preview pages');
  console.log(`\nPASS: ${results.length} end-to-end checks.`);
} catch (error) {
  console.error(serverLog.join('').slice(-3000));
  throw error;
} finally {
  server?.kill();
  await stack.stop();
}
