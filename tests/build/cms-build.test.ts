import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { promisify } from 'node:util';

// Builds the site against a fake CMS endpoint and inspects the static output.
const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, '.static-build/test-dist');
const image = { path: '0f8fad5b-d9cb-469f-a165-70867728950e.webp', width: 1600, height: 900, alt: 'Pessoa assinando um contrato' };
const row = (over: Record<string, unknown>) => ({
  slug: 'artigo',
  title: 'Título',
  excerpt: 'Resumo do artigo com contexto suficiente.',
  content: { version: 1, blocks: [{ type: 'heading', level: 2, text: 'Seção' }, { type: 'paragraph', text: 'Parágrafo.' }] },
  category: 'MARCAS',
  tags: [],
  author_key: 'velmont',
  sources: [],
  featured_image: null,
  seo_title: null,
  seo_description: null,
  canonical_url: null,
  og_title: null,
  og_description: null,
  og_image: null,
  robots_index: true,
  reading_minutes: null,
  published_at: null,
  modified_at: null,
  created_at: '2026-09-06T12:00:00Z',
  ...over,
});
const rows = [
  row({
    slug: 'marca-e-dominio',
    title: 'Marca e domínio: qual a diferença?',
    author_key: 'lisandra',
    featured_image: image,
    published_at: '2026-10-01T12:00:00Z',
    modified_at: '2026-10-05T09:30:00Z',
    content: {
      version: 1,
      blocks: [
        { type: 'callout', title: 'Em resumo', text: 'Domínio não é marca.' },
        { type: 'heading', level: 2, text: 'O que é <b>marca</b>' },
        { type: 'paragraph', text: '<script>alert("x")</script> [perigo](javascript:alert(1)) e [INPI](https://www.gov.br/inpi).' },
        { type: 'faq', question: 'Registro é garantido?', answer: 'Não.' },
      ],
    },
  }),
  row({ slug: 'rascunho-interno', title: 'Nota interna', robots_index: false, published_at: '2026-09-20T12:00:00Z' }),
  row({ slug: 'republicado', title: 'Republicado', canonical_url: 'https://outro.example/original', published_at: '2026-09-10T12:00:00Z' }),
];

let server: http.Server;
let requests: { url: string; apikey: string | undefined }[] = [];
let failing = false;

before(async () => {
  server = http.createServer((req, res) => {
    requests.push({ url: req.url || '', apikey: req.headers.apikey as string | undefined });
    if (failing) {
      res.writeHead(500).end('{}');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(rows));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
});
after(() => {
  server.close();
  fs.rmSync(out, { recursive: true, force: true });
});

const build = (extra: Record<string, string> = {}) => {
  const port = (server.address() as { port: number }).port;
  return run(process.execPath, ['scripts/build-static.mjs'], {
    cwd: root,
    env: { ...process.env, VERCEL: '', VELMONT_OUTPUT: '.static-build/test-dist', NEXT_PUBLIC_SITE_URL: 'https://www.velmont.test', NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-test-key', ...extra },
  });
};
const read = (file: string) => fs.readFileSync(path.join(out, file), 'utf8');

describe('static build from the CMS', () => {
  test('reads only the published snapshot table with the public key', async () => {
    requests = [];
    await build();
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /^\/rest\/v1\/published_articles\?select=/);
    assert.equal(requests[0].apikey, 'anon-test-key');
  });

  test('renders articles as HTML with escaped content and safe links', () => {
    const html = read('blog/marca-e-dominio/index.html');
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.ok(!html.includes('<script>alert'));
    assert.ok(!html.includes('<b>marca</b>'));
    assert.ok(!/href="javascript:/i.test(html));
    assert.match(html, /<a href="https:\/\/www.gov.br\/inpi" target="_blank" rel="noopener noreferrer">INPI<\/a>/);
    assert.match(html, /Por <a href="\/#fundadoras" rel="author">Lisandra Ferreira dos Santos<\/a>/);
    assert.match(html, /class="article-callout"/);
    assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www.velmont.test\/blog\/marca-e-dominio">/);
    assert.match(html, /<meta property="article:modified_time" content="2026-10-05T09:30:00Z">/);
  });

  test('JSON-LD matches the visible article', () => {
    const html = read('blog/marca-e-dominio/index.html');
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/)![1])['@graph'];
    const post = graph.find((n: { '@type': string }) => n['@type'] === 'BlogPosting');
    assert.equal(post.headline, 'Marca e domínio: qual a diferença?');
    assert.deepEqual(post.author, { '@id': 'https://www.velmont.test/#lisandra' });
    assert.equal(post.datePublished, '2026-10-01T12:00:00Z');
    assert.equal(post.dateModified, '2026-10-05T09:30:00Z');
    assert.match(post.image[0], /storage\/v1\/object\/public\/media\/0f8fad5b/);
    assert.ok(graph.some((n: { '@type': string }) => n['@type'] === 'BreadcrumbList'));
    assert.ok(!html.includes('aggregateRating'));
  });

  test('embedded page data cannot break out of its script tag', () => {
    const html = read('blog/marca-e-dominio/index.html');
    const data = html.match(/<script type="application\/json" id="vm-data">(.+?)<\/script>/)![1];
    assert.ok(!data.includes('<'));
    assert.equal(JSON.parse(data).post.slug, 'marca-e-dominio');
  });

  test('sitemap lists only indexable, self-canonical pages with lastmod', () => {
    const sitemap = read('sitemap.xml');
    assert.match(sitemap, /<loc>https:\/\/www.velmont.test\/blog\/marca-e-dominio<\/loc><lastmod>2026-10-05T09:30:00.000Z<\/lastmod>/);
    assert.ok(!sitemap.includes('rascunho-interno'));
    assert.ok(!sitemap.includes('republicado'));
    assert.ok(!sitemap.includes('/admin'));
    assert.match(read('blog/rascunho-interno/index.html'), /<meta name="robots" content="noindex,follow">/);
    assert.match(read('blog/republicado/index.html'), /<link rel="canonical" href="https:\/\/outro.example\/original">/);
  });

  test('robots allows search and AI search crawlers', () => {
    const robots = read('robots.txt');
    assert.match(robots, /User-agent: \*\nAllow: \//);
    assert.ok(!/OAI-SearchBot|Googlebot/.test(robots), 'no crawler-specific blocks');
    assert.match(robots, /Sitemap: https:\/\/www.velmont.test\/sitemap.xml/);
  });

  test('refuses to deploy an empty blog when the CMS fails', async () => {
    failing = true;
    await assert.rejects(build(), /CMS request failed/);
    failing = false;
  });

  test('refuses a service_role key in the public variable', async () => {
    const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    await assert.rejects(build({ NEXT_PUBLIC_SUPABASE_ANON_KEY: `x.${payload}.y` }), /service_role/);
  });
});
