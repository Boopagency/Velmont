import { useEffect, useState, type SubmitEvent } from 'react';
import { useStaff } from '../auth';
import { explain, supabase } from '../supabase';
import { date, dateTime, type Role } from '../types';
import { Button, Empty, Field, formText, Loading, PageHeader, useToast } from '../ui';

type Member = { user_id: string; email: string; display_name: string; role: Role; active: boolean; created_at: string };
type Event = { id: number; occurred_at: string; action: string; resource: string; resource_id: string | null; actor_id: string | null };

const actionLabel: Record<string, string> = {
  'auth.login': 'Entrou no painel', 'article.create': 'Criou artigo', 'article.update': 'Editou artigo', 'article.publish': 'Publicou artigo', 'article.unpublish': 'Despublicou artigo',
  'article.archive': 'Arquivou artigo', 'article.delete': 'Excluiu artigo', 'article.submit_review': 'Enviou para revisão', 'article.return_draft': 'Voltou para rascunho',
  'lead.update': 'Atualizou lead', 'lead.delete': 'Excluiu lead', 'media.upload': 'Enviou imagem', 'media.delete': 'Excluiu imagem', 'staff.add': 'Adicionou pessoa', 'staff.update': 'Alterou acesso', 'staff.remove': 'Removeu pessoa',
};

/** Owner only. The database enforces this too (RLS + owner-only functions). */
export function Team() {
  const staff = useStaff();
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);
  useEffect(() => {
    void (async () => {
    const [m, a] = await Promise.all([
      supabase.from('admin_users').select('user_id, email, display_name, role, active, created_at').order('created_at'),
      supabase.from('audit_log').select('id, occurred_at, action, resource, resource_id, actor_id').order('occurred_at', { ascending: false }).limit(50),
    ]);
    setMembers((m.data as Member[]) || []);
    setEvents((a.data as Event[]) || []);
    })();
  }, [version]);

  if (staff.role !== 'owner') return <Empty>Área restrita à pessoa responsável.</Empty>;

  async function add(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const { error } = await supabase.rpc('add_staff_member', { p_email: formText(data, 'email'), p_display_name: formText(data, 'name'), p_role: formText(data, 'role') as Role });
    if (error) toast('error', error.code === 'P0002' ? 'Convide primeiro este e-mail pelo Supabase (Authentication → Users → Invite).' : explain(error));
    else {
      form.reset();
      toast('ok', 'Acesso liberado.');
      load();
    }
  }

  async function change(member: Member, role: Role, active: boolean) {
    const { error } = await supabase.rpc('update_staff_member', { p_user_id: member.user_id, p_role: role, p_active: active });
    if (error) toast('error', error.code === '23514' ? 'É preciso manter ao menos uma pessoa responsável ativa.' : explain(error));
    else load();
  }

  const names = Object.fromEntries((members || []).map((m) => [m.user_id, m.display_name]));
  return (
    <>
      <PageHeader eyebrow="Administração" title="Equipe" />
      {!members ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Pessoa</th><th scope="col">Papel</th><th scope="col">Acesso</th><th scope="col">Desde</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td><span className="row-title">{m.display_name}</span><span className="row-sub">{m.email}</span></td>
                  <td>
                    <select aria-label={`Papel de ${m.display_name}`} value={m.role} onChange={(e) => void change(m, e.target.value as Role, m.active)}>
                      <option value="editor">Editora</option>
                      <option value="owner">Responsável</option>
                    </select>
                  </td>
                  <td>
                    <label className="check"><input type="checkbox" checked={m.active} onChange={(e) => void change(m, m.role, e.target.checked)} /> Ativo</label>
                  </td>
                  <td>{date(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="columns">
        <section className="panel">
          <h2>Liberar acesso</h2>
          <p className="field-hint">1. Convide o e-mail em Supabase → Authentication → Users. 2. Depois que a pessoa aceitar o convite, libere o acesso aqui.</p>
          <form className="stack" onSubmit={(e) => void add(e)}>
            <Field label="Nome" id="member-name"><input id="member-name" name="name" required maxLength={120} /></Field>
            <Field label="E-mail" id="member-email"><input id="member-email" name="email" type="email" required maxLength={320} /></Field>
            <Field label="Papel" id="member-role">
              <select id="member-role" name="role" defaultValue="editor">
                <option value="editor">Editora: artigos, mídia e leads</option>
                <option value="owner">Responsável: tudo, inclusive equipe e exclusões</option>
              </select>
            </Field>
            <Button type="submit">Liberar acesso</Button>
          </form>
        </section>
        <section className="panel">
          <h2>Registro de atividades</h2>
          {events.length === 0 ? (
            <Empty>Nenhuma atividade.</Empty>
          ) : (
            <ul className="list compact">
              {events.map((e) => (
                <li key={e.id}>
                  <span>{actionLabel[e.action] || e.action}</span>
                  <span className="meta">{names[e.actor_id || ''] || 'Sistema'} · {dateTime(e.occurred_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
