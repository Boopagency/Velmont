import { serverEnv } from '../server/env.js';
import { anonClient } from '../server/supabase.js';

// Reached only when /blog/<slug> has no static page. Renamed articles get a
// permanent redirect to their current URL; anything else gets the site's 404.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function notFound(request: Request) {
  let body = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Página não encontrada | Velmont</title><meta name="robots" content="noindex"><p>Esta página não foi encontrada. <a href="/">Voltar para o início</a></p></html>';
  try {
    const page = await fetch(new URL('/404', request.url), { signal: AbortSignal.timeout(2000), redirect: 'manual' });
    const html = await page.text();
    if (html.startsWith('<!doctype html>') && html.includes('Página não encontrada')) body = html;
  } catch {
    // Keep the minimal page.
  }
  return new Response(body, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60', 'x-content-type-options': 'nosniff' } });
}

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug') || '';
  const env = serverEnv();
  if (!SLUG.test(slug) || slug.length > 120 || !env.supabaseUrl || !env.supabaseAnonKey) return notFound(request);
  const { data, error } = await anonClient(env).rpc('resolve_slug_redirect', { p_slug: slug });
  if (error || typeof data !== 'string' || !SLUG.test(data)) return notFound(request);
  return new Response(null, { status: 301, headers: { location: `/blog/${data}`, 'cache-control': 'public, max-age=300, s-maxage=3600' } });
}
