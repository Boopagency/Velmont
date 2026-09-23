import { useEffect, useState, type SubmitEvent } from 'react';
import type { Factor } from '@supabase/supabase-js';
import { useStaff } from '../auth';
import { supabase } from '../supabase';
import { date } from '../types';
import { Button, Field, formText, PageHeader, useConfirm, useToast } from '../ui';

export function Account() {
  const staff = useStaff();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [busy, setBusy] = useState(false);
  const recovering = new URLSearchParams(location.search).get('senha') === 'nova';

  useEffect(() => {
    void supabase.auth.mfa.listFactors().then(({ data }) => setFactors(data?.totp || []));
  }, []);

  async function changePassword(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const password = formText(data, 'password');
    if (password.length < 12) return toast('error', 'Use pelo menos 12 caracteres.');
    if (password !== formText(data, 'confirm')) return toast('error', 'As senhas não conferem.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) toast('error', error.message.includes('weak') || error.message.includes('pwned') ? 'Senha fraca ou exposta em vazamentos. Escolha outra.' : 'Não foi possível alterar a senha.');
    else {
      form.reset();
      toast('ok', 'Senha alterada.');
    }
  }

  async function signOutEverywhere() {
    if (await confirm('Sair de todos os dispositivos?', 'Todas as sessões abertas, inclusive esta, serão encerradas.', 'Sair de todos')) await supabase.auth.signOut({ scope: 'global' });
  }

  return (
    <>
      {dialog}
      <PageHeader eyebrow="Conta" title={staff.displayName} />
      <div className="columns">
        <section className="panel">
          <h2>{recovering ? 'Crie sua nova senha' : 'Alterar senha'}</h2>
          <form className="stack" onSubmit={(e) => void changePassword(e)}>
            <input type="email" autoComplete="username" value={staff.email} readOnly hidden />
            <Field label="Nova senha" id="password" hint="Mínimo de 12 caracteres. Prefira uma frase longa.">
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
            </Field>
            <Field label="Confirme a nova senha" id="confirm">
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
            </Field>
            <Button type="submit" busy={busy}>Salvar senha</Button>
          </form>
        </section>
        <section className="panel stack">
          <h2>Segurança</h2>
          <p>E-mail: <strong>{staff.email}</strong></p>
          <p>Papel: <strong>{staff.role === 'owner' ? 'Responsável (owner)' : 'Editora'}</strong></p>
          <p>Verificação em duas etapas: <strong>ativa</strong>{factors[0] && ` desde ${date(factors[0].created_at)}`}.</p>
          <p className="field-hint">Trocou de celular? Peça à pessoa responsável para redefinir seu autenticador no Supabase; no próximo acesso você cadastra o novo.</p>
          <Button variant="secondary" onClick={() => void signOutEverywhere()}>Sair de todos os dispositivos</Button>
        </section>
      </div>
    </>
  );
}
