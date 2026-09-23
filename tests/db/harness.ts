import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

// Runs the real migrations on a real PostgreSQL. Uses PG_TEST_URL when set
// (CI service container); otherwise starts a throwaway local cluster.

const root = path.resolve(import.meta.dirname, '../..');
const bin = process.env.PG_BIN || '/usr/lib/postgresql/16/bin';

export type Claims = { sub: string; role: 'authenticated'; aal: 'aal1' | 'aal2'; session_id?: string };
export type Database = {
  pool: pg.Pool;
  stop: () => Promise<void>;
};

function asPostgresUser(file: string, args: string[]) {
  if (process.getuid?.() === 0) {
    const quoted = [file, ...args].map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ');
    return execFileSync('su', ['postgres', '-c', quoted], { stdio: 'pipe' });
  }
  return execFileSync(file, args, { stdio: 'pipe' });
}

async function startLocalCluster() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velmont-pg-'));
  fs.chmodSync(dir, 0o777);
  const data = path.join(dir, 'data');
  asPostgresUser(path.join(bin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'postgres']);
  const port = String(20000 + Math.floor(Math.random() * 20000));
  const args = ['-D', data, '-p', port, '-k', dir, '-c', 'listen_addresses=', '-c', 'fsync=off'];
  let child: ChildProcess;
  if (process.getuid?.() === 0) {
    const cmd = [path.join(bin, 'postgres'), ...args].map((a) => `'${a}'`).join(' ');
    child = spawn('su', ['postgres', '-c', `exec ${cmd}`], { stdio: 'ignore' });
  } else {
    child = spawn(path.join(bin, 'postgres'), args, { stdio: 'ignore' });
  }
  const url = `postgresql://postgres@localhost:${port}/postgres?host=${encodeURIComponent(dir)}`;
  for (let i = 0; i < 100; i++) {
    try {
      const client = new pg.Client({ connectionString: url });
      await client.connect();
      await client.end();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return {
    url,
    stop: async () => {
      child.kill('SIGINT');
      await new Promise((r) => child.once('exit', r));
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function startDatabase(): Promise<Database> {
  let url: string;
  let stopServer = async () => {};
  if (process.env.PG_TEST_URL) {
    const admin = new pg.Client({ connectionString: process.env.PG_TEST_URL });
    await admin.connect();
    const name = `velmont_test_${process.pid}_${Date.now()}`;
    await admin.query(`create database ${name}`);
    await admin.end();
    const parsed = new URL(process.env.PG_TEST_URL);
    parsed.pathname = `/${name}`;
    url = parsed.toString();
    stopServer = async () => {
      const cleanup = new pg.Client({ connectionString: process.env.PG_TEST_URL });
      await cleanup.connect();
      await cleanup.query(`drop database if exists ${name} with (force)`);
      await cleanup.end();
    };
  } else {
    const local = await startLocalCluster();
    url = local.url;
    stopServer = local.stop;
  }
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  const setup = await pool.connect();
  try {
    // Roles are cluster-wide; tolerate reuse of a shared CI server.
    const shim = fs.readFileSync(path.join(import.meta.dirname, 'supabase-shim.sql'), 'utf8');
    const roles = await setup.query(`select 1 from pg_roles where rolname = 'anon'`);
    await setup.query(roles.rowCount ? shim.replace(/^create role .*$/gm, '') : shim);
    const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrations) {
      await setup.query(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'));
    }
  } finally {
    setup.release();
  }
  return {
    pool,
    stop: async () => {
      await pool.end();
      await stopServer();
    },
  };
}

/** Runs `fn` inside a rolled-back transaction as a given API role. */
export async function as<T>(
  db: Database,
  role: 'anon' | 'authenticated' | 'service_role',
  claims: Claims | null,
  fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>,
  { commit = false } = {},
): Promise<T> {
  const client = await db.pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims ? JSON.stringify(claims) : '']);
    await client.query(`set local role ${role}`);
    const result = await fn((sql, params) => client.query(sql, params as unknown[]));
    await client.query(commit ? 'commit' : 'rollback');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Resolves with the Postgres error code (or 'ok'). */
export async function outcome(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return e.code || e.message || 'error';
  }
}
