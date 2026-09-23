import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { startStack, totp, type Stack } from './stack';

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

const stack: Stack = await startStack();
let server: ReturnType<typeof spawn> | null = null;
const cspErrors: string[] = [];
const serverLog: string[] = [];
try {
  const env = {
    ...process.env, VERCEL: '', VELMONT_OUTPUT: out, PORT: '3100', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100', NEXT_PUBLIC_SUPABASE_URL: stack.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
    NEXT_PUBLIC_LEAD_CAPTURE: 'true', SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey, RATE_LIMIT_SALT: 'e2e-salt-e2e-salt-e2e-salt', VERCEL_DEPLOY_HOOK_URL: '',
  };
  // Async: the gateway lives in this process and must keep answering during the build.
  const build = () => promisify(execFile)(process.execPath, ['scripts/build-static.mjs'], { cwd: root, env });
  await build();
  server = spawn(process.execPath, ['--import', 'tsx', 'scripts/dev-server.ts'], { cwd: root, env, stdio: 'pipe' });
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
  fs.mkdirSync(shots, { recursive: true });

  // 1. Public site still works and records the lead without blocking WhatsApp.
  await page.goto(`${site}/?utm_source=google&utm_campaign=marcas`);
  await page.fill('#name', 'Maria <script>alert(1)</script>');
  await page.fill('#company', 'Empresa Teste');
  const wa = page.waitForURL(/wa\.me/);
  await page.click('button.form-submit');
  await wa;
  assert.match(decodeURIComponent(page.url()), /Nome: Maria/);
  let lead = { rows: [] as { name: string; utm_source: string; landing_page: string }[] };
  for (let i = 0; i < 30 && !lead.rows.length; i++) {
    lead = await stack.db.query('select name, utm_source, landing_page from public.leads');
    await page.waitForTimeout(100);
  }
  assert.deepEqual(lead.rows[0], { name: 'Maria <script>alert(1)</script>', utm_source: 'google', landing_page: '/' });
  ok('contact form still opens WhatsApp and stores the lead with UTM attribution');

  const burst: number[] = [];
  for (let i = 0; i < 7; i++) {
    const r = await fetch(`${site}/api/leads`, { method: 'POST', headers: { origin: site, 'content-type': 'application/json' }, body: JSON.stringify({ name: `Spam ${i}`, interest: 'Marcas' }) });
    burst.push(r.status);
  }
  assert.deepEqual(burst.slice(0, 4), [201, 201, 201, 201]);
  assert.ok(burst.slice(4).every((code) => code === 429), burst.join(','));
  await stack.db.query(`delete from public.leads where name like 'Spam %'`);
  ok('excessive submissions from one client are rate limited (429) by the database-backed limiter');

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
  const api = (p: string, init: RequestInit = {}) => fetch(`${stack.url}${p}`, { ...init, headers: { apikey: stack.anonKey, 'content-type': 'application/json', ...init.headers } });
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
  const unpublished = await (await fetch(`${site}/blog/nao-existe-ainda`)).status;
  assert.equal(unpublished, 404);
  ok('attacker probes with the public key: privileged RPCs, writes, draft embedding, audit/team reads, sign-up and SQL injection all fail');

  // 3. Wrong password, then an outsider with a valid account.
  await page.goto(`${site}/admin`);
  await page.fill('#email', 'lisandra@velmont.test');
  await page.fill('#password', 'senha-errada-123456');
  await page.click('button[type=submit]');
  await page.getByText('E-mail ou senha incorretos.').waitFor();
  ok('wrong password shows a generic message');

  const enroll = async () => {
    await page.getByRole('heading', { name: 'Proteja sua conta' }).waitFor();
    await page.getByText('Não consegue escanear?').click();
    const secret = (await page.locator('.secret code').textContent())!.trim();
    await page.fill('#code', totp(secret));
    await page.click('button[type=submit]');
    return secret;
  };
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
  await page.getByRole('button', { name: 'Resumo em destaque' }).click();
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
  await page.locator('dialog').getByRole('button', { name: 'Publicar' }).click();
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

  // 7. Leads area.
  await page.goto(`${site}/admin/leads`);
  await page.getByRole('link', { name: /Maria/ }).click();
  await page.getByText('Empresa Teste').waitFor();
  assert.equal(await page.locator('script:has-text("alert(1)")').count(), 0);
  await page.selectOption('#lead-status', 'contacted');
  await page.fill('#lead-notes', 'Retornar na segunda.');
  await page.click('button:has-text("Salvar")');
  await page.getByText('Lead atualizado.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Excluir lead' }).count(), 0);
  const audit = await stack.db.query(`select action from public.audit_log where actor_id = $1 order by id`, [lisandra]);
  const actions = audit.rows.map((r) => r.action);
  for (const a of ['auth.login', 'article.create', 'article.publish', 'article.update', 'lead.update']) assert.ok(actions.includes(a), `audit ${a}`);
  ok('lead opened, status/notes updated; editor cannot delete leads; audit log records the actions');

  // 8. Media upload through the validated API.
  await page.goto(`${site}/admin/midia`);
  const png = fs.readFileSync(path.join(root, 'public/images/velmont-icon.png'));
  await page.setInputFiles('input[type=file]', { name: 'foto.png', mimeType: 'image/png', buffer: png });
  await page.locator('.toast').first().waitFor();
  assert.match((await page.locator('.toast').first().textContent()) || '', /Imagem enviada/);
  const stored = [...stack.storage.keys()];
  assert.equal(stored.length, 1);
  assert.match(stored[0], /^[0-9a-f-]{36}\.(webp|jpg)$/);
  ok('image upload is re-encoded, validated server-side and stored under a random name');

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
  await page.getByRole('heading', { name: 'Mídia' }).waitFor();
  await page.getByRole('button', { name: 'Sair' }).click();
  ok('returning login requires the current TOTP code; a wrong code is refused');
  await page.fill('#email', 'owner@velmont.test');
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await enroll();
  await page.getByRole('link', { name: 'Equipe' }).click();
  await page.getByRole('heading', { name: 'Equipe' }).waitFor();
  await page.getByText('Publicou artigo').first().waitFor();
  ok('owner sees team management and the activity log');

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
