import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Minimal client router for /admin/*. The server rewrites every admin path
// to the same static shell; nothing here grants access by itself.
const listeners = new Set<() => void>();
const here = () => location.pathname + location.search;
let current = typeof location === 'undefined' ? '' : here();

// A page with unsaved work registers a guard; every in-app navigation (links,
// back/forward, sign-out) asks it first. Tab close/reload uses beforeunload.
type Guard = () => Promise<boolean>;
let guard: Guard | null = null;

export function setLeaveGuard(next: Guard) {
  guard = next;
  return () => {
    if (guard === next) guard = null;
  };
}

/** Resolves true when it is fine to leave the current page. */
export const confirmLeave = () => (guard ? guard() : Promise.resolve(true));

function go(to: string, replace: boolean) {
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  current = here();
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

/** `force` skips the leave guard (used after the page saved its own work). */
export function navigate(to: string, { replace = false, force = false } = {}) {
  if (!to.startsWith('/admin')) return;
  if (force || !guard) return go(to, replace);
  void confirmLeave().then((ok) => {
    if (ok) go(to, replace);
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const target = here();
    if (guard) {
      // Undo the browser's move until the page agrees to leave.
      history.pushState(null, '', current);
      void confirmLeave().then((ok) => {
        if (ok) {
          guard = null;
          go(target, false);
        }
      });
      return;
    }
    current = target;
    listeners.forEach((l) => l());
  });
}

export function usePath() {
  const [path, setPath] = useState(() => location.pathname.replace(/\/$/, '') || '/admin');
  useEffect(() => {
    const update = () => setPath(location.pathname.replace(/\/$/, '') || '/admin');
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return path;
}

export function Link({ href, onClick, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...props}
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
