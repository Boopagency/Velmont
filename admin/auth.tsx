import { createContext, useCallback, useContext, useEffect, useState, type SubmitEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ShieldCheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from './supabase';
import { Field, formText } from './ui';
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

  if (stage === 'loading')
    return (
      <AuthShell>
        <output className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner aria-hidden="true" /> Verificando acesso…
        </output>
      </AuthShell>
    );
  if (stage === 'signed-out') return <Login />;
  if (stage === 'enroll') return <EnrollMfa onDone={() => void supabase.auth.getSession().then(({ data }) => evaluate(data.session))} />;
  if (stage === 'verify') return <VerifyMfa />;
  if (stage === 'no-access') return <NoAccess />;
  return <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>;
}

export function AuthShell({ children, title, description }: { children: ReactNode; title?: string; description?: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center gap-2">
          <span aria-hidden="true" className="brand-logo h-12 w-[144px] [mask-position:center]!" />
          <span className="sr-only">Velmont</span>
          <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">Painel editorial</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-[0_1px_2px_rgba(29,21,23,0.04),0_12px_32px_-16px_rgba(29,21,23,0.12)] sm:p-7">
          {(title || description) && (
            <div className="mb-5 space-y-1.5">
              {title && <h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>}
              {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
            </div>
          )}
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Acesso restrito à equipe da Velmont.</p>
      </div>
    </main>
  );
}

const FormMessage = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg bg-destructive/8 px-3 py-2 text-[13px] text-destructive" role="alert">
    {children}
  </p>
);

function SubmitButton({ busy, children, busyLabel }: { busy: boolean; children: ReactNode; busyLabel: string }) {
  return (
    <Button type="submit" size="lg" className="mt-1 h-10 w-full" disabled={busy} aria-busy={busy || undefined}>
      {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
      {busy ? busyLabel : children}
    </Button>
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
    <AuthShell title={mode === 'login' ? 'Entrar' : 'Recuperar acesso'} description={mode === 'login' ? 'Use o e-mail e a senha da sua conta.' : 'Enviaremos um link para você criar uma nova senha.'}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="E-mail" id="email">
          <Input id="email" name="email" type="email" autoComplete="username" required maxLength={320} className="h-10" />
        </Field>
        {mode === 'login' && (
          <Field label="Senha" id="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} className="h-10" />
          </Field>
        )}
        {message && (mode === 'login' ? <FormMessage>{message}</FormMessage> : <output className="block rounded-lg bg-muted px-3 py-2 text-[13px]">{message}</output>)}
        <SubmitButton busy={busy} busyLabel={mode === 'login' ? 'Entrando…' : 'Enviando…'}>
          {mode === 'login' ? 'Entrar' : 'Enviar link'}
        </SubmitButton>
        <Button
          type="button"
          variant="link"
          className="h-auto justify-self-center p-0 text-[13px] text-muted-foreground hover:text-brand"
          onClick={() => {
            setMode(mode === 'login' ? 'reset' : 'login');
            setMessage('');
          }}
        >
          {mode === 'login' ? 'Esqueci minha senha' : 'Voltar para o login'}
        </Button>
      </form>
    </AuthShell>
  );
}

const codeInput = (
  <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required maxLength={7} className="h-11 text-center text-lg tracking-[0.35em] tabular-nums md:text-lg" />
);

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
    <AuthShell title="Proteja sua conta" description="O painel exige verificação em duas etapas. Abra um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password…) e escaneie o código abaixo.">
      {factor ? (
        <div className="grid gap-4">
          <div className="flex justify-center rounded-lg border bg-white p-3">
            <img className="qr" src={factor.qr} width="168" height="168" alt="QR code para o aplicativo autenticador" />
          </div>
          <details className="secret group rounded-lg border px-3 py-2 text-[13px]">
            <summary className="cursor-pointer font-medium text-muted-foreground outline-none select-none hover:text-foreground focus-visible:text-foreground">Não consegue escanear?</summary>
            <p className="mt-2 text-muted-foreground">Digite esta chave no aplicativo:</p>
            <code className="mt-1.5 block rounded-md bg-muted px-2.5 py-2 font-mono text-xs break-all">{factor.secret}</code>
          </details>
          <form onSubmit={verify} className="grid gap-4">
            <Field label="Código de 6 dígitos" id="code">
              {codeInput}
            </Field>
            {error && <FormMessage>{error}</FormMessage>}
            <SubmitButton busy={busy} busyLabel="Verificando…">
              Ativar e continuar
            </SubmitButton>
          </form>
        </div>
      ) : (
        !error && (
          <output className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner aria-hidden="true" /> Preparando o código…
          </output>
        )
      )}
      {!factor && error && <FormMessage>{error}</FormMessage>}
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
    <AuthShell title="Verificação em duas etapas" description="Digite o código de 6 dígitos que aparece no seu aplicativo autenticador.">
      <form onSubmit={verify} className="grid gap-4">
        <Field label="Código do aplicativo autenticador" id="code">
          {codeInput}
        </Field>
        {error && <FormMessage>{error}</FormMessage>}
        <SubmitButton busy={busy} busyLabel="Verificando…">
          Confirmar
        </SubmitButton>
      </form>
      <SignOutLink />
    </AuthShell>
  );
}

function NoAccess() {
  return (
    <AuthShell title="Acesso não liberado">
      <div className="flex gap-3 rounded-lg bg-muted p-3 text-sm leading-relaxed text-muted-foreground">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        <p>Sua conta ainda não tem acesso ao painel. Peça a uma pessoa responsável pela equipe para liberar seu e-mail.</p>
      </div>
      <SignOutLink />
    </AuthShell>
  );
}

function SignOutLink() {
  return (
    <div className="mt-4 flex justify-center border-t pt-4">
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void supabase.auth.signOut()}>
        Sair
      </Button>
    </div>
  );
}
