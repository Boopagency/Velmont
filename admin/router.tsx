import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// Minimal client router for /admin/*. The server rewrites every admin path
// to the same static shell; nothing here grants access by itself.
const listeners = new Set<() => void>();

export function navigate(to: string, { replace = false } = {}) {
  if (!to.startsWith('/admin')) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  listeners.forEach((l) => l());
  window.scrollTo(0, 0);
}

export function usePath() {
  const [path, setPath] = useState(() => location.pathname.replace(/\/$/, '') || '/admin');
  useEffect(() => {
    const update = () => setPath(location.pathname.replace(/\/$/, '') || '/admin');
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
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
