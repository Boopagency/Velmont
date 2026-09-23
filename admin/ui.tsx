import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

/** Reads a text field from FormData (files and missing values become ''). */
export const formText = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

export function Button({ variant = 'primary', busy = false, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; busy?: boolean }) {
  return (
    <button type="button" {...props} className={`btn btn-${variant} ${props.className || ''}`} disabled={props.disabled || busy} aria-busy={busy || undefined}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children, id }: { label: string; hint?: ReactNode; children: ReactNode; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: string; title: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function Loading() {
  return <output className="loading">Carregando…</output>;
}

type Toast = { id: number; tone: 'ok' | 'error' | 'info'; text: string };
const ToastContext = createContext<(tone: Toast['tone'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 9000 : 5000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <output className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={`toast toast-${t.tone}`}>
            {t.text}
          </p>
        ))}
      </output>
    </ToastContext.Provider>
  );
}

/** Accessible confirmation built on the native <dialog>. */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; text: string; action: string; danger: boolean; resolve: (ok: boolean) => void } | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (state && !ref.current?.open) ref.current?.showModal();
  }, [state]);
  const confirm = (title: string, text: string, action = 'Confirmar', danger = false) => new Promise<boolean>((resolve) => setState({ title, text, action, danger, resolve }));
  const close = (ok: boolean) => {
    state?.resolve(ok);
    ref.current?.close();
    setState(null);
  };
  const dialog = state && (
    <dialog ref={ref} className="dialog" onCancel={() => close(false)} aria-labelledby="confirm-title">
      <h2 id="confirm-title">{state.title}</h2>
      <p>{state.text}</p>
      <div className="dialog-actions">
        <Button variant="secondary" onClick={() => close(false)}>
          Cancelar
        </Button>
        <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
          {state.action}
        </Button>
      </div>
    </dialog>
  );
  return { confirm, dialog };
}
