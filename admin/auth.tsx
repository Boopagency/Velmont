import { createContext, useCallback, useContext, useEffect, useState, type SubmitEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Button, Field, formText } from './ui';
import type { Role } from './types';

export type Staff = { userId: string; email: string; role: Role; displayName: string };
const StaffContext = createContext<Staff | null>(null);
export const useStaff = () => useContext(StaffContext)!;

type Stage = 'loading' | 'signed-out' | 'enroll' | 'verify' | 'no-access' | 'ready';

/**
 * Decides what the browser shows. It is a convenience only: the database
 * refuses every private query unless the JWT is aal2 and the user is active
 * staff, whatever this component renders.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('loading');
  const [staff, setStaff] = useState<Staff | null>(null);

  const evaluate = useCallback(async (session: Session | null) => {
    if (!session) {
      setStaff(null);
      setStage('signed-out');
      return;
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') {
      setStage(aal?.nextLevel === 'aal2' ? 'verify' : 'enroll');
      return;
    }
    const { data, error } = await supabase.rpc('admin_context');
    const ctx = data as { is_staff?: boolean; role?: Role; display_name?: string } | null;
    if (error || !ctx?.is_staff || !ctx.role) {
      setStage('no-access');
      return;
    }
    const marker = `vm-login:${session.user.id}:${session.user.last_sign_in_at}`;
    try {
      if (!sessionStorage.getItem(marker)) {
        sessionStorage.setItem(marker, '1');
        void supabase.rpc('record_admin_login').then(() => undefined);
      }
    } catch {
      // Audit of the login is best effort.
    }
    setStaff({ userId: session.user.id, email: session.user.email || '', role: ctx.role, displayName: ctx.display_name || session.user.email || '' });
    setStage('ready');
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'MFA_CHALLENGE_VERIFIED' || event === 'USER_UPDATED') setTimeout(() => void evaluate(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [evaluate]);

  if (stage === 'loading') return <AuthShell><output>Verificando acesso…</output></AuthShell>;
  if (stage === 'signed-out') return <Login />;
  if (stage === 'enroll') return <EnrollMfa onDone={() => void supabase.auth.getSession().then(({ data }) => evaluate(data.session))} />;
  if (stage === 'verify') return <VerifyMfa />;
  if (stage === 'no-access') return <NoAccess />;
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>;
}

function AuthShell({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-brand"><img src="/images/velmont-logo.webp" width="140" height="70" alt="Velmont" /></div>
        <p className="eyebrow">Painel editorial</p>
        {title && <h1>{title}</h1>}
        {children}
      </div>
    </main>
  );
}

function Login() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = formText(form, 'email').trim();
    setBusy(true);
    setMessage('');
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: formText(form, 'password') });
      if (error) setMessage(error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'E-mail ou senha incorretos.');
    } else {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin/conta?senha=nova` });
      setMessage('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.');
    }
    setBusy(false);
  }
  return (
    <AuthShell title={mode === 'login' ? 'Entrar' : 'Recuperar acesso'}>
      <form onSubmit={submit} className="stack">
        <Field label="E-mail" id="email">
          <input id="email" name="email" type="email" autoComplete="username" required maxLength={320} />
        </Field>
        {mode === 'login' && (
          <Field label="Senha" id="password">
            <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} />
          </Field>
        )}
        {message && <p className="form-message" role="alert">{message}</p>}
        <Button type="submit" busy={busy}>
          {mode === 'login' ? 'Entrar' : 'Enviar link'}
        </Button>
        <button type="button" className="text-button" onClick={() => { setMode(mode === 'login' ? 'reset' : 'login'); setMessage(''); }}>
          {mode === 'login' ? 'Esqueci minha senha' : 'Voltar para o login'}
        </button>
      </form>
    </AuthShell>
  );
}

function EnrollMfa({ onDone }: { onDone: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all || []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Velmont ${new Date().toISOString().slice(0, 10)}` });
      if (enrollError || !data) setError('Não foi possível iniciar a configuração. Recarregue a página.');
      else setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, []);
  async function verify(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!factor) return;
    setBusy(true);
    const code = formText(new FormData(e.currentTarget), 'code').replace(/\D/g, '');
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (verifyError) setError('Código inválido. Confira o horário do celular e tente o código atual.');
    else onDone();
  }
  return (
    <AuthShell title="Proteja sua conta">
      <p>O painel exige verificação em duas etapas. Abra um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password…) e escaneie o código abaixo.</p>
      {factor && (
        <>
          <img className="qr" src={factor.qr} width="180" height="180" alt="QR code para o aplicativo autenticador" />
          <details className="secret">
            <summary>Não consegue escanear?</summary>
            <p>Digite esta chave no aplicativo:</p>
            <code>{factor.secret}</code>
          </details>
          <form onSubmit={verify} className="stack">
            <Field label="Código de 6 dígitos" id="code">
              <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required maxLength={7} />
            </Field>
            <Button type="submit" busy={busy}>Ativar e continuar</Button>
          </form>
        </>
      )}
      {error && <p className="form-message" role="alert">{error}</p>}
      <SignOutLink />
    </AuthShell>
  );
}

function VerifyMfa() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function verify(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const code = formText(new FormData(e.currentTarget), 'code').replace(/\D/g, '');
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp[0];
    const result = factor ? await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code }) : null;
    setBusy(false);
    if (!result || result.error) setError(result?.error?.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Código inválido.');
  }
  return (
    <AuthShell title="Verificação em duas etapas">
      <form onSubmit={verify} className="stack">
        <Field label="Código do aplicativo autenticador" id="code">
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required maxLength={7} />
        </Field>
        {error && <p className="form-message" role="alert">{error}</p>}
        <Button type="submit" busy={busy}>Confirmar</Button>
      </form>
      <SignOutLink />
    </AuthShell>
  );
}

function NoAccess() {
  return (
    <AuthShell title="Acesso não liberado">
      <p>Sua conta ainda não tem acesso ao painel. Peça a uma pessoa responsável pela equipe para liberar seu e-mail.</p>
      <SignOutLink />
    </AuthShell>
  );
}

function SignOutLink() {
  return (
    <button type="button" className="text-button" onClick={() => void supabase.auth.signOut()}>
      Sair
    </button>
  );
}
