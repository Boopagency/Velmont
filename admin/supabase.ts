import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/public-env';

// Browser client with the public (anon) key only. Every read and write is
// authorized by Row Level Security in the database.
export const configured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);

export const supabase = createClient(publicEnv.supabaseUrl || 'https://not-configured.invalid', publicEnv.supabaseAnonKey || 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'velmont-admin' },
});

/** Calls a Vercel Function with the current access token. */
export async function adminApi(path: '/api/admin/media' | '/api/admin/rebuild' | '/api/admin/publish', init: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente.');
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, body };
}

export async function requestSiteUpdate(reason: string) {
  try {
    const result = await adminApi('/api/admin/rebuild', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) });
    return result.ok;
  } catch {
    return false;
  }
}

/** Friendly Portuguese messages for database errors; never shows raw SQL. */
export function explain(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return '';
  const map: Record<string, string> = {
    '42501': 'Você não tem permissão para esta ação.',
    '40001': 'Este artigo foi alterado por outra pessoa. Recarregue para ver a versão mais recente.',
    '23505': 'Este endereço (slug) já está em uso por outro artigo.',
    '23514': 'Algum campo está fora do formato permitido.',
    P0002: 'Registro não encontrado.',
  };
  if (error.code && map[error.code]) return map[error.code];
  if (error.message === 'incomplete') return 'Preencha título, resumo e conteúdo antes de publicar.';
  if (error.message === 'slug_in_use') return map['23505'];
  return 'Não foi possível concluir. Tente novamente.';
}
