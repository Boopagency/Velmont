import { useEffect, useState, type SubmitEvent } from 'react';
import { ActivityIcon, LockIcon, MoreHorizontalIcon, ShieldCheckIcon, UserPlusIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStaff } from '../auth';
import { explain, supabase } from '../supabase';
import { leadStatusLabel, type LeadStatus, type Role } from '../types';
import { EmptyState, Field, formText, fullDate, initials, longDate, notify, Page, PageHeader, roleLabel, StatusBadge, useConfirm, useCrumbs } from '../ui';

type Member = { user_id: string; email: string; display_name: string; role: Role; active: boolean; created_at: string };
type Event = { id: number; occurred_at: string; action: string; resource: string; resource_id: string | null; actor_id: string | null; metadata: Record<string, unknown> | null };
type Entry = { event: Event; actor: string; text: string; count: number; since: string };

const roleHint: Record<Role, string> = { editor: 'Artigos, mídia e leads', owner: 'Tudo, inclusive equipe e exclusões' };
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  const text = day.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A readable sentence from the audit record; only what the record holds. */
function describe(e: Event, names: Record<string, string>, articles: Record<string, string>, leads: Record<string, string>) {
  const meta = e.metadata || {};
  const text = (key: string) => (typeof meta[key] === 'string' ? (meta[key] as string) : '');
  const article = articles[e.resource_id || ''] || text('title') || (text('slug') ? `/blog/${text('slug')}` : 'um artigo');
  const quoted = article === 'um artigo' ? article : `“${article}”`;
  const member = names[e.resource_id || ''] || 'uma pessoa';
  const role = typeof meta.role === 'string' && meta.role in roleLabel ? roleLabel[meta.role as Role] : null;
  switch (e.action) {
    case 'auth.login': return 'entrou no painel';
    case 'article.create': return `criou ${quoted}`;
    case 'article.update': return `editou ${quoted}`;
    case 'article.publish': return `publicou ${quoted}`;
    case 'article.unpublish': return `despublicou ${quoted}`;
    case 'article.archive': return `arquivou ${quoted}`;
    case 'article.delete': return `excluiu o artigo ${text('title') ? `“${text('title')}”` : quoted}`;
    case 'article.submit_review': return `enviou ${quoted} para revisão`;
    case 'article.return_draft': return `voltou ${quoted} para rascunho`;
    case 'lead.update': {
      const from = text('from_status') as LeadStatus;
      const to = text('to_status') as LeadStatus;
      const name = leads[e.resource_id || ''];
      const change = from && to && from !== to && leadStatusLabel[from] && leadStatusLabel[to] ? ` (${leadStatusLabel[from]} → ${leadStatusLabel[to]})` : meta.notes_changed ? ' (notas)' : '';
      return `atualizou o lead ${name || ''}${change}`.replace('  ', ' ');
    }
    case 'lead.delete': return 'excluiu um lead';
    case 'media.upload': return 'enviou uma imagem';
    case 'media.delete': return 'excluiu uma imagem';
    case 'staff.add': return `liberou o acesso de ${member}${role ? ` como ${role}` : ''}`;
    case 'staff.update': return meta.active === false ? `desativou o acesso de ${member}` : `alterou o acesso de ${member}${role ? ` para ${role}` : ''}`;
    case 'staff.remove': return `removeu ${member}`;
    default: return e.action;
  }
}

function InviteDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: () => void }) {
  const [busy, setBusy] = useState(false);
  async function add(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const { error } = await supabase.rpc('add_staff_member', { p_email: formText(data, 'email'), p_display_name: formText(data, 'name'), p_role: formText(data, 'role') as Role });
    setBusy(false);
    if (error) notify.error('Não foi possível liberar o acesso', error.code === 'P0002' ? 'Convide primeiro este e-mail pelo Supabase (Authentication → Users → Invite).' : explain(error));
    else {
      form.reset();
      notify.ok('Acesso liberado.');
      onAdded();
      onOpenChange(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">Liberar acesso</DialogTitle>
          <DialogDescription>Duas etapas: 1. convide o e-mail no Supabase (Authentication → Users → Invite). 2. Depois que a pessoa aceitar o convite, libere o acesso aqui.</DialogDescription>
        </DialogHeader>
        <form id="invite-form" className="grid gap-4" onSubmit={(e) => void add(e)}>
          <Field label="Nome" id="member-name">
            <Input id="member-name" name="name" required maxLength={120} className="h-9" />
          </Field>
          <Field label="E-mail" id="member-email">
            <Input id="member-email" name="email" type="email" required maxLength={320} className="h-9" />
          </Field>
          <Field label="Papel" id="member-role">
            <NativeSelect id="member-role" name="role" defaultValue="editor" className="w-full">
              <NativeSelectOption value="editor">Editor · {roleHint.editor}</NativeSelectOption>
              <NativeSelectOption value="owner">Responsável · {roleHint.owner}</NativeSelectOption>
            </NativeSelect>
          </Field>
        </form>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <Button type="submit" form="invite-form" disabled={busy}>
            {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
            {busy ? 'Liberando…' : 'Liberar acesso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Owner only. The database enforces this too (RLS + owner-only functions). */
export function Team() {
  const staff = useStaff();
  const { confirm, dialog } = useConfirm();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [articles, setArticles] = useState<Record<string, string>>({});
  const [leads, setLeads] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState(false);
  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);
  useCrumbs([{ label: 'Gestão' }, { label: 'Equipe' }]);

  useEffect(() => {
    if (staff.role !== 'owner') return;
    void (async () => {
      const [m, a, arts, ls] = await Promise.all([
        supabase.from('admin_users').select('user_id, email, display_name, role, active, created_at').order('created_at'),
        supabase.from('audit_log').select('id, occurred_at, action, resource, resource_id, actor_id, metadata').order('occurred_at', { ascending: false }).limit(150),
        supabase.from('articles').select('id, title').limit(500),
        supabase.from('leads').select('id, name').order('created_at', { ascending: false }).limit(500),
      ]);
      setMembers((m.data as Member[]) || []);
      setEvents((a.data as Event[]) || []);
      setArticles(Object.fromEntries(((arts.data as { id: string; title: string }[]) || []).map((r) => [r.id, r.title || 'Sem título'])));
      setLeads(Object.fromEntries(((ls.data as { id: string; name: string }[]) || []).map((r) => [r.id, r.name])));
    })();
  }, [version, staff.role]);

  if (staff.role !== 'owner')
    return (
      <Page>
        <EmptyState icon={<LockIcon />} title="Área restrita à pessoa responsável." description="A gestão da equipe e o registro de atividades ficam com quem tem o papel Responsável." />
      </Page>
    );

  async function change(member: Member, role: Role, active: boolean) {
    const texts: [string, string, string] =
      member.active !== active
        ? active
          ? [`Reativar ${member.display_name}?`, 'A pessoa volta a entrar no painel com o mesmo papel.', 'Reativar']
          : [`Desativar ${member.display_name}?`, 'A pessoa deixa de entrar no painel. O histórico de atividades é mantido.', 'Desativar']
        : [`Tornar ${member.display_name} ${roleLabel[role]}?`, `${roleLabel[role]}: ${roleHint[role].toLowerCase()}.`, 'Confirmar'];
    if (!(await confirm(texts[0], texts[1], texts[2], !active))) return;
    const { error } = await supabase.rpc('update_staff_member', { p_user_id: member.user_id, p_role: role, p_active: active });
    if (error) notify.error('Não foi possível alterar o acesso', error.code === '23514' ? 'É preciso manter ao menos uma pessoa responsável ativa.' : explain(error));
    else {
      notify.ok('Acesso atualizado.');
      load();
    }
  }

  const names = Object.fromEntries((members || []).map((m) => [m.user_id, m.display_name]));
  // By day; the same sentence repeated in a row (e.g. several saves of one
  // article) becomes one line with a count and the time span.
  const groups: [string, Entry[]][] = [];
  for (const e of events || []) {
    const label = dayLabel(e.occurred_at);
    const actor = names[e.actor_id || ''] || 'Sistema';
    const text = describe(e, names, articles, leads);
    let group = groups[groups.length - 1];
    if (!group || group[0] !== label) {
      group = [label, []];
      groups.push(group);
    }
    const last = group[1][group[1].length - 1];
    if (last && last.actor === actor && last.text === text) {
      last.count++;
      last.since = e.occurred_at;
    } else group[1].push({ event: e, actor, text, count: 1, since: e.occurred_at });
  }

  return (
    <Page>
      {dialog}
      <PageHeader
        title="Equipe"
        description="Quem pode entrar no painel e o que cada pessoa pode fazer."
        actions={
          <Button className="h-9 px-3.5" onClick={() => setInviting(true)}>
            <UserPlusIcon data-icon="inline-start" aria-hidden="true" /> Liberar acesso
          </Button>
        }
      />
      <InviteDialog open={inviting} onOpenChange={setInviting} onAdded={load} />

      {!members ? (
        <div className="rounded-xl border bg-card p-5">
          <Skeleton className="mb-3 h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 pl-4 text-xs font-medium text-muted-foreground">Pessoa</TableHead>
                <TableHead className="hidden h-10 text-xs font-medium text-muted-foreground lg:table-cell">E-mail</TableHead>
                <TableHead className="h-10 text-xs font-medium text-muted-foreground">Papel</TableHead>
                <TableHead className="hidden h-10 text-xs font-medium text-muted-foreground md:table-cell">MFA</TableHead>
                <TableHead className="hidden h-10 text-xs font-medium text-muted-foreground sm:table-cell">Status</TableHead>
                <TableHead className="h-10 w-12 pr-3">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const self = m.user_id === staff.userId;
                return (
                  <TableRow key={m.user_id} className={cn(!m.active && 'text-muted-foreground')}>
                    <TableCell className="w-full max-w-0 py-3 pl-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className={cn('text-xs font-semibold', m.active ? 'bg-brand-soft text-brand' : 'bg-muted text-muted-foreground')}>{initials(m.display_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                            {m.display_name}
                            {self && <span className="rounded bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">você</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground lg:hidden">{m.email}</p>
                          <p className="text-xs text-muted-foreground">Desde {longDate(m.created_at)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden py-3 text-[13px] text-muted-foreground lg:table-cell">{m.email}</TableCell>
                    <TableCell className="py-3">
                      <StatusBadge tone={m.role === 'owner' ? 'brand' : 'neutral'}>{roleLabel[m.role]}</StatusBadge>
                    </TableCell>
                    <TableCell className="hidden py-3 md:table-cell">
                      <Tooltip>
                        <TooltipTrigger className="inline-flex items-center gap-1.5 rounded text-[13px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                          <ShieldCheckIcon className="size-4 text-success" aria-hidden="true" /> Obrigatório
                        </TooltipTrigger>
                        <TooltipContent className="max-w-56">O painel só abre depois da verificação em duas etapas, para todas as pessoas.</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="hidden py-3 sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-[13px]">
                        <span aria-hidden="true" className={cn('size-1.5 rounded-full', m.active ? 'bg-success' : 'bg-muted-foreground/40')} />
                        {m.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 pr-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações para ${m.display_name}`} className="text-muted-foreground" />}>
                          <MoreHorizontalIcon aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Papel</DropdownMenuLabel>
                            {(['owner', 'editor'] as Role[]).map((r) => (
                              <DropdownMenuItem key={r} disabled={m.role === r} onClick={() => void change(m, r, m.active)} className="items-start">
                                <span className="grid gap-0.5">
                                  <span>Tornar {roleLabel[r]}</span>
                                  <span className="text-xs text-muted-foreground">{roleHint[r]}</span>
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          {m.active ? (
                            <DropdownMenuItem variant="destructive" onClick={() => void change(m, m.role, false)}>
                              Desativar acesso
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => void change(m, m.role, true)}>Reativar acesso</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <section aria-labelledby="activity-title" className="mt-12">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 id="activity-title" className="text-[15px] font-semibold tracking-[-0.01em]">
              Atividade recente
            </h2>
            <p className="text-[13px] text-muted-foreground">Registro de auditoria: quem fez o quê, e quando. Últimos 150 registros; repetições seguidas aparecem agrupadas.</p>
          </div>
        </div>
        {!events ? (
          <div className="grid gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5 w-full max-w-lg" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState icon={<ActivityIcon />} title="Nenhuma atividade ainda." description="Entradas no painel, publicações e alterações aparecem aqui." />
        ) : (
          <div className="grid gap-8">
            {groups.map(([label, list]) => (
              <div key={label}>
                <h3 className="mb-2 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">{label}</h3>
                <ol className="relative grid gap-0 border-l pl-6">
                  {list.map(({ event: e, actor, text, count, since }) => {
                    const at = time.format(new Date(e.occurred_at));
                    const from = time.format(new Date(since));
                    return (
                      <li key={e.id} className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                        <span aria-hidden="true" className={cn('absolute top-[15px] -left-[27.5px] size-2 rounded-full ring-4 ring-background', e.action.startsWith('article.publish') ? 'bg-success' : e.action.includes('delete') || e.action.includes('remove') ? 'bg-destructive' : 'bg-brand/60')} />
                        <p className="min-w-0 text-sm">
                          <span className="font-semibold">{actor}</span> <span className="text-foreground/80">{text}</span>
                          {count > 1 && <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular">{count} vezes</span>}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">
                          {count > 1 && from !== at && (
                            <>
                              <time dateTime={since} title={fullDate(since)}>
                                {from}
                              </time>
                              {' – '}
                            </>
                          )}
                          <time dateTime={e.occurred_at} title={fullDate(e.occurred_at)}>
                            {at}
                          </time>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </Page>
  );
}
