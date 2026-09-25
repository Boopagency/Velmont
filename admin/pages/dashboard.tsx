import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRightIcon, FileTextIcon, InboxIcon, PlusIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useStaff } from '../auth';
import { Link } from '../router';
import { SiteStatusLine, SiteStatusPanel, useSiteStatus } from '../site-status';
import { supabase } from '../supabase';
import type { ArticleStatus, LeadStatus } from '../types';
import { ArticleStatusBadge, EmptyState, LeadStatusBadge, Page, PageHeader, SectionTitle, TimeAgo, useCrumbs } from '../ui';

type Data = {
  published: number;
  drafts: number;
  newLeads: number;
  articles: { id: string; title: string; status: ArticleStatus; updated_at: string }[];
  leads: { id: string; name: string; interest: string; status: LeadStatus; created_at: string }[];
};

const today = () => {
  const text = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function Metric({ href, label, value, hint }: { href: string; label: string; value: number; hint?: string }) {
  return (
    <Link href={href} className="stat group flex min-w-0 flex-col gap-2 px-5 py-4 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset">
      <span className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
        {label}
        <ArrowRightIcon aria-hidden="true" className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </span>
      <strong className="tabular text-[28px] leading-none font-semibold tracking-[-0.02em]">{value}</strong>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Link>
  );
}

function ListCard({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-xl border bg-card">{children}</div>;
}

export function Dashboard() {
  const staff = useStaff();
  const site = useSiteStatus();
  const [data, setData] = useState<Data | null>(null);
  useCrumbs([{ label: 'Dashboard' }]);

  useEffect(() => {
    void (async () => {
      const head = { count: 'exact' as const, head: true };
      const [published, drafts, newLeads, articles, leads] = await Promise.all([
        supabase.from('articles').select('id', head).eq('status', 'published'),
        supabase.from('articles').select('id', head).in('status', ['draft', 'review']),
        supabase.from('leads').select('id', head).eq('status', 'new'),
        supabase.from('articles').select('id, title, status, updated_at').neq('status', 'archived').order('updated_at', { ascending: false }).limit(5),
        supabase.from('leads').select('id, name, interest, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);
      setData({
        published: published.count ?? 0,
        drafts: drafts.count ?? 0,
        newLeads: newLeads.count ?? 0,
        articles: (articles.data as Data['articles']) || [],
        leads: (leads.data as Data['leads']) || [],
      });
    })();
  }, []);

  const first = staff.displayName.split(' ')[0];
  return (
    <Page>
      <PageHeader
        title={`Olá, ${first}.`}
        description={`${today()} · Conteúdo, contatos e o estado do site em um só lugar.`}
        actions={
          <Link href="/admin/artigos/novo" className={buttonVariants({ size: 'lg', className: 'h-9 px-3.5' })}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Novo artigo
          </Link>
        }
      />

      <section aria-label="Resumo" className="mb-10 grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4 [&>*]:border-border [&>*:nth-child(odd)]:border-r lg:[&>*:not(:last-child)]:border-r [&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0">
        {data ? (
          <>
            <Metric href="/admin/artigos?status=published" label="Artigos publicados" value={data.published} />
            <Metric href="/admin/artigos?status=draft" label="Rascunhos" value={data.drafts} hint={data.drafts ? 'inclui artigos em revisão' : undefined} />
            <Metric href="/admin/leads?status=new" label="Leads novos" value={data.newLeads} hint={data.newLeads ? 'aguardando retorno' : undefined} />
          </>
        ) : (
          [0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 px-5 py-4">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))
        )}
        <a href="#site-status-title" className="group flex min-w-0 flex-col gap-2 px-5 py-4 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset">
          <span className="text-[13px] text-muted-foreground">Status do site</span>
          {site.loading ? <Skeleton className="h-7 w-32" /> : <SiteStatusLine status={site} compact className="flex-wrap text-[15px] leading-7" />}
        </a>
      </section>

      <div className="mb-10 grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="recent-articles">
          <SectionTitle
            id="recent-articles"
            action={
              <Link href="/admin/artigos" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-brand">
                Ver todos <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
            }
          >
            Artigos recentes
          </SectionTitle>
          {!data ? (
            <ListCard>
              <ListSkeleton />
            </ListCard>
          ) : data.articles.length ? (
            <ListCard>
              <ul className="divide-y">
                {data.articles.map((a) => (
                  <li key={a.id}>
                    <Link href={`/admin/artigos/${a.id}`} className="group flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60">
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-medium group-hover:text-brand">{a.title || 'Sem título'}</span>
                        <span className="text-xs text-muted-foreground">
                          Atualizado <TimeAgo value={a.updated_at} />
                        </span>
                      </span>
                      <ArticleStatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </ListCard>
          ) : (
            <EmptyState
              icon={<FileTextIcon />}
              title="Nenhum artigo ainda"
              description="Artigos ajudam a Velmont a ser encontrada e a explicar cada serviço."
              action={
                <Link href="/admin/artigos/novo" className={buttonVariants({ variant: 'outline' })}>
                  Escrever o primeiro artigo
                </Link>
              }
            />
          )}
        </section>

        <section aria-labelledby="recent-leads">
          <SectionTitle
            id="recent-leads"
            action={
              <Link href="/admin/leads" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-brand">
                Ver todos <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
            }
          >
            Leads recentes
          </SectionTitle>
          {!data ? (
            <ListCard>
              <ListSkeleton />
            </ListCard>
          ) : data.leads.length ? (
            <ListCard>
              <ul className="divide-y">
                {data.leads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/leads/${l.id}`} className="group flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60">
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-medium group-hover:text-brand">{l.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {l.interest} · <TimeAgo value={l.created_at} />
                        </span>
                      </span>
                      <LeadStatusBadge status={l.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </ListCard>
          ) : (
            <EmptyState icon={<InboxIcon />} title="Nenhum lead ainda" description="Quando alguém preencher o formulário do site, o contato aparece aqui, com a página de origem e as respostas." />
          )}
        </section>
      </div>

      <div id="site-status" className={cn('scroll-mt-16')}>
        <SiteStatusPanel status={site} />
      </div>
    </Page>
  );
}

function ListSkeleton() {
  return (
    <output className="block divide-y" aria-label="Carregando">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </output>
  );
}
