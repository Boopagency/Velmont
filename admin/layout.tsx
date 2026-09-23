import { useState, type ReactNode } from 'react';
import { useStaff } from './auth';
import { Link, usePath } from './router';
import { supabase } from './supabase';

const main = [
  ['/admin', 'Dashboard'],
  ['/admin/artigos', 'Artigos'],
  ['/admin/leads', 'Leads'],
  ['/admin/midia', 'Mídia'],
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const staff = useStaff();
  const path = usePath();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  const item = (href: string, label: string) => (
    <Link key={href} href={href} className={active(href) ? 'active' : undefined} aria-current={active(href) ? 'page' : undefined} onClick={() => setOpen(false)}>
      {label}
    </Link>
  );
  return (
    <div className="shell">
      <a className="skip" href="#conteudo">Pular para o conteúdo</a>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top">
          <Link href="/admin" className="brand" aria-label="Velmont — painel">
            <img src="/images/velmont-logo.webp" width="112" height="56" alt="Velmont" />
          </Link>
          <button type="button" className="menu-button" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen(!open)}>
            {open ? 'Fechar' : 'Menu'}
          </button>
        </div>
        <nav id="admin-nav" aria-label="Painel">
          <div className="nav-main">{main.map(([href, label]) => item(href, label))}</div>
          <div className="nav-bottom">
            {staff.role === 'owner' && item('/admin/equipe', 'Equipe')}
            {item('/admin/conta', 'Conta')}
            <button type="button" onClick={() => void supabase.auth.signOut()}>
              Sair
            </button>
            <p className="who">
              {staff.displayName}
              <span>{staff.role === 'owner' ? 'Responsável' : 'Editora'}</span>
            </p>
          </div>
        </nav>
      </aside>
      <main id="conteudo" className="content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
