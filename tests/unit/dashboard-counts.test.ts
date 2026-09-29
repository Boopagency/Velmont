import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

// The dashboard counts with HEAD + Prefer: count=exact (admin/pages/dashboard.tsx).
// supabase-js repeats a 503 (or 520) on GET/HEAD by itself, with an
// X-Retry-Count header: a transient 503 in the Network panel is followed by
// that retry, and the number shown is still right. A count that never
// arrives is null, shown as "—".

type Call = { method: string; url: string; prefer: string | null; retry: string | null };

function client(answers: (() => Response)[]) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ method: init?.method || 'GET', url, prefer: headers.get('prefer'), retry: headers.get('x-retry-count') });
    // The last answer repeats.
    return (answers.length > 1 ? answers.shift()! : answers[0])();
  };
  const supabase = createClient('https://project.supabase.co', 'anon', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { supabase, calls };
}
const ok = (total: number) => () => new Response(null, { status: 200, headers: { 'content-range': total ? `0-${total - 1}/${total}` : '*/0' } });
const unavailable = () => new Response(null, { status: 503, headers: { 'retry-after': '0' } });

describe('dashboard counts (HEAD, count=exact)', () => {
  test('the request is a HEAD with Prefer: count=exact, and the total comes from Content-Range', async () => {
    const { supabase, calls } = client([ok(3)]);
    const { count, error } = await supabase.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published');
    assert.equal(error, null);
    assert.equal(count, 3);
    assert.deepEqual(calls, [{ method: 'HEAD', url: 'https://project.supabase.co/rest/v1/articles?select=id&status=eq.published', prefer: 'count=exact', retry: null }]);
  });

  test('a 503 is retried by supabase-js (X-Retry-Count: 1), so the number shown is still right', async () => {
    const { supabase, calls } = client([unavailable, ok(2)]);
    const { count, error } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new');
    assert.equal(error, null);
    assert.equal(count, 2);
    assert.deepEqual(calls.map((c) => [c.method, c.retry]), [['HEAD', null], ['HEAD', '1']]);
  });

  test('a count that never arrives (503 on every attempt) is null, never 0', async () => {
    const { supabase, calls } = client([unavailable]);
    const { count, error } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new');
    assert.equal(count, null);
    assert.ok(error);
    assert.equal(calls.length, 4, 'the first attempt and three retries');
  });
});
