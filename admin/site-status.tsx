import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlertIcon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { requestSiteUpdate, supabase } from './supabase';
import { fullDate, TimeAgo } from './ui';

// The public site is static: every publish asks Vercel for a new build
// (site_builds: pending → success | failed, reported by the production build).
// This reads that lifecycle and the live build's own timestamp.

type Build = { id: number; requested_at: string; status: 'pending' | 'success' | 'failed'; finished_at: string | null; detail: string | null };
export type SiteState = 'updated' | 'updating' | 'stalled' | 'failed';

/** A pending build with no answer after this long is shown as unconfirmed. */
const STALLED_MS = 15 * 60 * 1000;
const POLL_MS = 10000;

function derive(build: Build | null, now = Date.now()): SiteState {
  if (!build || build.status === 'success') return 'updated';
  if (build.status === 'failed') return 'failed';
  return now - new Date(build.requested_at).getTime() > STALLED_MS ? 'stalled' : 'updating';
}

/** Plain-language reason for a failed update; never shows raw server text. */
export function failureReason(detail: string | null) {
  if (!detail) return 'A atualização não foi concluída.';
  if (/not configured/i.test(detail)) return 'A atualização automática não está configurada (Deploy Hook da Vercel).';
  if (/unreachable/i.test(detail)) return 'Não foi possível contatar a Vercel.';
  if (/answered/i.test(detail)) return 'A Vercel recusou o pedido de atualização.';
  if (/build failed/i.test(detail)) return 'A geração do site falhou na Vercel.';
  return 'A atualização não foi concluída.';
}

/** Latest build request and the live build's own timestamp. */
async function fetchStatus() {
  const [builds, info] = await Promise.all([
    supabase.from('site_builds').select('id, requested_at, status, finished_at, detail').order('requested_at', { ascending: false }).limit(1),
    fetch('/build-info.json', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ builtAt?: string }>) : null))
      .catch(() => null),
  ]);
  return { build: ((builds.data as Build[] | null) || [])[0] || null, builtAt: info?.builtAt || null };
}

export function useSiteStatus() {
  const [build, setBuild] = useState<Build | null | undefined>(undefined);
  const [builtAt, setBuiltAt] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [optimistic, setOptimistic] = useState(false);
  const previous = useRef<SiteState | null>(null);

  const apply = useCallback((status: Awaited<ReturnType<typeof fetchStatus>>) => {
    setBuild(status.build);
    setBuiltAt(status.builtAt);
    setOptimistic(false);
  }, []);
  const load = useCallback(() => fetchStatus().then(apply), [apply]);

  useEffect(() => {
    void fetchStatus().then(apply);
  }, [apply]);

  const state: SiteState = optimistic ? 'updating' : derive(build ?? null);

  // While Vercel builds, check again every few seconds (only with the tab visible).
  useEffect(() => {
    if (state !== 'updating') return;
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state, load]);

  // Tell the person when an update they are watching finishes.
  useEffect(() => {
    if (build === undefined) return;
    if (previous.current === 'updating' && state === 'updated') toast.success('Site atualizado', { description: 'A versão publicada já está no ar.' });
    if (previous.current === 'updating' && state === 'failed') toast.error('Não foi possível atualizar o site', { description: failureReason(build?.detail ?? null) });
    previous.current = state;
  }, [state, build]);

  const update = useCallback(
    async (reason: string) => {
      setRequesting(true);
      const ok = await requestSiteUpdate(reason);
      setRequesting(false);
      if (ok) {
        setOptimistic(true);
        previous.current = 'updating';
        toast.success('Atualização do site solicitada', { description: 'Leva cerca de 1 a 2 minutos.' });
      } else toast.error('Não foi possível atualizar o site', { description: 'O pedido não foi aceito. Tente novamente em instantes.' });
      await load();
      if (ok) setOptimistic(false);
      return ok;
    },
    [load],
  );

  /** For flows that already asked for a build (publishing): start watching it. */
  const watch = useCallback(() => {
    previous.current = 'updating';
    void load();
  }, [load]);

  return { loading: build === undefined, build: build ?? null, builtAt, state, update, requesting, refresh: load, watch };
}

type Status = ReturnType<typeof useSiteStatus>;

const labels: Record<SiteState, string> = { updated: 'Atualizado', updating: 'Atualizando site…', stalled: 'Sem confirmação', failed: 'Falha na atualização' };

export function SiteStateIcon({ state, className }: { state: SiteState; className?: string }) {
  if (state === 'updating') return <Spinner className={cn('size-3.5 text-champagne-foreground', className)} aria-hidden="true" />;
  if (state === 'failed') return <CircleAlertIcon aria-hidden="true" className={cn('size-3.5 text-destructive', className)} />;
  if (state === 'stalled') return <CircleAlertIcon aria-hidden="true" className={cn('size-3.5 text-champagne-foreground', className)} />;
  return <span aria-hidden="true" className={cn('inline-block size-2 rounded-full bg-success ring-3 ring-success/15', className)} />;
}

/** One line: "● Atualizado · há 4 min". */
/** One line of state; `compact` uses the short labels of the dashboard metric. */
export function SiteStatusLine({ status, className, compact }: { status: Status; className?: string; compact?: boolean }) {
  const { state, build, builtAt } = status;
  const when = state === 'updated' ? build?.finished_at || builtAt : build?.requested_at || null;
  return (
    <output className={cn('inline-flex min-w-0 items-center gap-x-2 text-sm', className)}>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <SiteStateIcon state={state} />
        <span className={cn('font-medium', state === 'failed' && 'text-destructive')}>{compact && state === 'failed' ? 'Falha' : labels[state]}</span>
      </span>
      {when && !status.loading && (
        <span className="truncate text-muted-foreground">
          · <TimeAgo value={when} />
        </span>
      )}
    </output>
  );
}

/** Dashboard panel: state, when, what went wrong and the way forward. */
export function SiteStatusPanel({ status }: { status: Status }) {
  const { state, build, builtAt, loading, requesting } = status;
  const retry = state === 'failed' || state === 'stalled';
  const lastRequest = build ? { pending: 'em andamento', success: 'concluída', failed: 'não concluída' }[build.status] : null;
  return (
    <section aria-labelledby="site-status-title" className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1.5">
          <h2 id="site-status-title" className="text-[15px] font-semibold tracking-[-0.01em]">
            Status do site
          </h2>
          {loading ? <p className="text-sm text-muted-foreground">Verificando…</p> : <SiteStatusLine status={status} />}
          {!loading && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {state === 'updating' && 'A Vercel está gerando a nova versão. Leva cerca de 1 a 2 minutos; esta página acompanha sozinha.'}
              {state === 'updated' && 'O site público mostra o conteúdo publicado mais recente.'}
              {state === 'failed' && failureReason(build?.detail ?? null)}
              {state === 'stalled' && 'A atualização foi solicitada, mas a Vercel ainda não confirmou a conclusão. Tente novamente.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" href="/" target="_blank" rel="noopener noreferrer">
            Abrir site <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          </a>
          <Button variant={retry ? 'default' : 'outline'} disabled={requesting || state === 'updating'} onClick={() => void status.update(retry ? 'retry: dashboard' : 'manual: dashboard')}>
            {requesting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />}
            {requesting ? 'Solicitando…' : retry ? 'Tentar novamente' : 'Atualizar site agora'}
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-1 border-t text-[13px] sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 px-5 py-3 sm:border-r">
          <dt className="text-muted-foreground">Versão no ar gerada em</dt>
          <dd className="tabular font-medium">{builtAt ? fullDate(builtAt) : '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-5 py-3 sm:border-t-0">
          <dt className="text-muted-foreground">Última solicitação</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            {build ? (
              <>
                <TimeAgo value={build.requested_at} /> <span className="font-normal text-muted-foreground">· {lastRequest}</span>
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
