import { AuthGate } from './auth';
import { Layout } from './layout';
import { usePath } from './router';
import { configured } from './supabase';
import { ToastProvider } from './ui';
import { Account } from './pages/account';
import { ArticleEditor } from './pages/article-editor';
import { Articles } from './pages/articles';
import { Dashboard } from './pages/dashboard';
import { LeadDetail, Leads } from './pages/leads';
import { Media } from './pages/media';
import { Team } from './pages/team';

const UUID = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

function Page() {
  const path = usePath();
  let m: RegExpExecArray | null;
  if (path === '/admin') return <Dashboard />;
  if (path === '/admin/artigos') return <Articles />;
  if (path === '/admin/artigos/novo') return <ArticleEditor key="novo" id={null} />;
  if ((m = new RegExp(`^/admin/artigos/${UUID}$`).exec(path))) return <ArticleEditor key={m[1]} id={m[1]} />;
  if (path === '/admin/leads') return <Leads />;
  if ((m = new RegExp(`^/admin/leads/${UUID}$`).exec(path))) return <LeadDetail key={m[1]} id={m[1]} />;
  if (path === '/admin/midia') return <Media />;
  if (path === '/admin/conta') return <Account />;
  if (path === '/admin/equipe') return <Team />;
  return <p className="empty">Página não encontrada.</p>;
}

export function App() {
  if (!configured) {
    return (
      <main className="auth">
        <div className="auth-card">
          <h1>Painel não configurado</h1>
          <p>Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente de build. Consulte ADMIN-CMS-IMPLEMENTATION.md.</p>
        </div>
      </main>
    );
  }
  return (
    <ToastProvider>
      <AuthGate>
        <Layout>
          <Page />
        </Layout>
      </AuthGate>
    </ToastProvider>
  );
}
