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
// This reads that lifecycle and the live build's own timestamps.

type Build = { id: number; requested_at: string; status: 'pending' | 'success' | 'failed'; finished_at: string | null; detail: string | null };
/** unconfirmed: requested, but Vercel's answer did not arrive; the build that follows settles it. */
export type SiteState = 'updated' | 'updating' | 'unconfirmed' | 'stalled' | 'failed';
/**
 * The version this browser gets from the site: when it was generated
 * (builtAt), when it began reading the content (startedAt), and whether it is
 * a preview deployment, which never shows the production version.
 */
export type LiveBuild = { builtAt: string | null; startedAt: string | null; preview?: boolean };

/** site_builds.detail of a request without Vercel's answer (server/deploy.ts writes the same marker). */
const UNCONFIRMED = 'deploy hook unconfirmed';
/** A pending build with no answer after this long is shown as unconfirmed ("Sem confirmação"). */
const STALLED_MS = 15 * 60 * 1000;
/** A request whose delivery was never confirmed gets a shorter wait before offering a retry. */
const UNCONFIRMED_MS = 5 * 60 * 1000;
const POLL_MS = 10000;

/**
 * The state of the latest request. A live version that began reading the
 * content after the request was made includes it: whatever Vercel answered
 * (or failed to answer) at the time, that update is on the site. Otherwise
 * the build decides: a real failure, or still on its way. A build reports
 * success when it ends, before Vercel deploys it and moves the domain to it
 * (about half a minute more), so success alone is still "updating"; it only
 * stands on its own where the live version cannot tell (a preview, or an
 * older version without startedAt). An unreadable build-info.json proves
 * nothing either way.
 */
export function derive(build: Build | null, live: LiveBuild = { builtAt: null, startedAt: null }, now = Date.now()): SiteState {
  if (!build) return 'updated';
  if (live.startedAt && Date.parse(live.startedAt) >= Date.parse(build.requested_at)) return 'updated';
  if (build.status === 'failed') return 'failed';
  if (build.status === 'success' && (live.preview || (live.builtAt && !live.startedAt))) return 'updated';
  const age = now - Date.parse(build.requested_at);
  if (build.status === 'pending' && build.detail === UNCONFIRMED) return age > UNCONFIRMED_MS ? 'stalled' : 'unconfirmed';
  return age > STALLED_MS ? 'stalled' : 'updating';
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

const stamp = (value: unknown) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);

/** Latest build request and the live build's own timestamps. */
async function fetchStatus() {
  const [builds, info] = await Promise.all([
    supabase.from('site_builds').select('id, requested_at, status, finished_at, detail').order('requested_at', { ascending: false }).limit(1),
    fetch('/build-info.json', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ builtAt?: unknown; startedAt?: unknown; env?: unknown }>) : null))
      .catch(() => null),
  ]);
  return { build: ((builds.data as Build[] | null) || [])[0] || null, live: { builtAt: stamp(info?.builtAt), startedAt: stamp(info?.startedAt), preview: info?.env === 'preview' } };
}

const inFlight = (state: SiteState) => state === 'updating' || state === 'unconfirmed';

export function useSiteStatus() {
  const [build, setBuild] = useState<Build | null | undefined>(undefined);
  const [live, setLive] = useState<LiveBuild>({ builtAt: null, startedAt: null });
  const [requesting, setRequesting] = useState(false);
  const [optimistic, setOptimistic] = useState(false);
  const previous = useRef<SiteState | null>(null);

  const apply = useCallback((status: Awaited<ReturnType<typeof fetchStatus>>) => {
    setBuild(status.build);
    setLive(status.live);
    setOptimistic(false);
  }, []);
  const load = useCallback(() => fetchStatus().then(apply), [apply]);

  useEffect(() => {
    void fetchStatus().then(apply);
  }, [apply]);

  // What the records say; `state` also covers the moment between a request and its row.
  const real: SiteState = derive(build ?? null, live);
  const state: SiteState = optimistic ? 'updating' : real;

  // While Vercel builds, check again every few seconds (only with the tab visible).
  useEffect(() => {
    if (!inFlight(state)) return;
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state, load]);

  // A hidden tab is not checked; coming back to it checks at once instead of
  // showing what it knew before until the next round.
  useEffect(() => {
    const back = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [load]);

  // Tell the person when an update they are watching finishes (from the records, never the optimistic guess).
  useEffect(() => {
    if (build === undefined || optimistic) return;
    const watched = previous.current !== null && inFlight(previous.current);
    if (watched && real === 'updated') toast.success('Site atualizado', { description: 'A nova versão já está no ar. Em outros acessos, pode levar alguns segundos para aparecer.' });
    if (watched && real === 'failed') toast.error('Não foi possível atualizar o site', { description: failureReason(build?.detail ?? null) });
    previous.current = real;
  }, [real, build, optimistic]);

  const update = useCallback(
    async (reason: string) => {
      setRequesting(true);
      // A build that succeeded but never reached the site does not count as
      // done (the server skips a retry once the latest build succeeded).
      const result = await requestSiteUpdate(build?.status === 'success' ? reason.replace(/^retry/, 'manual') : reason);
      setRequesting(false);
      if (result.skipped === 'updated') toast.success('O site já está atualizado', { description: 'A versão publicada mais recente já está no ar.' });
      else if (result.skipped === 'in_progress') toast.info('Atualização em andamento', { description: 'Uma atualização já foi solicitada; esta página acompanha sozinha.' });
      else if (result.ok) toast.success('Atualização do site solicitada', { description: 'Leva cerca de 1 a 2 minutos.' });
      else toast.error('Não foi possível atualizar o site', { description: 'O pedido não foi aceito. Tente novamente em instantes.' });
      if (result.ok && !result.skipped) {
        setOptimistic(true);
        previous.current = 'updating';
      }
      await load();
      return result.ok;
    },
    [load, build],
  );

  /** For flows that already asked for a build (publishing): start watching it. */
  const watch = useCallback(() => {
    setOptimistic(true);
    previous.current = 'updating';
    void load();
  }, [load]);

  return { loading: build === undefined, build: build ?? null, builtAt: live.builtAt, state, update, requesting, refresh: load, watch };
}

type Status = ReturnType<typeof useSiteStatus>;

const labels: Record<SiteState, string> = { updated: 'Atualizado', updating: 'Atualizando site…', unconfirmed: 'Aguardando confirmação', stalled: 'Sem confirmação', failed: 'Falha na atualização' };

export function SiteStateIcon({ state, className }: { state: SiteState; className?: string }) {
  if (inFlight(state)) return <Spinner className={cn('size-3.5 text-champagne-foreground', className)} aria-hidden="true" />;
  if (state === 'failed') return <CircleAlertIcon aria-hidden="true" className={cn('size-3.5 text-destructive', className)} />;
  if (state === 'stalled') return <CircleAlertIcon aria-hidden="true" className={cn('size-3.5 text-champagne-foreground', className)} />;
  return <span aria-hidden="true" className={cn('inline-block size-2 rounded-full bg-success ring-3 ring-success/15', className)} />;
}

/** One line: "● Atualizado · há 4 min". */
/** One line of state; `compact` uses the short labels of the dashboard metric. */
export function SiteStatusLine({ status, className, compact }: { status: Status; className?: string; compact?: boolean }) {
  const { state, build, builtAt } = status;
  const when = state === 'updated' ? builtAt || build?.finished_at || null : build?.requested_at || null;
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
  const lastRequest = build ? { updated: 'concluída', updating: 'em andamento', unconfirmed: 'em andamento', stalled: 'sem confirmação', failed: 'não concluída' }[state] : null;
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
              {state === 'updating' && 'A Vercel está gerando a nova versão e colocando no ar. Leva cerca de 1 a 2 minutos; esta página acompanha sozinha.'}
              {state === 'unconfirmed' && 'A atualização foi solicitada, e a Vercel ainda não confirmou o recebimento. Esta página acompanha sozinha e mostra quando a nova versão entrar no ar.'}
              {state === 'updated' && 'O site público já mostra o conteúdo publicado mais recente. Em outros acessos, pode levar alguns segundos para aparecer.'}
              {state === 'failed' && failureReason(build?.detail ?? null)}
              {state === 'stalled' && 'A atualização foi solicitada, mas a nova versão ainda não apareceu no site. Tente novamente.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" href="/" target="_blank" rel="noopener noreferrer">
            Abrir site <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          </a>
          <Button variant={retry ? 'default' : 'outline'} disabled={requesting || inFlight(state)} onClick={() => void status.update(retry ? 'retry: dashboard' : 'manual: dashboard')}>
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
