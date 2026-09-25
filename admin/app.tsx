import { CompassIcon } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { buttonVariants } from '@/components/ui/button';
import { AuthGate, AuthShell } from './auth';
import { Layout } from './layout';
import { Link, usePath } from './router';
import { configured } from './supabase';
import { EmptyState, Page } from './ui';
import { Account } from './pages/account';
import { ArticleEditor } from './pages/article-editor';
import { Articles } from './pages/articles';
import { Dashboard } from './pages/dashboard';
import { Leads } from './pages/leads';
import { Media } from './pages/media';
import { Team } from './pages/team';

const UUID = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

function Screen() {
  const path = usePath();
  let m: RegExpExecArray | null;
  if (path === '/admin') return <Dashboard />;
  if (path === '/admin/artigos') return <Articles />;
  if (path === '/admin/artigos/novo') return <ArticleEditor key="novo" id={null} />;
  if ((m = new RegExp(`^/admin/artigos/${UUID}$`).exec(path))) return <ArticleEditor key={m[1]} id={m[1]} />;
  if (path === '/admin/leads') return <Leads leadId={null} />;
  // A lead opens in a side sheet over the list, and keeps its own address.
  if ((m = new RegExp(`^/admin/leads/${UUID}$`).exec(path))) return <Leads leadId={m[1]} />;
  if (path === '/admin/midia') return <Media />;
  if (path === '/admin/conta') return <Account />;
  if (path === '/admin/equipe') return <Team />;
  return (
    <Page>
      <EmptyState
        icon={<CompassIcon />}
        title="Página não encontrada"
        description="O endereço pode ter mudado. Use o menu ao lado para continuar."
        action={
          <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
            Ir para o Dashboard
          </Link>
        }
      />
    </Page>
  );
}

export function App() {
  if (!configured) {
    return (
      <AuthShell title="Painel não configurado">
        <p className="text-sm text-muted-foreground">Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no ambiente de build. Consulte ADMIN-CMS-IMPLEMENTATION.md.</p>
      </AuthShell>
    );
  }
  return (
    <TooltipProvider delay={300}>
      <AuthGate>
        <Layout>
          <Screen />
        </Layout>
      </AuthGate>
      <Toaster position="bottom-right" closeButton containerAriaLabel="Notificações" toastOptions={{ duration: 5000, closeButtonAriaLabel: 'Fechar notificação', classNames: { toast: 'toast' } }} />
    </TooltipProvider>
  );
}
