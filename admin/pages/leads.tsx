import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon, MessageCircleIcon, SearchXIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { contact } from '@/lib/site';
import { useStaff } from '../auth';
import { Link, navigate } from '../router';
import { explain, supabase } from '../supabase';
import { leadStatusLabel, type Lead, type LeadStatus } from '../types';
import { EmptyState, FilterSelect, fullDate, LeadStatusBadge, LoadingRows, notify, Page, PageHeader, SearchInput, TimeAgo, useConfirm, useCrumbs } from '../ui';
import { searchTerm } from './articles';

const PAGE = 50;
const statuses = Object.keys(leadStatusLabel) as LeadStatus[];
const interests = ['Marcas', 'Patentes', 'Software', 'Outros ativos', 'Preciso de orientação'];
const columns = 'id, created_at, name, company, interest, source, channel, landing_page, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, status, notes, updated_at';
const statusOptions: [string, string][] = [['all', 'Todos os status'], ...statuses.map((s): [string, string] => [s, leadStatusLabel[s]])];
const interestOptions: [string, string][] = [['all', 'Todos os interesses'], ...interests.map((i): [string, string] => [i, i])];
const periodOptions: [string, string][] = [['all', 'Todo o período'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias']];

const origin = (l: Pick<Lead, 'utm_source' | 'referrer'>) => l.utm_source || (l.referrer ? l.referrer.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : 'Direto');

export function Leads({ leadId }: { leadId: string | null }) {
  const params = new URLSearchParams(location.search);
  const [status, setStatus] = useState(params.get('status') || 'all');
  const [interest, setInterest] = useState('all');
  const [period, setPeriod] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [total, setTotal] = useState(0);
  const [version, setVersion] = useState(0);
  useCrumbs(leadId ? [{ label: 'Leads', href: '/admin/leads' }, { label: rows?.find((r) => r.id === leadId)?.name || 'Lead' }] : [{ label: 'Leads' }]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        let q = supabase.from('leads').select(columns, { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
        if (status !== 'all') q = q.eq('status', status);
        if (interest !== 'all') q = q.eq('interest', interest);
        if (period !== 'all') q = q.gte('created_at', new Date(Date.now() - Number(period) * 86400000).toISOString());
        const term = searchTerm(query);
        // The term is reduced to letters, digits and spaces, so it cannot alter the filter syntax.
        if (term) q = q.or(`name.ilike.%${term}%,company.ilike.%${term}%`);
        const { data, count } = await q;
        setRows((data as Lead[]) || []);
        setTotal(count ?? 0);
      })();
    }, 200);
    return () => clearTimeout(timer);
  }, [status, interest, period, query, page, version]);

  const filtered = status !== 'all' || interest !== 'all' || period !== 'all' || !!query.trim();
  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };
  const clear = () =>
    reset(() => {
      setStatus('all');
      setInterest('all');
      setPeriod('all');
      setQuery('');
    });

  return (
    <Page>
      <PageHeader title="Leads" description="Pessoas que preencheram o formulário do site. A conversa continua no WhatsApp: o registro indica a intenção de contato, não confirma que a mensagem foi enviada." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput label="Buscar por nome ou empresa" placeholder="Buscar por nome ou empresa" value={query} onChange={(v) => reset(() => setQuery(v))} />
        <FilterSelect label="Filtrar por status" value={status} onChange={(v) => reset(() => setStatus(v))} options={statusOptions} />
        <FilterSelect label="Filtrar por interesse" value={interest} onChange={(v) => reset(() => setInterest(v))} options={interestOptions} />
        <FilterSelect label="Filtrar por período" value={period} onChange={(v) => reset(() => setPeriod(v))} options={periodOptions} />
        {filtered && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clear}>
            Limpar filtros
          </Button>
        )}
        {rows && (
          <span className="ml-auto text-[13px] text-muted-foreground tabular" aria-live="polite">
            {total === 1 ? '1 lead' : `${total} leads`}
          </span>
        )}
      </div>

      {!rows ? (
        <div className="rounded-xl border bg-card p-5">
          <LoadingRows rows={6} />
        </div>
      ) : rows.length === 0 ? (
        filtered ? (
          status === 'new' && !query.trim() && interest === 'all' && period === 'all' ? (
            <EmptyState icon={<InboxIcon />} title="Nenhum lead novo." description="Tudo em dia. Novos contatos do formulário do site aparecem aqui com status Novo." />
          ) : (
            <EmptyState icon={<SearchXIcon />} title="Nenhum lead encontrado" description="Tente outro termo ou limpe os filtros." action={<Button variant="outline" onClick={clear}>Limpar filtros</Button>} />
          )
        ) : (
          <EmptyState icon={<InboxIcon />} title="Nenhum lead ainda." description="Quando alguém preencher o formulário do site, o contato aparece aqui, com a página de origem e as respostas." />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 pl-4 text-xs font-medium text-muted-foreground">Nome</TableHead>
                  <TableHead className="hidden h-10 text-xs font-medium text-muted-foreground md:table-cell">Interesse</TableHead>
                  <TableHead className="hidden h-10 text-xs font-medium text-muted-foreground lg:table-cell">Origem</TableHead>
                  <TableHead className="hidden h-10 text-xs font-medium text-muted-foreground sm:table-cell">Data</TableHead>
                  <TableHead className="h-10 pr-4 text-right text-xs font-medium text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id} data-state={l.id === leadId ? 'selected' : undefined} className="cursor-pointer data-[state=selected]:bg-brand-soft/60" onClick={(e) => !(e.target as HTMLElement).closest('a') && navigate(`/admin/leads/${l.id}`)}>
                    <TableCell className="w-full max-w-0 py-3 pl-4 whitespace-normal">
                      <Link className="line-clamp-1 text-sm font-semibold outline-none hover:text-brand focus-visible:text-brand focus-visible:underline" href={`/admin/leads/${l.id}`}>
                        {l.name}
                      </Link>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {l.company || 'Sem empresa informada'}
                        <span className="md:hidden"> · {l.interest}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden py-3 text-[13px] md:table-cell">{l.interest}</TableCell>
                    <TableCell className="hidden max-w-40 truncate py-3 text-[13px] text-muted-foreground lg:table-cell">{origin(l)}</TableCell>
                    <TableCell className="hidden py-3 text-[13px] text-muted-foreground sm:table-cell">
                      <TimeAgo value={l.created_at} />
                    </TableCell>
                    <TableCell className="py-3 pr-4 text-right">
                      <LeadStatusBadge status={l.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {total > PAGE && (
            <nav className="mt-4 flex items-center justify-between gap-3 text-[13px] text-muted-foreground" aria-label="Paginação">
              <span className="tabular">
                {page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} de {total}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeftIcon data-icon="inline-start" aria-hidden="true" /> Anteriores
                </Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>
                  Próximos <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      <LeadSheet id={leadId} onChanged={() => setVersion((v) => v + 1)} />
    </Page>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function LeadSheet({ id, onChanged }: { id: string | null; onChanged: () => void }) {
  const staff = useStaff();
  const { confirm, dialog } = useConfirm();
  const [loaded, setLoaded] = useState<Lead | null>(null);
  const [form, setForm] = useState<{ id: string; status: LeadStatus; notes: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Until the requested lead arrives, show loading instead of the previous one.
  const lead = loaded && loaded.id === id ? loaded : null;
  const status = form && form.id === id ? form.status : lead?.status || 'new';
  const notes = form && form.id === id ? form.notes : lead?.notes || '';
  const setStatus = (value: LeadStatus) => id && setForm({ id, status: value, notes });
  const setNotes = (value: string) => id && setForm({ id, status, notes: value });

  useEffect(() => {
    if (!id) return;
    void supabase
      .from('leads')
      .select(columns)
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          notify.error('Lead não encontrado.');
          navigate('/admin/leads', { replace: true });
          return;
        }
        const l = data as Lead;
        setLoaded(l);
        setForm({ id: l.id, status: l.status, notes: l.notes });
      });
  }, [id]);

  async function save() {
    if (!id) return;
    setBusy(true);
    const { data, error } = await supabase.from('leads').update({ status, notes: notes.slice(0, 5000) }).eq('id', id).select(columns).single();
    setBusy(false);
    if (error) notify.error(explain(error));
    else {
      setLoaded(data as Lead);
      onChanged();
      notify.ok('Lead atualizado.');
    }
  }

  async function remove() {
    if (!id || !(await confirm('Excluir este lead?', 'Use para atender pedidos de exclusão de dados (LGPD). Não pode ser desfeito.', 'Excluir', true))) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) notify.error(explain(error));
    else {
      notify.ok('Lead excluído.');
      onChanged();
      navigate('/admin/leads');
    }
  }

  const changed = !!lead && (status !== lead.status || notes !== lead.notes);
  const utms = lead ? ([['utm_source', lead.utm_source], ['utm_medium', lead.utm_medium], ['utm_campaign', lead.utm_campaign], ['utm_content', lead.utm_content], ['utm_term', lead.utm_term]] as const).filter(([, v]) => v) : [];

  return (
    <Sheet open={!!id} onOpenChange={(open) => !open && navigate('/admin/leads')}>
      <SheetContent className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {dialog}
        {!lead ? (
          <output className="grid gap-4 p-5" aria-label="Carregando lead">
            <SheetTitle className="sr-only">Carregando lead</SheetTitle>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </output>
        ) : (
          <>
            <SheetHeader className="gap-1.5 border-b p-5 pr-12">
              <div className="flex items-center gap-2">
                <LeadStatusBadge status={lead.status} />
                <span className="text-xs text-muted-foreground">
                  Recebido <TimeAgo value={lead.created_at} />
                </span>
              </div>
              <SheetTitle className="text-lg font-semibold tracking-[-0.015em]">{lead.name}</SheetTitle>
              <SheetDescription>{lead.company || 'Empresa ou projeto não informado'}</SheetDescription>
            </SheetHeader>

            <div className="grid gap-6 p-5">
              <a href={`https://wa.me/${contact.phone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3 text-[13px] transition-colors hover:bg-muted">
                <MessageCircleIcon className="size-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Conversa pelo WhatsApp da Velmont</span>
                  <span className="block text-xs text-muted-foreground">O formulário prepara a mensagem; o contato em si fica no WhatsApp.</span>
                </span>
              </a>

              <section aria-labelledby="lead-answers">
                <h3 id="lead-answers" className="mb-1 text-[13px] font-semibold">
                  Respostas
                </h3>
                <dl className="divide-y">
                  <Detail label="Nome">{lead.name}</Detail>
                  <Detail label="Empresa ou projeto">{lead.company}</Detail>
                  <Detail label="Interesse">{lead.interest}</Detail>
                  <Detail label="Recebido em">{fullDate(lead.created_at)}</Detail>
                </dl>
              </section>

              <section aria-labelledby="lead-origin">
                <h3 id="lead-origin" className="mb-1 text-[13px] font-semibold">
                  Origem
                </h3>
                <dl className="divide-y">
                  <Detail label="Canal">{lead.channel === 'whatsapp' ? 'Formulário do site → WhatsApp' : lead.channel}</Detail>
                  <Detail label="Página de entrada">{lead.landing_page}</Detail>
                  <Detail label="Site de origem">{lead.referrer}</Detail>
                  {utms.length ? utms.map(([k, v]) => <Detail key={k} label={k}>{v}</Detail>) : <Detail label="UTMs">Sem parâmetros de campanha</Detail>}
                </dl>
              </section>

              <section aria-labelledby="lead-follow" className="grid gap-4 rounded-lg border p-4">
                <h3 id="lead-follow" className="text-[13px] font-semibold">
                  Acompanhamento
                </h3>
                <div className="grid gap-2">
                  <Label htmlFor="lead-status" className="text-[13px]">
                    Status
                  </Label>
                  <NativeSelect id="lead-status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className="w-full">
                    {statuses.map((s) => (
                      <NativeSelectOption key={s} value={s}>
                        {leadStatusLabel[s]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lead-notes" className="text-[13px]">
                    Notas internas
                  </Label>
                  <Textarea id="lead-notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} placeholder="Ex.: Retornar na segunda. Tem dúvida sobre classes de marca." aria-describedby="lead-notes-hint" />
                  <p id="lead-notes-hint" className="text-xs text-muted-foreground">
                    Visíveis apenas para a equipe. Atualizado <TimeAgo value={lead.updated_at} />.
                  </p>
                </div>
              </section>
            </div>

            <SheetFooter className={cn('mt-auto flex-row items-center justify-between border-t bg-background p-4', 'sticky bottom-0')}>
              {staff.role === 'owner' ? (
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void remove()}>
                  <Trash2Icon data-icon="inline-start" aria-hidden="true" /> Excluir lead
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={() => void save()} disabled={busy || !changed} aria-busy={busy || undefined}>
                {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                {busy ? 'Salvando…' : 'Salvar'}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
