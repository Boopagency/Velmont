import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Local stand-in for Vercel: serves dist/ with vercel.json redirects,
// rewrites, headers and clean URLs, and runs the api/ functions.
// Usage: pnpm build && node --import tsx scripts/dev-server.ts

type Rule = { source: string; destination?: string; statusCode?: number; headers?: { key: string; value: string }[] };
const root = process.cwd();
const dist = path.resolve(root, process.env.VELMONT_OUTPUT || 'dist');
const port = Number(process.env.PORT || 3000);
const config = JSON.parse(await fs.readFile(path.join(root, 'vercel.json'), 'utf8')) as { redirects: Rule[]; rewrites: Rule[]; headers: Rule[] };
// Local Supabase (http://127.0.0.1:port) replaces the hosted *.supabase.co origin in the CSP.
const localSupabase = /^http:\/\/127\.0\.0\.1:\d+$/.exec(process.env.NEXT_PUBLIC_SUPABASE_URL || '')?.[0];
if (localSupabase) for (const rule of config.headers) for (const h of rule.headers || []) h.value = h.value.replaceAll('https://*.supabase.co', localSupabase).replaceAll('wss://*.supabase.co', localSupabase.replace('http', 'ws'));
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

function compile(source: string) {
  let pattern = '';
  for (let i = 0; i < source.length; ) {
    const param = /^:(\w+)(\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\))?(\*)?/.exec(source.slice(i));
    if (param) {
      pattern += `(?<${param[1]}>${param[2] ? param[2].slice(1, -1) : param[3] ? '.*' : '[^/]+'})`;
      i += param[0].length;
    } else if (source[i] === '(') {
      let depth = 0;
      let j = i;
      for (; j < source.length; j++) {
        if (source[j] === '(') depth++;
        if (source[j] === ')' && --depth === 0) break;
      }
      pattern += source.slice(i, j + 1);
      i = j + 1;
    } else {
      pattern += source[i].replace(/[.+?^${}|[\]\\]/g, '\\$&');
      i++;
    }
  }
  return new RegExp(`^${pattern}$`);
}
const fill = (destination: string, groups: Record<string, string> = {}) => destination.replace(/:(\w+)\*?/g, (_, k) => groups[k] ?? '');

async function staticFile(pathname: string) {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
  for (const candidate of [clean, `${clean}.html`, path.posix.join(clean, 'index.html')]) {
    const file = path.resolve(dist, `.${candidate}`);
    if (!file.startsWith(dist)) return null;
    try {
      if ((await fs.stat(file)).isFile()) return file;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function runFunction(pathname: string, req: http.IncomingMessage, url: URL) {
  const file = path.join(root, `${pathname}.ts`);
  if (!/^\/api\/[a-z/-]+$/.test(pathname)) return null;
  try {
    await fs.access(file);
  } catch {
    return null;
  }
  const mod = (await import(pathToFileURL(file).href)) as Record<string, (r: Request) => Promise<Response> | Response>;
  const handler = mod[req.method || 'GET'];
  if (!handler) return new Response('Method Not Allowed', { status: 405 });
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c)).on('end', () => resolve(Buffer.concat(chunks)));
  });
  const headers = new Headers(Object.entries(req.headers).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])) as [string, string][]);
  headers.set('x-real-ip', req.socket.remoteAddress || '127.0.0.1');
  return handler(new Request(url, { method: req.method, headers, body, duplex: 'half' } as RequestInit));
}

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const original = url.pathname;
      const extra: Record<string, string> = {};
      for (const rule of config.headers) if (compile(rule.source).test(original)) for (const h of rule.headers || []) extra[h.key] = h.value;
      const send = async (response: Response) => {
        const headers = { ...extra, ...Object.fromEntries(response.headers) };
        res.writeHead(response.status, headers);
        res.end(Buffer.from(await response.arrayBuffer()));
      };
      if (original !== '/' && original.endsWith('/')) return send(new Response(null, { status: 308, headers: { location: original.replace(/\/+$/, '') + url.search } }));
      for (const rule of config.redirects) {
        const m = compile(rule.source).exec(original);
        if (m) return send(new Response(null, { status: rule.statusCode || 308, headers: { location: fill(rule.destination!, m.groups) } }));
      }
      let target = original;
      let file = await staticFile(target);
      let response = !file ? await runFunction(target, req, url) : null;
      if (!file && !response) {
        for (const rule of config.rewrites) {
          const m = compile(rule.source).exec(original);
          if (!m) continue;
          const dest = new URL(fill(rule.destination!, m.groups), url);
          target = dest.pathname;
          file = await staticFile(target);
          if (!file) response = await runFunction(target, req, new URL(`${dest.pathname}${dest.search}`, url));
          break;
        }
      }
      if (response) return send(response);
      if (file) return send(new Response(await fs.readFile(file), { headers: { 'content-type': types[path.extname(file)] || 'application/octet-stream' } }));
      return send(new Response(await fs.readFile(path.join(dist, '404.html')), { status: 404, headers: { 'content-type': types['.html'] } }));
    } catch (error) {
      console.error(error);
      res.writeHead(500).end('Internal error');
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`Velmont (Vercel emulation): http://127.0.0.1:${port}`));
