import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

// Local Supabase-compatible stack for end-to-end tests, without Docker:
// real PostgreSQL + real Supabase Auth (GoTrue) + real PostgREST, a tiny
// gateway in place of Kong and an in-memory stand-in for Storage.
// Binaries: GOTRUE_BIN (github.com/supabase/auth releases) and POSTGREST_BIN.

const root = path.resolve(import.meta.dirname, '../..');
const pgBin = process.env.PG_BIN || '/usr/lib/postgresql/16/bin';
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
export const signJwt = (payload: Record<string, unknown>, secret: string) => {
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
};
const freePort = () => new Promise<number>((resolve) => {
  const s = http.createServer().listen(0, '127.0.0.1', () => {
    const { port } = s.address() as { port: number };
    s.close(() => resolve(port));
  });
});
const waitFor = async (check: () => Promise<boolean>, label: string) => {
  for (let i = 0; i < 150; i++) {
    if (await check().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timeout waiting for ${label}`);
};
const asPostgres = (cmd: string[]) => (process.getuid?.() === 0 ? ['su', ['postgres', '-c', cmd.map((a) => `'${a}'`).join(' ')]] as const : [cmd[0], cmd.slice(1)] as const);

export type Stack = { url: string; anonKey: string; serviceKey: string; db: pg.Pool; storage: Map<string, { type: string; body: Buffer }>; createUser: (email: string, password: string) => Promise<string>; stop: () => Promise<void> };

export async function startStack(): Promise<Stack> {
  const gotrue = process.env.GOTRUE_BIN;
  const postgrest = process.env.POSTGREST_BIN;
  if (!gotrue || !postgrest) throw new Error('Set GOTRUE_BIN and POSTGREST_BIN to run the end-to-end tests.');
  const secret = randomBytes(32).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const anonKey = signJwt({ role: 'anon', iss: 'supabase', iat: now, exp: now + 86400 }, secret);
  const serviceKey = signJwt({ role: 'service_role', iss: 'supabase', iat: now, exp: now + 86400 }, secret);
  const children: ChildProcess[] = [];

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velmont-e2e-'));
  fs.chmodSync(dir, 0o777);
  const pgPort = await freePort();
  const [initCmd, initArgs] = asPostgres([path.join(pgBin, 'initdb'), '-D', path.join(dir, 'data'), '-A', 'trust', '-U', 'postgres']);
  execFileSync(initCmd, initArgs, { stdio: 'ignore' });
  const [pgCmd, pgArgs] = asPostgres([path.join(pgBin, 'postgres'), '-D', path.join(dir, 'data'), '-p', String(pgPort), '-k', dir, '-c', 'listen_addresses=127.0.0.1', '-c', 'fsync=off']);
  children.push(spawn(pgCmd, pgArgs, { stdio: 'ignore' }));
  const admin = new pg.Pool({ connectionString: `postgresql://postgres@127.0.0.1:${pgPort}/postgres`, max: 3 });
  await waitFor(async () => (await admin.query('select 1')).rowCount === 1, 'postgres');
  await admin.query(`
    create role anon nologin noinherit;
    create role authenticated nologin noinherit;
    create role service_role nologin noinherit bypassrls;
    create role authenticator login noinherit password 'authenticator';
    grant anon, authenticated, service_role to authenticator;
    create role supabase_auth_admin login createrole noinherit password 'auth';
    create schema auth authorization supabase_auth_admin;
    grant create on database postgres to supabase_auth_admin;
    alter role supabase_auth_admin set search_path = auth;`);

  const authPort = await freePort();
  const authEnv = {
    ...process.env,
    GOTRUE_DB_DRIVER: 'postgres', DATABASE_URL: `postgres://supabase_auth_admin:auth@127.0.0.1:${pgPort}/postgres`, GOTRUE_DB_NAMESPACE: 'auth',
    API_EXTERNAL_URL: 'http://127.0.0.1', GOTRUE_API_HOST: '127.0.0.1', PORT: String(authPort), GOTRUE_SITE_URL: 'http://127.0.0.1:3000', GOTRUE_URI_ALLOW_LIST: 'http://127.0.0.1:3000/**',
    GOTRUE_JWT_SECRET: secret, GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_EXP: '3600',
    GOTRUE_DISABLE_SIGNUP: 'true', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true', GOTRUE_PASSWORD_MIN_LENGTH: '12',
    GOTRUE_MFA_TOTP_ENROLL_ENABLED: 'true', GOTRUE_MFA_TOTP_VERIFY_ENABLED: 'true', GOTRUE_MFA_MAX_ENROLLED_FACTORS: '10', GOTRUE_LOG_LEVEL: 'error',
  };
  execFileSync(gotrue, ['migrate'], { cwd: path.dirname(gotrue), env: authEnv, stdio: 'ignore' });
  children.push(spawn(gotrue, ['serve'], { cwd: path.dirname(gotrue), env: authEnv, stdio: 'ignore' }));

  // What Supabase provisions around Auth: API role grants, storage schema, default privileges.
  const shim = fs.readFileSync(path.join(root, 'tests/db/supabase-shim.sql'), 'utf8');
  await admin.query(`
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    grant select on auth.users to service_role;
    ${shim.slice(shim.indexOf('create schema storage;'))}`);
  for (const file of fs.readdirSync(path.join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    await admin.query(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'));
  }

  const restPort = await freePort();
  children.push(spawn(postgrest, [], {
    env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:authenticator@127.0.0.1:${pgPort}/postgres`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: secret, PGRST_SERVER_PORT: String(restPort), PGRST_SERVER_HOST: '127.0.0.1', PGRST_LOG_LEVEL: 'crit' },
    stdio: 'ignore',
  }));

  const storage = new Map<string, { type: string; body: Buffer }>();
  const gatewayPort = await freePort();
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-upsert, prefer, range, accept-profile, content-profile, x-supabase-api-version', 'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD', 'access-control-expose-headers': 'content-range, x-total-count' };
  const role = (auth: string | undefined) => {
    try {
      return JSON.parse(Buffer.from((auth || '').split('.')[1] || '', 'base64url').toString()).role as string;
    } catch {
      return '';
    }
  };
  const gateway = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    const url = new URL(req.url || '/', 'http://x');
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c)).on('end', () => {
      const body = Buffer.concat(chunks);
      if (url.pathname.startsWith('/storage/v1/')) {
        const publicPath = /^\/storage\/v1\/object\/public\/media\/(.+)$/.exec(url.pathname);
        if (req.method === 'GET' && publicPath) {
          const file = storage.get(publicPath[1]);
          return file ? res.writeHead(200, { ...cors, 'content-type': file.type, 'x-content-type-options': 'nosniff' }).end(file.body) : res.writeHead(404, cors).end();
        }
        if (role(req.headers.authorization?.replace('Bearer ', '')) !== 'service_role') return res.writeHead(403, cors).end('{"error":"forbidden"}');
        const upload = /^\/storage\/v1\/object\/media\/(.+)$/.exec(url.pathname);
        if (req.method === 'POST' && upload) {
          storage.set(upload[1], { type: String(req.headers['content-type']), body });
          return res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify({ Key: `media/${upload[1]}` }));
        }
        if (req.method === 'DELETE' && url.pathname === '/storage/v1/object/media') {
          for (const p of (JSON.parse(body.toString() || '{}').prefixes || []) as string[]) storage.delete(p);
          return res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end('[]');
        }
        return res.writeHead(404, cors).end();
      }
      const target = url.pathname.startsWith('/rest/v1') ? { port: restPort, path: url.pathname.slice(8) || '/' } : url.pathname.startsWith('/auth/v1') ? { port: authPort, path: url.pathname.slice(8) || '/' } : null;
      if (!target) return res.writeHead(404, cors).end();
      const upstream = http.request({ host: '127.0.0.1', port: target.port, path: target.path + url.search, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${target.port}` } }, (up) => {
        res.writeHead(up.statusCode || 502, { ...up.headers, ...cors });
        up.pipe(res);
      });
      upstream.on('error', () => res.writeHead(502, cors).end());
      upstream.end(body);
    });
  }).listen(gatewayPort, '127.0.0.1');

  const url = `http://127.0.0.1:${gatewayPort}`;
  await waitFor(async () => (await fetch(`${url}/auth/v1/health`)).ok, 'auth');
  await waitFor(async () => (await fetch(`${url}/rest/v1/published_articles?select=slug`, { headers: { apikey: anonKey } })).ok, 'postgrest');

  const createUser = async (email: string, password: string) => {
    const r = await fetch(`${url}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true }) });
    const user = (await r.json()) as { id: string };
    if (!r.ok) throw new Error(`createUser ${r.status} ${JSON.stringify(user)}`);
    return user.id;
  };

  return {
    url, anonKey, serviceKey, db: admin, storage, createUser,
    stop: async () => {
      gateway.close();
      await admin.end();
      for (const child of children.reverse()) child.kill('SIGINT');
      await new Promise((r) => setTimeout(r, 800));
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits), used to answer the MFA challenge. */
export function totp(secret: string, at = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const hmac = createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
