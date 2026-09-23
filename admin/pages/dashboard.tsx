import { useEffect, useState } from 'react';
import { useStaff } from '../auth';
import { Link } from '../router';
import { requestSiteUpdate, supabase } from '../supabase';
import { articleStatusLabel, dateTime, leadStatusLabel, type ArticleStatus, type LeadStatus } from '../types';
import { Button, Empty, Loading, PageHeader, Pill, useToast } from '../ui';

type Data = {
  published: number;
  drafts: number;
  newLeads: number;
  articles: { id: string; title: string; status: ArticleStatus; updated_at: string }[];
  leads: { id: string; name: string; interest: string; status: LeadStatus; created_at: string }[];
  lastBuild: { requested_at: string; ok: boolean } | null;
  siteBuiltAt: string | null;
};

export function Dashboard() {
  const staff = useStaff();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const head = { count: 'exact' as const, head: true };
      const [published, drafts, newLeads, articles, leads, builds, info] = await Promise.all([
        supabase.from('articles').select('id', head).eq('status', 'published'),
        supabase.from('articles').select('id', head).in('status', ['draft', 'review']),
        supabase.from('leads').select('id', head).eq('status', 'new'),
        supabase.from('articles').select('id, title, status, updated_at').neq('status', 'archived').order('updated_at', { ascending: false }).limit(5),
        supabase.from('leads').select('id, name, interest, status, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('site_builds').select('requested_at, ok').order('requested_at', { ascending: false }).limit(1),
        fetch('/build-info.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as Promise<{ builtAt?: string } | null>,
      ]);
      setData({
        published: published.count ?? 0,
        drafts: drafts.count ?? 0,
        newLeads: newLeads.count ?? 0,
        articles: (articles.data as Data['articles']) || [],
        leads: (leads.data as Data['leads']) || [],
        lastBuild: (builds.data?.[0] as Data['lastBuild']) || null,
        siteBuiltAt: info?.builtAt || null,
      });
    })();
  }, []);

  async function updateSite() {
    setBusy(true);
    const ok = await requestSiteUpdate('manual: dashboard');
    setBusy(false);
    toast(ok ? 'ok' : 'error', ok ? 'Atualização do site solicitada. Leva cerca de 1 a 2 minutos.' : 'Não foi possível solicitar a atualização do site.');
  }

  const first = staff.displayName.split(' ')[0];
  return (
    <>
      <PageHeader eyebrow="Painel editorial" title={`Olá, ${first}.`} actions={<Link className="btn btn-primary" href="/admin/artigos/novo">Novo artigo</Link>} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <section className="stats" aria-label="Resumo">
            <Link href="/admin/artigos?status=published" className="stat"><strong>{data.published}</strong><span>Artigos publicados</span></Link>
            <Link href="/admin/artigos?status=draft" className="stat"><strong>{data.drafts}</strong><span>Rascunhos e revisões</span></Link>
            <Link href="/admin/leads?status=new" className="stat"><strong>{data.newLeads}</strong><span>Leads novos</span></Link>
          </section>
          <div className="columns">
            <section className="panel">
              <h2>Últimos artigos</h2>
              {data.articles.length ? (
                <ul className="list">
                  {data.articles.map((a) => (
                    <li key={a.id}>
                      <Link href={`/admin/artigos/${a.id}`}>{a.title || 'Sem título'}</Link>
                      <span className="meta"><Pill tone={a.status}>{articleStatusLabel[a.status]}</Pill> {dateTime(a.updated_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nenhum artigo ainda.</Empty>
              )}
            </section>
            <section className="panel">
              <h2>Últimos leads</h2>
              {data.leads.length ? (
                <ul className="list">
                  {data.leads.map((l) => (
                    <li key={l.id}>
                      <Link href={`/admin/leads/${l.id}`}>{l.name}</Link>
                      <span className="meta"><Pill tone={l.status}>{leadStatusLabel[l.status]}</Pill> {l.interest} · {dateTime(l.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nenhum lead recebido ainda.</Empty>
              )}
            </section>
          </div>
          <section className="panel site-status">
            <div>
              <h2>Site público</h2>
              <p>Última versão publicada: {dateTime(data.siteBuiltAt)}{data.lastBuild && ` · Última solicitação: ${dateTime(data.lastBuild.requested_at)}${data.lastBuild.ok ? '' : ' (falhou)'}`}</p>
            </div>
            <Button variant="secondary" busy={busy} onClick={() => void updateSite()}>Atualizar site agora</Button>
          </section>
        </>
      )}
    </>
  );
}
