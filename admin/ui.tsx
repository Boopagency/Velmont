import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { SearchIcon } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ArticleStatus, LeadStatus, Role } from './types';
import { articleStatusLabel, leadStatusLabel } from './types';

/** Reads a text field from FormData (files and missing values become ''). */
export const formText = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

export const roleLabel: Record<Role, string> = { owner: 'Responsável', editor: 'Editor' };

/** Feedback through Sonner. Errors stay longer so they can be read. */
export const notify = {
  ok: (title: string, description?: string) => toast.success(title, { description }),
  info: (title: string, description?: string) => toast.info(title, { description }),
  error: (title: string, description?: string) => toast.error(title, { description, duration: 9000 }),
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

// ---------------------------------------------------------------------------
// Dates: relative for recent activity, exact on hover or in details.

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const dayYearFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fullFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

export const fullDate = (value: string | null) => (value ? fullFormat.format(new Date(value)) : '—');
const longFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' });
export const longDate = (value: string | null) => (value ? longFormat.format(new Date(value)) : '—');

/** "agora", "há 4 min", "há 3 h", "ontem, 14:20", "12 de set.". */
export function timeAgo(value: string | null, now = Date.now()) {
  if (!value) return '—';
  const date = new Date(value);
  const minutes = Math.round((now - date.getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 6 * 60) return `há ${Math.round(minutes / 60)} h`;
  const today = new Date(now);
  const yesterday = new Date(now - 86400000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return `hoje, ${timeFormat.format(date)}`;
  if (sameDay(date, yesterday)) return `ontem, ${timeFormat.format(date)}`;
  return (date.getFullYear() === today.getFullYear() ? dayFormat : dayYearFormat).format(date);
}

/** Relative time that stays current and shows the exact moment on hover. */
export function TimeAgo({ value, className }: { value: string | null; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  if (!value) return <span className={className}>—</span>;
  return (
    <time dateTime={value} title={fullDate(value)} className={cn('tabular', className)}>
      {timeAgo(value)}
    </time>
  );
}

// ---------------------------------------------------------------------------
// Page structure.

export function PageHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn('mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em] text-foreground md:text-[28px]">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Content width and rhythm shared by every page of the panel. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-9 lg:px-10', className)}>{children}</div>;
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
      <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Field({ label, hint, id, children, className, labelAside }: { label: ReactNode; hint?: ReactNode; id: string; children: ReactNode; className?: string; labelAside?: ReactNode }) {
  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-[13px]">
          {label}
        </Label>
        {labelAside}
      </div>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status: soft tones, never a rainbow. Green = on the site, champagne = waiting,
// burgundy = new, neutral = private or archived.

const tone = {
  neutral: 'border-transparent bg-muted text-foreground/75',
  success: 'border-transparent bg-success-soft text-success',
  champagne: 'border-transparent bg-champagne-soft text-champagne-foreground',
  brand: 'border-transparent bg-brand-soft text-brand',
  outline: 'border-border bg-transparent text-muted-foreground',
} as const;
const dot = { neutral: 'bg-foreground/35', success: 'bg-success', champagne: 'bg-champagne', brand: 'bg-brand', outline: 'bg-muted-foreground/50' } as const;
type Tone = keyof typeof tone;

export function StatusBadge({ tone: t, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn('h-[22px] gap-1.5 rounded-full px-2 text-xs font-medium', tone[t], className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', dot[t])} />
      {children}
    </Badge>
  );
}

const articleTone: Record<ArticleStatus, Tone> = { published: 'success', draft: 'neutral', review: 'champagne', archived: 'outline' };
export const ArticleStatusBadge = ({ status }: { status: ArticleStatus }) => <StatusBadge tone={articleTone[status]}>{articleStatusLabel[status]}</StatusBadge>;

const leadTone: Record<LeadStatus, Tone> = { new: 'brand', contacted: 'champagne', qualified: 'neutral', converted: 'success', archived: 'outline' };
export const LeadStatusBadge = ({ status }: { status: LeadStatus }) => <StatusBadge tone={leadTone[status]}>{leadStatusLabel[status]}</StatusBadge>;

// ---------------------------------------------------------------------------
// Toolbar search and filters.

export function SearchInput({ value, onChange, label, placeholder, className }: { value: string; onChange: (value: string) => void; label: string; placeholder: string; className?: string }) {
  return (
    <InputGroup className={cn('h-8 w-full bg-background sm:w-72', className)}>
      <InputGroupAddon>
        <SearchIcon aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput type="search" aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} className="text-[13px] md:text-[13px]" />
    </InputGroup>
  );
}

/** A compact shadcn Select whose value maps to a readable label. */

export function FilterSelect({ label, value, onChange, options, className }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][]; className?: string }) {
  return (
    <Select items={Object.fromEntries(options)} value={value} onValueChange={(v) => onChange(String(v ?? ''))}>
      <SelectTrigger aria-label={label} className={cn('h-8 min-w-0 bg-background text-[13px] data-[size=default]:h-8', value !== options[0][0] && 'border-brand/30 bg-brand-soft/60 text-brand', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {options.map(([v, text]) => (
          <SelectItem key={v} value={v}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Empty and loading states.

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Empty className={cn('border border-dashed border-border bg-background py-12', className)}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon" className="bg-brand-soft text-brand">{icon}</EmptyMedia>}
        <EmptyTitle className="text-[15px] font-semibold">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <output className={cn('grid gap-3', className)} aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
        </div>
      ))}
    </output>
  );
}

// ---------------------------------------------------------------------------
// Confirmation: shadcn AlertDialog behind a promise, so flows read top to bottom.

type ConfirmState = { title: string; text: string; action: string; danger: boolean };

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<ConfirmState | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirm = useCallback(
    (title: string, text: string, action = 'Confirmar', danger = false) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setContent({ title, text, action, danger });
        setOpen(true);
      }),
    [],
  );
  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  };
  const dialog = (
    <AlertDialog open={open} onOpenChange={(next) => !next && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[15px] font-semibold">{content?.title}</AlertDialogTitle>
          <AlertDialogDescription>{content?.text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant={content?.danger ? 'destructive' : 'default'} onClick={() => settle(true)}>
            {content?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { confirm, dialog };
}

// ---------------------------------------------------------------------------
// Breadcrumbs: each page names where it is; the top bar shows it.

export type Crumb = { label: string; href?: string };
const CrumbContext = createContext<(crumbs: Crumb[] | null) => void>(() => {});
export const CrumbProvider = CrumbContext.Provider;

export function useCrumbs(crumbs: Crumb[] | null) {
  const set = useContext(CrumbContext);
  const key = JSON.stringify(crumbs);
  const stable = useMemo(() => JSON.parse(key) as Crumb[] | null, [key]);
  useEffect(() => {
    set(stable);
    return () => set(null);
  }, [set, stable]);
}
