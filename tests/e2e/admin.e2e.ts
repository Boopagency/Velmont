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
  await page.getByRole('dialog').getByText('Empresa Teste').first().waitFor();
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

  await page.locator('.media-card img').nth(1).waitFor();
  const thumbs = await page.locator('.media-card img').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src));
  assert.ok(thumbs.every((src) => src.includes('/storage/v1/object/sign/media-private/') && src.includes('token=')), thumbs.join('\n'));
  assert.ok(await page.locator('.media-card img').first().evaluate((img) => (img as HTMLImageElement).naturalWidth > 0), 'signed thumbnail loads');
  const [first] = (await stack.db.query('select path from public.media order by created_at limit 1')).rows as { path: string }[];
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
  await page.getByText('Aguardando primeiro acesso').waitFor();

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
  await enroll(newbie);
  await newbie.getByRole('heading', { name: 'Crie sua senha' }).waitFor();
  const lockedToken = await tokenOf(newbie);
  assert.deepEqual(await leadsWith(lockedToken), [], 'MFA verified, temporary password: nothing readable');
  const lockedApi = await fetch(`${site}/api/admin/rebuild`, { method: 'POST', headers: { origin: site, authorization: `Bearer ${lockedToken}`, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(lockedApi.status, 403);
  await newbie.fill('#new-password', temporary);
  await newbie.fill('#new-password-confirm', temporary);
  await newbie.click('button[type=submit]');
  await newbie.getByText('diferente da senha temporária').waitFor();
  await newbie.fill('#new-password', 'minha-senha-pessoal-2026');
  await newbie.fill('#new-password-confirm', 'minha-senha-pessoal-2026');
  await newbie.click('button[type=submit]');
  await newbie.getByRole('heading', { name: /Olá, Nova/ }).waitFor();
  assert.equal((await stack.db.query('select must_change_password from public.admin_users where user_id = $1', [newbieId])).rows[0].must_change_password, false);
  assert.deepEqual((await stack.db.query(`select actor_id from public.audit_log where action = 'auth.password_set' and resource_id = $1`, [newbieId])).rows, [{ actor_id: newbieId }]);
  assert.ok((await leadsWith(await tokenOf(newbie))).length >= 1, "reads leads once unlocked");
  ok('first access with a temporary password: MFA first, then a personal password; nothing is readable before that');

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
