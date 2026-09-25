import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRightIcon, FileTextIcon, ImagesIcon, InboxIcon, LayoutDashboardIcon, LogOutIcon, UserRoundCogIcon, UsersIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStaff } from './auth';
import { Link, confirmLeave, usePath } from './router';
import { supabase } from './supabase';
import { CrumbProvider, initials, roleLabel, type Crumb } from './ui';

const main = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/admin/artigos', label: 'Artigos', icon: FileTextIcon },
  { href: '/admin/leads', label: 'Leads', icon: InboxIcon },
  { href: '/admin/midia', label: 'Mídia', icon: ImagesIcon },
] as const;

const sections: [RegExp, Crumb[]][] = [
  [/^\/admin\/artigos\/novo$/, [{ label: 'Artigos', href: '/admin/artigos' }, { label: 'Novo artigo' }]],
  [/^\/admin\/artigos\/.+/, [{ label: 'Artigos', href: '/admin/artigos' }, { label: 'Artigo' }]],
  [/^\/admin\/artigos$/, [{ label: 'Artigos' }]],
  [/^\/admin\/leads\/.+/, [{ label: 'Leads', href: '/admin/leads' }, { label: 'Lead' }]],
  [/^\/admin\/leads$/, [{ label: 'Leads' }]],
  [/^\/admin\/midia$/, [{ label: 'Mídia' }]],
  [/^\/admin\/equipe$/, [{ label: 'Gestão' }, { label: 'Equipe' }]],
  [/^\/admin\/conta$/, [{ label: 'Conta' }]],
];
const defaultCrumbs = (path: string) => sections.find(([re]) => re.test(path))?.[1] || [{ label: 'Dashboard' }];

/** Desktop starts expanded from 1024 px; the choice is remembered (shadcn cookie). */
function initialOpen() {
  const saved = /(?:^|;\s*)sidebar_state=(true|false)/.exec(document.cookie)?.[1];
  return saved ? saved === 'true' : window.innerWidth >= 1024;
}

function useNewLeads(path: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    void supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')
      .then(({ count: n }) => setCount(n ?? 0));
  }, [path]);
  return count;
}

function AppSidebar({ path }: { path: string }) {
  const staff = useStaff();
  const { isMobile, setOpenMobile } = useSidebar();
  const newLeads = useNewLeads(path);
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  const close = () => isMobile && setOpenMobile(false);
  const item = (href: string, label: string, Icon: typeof FileTextIcon, badge?: number) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton
        isActive={active(href)}
        tooltip={label}
        className="h-9 gap-2.5 px-2.5 text-[13.5px] text-sidebar-foreground/85 data-active:bg-brand-soft data-active:font-semibold data-active:text-brand data-active:[&_svg]:text-brand [&_svg]:text-sidebar-foreground/60"
        render={<Link href={href} aria-current={active(href) ? 'page' : undefined} onClick={close} />}
      >
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </SidebarMenuButton>
      {!!badge && (
        <SidebarMenuBadge className="top-2! rounded-full bg-brand-soft px-1.5 text-[11px] text-brand">
          <span className="sr-only">novos: </span>
          {badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
  const signOut = () =>
    void confirmLeave().then(async (ok) => {
      if (ok) await supabase.auth.signOut();
    });
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="px-2 pt-4 pb-3">
        <Link href="/admin" aria-label="Velmont — painel" onClick={close} className="flex h-10 items-center rounded-md px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span aria-hidden="true" className="brand-logo h-9 w-[108px] group-data-[collapsible=icon]:hidden" />
          <span aria-hidden="true" className="brand-mark hidden w-8 group-data-[collapsible=icon]:block" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <nav id="admin-nav" aria-label="Painel">
          <SidebarGroup className="px-2 py-1">
            <SidebarMenu className="gap-0.5">{main.map((m) => item(m.href, m.label, m.icon, m.href === '/admin/leads' ? newLeads : undefined))}</SidebarMenu>
          </SidebarGroup>
          {staff.role === 'owner' && (
            <SidebarGroup className="px-2 pt-4">
              <SidebarGroupLabel className="h-7 px-2.5 text-[11px] font-semibold tracking-[0.06em] text-sidebar-foreground/55 uppercase">Gestão</SidebarGroupLabel>
              <SidebarMenu className="gap-0.5">{item('/admin/equipe', 'Equipe', UsersIcon)}</SidebarMenu>
            </SidebarGroup>
          )}
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-1 px-2 pb-3">
        <SidebarMenu>{item('/admin/conta', 'Conta', UserRoundCogIcon)}</SidebarMenu>
        <Separator className="my-1.5 bg-sidebar-border" />
        <div className="flex items-center gap-2.5 px-1.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
          <Avatar size="sm" className="size-7">
            <AvatarFallback className="bg-brand-soft text-[11px] font-semibold text-brand">{initials(staff.displayName)}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[13px] font-semibold">{staff.displayName}</span>
            <span className="truncate text-xs text-muted-foreground">{roleLabel[staff.role]}</span>
          </div>
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Sair" className="text-muted-foreground hover:text-foreground" onClick={signOut} />}>
              <LogOutIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="top">Sair</TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function Topbar({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3 md:rounded-t-xl md:px-4">
      <SidebarTrigger aria-label="Alternar menu lateral" className="-ml-1 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="mx-1 data-vertical:h-4 data-vertical:self-center" />
      <span aria-hidden="true" className="brand-logo mr-1 h-6 w-[72px] shrink-0 md:hidden" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap text-[13px]">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={`${i}-${crumb.label}`}>
                <BreadcrumbItem className={cn('min-w-0', !last && 'hidden md:inline-flex')}>
                  {last ? (
                    <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                  ) : crumb.href ? (
                    <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </BreadcrumbItem>
                {!last && <BreadcrumbSeparator className="hidden md:block" />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex shrink-0 items-center">
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <span className="hidden sm:inline">Ver site</span>
          <span className="sr-only sm:hidden">Ver site</span>
          <ArrowUpRightIcon className="size-4" aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const path = usePath();
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  const [open] = useState(initialOpen);
  return (
    <CrumbProvider value={setCrumbs}>
      <SidebarProvider defaultOpen={open} className="md:h-svh md:overflow-hidden">
        <a className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow" href="#conteudo">
          Pular para o conteúdo
        </a>
        <AppSidebar path={path} />
        <SidebarInset
          id="conteudo"
          tabIndex={-1}
          className="content min-w-0 outline-none md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:overflow-y-auto md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:border-sidebar-border md:peer-data-[variant=inset]:shadow-[0_1px_2px_rgba(29,21,23,0.04),0_8px_24px_-12px_rgba(29,21,23,0.08)]"
        >
          <Topbar crumbs={crumbs || defaultCrumbs(path)} />
          <div className="flex-1">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </CrumbProvider>
  );
}
