import { useEffect, useState, type ReactNode, type SubmitEvent } from 'react';
import type { Factor } from '@supabase/supabase-js';
import { KeyRoundIcon, LogOutIcon, ShieldCheckIcon, SmartphoneIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useStaff } from '../auth';
import { supabase } from '../supabase';
import { Field, formText, initials, longDate, notify, Page, PageHeader, roleLabel, StatusBadge, useConfirm, useCrumbs } from '../ui';

function Setting({ id, title, description, children }: { id: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t py-8 first:border-t-0 first:pt-0 md:grid-cols-[260px_minmax(0,1fr)] md:gap-10">
      <div className="space-y-1">
        <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0 rounded-xl border bg-card p-5">{children}</div>
    </section>
  );
}

export function Account() {
  const staff = useStaff();
  const { confirm, dialog } = useConfirm();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [busy, setBusy] = useState(false);
  const recovering = new URLSearchParams(location.search).get('senha') === 'nova';
  useCrumbs([{ label: 'Conta' }]);

  useEffect(() => {
    void supabase.auth.mfa.listFactors().then(({ data }) => setFactors(data?.totp || []));
  }, []);

  async function changePassword(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const password = formText(data, 'password');
    if (password.length < 12) return void notify.error('Senha muito curta', 'Use pelo menos 12 caracteres.');
    if (password !== formText(data, 'confirm')) return void notify.error('As senhas não conferem.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) notify.error('Não foi possível alterar a senha', error.message.includes('weak') || error.message.includes('pwned') ? 'Senha fraca ou exposta em vazamentos. Escolha outra.' : 'Tente novamente.');
    else {
      form.reset();
      notify.ok('Senha alterada.');
    }
  }

  async function signOutEverywhere() {
    if (await confirm('Sair de todos os dispositivos?', 'Todas as sessões abertas, inclusive esta, serão encerradas.', 'Sair de todos')) await supabase.auth.signOut({ scope: 'global' });
  }

  return (
    <Page className="max-w-[1080px]">
      {dialog}
      <PageHeader title="Conta" description="Seus dados de acesso e a segurança da sua conta no painel." />

      <Setting id="profile" title="Perfil" description="Como você aparece no painel e no registro de atividades.">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-12">
            <AvatarFallback className="bg-brand-soft text-sm font-semibold text-brand">{initials(staff.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{staff.displayName}</p>
            <p className="truncate text-[13px] text-muted-foreground">{staff.email}</p>
          </div>
          <StatusBadge tone={staff.role === 'owner' ? 'brand' : 'neutral'}>{roleLabel[staff.role]}</StatusBadge>
        </div>
        <p className="mt-4 border-t pt-4 text-xs text-muted-foreground">Para alterar nome ou papel, fale com a pessoa responsável pela equipe.</p>
      </Setting>

      <Setting id="password-title" title={recovering ? 'Crie sua nova senha' : 'Senha'} description="Mínimo de 12 caracteres. Prefira uma frase longa, fácil de lembrar e difícil de adivinhar.">
        <form className="grid max-w-md gap-4" onSubmit={(e) => void changePassword(e)}>
          <input type="email" autoComplete="username" value={staff.email} readOnly hidden />
          <Field label="Nova senha" id="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={200} required className="h-9" />
          </Field>
          <Field label="Confirme a nova senha" id="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={200} required className="h-9" />
          </Field>
          <Button type="submit" className="w-fit" disabled={busy} aria-busy={busy || undefined}>
            {busy ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />}
            {busy ? 'Salvando…' : 'Salvar senha'}
          </Button>
        </form>
      </Setting>

      <Setting id="mfa-title" title="Verificação em duas etapas" description="Obrigatória para todas as pessoas do painel. Cada entrada pede o código do aplicativo autenticador.">
        {factors === null ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
                <ShieldCheckIcon className="size-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Ativa</p>
                <p className="text-[13px] text-muted-foreground">
                  {factors[0] ? `Aplicativo autenticador cadastrado em ${longDate(factors[0].created_at)}.` : 'Aplicativo autenticador cadastrado.'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3 text-[13px] text-muted-foreground">
              <SmartphoneIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>Trocou de celular? Peça à pessoa responsável para redefinir seu autenticador no Supabase. No próximo acesso, você cadastra o novo.</p>
            </div>
          </div>
        )}
      </Setting>

      <Setting id="session-title" title="Sessão" description="Encerre o acesso em computadores e celulares onde você entrou no painel.">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-md text-[13px] text-muted-foreground">Use se você esqueceu o painel aberto em outro lugar ou suspeita de acesso indevido. Todas as sessões, inclusive esta, serão encerradas.</p>
          <Button variant="outline" onClick={() => void signOutEverywhere()}>
            <LogOutIcon data-icon="inline-start" aria-hidden="true" /> Sair de todos os dispositivos
          </Button>
        </div>
      </Setting>
    </Page>
  );
}
