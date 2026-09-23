import { useEffect, useState } from 'react';
import { useStaff } from '../auth';
import { Link, navigate } from '../router';
import { explain, supabase } from '../supabase';
import { dateTime, leadStatusLabel, type Lead, type LeadStatus } from '../types';
import { Button, Empty, Field, Loading, PageHeader, Pill, useConfirm, useToast } from '../ui';
import { searchTerm } from './articles';

const PAGE = 50;
const statuses = Object.keys(leadStatusLabel) as LeadStatus[];
const interests = ['Marcas', 'Patentes', 'Software', 'Outros ativos', 'Preciso de orientação'];
const columns = 'id, created_at, name, company, interest, source, channel, landing_page, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, status, notes, updated_at';

export function Leads() {
  const params = new URLSearchParams(location.search);
  const [status, setStatus] = useState(params.get('status') || '');
  const [interest, setInterest] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        let q = supabase.from('leads').select(columns, { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
        if (status) q = q.eq('status', status);
        if (interest) q = q.eq('interest', interest);
        const term = searchTerm(query);
        // The term is reduced to letters, digits and spaces, so it cannot alter the filter syntax.
        if (term) q = q.or(`name.ilike.%${term}%,company.ilike.%${term}%`);
        const { data, count } = await q;
        setRows((data as Lead[]) || []);
        setTotal(count ?? 0);
      })();
    }, 200);
    return () => clearTimeout(timer);
  }, [status, interest, query, page]);

  return (
    <>
      <PageHeader eyebrow="Contatos" title="Leads" />
      <p className="field-hint intro">Pessoas que preencheram o formulário do site. A conversa continua no WhatsApp: o registro indica a intenção de contato, não confirma que a mensagem foi enviada.</p>
      <div className="toolbar">
        <select aria-label="Filtrar por status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="">Todos os status</option>
          {statuses.map((s) => <option key={s} value={s}>{leadStatusLabel[s]}</option>)}
        </select>
        <select aria-label="Filtrar por interesse" value={interest} onChange={(e) => { setInterest(e.target.value); setPage(0); }}>
          <option value="">Todos os interesses</option>
          {interests.map((i) => <option key={i}>{i}</option>)}
        </select>
        <input type="search" placeholder="Buscar por nome ou empresa" aria-label="Buscar por nome ou empresa" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} maxLength={80} />
      </div>
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>Nenhum lead encontrado.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">Nome</th><th scope="col">Interesse</th><th scope="col">Origem</th><th scope="col">Status</th><th scope="col">Recebido</th></tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td><Link className="row-title" href={`/admin/leads/${l.id}`}>{l.name}</Link>{l.company && <span className="row-sub">{l.company}</span>}</td>
                    <td>{l.interest}</td>
                    <td>{l.utm_source || (l.referrer ? l.referrer.replace(/^https?:\/\//, '') : 'Direto')}</td>
                    <td><Pill tone={l.status}>{leadStatusLabel[l.status]}</Pill></td>
                    <td>{dateTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pager" aria-label="Paginação">
            <Button variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Anteriores</Button>
            <span>{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} de {total}</span>
            <Button variant="ghost" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Próximos</Button>
          </nav>
        </>
      )}
    </>
  );
}

export function LeadDetail({ id }: { id: string }) {
  const staff = useStaff();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [lead, setLead] = useState<Lead | null>(null);
  const [status, setStatus] = useState<LeadStatus>('new');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.from('leads').select(columns).eq('id', id).maybeSingle().then(({ data }) => {
      if (!data) {
        navigate('/admin/leads', { replace: true });
        return;
      }
      const l = data as Lead;
      setLead(l);
      setStatus(l.status);
      setNotes(l.notes);
    });
  }, [id]);

  async function save() {
    setBusy(true);
    const { data, error } = await supabase.from('leads').update({ status, notes: notes.slice(0, 5000) }).eq('id', id).select(columns).single();
    setBusy(false);
    if (error) toast('error', explain(error));
    else {
      setLead(data as Lead);
      toast('ok', 'Lead atualizado.');
    }
  }

  async function remove() {
    if (!(await confirm('Excluir este lead?', 'Use para atender pedidos de exclusão de dados (LGPD). Não pode ser desfeito.', 'Excluir', true))) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) toast('error', explain(error));
    else {
      toast('ok', 'Lead excluído.');
      navigate('/admin/leads');
    }
  }

  if (!lead) return <Loading />;
  const rows: [string, string | null][] = [
    ['Nome', lead.name],
    ['Empresa ou projeto', lead.company],
    ['Interesse', lead.interest],
    ['Recebido em', dateTime(lead.created_at)],
    ['Canal', lead.channel === 'whatsapp' ? 'Formulário do site → WhatsApp' : lead.channel],
    ['Página de entrada', lead.landing_page],
    ['Site de origem', lead.referrer],
    ['utm_source', lead.utm_source],
    ['utm_medium', lead.utm_medium],
    ['utm_campaign', lead.utm_campaign],
    ['utm_content', lead.utm_content],
    ['utm_term', lead.utm_term],
  ];
  return (
    <>
      {dialog}
      <PageHeader eyebrow="Lead" title={lead.name} actions={<Link href="/admin/leads" className="text-link">← Todos os leads</Link>} />
      <div className="columns">
        <section className="panel">
          <h2>Respostas</h2>
          <dl className="details">
            {rows.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>
            ))}
          </dl>
        </section>
        <section className="panel stack">
          <h2>Acompanhamento</h2>
          <Field label="Status" id="lead-status">
            <select id="lead-status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
              {statuses.map((s) => <option key={s} value={s}>{leadStatusLabel[s]}</option>)}
            </select>
          </Field>
          <Field label="Notas internas" id="lead-notes" hint="Visíveis apenas para a equipe.">
            <textarea id="lead-notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />
          </Field>
          <Button onClick={() => void save()} busy={busy}>Salvar</Button>
          <p className="field-hint">Atualizado em {dateTime(lead.updated_at)}</p>
          {staff.role === 'owner' && <Button variant="danger" onClick={() => void remove()}>Excluir lead</Button>}
        </section>
      </div>
    </>
  );
}
