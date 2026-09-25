import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  ExternalLinkIcon,
  EyeIcon,
  HistoryIcon,
  ImageIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
  UndoIcon,
  XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { contentSchema, SLUG_RE, sourceSchema } from '@/lib/blog/schema';
import { readingMinutes } from '@/lib/blog/posts';
import { authorKeys, categories, type Block } from '@/lib/blog/types';
import { cn } from '@/lib/utils';
import { useStaff } from '../auth';
import { BlockEditor, cleanBlocks, emptyBlock } from '../blocks';
import { MediaPicker } from '../media';
import { MediaImage } from '../signed';
import { navigate, setLeaveGuard } from '../router';
import { SiteStateIcon, useSiteStatus } from '../site-status';
import { adminApi, explain, supabase } from '../supabase';
import { authorLabel, categoryLabel, editableArticleFields, hasUnpublishedChanges, type ArticleDraft, type ArticleRow, type MediaItem } from '../types';
import { ArticleStatusBadge, longDate, notify, TimeAgo, useConfirm, useCrumbs } from '../ui';

const select = 'id, title, slug, excerpt, content, featured_image_id, author_key, category, tags, sources, seo_title, seo_description, canonical_url, og_title, og_description, og_image_id, robots_index, reading_minutes, status, version, first_published_at, created_at, updated_at, published:published_articles(slug, source_version, published_at, modified_at)';

export const slugify = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

const blank = (): ArticleDraft => ({
  title: '', slug: '', excerpt: '', content: { version: 1, blocks: [emptyBlock('paragraph')] }, featured_image_id: null, author_key: 'velmont', category: 'MARCAS', tags: [], sources: [],
  seo_title: null, seo_description: null, canonical_url: null, og_title: null, og_description: null, og_image_id: null, robots_index: true,
});
const pick = (row: ArticleRow): ArticleDraft => {
  const draft = Object.fromEntries(editableArticleFields.map((k) => [k, row[k]])) as ArticleDraft;
  return { ...draft, content: { version: 1, blocks: draft.content.blocks.map((b, i) => ({ ...b, id: b.id || `k${i}` })) } };
};
const nullIfEmpty = (v: string | null) => (v && v.trim() ? v.trim() : null);

/** What goes to the database: trimmed, empty blocks removed, validated. */
function toPayload(d: ArticleDraft, fallbackSlug: string) {
  const payload = {
    ...d,
    title: d.title.trim(),
    slug: d.slug.trim() || fallbackSlug,
    excerpt: d.excerpt.trim(),
    content: { version: 1 as const, blocks: cleanBlocks(d.content.blocks) },
    tags: [...new Set(d.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 12),
    sources: d.sources.map((s) => ({ title: s.title.trim(), url: s.url.trim() })).filter((s) => s.title || s.url),
    seo_title: nullIfEmpty(d.seo_title), seo_description: nullIfEmpty(d.seo_description), canonical_url: nullIfEmpty(d.canonical_url),
    og_title: nullIfEmpty(d.og_title), og_description: nullIfEmpty(d.og_description),
  };
  const problems: string[] = [];
  if (!SLUG_RE.test(payload.slug)) problems.push('O endereço (slug) só pode ter letras minúsculas, números e hífens.');
  if (!contentSchema.safeParse(payload.content).success) problems.push('Algum bloco de conteúdo está incompleto ou muito longo.');
  payload.sources.forEach((s, i) => { if (!sourceSchema.safeParse(s).success) problems.push(`Referência ${i + 1}: informe título e um endereço que comece com https://.`); });
  if (payload.canonical_url && !/^https:\/\/[^\s<>"]+$/.test(payload.canonical_url)) problems.push('A URL canônica precisa começar com https://.');
  return { payload, problems };
}

function checklist(d: ArticleDraft, media: MediaItem | null) {
  const blocks = d.content.blocks;
  const text = JSON.stringify(blocks);
  return [
    { ok: d.title.trim().length >= 3, required: true, label: 'Título' },
    { ok: d.excerpt.trim().length >= 10, required: true, label: 'Resumo (aparece na busca e nos cards)' },
    { ok: cleanBlocks(blocks).length > 0, required: true, label: 'Conteúdo' },
    { ok: blocks.some((b) => b.type === 'heading' && b.level === 2), required: false, label: 'Títulos de seção organizando o texto' },
    { ok: blocks.some((b) => b.type === 'callout' || b.type === 'faq'), required: false, label: 'Resposta direta (resumo ou pergunta e resposta)' },
    { ok: !!media && media.alt.trim().length > 0, required: false, label: 'Imagem principal com descrição' },
    { ok: d.sources.length > 0, required: false, label: 'Referências (ex.: páginas do INPI)' },
    { ok: /\]\(\/(?!\/)/.test(text), required: false, label: 'Link para um serviço ou outro artigo do site' },
    { ok: d.excerpt.trim().length >= 50 && d.excerpt.trim().length <= 160, required: false, label: 'Resumo entre 50 e 160 caracteres' },
  ];
}

type Revision = { id: number; kind: 'edit' | 'publish'; created_at: string; snapshot: ArticleRow };
type Busy = 'save' | 'publish' | 'review' | 'draft' | 'unpublish' | 'archive' | null;

/** Grows a textarea with its content (also where CSS field-sizing is not supported). */
function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t py-5 first:border-t-0 first:pt-0">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold tracking-[-0.005em]">{title}</h2>
        {aside}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Counter({ value, ideal, max }: { value: number; ideal: [number, number]; max?: number }) {
  const good = value >= ideal[0] && value <= ideal[1];
  return (
    <span className={cn('text-xs tabular', value === 0 ? 'text-muted-foreground' : good ? 'text-success' : 'text-champagne-foreground')}>
      {value}
      {max ? `/${max}` : ''}
    </span>
  );
}

function TagInput({ id, value, onChange, suggestions }: { id: string; value: string[]; onChange: (tags: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const tag = raw.trim().slice(0, 40);
    if (!tag || value.length >= 12 || value.some((t) => t.toLowerCase() === tag.toLowerCase())) return setText('');
    onChange([...value, tag]);
    setText('');
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
      {value.map((tag) => (
        <span key={tag} className="inline-flex h-6 items-center gap-1 rounded-md bg-muted pr-0.5 pl-2 text-xs font-medium">
          {tag}
          <button type="button" className="grid size-5 place-items-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remover tag ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))}>
            <XIcon className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={`${id}-suggestions`}
        value={text}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
        onKeyDown={key}
        onBlur={() => text.trim() && add(text)}
        placeholder={value.length ? '' : 'Digite e tecle Enter'}
        maxLength={40}
        disabled={value.length >= 12}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        className="h-6 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <datalist id={`${id}-suggestions`}>
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </datalist>
    </div>
  );
}

export function ArticleEditor({ id }: { id: string | null }) {
  const staff = useStaff();
  const site = useSiteStatus();
  const { confirm, dialog } = useConfirm();
  const [row, setRow] = useState<ArticleRow | null>(null);
  const [draft, setDraft] = useState<ArticleDraft | null>(id ? null : blank());
  const [dirty, setDirty] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [picker, setPicker] = useState<'featured' | 'og' | null>(null);
  const [images, setImages] = useState<Record<string, MediaItem>>({});
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [published, setPublished] = useState<'updating' | 'not_updated' | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const backupKey = `vm-draft:${id || 'novo'}`;
  const [fallbackSlug] = useState(() => `rascunho-${Math.random().toString(36).slice(2, 8)}`);
  const [reloadKey, setReloadKey] = useState(0);
  const confirmRef = useRef(confirm);
  const dirtyRef = useRef(dirty);
  const checklistRef = useRef<HTMLDivElement>(null);
  const titleRef = useAutosize(draft?.title || '');
  const excerptRef = useAutosize(draft?.excerpt || '');
  useEffect(() => {
    confirmRef.current = confirm;
    dirtyRef.current = dirty;
  });
  useCrumbs([{ label: 'Artigos', href: '/admin/artigos' }, { label: id ? draft?.title.trim() || row?.title || 'Sem título' : 'Novo artigo' }]);

  // In-app navigation (links, back/forward, sign-out) asks before discarding edits.
  useEffect(
    () =>
      setLeaveGuard(() =>
        dirtyRef.current
          ? confirmRef.current('Sair sem salvar?', 'As alterações deste artigo ainda não foram salvas. Se sair agora, elas ficam só na cópia local deste navegador.', 'Sair sem salvar', true)
          : Promise.resolve(true),
      ),
    [],
  );

  useEffect(() => {
    void supabase
      .from('articles')
      .select('tags')
      .limit(200)
      .then(({ data }) => setTagSuggestions([...new Set(((data as { tags: string[] }[]) || []).flatMap((r) => r.tags || []))].sort((a, b) => a.localeCompare(b, 'pt-BR'))));
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from('articles').select(select).eq('id', id).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        notify.error('Artigo não encontrado.');
        navigate('/admin/artigos', { replace: true, force: true });
        return;
      }
      const article = data as unknown as ArticleRow;
      setRow(article);
      let next = pick(article);
      try {
        const backup = JSON.parse(localStorage.getItem(`vm-draft:${id}`) || 'null') as { version: number; draft: ArticleDraft } | null;
        if (backup && backup.version === article.version && JSON.stringify(backup.draft) !== JSON.stringify(next) && (await confirmRef.current('Alterações não salvas', 'Encontramos alterações deste artigo que não foram salvas neste navegador. Deseja recuperá-las?', 'Recuperar'))) {
          next = backup.draft;
          setDirty(true);
        } else localStorage.removeItem(`vm-draft:${id}`);
      } catch {
        // Local backup is optional.
      }
      setDraft(next);
      setSlugTouched(article.status !== 'draft' || !!article.published || !article.slug.startsWith('rascunho-'));
      const ids = [next.featured_image_id, next.og_image_id].filter(Boolean) as string[];
      if (ids.length) {
        const { data: media } = await supabase.from('media').select('id, path, mime_type, bytes, width, height, alt, created_at').in('id', ids);
        setImages(Object.fromEntries(((media as MediaItem[]) || []).map((m) => [m.id, m])));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Protect unsaved work: local backup and a warning before leaving the page.
  useEffect(() => {
    if (!dirty || !draft) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(backupKey, JSON.stringify({ version: row?.version ?? 0, draft }));
      } catch {
        // Storage full or blocked.
      }
    }, 800);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeunload', warn);
    };
  }, [dirty, draft, row?.version, backupKey]);

  const update = <K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, [key]: value };
      if (key === 'title' && !slugTouched && typeof value === 'string') next.slug = slugify(value);
      return next;
    });
    setDirty(true);
  };

  const minutes = useMemo(() => (draft ? readingMinutes({ version: 1, blocks: cleanBlocks(draft.content.blocks) }) : 0), [draft]);
  const featured = draft?.featured_image_id ? images[draft.featured_image_id] || null : null;
  const ogImage = draft?.og_image_id ? images[draft.og_image_id] || null : null;
  const checks = draft ? checklist(draft, featured) : [];
  const live = row?.published;
  const pending = row ? hasUnpublishedChanges(row) : false;

  async function save(): Promise<ArticleRow | null> {
    if (!draft) return null;
    const { payload, problems } = toPayload(draft, fallbackSlug);
    if (problems.length) {
      notify.error('Revise antes de salvar', problems[0]);
      return null;
    }
    setBusy('save');
    const query = row
      ? supabase.from('articles').update(payload).eq('id', row.id).eq('version', row.version).select(select).maybeSingle()
      : supabase.from('articles').insert(payload).select(select).single();
    const { data, error } = await query;
    setBusy(null);
    if (error) {
      notify.error(explain(error));
      return null;
    }
    if (!data) {
      notify.error(explain({ code: '40001' }));
      return null;
    }
    const saved = data as unknown as ArticleRow;
    try {
      localStorage.removeItem(backupKey);
    } catch {
      // ignore
    }
    setRow(saved);
    setDraft(pick(saved));
    setDirty(false);
    setPublished(null);
    dirtyRef.current = false;
    if (!row) navigate(`/admin/artigos/${saved.id}`, { replace: true, force: true });
    return saved;
  }

  async function saveAndNotify() {
    const saved = await save();
    if (!saved) return;
    if (saved.status === 'published') notify.ok('Alterações salvas', 'O site continua mostrando a versão publicada até você publicar as alterações.');
    else notify.ok('Rascunho salvo.');
  }

  async function workflow(action: 'publish' | 'review' | 'draft' | 'unpublish' | 'archive') {
    if (action === 'publish' && !checks.filter((c) => c.required).every((c) => c.ok)) {
      setShowChecklist(true);
      checklistRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notify.error('Faltam itens obrigatórios', 'Preencha título, resumo e conteúdo antes de publicar.');
      return;
    }
    const current = dirty || !row ? await save() : row;
    if (!current) return;
    const texts: Record<typeof action, [string, string, string]> = {
      publish: ['Publicar artigo?', current.status === 'published' ? 'As alterações substituirão a versão que está no site.' : 'O artigo ficará visível para todos no site e nos buscadores.', 'Publicar'],
      review: ['Enviar para revisão?', 'O artigo continua privado até ser publicado.', 'Enviar'],
      draft: ['Voltar para rascunho?', 'O artigo continua privado.', 'Confirmar'],
      unpublish: ['Despublicar artigo?', 'O artigo sai do site e o endereço deixa de funcionar até ser publicado novamente.', 'Despublicar'],
      archive: ['Arquivar artigo?', 'Ele sai do site (se publicado) e da lista principal. Você pode restaurá-lo depois.', 'Arquivar'],
    };
    const [title, text, label] = texts[action];
    if (!(await confirm(title, text, label, action === 'unpublish' || action === 'archive'))) return;
    setBusy(action);
    if (action === 'publish' || action === 'unpublish' || action === 'archive') {
      // Server-side: copies only this article's images to the public bucket,
      // changes the status as the signed-in user and rebuilds the site.
      const result = await adminApi('/api/admin/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: current.id, action, expectedVersion: current.version }) });
      if (!result.ok) {
        setBusy(null);
        const messages: Record<string, string> = {
          version_conflict: explain({ code: '40001' }),
          invalid_media: 'Alguma imagem do artigo não foi encontrada. Escolha a imagem novamente e salve.',
          media_missing: 'Alguma imagem do artigo não foi encontrada. Escolha a imagem novamente e salve.',
          invalid_article: 'Preencha título, resumo e conteúdo antes de publicar.',
          too_many_requests: 'Muitas publicações em pouco tempo. Aguarde alguns minutos.',
        };
        notify.error(action === 'publish' ? 'Não foi possível publicar' : 'Não foi possível concluir', messages[String(result.body.error)] || 'Tente novamente.');
        return;
      }
      const done = { publish: 'Artigo publicado', unpublish: 'Artigo despublicado', archive: 'Artigo arquivado' }[action];
      if (result.body.site === 'updating') {
        notify.ok(done, 'O site será atualizado em cerca de 1 a 2 minutos.');
        setPublished('updating');
        site.watch();
      } else {
        notify.error('Não foi possível atualizar o site', `${done}, mas a atualização automática do site falhou. Tente novamente pelo status do site.`);
        setPublished('not_updated');
        void site.refresh();
      }
    } else {
      const rpc = action === 'review' ? 'submit_article_for_review' : 'return_article_to_draft';
      const { error } = await supabase.rpc(rpc, { p_id: current.id });
      if (error) {
        setBusy(null);
        notify.error(explain(error));
        return;
      }
      notify.ok(action === 'review' ? 'Enviado para revisão' : 'Artigo voltou para rascunho');
    }
    setBusy(null);
    setReloadKey((k) => k + 1);
  }

  async function remove() {
    if (!row || !(await confirm('Excluir definitivamente?', 'O artigo e todo o histórico de versões serão apagados. Esta ação não pode ser desfeita.', 'Excluir', true))) return;
    const { error } = await supabase.from('articles').delete().eq('id', row.id);
    if (error) notify.error(explain(error));
    else {
      notify.ok('Artigo excluído.');
      navigate('/admin/artigos', { force: true });
    }
  }

  async function preview() {
    const current = dirty || !row ? await save() : row;
    if (current) window.open(`/admin/preview?id=${current.id}`, '_blank', 'noopener');
  }

  async function showRevisions() {
    if (!row) return;
    const { data } = await supabase.from('article_revisions').select('id, kind, created_at, snapshot').eq('article_id', row.id).order('created_at', { ascending: false }).limit(20);
    setRevisions((data as Revision[]) || []);
  }

  // The dialog must render while loading: recovering a local backup asks first.
  if (!draft)
    return (
      <>
        {dialog}
        <div className="sticky top-12 z-10 flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-56" />
        </div>
        <output className="mx-auto grid max-w-[1320px] gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10" aria-label="Carregando artigo">
          <div className="space-y-5">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </output>
      </>
    );

  const status = row?.status || 'draft';
  const archived = status === 'archived';
  const required = checks.filter((c) => c.required);
  const missing = required.filter((c) => !c.ok).length;
  const recommended = checks.filter((c) => !c.required);
  const canPublishNow = !archived && (status !== 'published' || pending || dirty);
  const saving = busy === 'save';
  const publishing = busy === 'publish';

  // One sentence about where this article stands right now.
  const state: { icon: ReactNode; text: string; tone?: string } = saving
    ? { icon: <Spinner className="size-3.5" aria-hidden="true" />, text: 'Salvando…' }
    : publishing
      ? { icon: <Spinner className="size-3.5" aria-hidden="true" />, text: 'Publicando…' }
      : busy
        ? { icon: <Spinner className="size-3.5" aria-hidden="true" />, text: 'Atualizando status…' }
        : dirty
          ? { icon: <CircleIcon className="size-2 fill-champagne text-champagne" aria-hidden="true" />, text: 'Alterações não salvas' }
          : published && site.state === 'updating'
            ? { icon: <SiteStateIcon state="updating" />, text: 'Atualizando site…' }
            : published && (site.state === 'failed' || published === 'not_updated')
              ? { icon: <SiteStateIcon state="failed" />, text: 'Falha na atualização do site', tone: 'text-destructive' }
              : published && site.state === 'updated'
                ? { icon: <SiteStateIcon state="updated" />, text: 'Site atualizado' }
                : row
                  ? { icon: <CheckIcon className="size-3.5 text-success" aria-hidden="true" />, text: `Salvo` }
                  : { icon: <CircleIcon className="size-2 fill-muted-foreground/40 text-muted-foreground/40" aria-hidden="true" />, text: 'Ainda não salvo' };

  const seoTitle = draft.seo_title || draft.title || 'Título do artigo';
  const seoDescription = draft.seo_description || draft.excerpt || 'O resumo do artigo aparece aqui.';
  const shareImage = ogImage || featured;

  return (
    <>
      {dialog}
      {/* Actions stay in reach while writing. */}
      <div className="sticky top-12 z-10 border-b bg-background">
        <div className="mx-auto flex min-h-14 max-w-[1320px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="hidden sm:contents">
              <ArticleStatusBadge status={status} />
            </span>
            <output className={cn('flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground', state.tone)} aria-live="polite">
              {state.icon}
              <span className="truncate" title={state.text}>
                {state.text}
                {state.text === 'Salvo' && row && (
                  <span className="hidden sm:inline">
                    {' '}
                    · <TimeAgo value={row.updated_at} />
                  </span>
                )}
              </span>
            </output>
            {published && (site.state === 'failed' || published === 'not_updated') && site.state !== 'updating' && (
              <Button variant="link" size="sm" className="h-auto px-0 text-[13px]" disabled={site.requesting} onClick={() => void site.update('retry: editor').then((ok) => ok && setPublished('updating'))}>
                <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Tentar novamente</span>
              </Button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {!archived && (
              <Button variant="ghost" onClick={() => void preview()} disabled={saving} className="text-muted-foreground hover:text-foreground">
                <EyeIcon data-icon="inline-start" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Pré-visualizar</span>
              </Button>
            )}
            {!archived && (
              <Button variant="outline" onClick={() => void saveAndNotify()} disabled={saving || publishing || (!dirty && !!row)} aria-busy={saving || undefined}>
                {saving && <Spinner data-icon="inline-start" aria-hidden="true" />}
                {saving ? (
                  'Salvando…'
                ) : status === 'published' ? (
                  <>
                    <span className="sm:hidden">Salvar</span>
                    <span className="hidden sm:inline">Salvar alterações</span>
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            )}
            {canPublishNow && (
              <Button onClick={() => void workflow('publish')} disabled={publishing || saving} aria-busy={publishing || undefined}>
                {publishing ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <SendIcon data-icon="inline-start" aria-hidden="true" />}
                {publishing ? (
                  'Publicando…'
                ) : status === 'published' ? (
                  <>
                    <span className="sm:hidden">Publicar</span>
                    <span className="hidden sm:inline">Publicar alterações</span>
                  </>
                ) : (
                  'Publicar'
                )}
              </Button>
            )}
            {archived && (
              <Button onClick={() => void workflow('draft')} disabled={!!busy}>
                <ArchiveRestoreIcon data-icon="inline-start" aria-hidden="true" /> Restaurar como rascunho
              </Button>
            )}
            {(row || live) && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Mais ações" className="text-muted-foreground" />}>
                  <MoreHorizontalIcon aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {live && status === 'published' && (
                    <DropdownMenuItem onClick={() => window.open(`/blog/${live.slug}`, '_blank', 'noopener')}>
                      <ExternalLinkIcon aria-hidden="true" /> Ver no site
                    </DropdownMenuItem>
                  )}
                  {status === 'draft' && row && (
                    <DropdownMenuItem onClick={() => void workflow('review')}>
                      <SendIcon aria-hidden="true" /> Enviar para revisão
                    </DropdownMenuItem>
                  )}
                  {status === 'review' && (
                    <DropdownMenuItem onClick={() => void workflow('draft')}>
                      <UndoIcon aria-hidden="true" /> Voltar para rascunho
                    </DropdownMenuItem>
                  )}
                  {status === 'published' && (
                    <DropdownMenuItem onClick={() => void workflow('unpublish')}>
                      <UndoIcon aria-hidden="true" /> Despublicar
                    </DropdownMenuItem>
                  )}
                  {row && !archived && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void workflow('archive')}>
                        <ArchiveIcon aria-hidden="true" /> Arquivar
                      </DropdownMenuItem>
                    </>
                  )}
                  {archived && staff.role === 'owner' && (
                    <DropdownMenuItem variant="destructive" onClick={() => void remove()}>
                      <Trash2Icon aria-hidden="true" /> Excluir definitivamente
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-6 md:py-9 lg:px-10">
        {/* On phones the status badge leaves the action bar and sits above the title. */}
        <div className="mb-5 sm:hidden">
          <ArticleStatusBadge status={status} />
        </div>
        {pending && !dirty && (
          <p className="mb-6 flex items-start gap-2.5 rounded-lg bg-champagne-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-champagne-foreground">
            <CircleIcon className="mt-1.5 size-2 shrink-0 fill-current" aria-hidden="true" />
            <span>
              Este artigo tem alterações salvas que ainda não estão no site. Clique em <strong className="font-semibold">Publicar alterações</strong> quando estiver pronto.
            </span>
          </p>
        )}
        {archived && <p className="mb-6 rounded-lg bg-muted px-3.5 py-2.5 text-[13px] text-muted-foreground">Artigo arquivado. Restaure como rascunho para voltar a editar e publicar.</p>}

        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <label htmlFor="title" className="sr-only">
              Título
            </label>
            <textarea
              ref={titleRef}
              id="title"
              rows={1}
              value={draft.title}
              onChange={(e) => update('title', e.target.value.replace(/\n/g, ' '))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  excerptRef.current?.focus();
                }
              }}
              maxLength={200}
              placeholder="Título do artigo"
              className="block w-full resize-none overflow-hidden bg-transparent text-[28px] leading-[1.2] font-semibold tracking-[-0.025em] text-foreground outline-none placeholder:text-muted-foreground/50 md:text-[34px]"
            />
            <div className="mt-5 grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="excerpt" className="text-[13px] text-muted-foreground">
                  Resumo
                </Label>
                <Counter value={draft.excerpt.trim().length} ideal={[50, 160]} max={160} />
              </div>
              <textarea
                ref={excerptRef}
                id="excerpt"
                rows={2}
                value={draft.excerpt}
                onChange={(e) => update('excerpt', e.target.value)}
                maxLength={400}
                aria-describedby="excerpt-hint"
                placeholder="Em uma ou duas frases: do que o artigo trata e por que importa."
                className="block w-full resize-none overflow-hidden rounded-lg border border-transparent bg-muted/60 px-3 py-2.5 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/70 hover:bg-muted focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/40"
              />
              <p id="excerpt-hint" className="text-xs text-muted-foreground">
                Aparece nos cards do site e nos resultados de busca. Ideal entre 50 e 160 caracteres.
              </p>
            </div>

            <div className="mt-9 mb-3 flex items-center justify-between gap-3 border-t pt-6">
              <h2 className="text-[13px] font-semibold">Conteúdo</h2>
              <span className="text-xs text-muted-foreground">cerca de {minutes} min de leitura</span>
            </div>
            <BlockEditor blocks={draft.content.blocks} onChange={(blocks: Block[]) => update('content', { version: 1, blocks })} confirm={confirm} />

            <section className="mt-10 border-t pt-6" aria-labelledby="sources-title">
              <div className="mb-1 flex items-center justify-between gap-3">
                <h2 id="sources-title" className="text-[13px] font-semibold">
                  Referências
                </h2>
                <span className="text-xs text-muted-foreground tabular">{draft.sources.length}/20</span>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Fontes oficiais citadas no texto. Aparecem ao final do artigo.</p>
              <div className="grid gap-2">
                {draft.sources.map((s, i) => (
                  <div className="group/source grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" key={i}>
                    <Input aria-label={`Título da referência ${i + 1}`} placeholder="Ex.: INPI — Guia básico de marcas" value={s.title} onChange={(e) => update('sources', draft.sources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} maxLength={200} className="h-9" />
                    <Input aria-label={`Endereço da referência ${i + 1}`} placeholder="https://" type="url" value={s.url} onChange={(e) => update('sources', draft.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} maxLength={500} className="h-9" />
                    <Button variant="ghost" size="icon" className="size-9 justify-self-end text-muted-foreground hover:text-destructive" onClick={() => update('sources', draft.sources.filter((_, j) => j !== i))} aria-label={`Remover referência ${i + 1}`}>
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
              {draft.sources.length < 20 && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => update('sources', [...draft.sources, { title: '', url: '' }])}>
                  <PlusIcon data-icon="inline-start" aria-hidden="true" /> Adicionar referência
                </Button>
              )}
            </section>
          </div>

          <aside className="min-w-0 lg:border-l lg:pl-8" aria-label="Configurações do artigo">
            <Section title="Publicação">
              <dl className="grid gap-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <ArticleStatusBadge status={status} />
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Endereço</dt>
                  <dd className="min-w-0 text-right">
                    {live && status === 'published' ? (
                      <a className="inline-flex max-w-full items-center gap-1 font-medium [overflow-wrap:anywhere] text-brand hover:underline" href={`/blog/${live.slug}`} target="_blank" rel="noopener noreferrer">
                        /blog/{live.slug} <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="[overflow-wrap:anywhere] text-muted-foreground">/blog/{draft.slug || '…'}</span>
                    )}
                  </dd>
                </div>
                {row?.first_published_at && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Publicado pela 1ª vez</dt>
                    <dd className="tabular">{longDate(row.first_published_at)}</dd>
                  </div>
                )}
                {(live || published) && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Site</dt>
                    <dd className="flex items-center gap-1.5 font-medium">
                      <SiteStateIcon state={site.state} />
                      {{ updated: 'Atualizado', updating: 'Atualizando…', stalled: 'Sem confirmação', failed: 'Falha' }[site.state]}
                    </dd>
                  </div>
                )}
              </dl>
              <div ref={checklistRef} className="rounded-lg border bg-muted/30">
                <Collapsible open={showChecklist || missing > 0} onOpenChange={setShowChecklist}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                    <span className="flex items-center gap-2">
                      Antes de publicar
                      <span className={cn('rounded-full px-1.5 py-px text-[11px] font-semibold tabular', missing ? 'bg-destructive/10 text-destructive' : 'bg-success-soft text-success')}>
                        {missing ? `${missing} pendente${missing > 1 ? 's' : ''}` : `${checks.filter((c) => c.ok).length}/${checks.length}`}
                      </span>
                    </span>
                    <ChevronDownIcon className="size-4 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180" aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="grid gap-1.5 px-3 pb-3 text-[13px]">
                      {[...required, ...recommended].map((c) => (
                        <li key={c.label} className={cn('flex items-start gap-2', c.ok ? 'text-foreground' : c.required ? 'text-destructive' : 'text-muted-foreground')}>
                          {c.ok ? <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" /> : <CircleIcon className="mt-1 size-2.5 shrink-0" aria-hidden="true" />}
                          <span>
                            {c.label}
                            {!c.ok && c.required && <span className="text-[11px] font-medium"> (obrigatório)</span>}
                            <span className="sr-only">{c.ok ? ': feito' : ': pendente'}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </Section>

            <Section title="Organização">
              <div className="grid gap-2">
                <Label htmlFor="author" className="text-[13px]">
                  Autoria
                </Label>
                <Select items={authorLabel} value={draft.author_key} onValueChange={(v) => v && update('author_key', v as ArticleDraft['author_key'])}>
                  <SelectTrigger id="author" className="h-9 w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {authorKeys.map((k) => (
                      <SelectItem key={k} value={k}>
                        {authorLabel[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category" className="text-[13px]">
                  Categoria
                </Label>
                <Select items={categoryLabel} value={draft.category} onValueChange={(v) => v && update('category', v as ArticleDraft['category'])}>
                  <SelectTrigger id="category" className="h-9 w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {categoryLabel[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label id="tags-label" htmlFor="tags" className="text-[13px]">
                    Tags
                  </Label>
                  <span className="text-xs text-muted-foreground tabular">{draft.tags.length}/12</span>
                </div>
                <TagInput id="tags" value={draft.tags} onChange={(tags) => update('tags', tags)} suggestions={tagSuggestions} />
                <p id="tags-hint" className="text-xs text-muted-foreground">
                  Enter ou vírgula adiciona. Usadas para organizar e relacionar artigos.
                </p>
              </div>
            </Section>

            <Section title="Imagem principal">
              {featured ? (
                <figure className="cover-preview m-0 grid grid-cols-1 gap-2">
                  <div className="aspect-[16/10] overflow-hidden rounded-lg border bg-muted">
                    <MediaImage path={featured.path} alt={featured.alt ? `Imagem principal: ${featured.alt}` : 'Imagem principal do artigo, ainda sem descrição'} width={featured.width} height={featured.height} className="size-full object-cover" />
                  </div>
                  <figcaption className={cn('text-xs', featured.alt ? 'text-muted-foreground' : 'text-champagne-foreground')}>{featured.alt || 'Sem descrição. Descreva a imagem em Mídia.'}</figcaption>
                </figure>
              ) : (
                <div className="grid aspect-[16/10] place-items-center rounded-lg border border-dashed bg-muted/30 px-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    <ImageIcon className="mx-auto mb-2 size-5 text-muted-foreground/70" aria-hidden="true" />
                    Sem imagem, o site usa a ilustração da categoria.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setPicker('featured')}>
                  {featured ? 'Trocar imagem' : 'Escolher imagem'}
                </Button>
                {featured && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => update('featured_image_id', null)}>
                    Remover
                  </Button>
                )}
              </div>
            </Section>

            <section className="border-t py-5">
              <Collapsible>
                <CollapsibleTrigger className="group/seo flex w-full items-center justify-between gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                  <span>
                    <span className="block text-[13px] font-semibold">SEO e compartilhamento</span>
                    <span className="block text-xs text-muted-foreground">Opcional. Sem preenchimento, usa título, resumo e imagem.</span>
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/seo:rotate-180" aria-hidden="true" />
                </CollapsibleTrigger>
                <CollapsibleContent className="grid grid-cols-1 gap-5 pt-5">
                  <div className="grid gap-2">
                    <Label htmlFor="slug" className="text-[13px]">
                      Endereço do artigo
                    </Label>
                    <InputGroup className="h-9 bg-background">
                      <InputGroupAddon className="pr-0 text-[13px] text-muted-foreground">/blog/</InputGroupAddon>
                      <InputGroupInput
                        id="slug"
                        value={draft.slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 120));
                        }}
                        maxLength={120}
                        aria-describedby="slug-hint"
                        className="pl-0.5 text-[13px] md:text-[13px]"
                      />
                    </InputGroup>
                    <p id="slug-hint" className="text-xs text-muted-foreground">
                      {live ? `Publicado em /blog/${live.slug}. Se mudar, o endereço antigo redireciona para o novo.` : 'Gerado a partir do título. Use letras minúsculas, números e hífens.'}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="seo_title" className="text-[13px]">
                        Título para buscadores
                      </Label>
                      <Counter value={(draft.seo_title || '').length} ideal={[1, 60]} max={60} />
                    </div>
                    <Input id="seo_title" value={draft.seo_title || ''} onChange={(e) => update('seo_title', e.target.value)} maxLength={120} placeholder={draft.title || 'Usa o título do artigo'} className="h-9" />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="seo_description" className="text-[13px]">
                        Descrição para buscadores
                      </Label>
                      <Counter value={(draft.seo_description || '').length} ideal={[1, 155]} max={155} />
                    </div>
                    <Textarea id="seo_description" rows={2} value={draft.seo_description || ''} onChange={(e) => update('seo_description', e.target.value)} maxLength={320} placeholder="Usa o resumo do artigo" />
                  </div>
                  <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
                    <Checkbox id="robots_index" aria-labelledby="robots_index-label" checked={draft.robots_index} onCheckedChange={(checked) => update('robots_index', checked === true)} className="mt-0.5" />
                    <div className="grid gap-0.5">
                      <Label id="robots_index-label" htmlFor="robots_index" className="text-[13px] leading-snug">
                        Permitir que buscadores mostrem este artigo
                      </Label>
                      <span className="text-xs text-muted-foreground">Desmarque só para conteúdos que não devem aparecer no Google.</span>
                    </div>
                  </div>

                  <figure className="m-0 grid grid-cols-1 gap-2">
                    <figcaption className="text-xs font-medium text-muted-foreground">Prévia na busca</figcaption>
                    <div className="rounded-lg border bg-background p-3">
                      <p className="truncate text-xs text-muted-foreground">grupovelmont.com › blog › {draft.slug || '…'}</p>
                      <p className="mt-0.5 line-clamp-1 text-[15px] font-medium text-[#1a0dab]">{seoTitle}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{seoDescription}</p>
                    </div>
                  </figure>

                  <div className="grid gap-2">
                    <Label htmlFor="og_title" className="text-[13px]">
                      Título para redes sociais
                    </Label>
                    <Input id="og_title" value={draft.og_title || ''} onChange={(e) => update('og_title', e.target.value)} maxLength={120} placeholder="Usa o título para buscadores" className="h-9" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="og_description" className="text-[13px]">
                      Descrição para redes sociais
                    </Label>
                    <Textarea id="og_description" rows={2} value={draft.og_description || ''} onChange={(e) => update('og_description', e.target.value)} maxLength={320} placeholder="Usa a descrição para buscadores" />
                  </div>
                  <div className="grid gap-2">
                    <span className="text-[13px] font-medium">Imagem para redes sociais</span>
                    <figure className="m-0 overflow-hidden rounded-lg border bg-background">
                      <figcaption className="sr-only">Prévia do compartilhamento em redes sociais</figcaption>
                      <div className="aspect-[1.91/1] bg-muted">
                        {shareImage ? (
                          <MediaImage path={shareImage.path} alt={shareImage.alt ? `Imagem de compartilhamento: ${shareImage.alt}` : 'Imagem de compartilhamento do artigo'} className="size-full object-cover" />
                        ) : (
                          <div className="grid size-full place-items-center text-xs text-muted-foreground">Imagem padrão da Velmont</div>
                        )}
                      </div>
                      <div className="border-t px-3 py-2">
                        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">grupovelmont.com</p>
                        <p className="line-clamp-1 text-[13px] font-semibold">{draft.og_title || seoTitle}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{draft.og_description || seoDescription}</p>
                      </div>
                    </figure>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPicker('og')}>
                        {draft.og_image_id ? 'Trocar' : 'Escolher outra'}
                      </Button>
                      {draft.og_image_id && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => update('og_image_id', null)}>
                          Usar a imagem principal
                        </Button>
                      )}
                    </div>
                  </div>

                  <Collapsible className="rounded-lg border px-3 py-2.5">
                    <CollapsibleTrigger className="group/adv flex w-full items-center justify-between text-left text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                      Avançado
                      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[panel-open]/adv:rotate-180" aria-hidden="true" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="grid grid-cols-1 gap-2 pt-3">
                      <Label htmlFor="canonical" className="text-[13px]">
                        URL canônica
                      </Label>
                      <Input id="canonical" type="url" value={draft.canonical_url || ''} onChange={(e) => update('canonical_url', e.target.value)} maxLength={500} placeholder="Deixe vazio na maioria dos casos" aria-describedby="canonical-hint" className="h-9" />
                      <p id="canonical-hint" className="text-xs text-muted-foreground">
                        Somente se este texto foi publicado primeiro em outro site. Um valor errado pode tirar o artigo das buscas.
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                </CollapsibleContent>
              </Collapsible>
            </section>

            {row && (
              <section className="border-t py-5">
                <Collapsible onOpenChange={(open) => open && revisions === null && void showRevisions()}>
                  <CollapsibleTrigger className="group/hist flex w-full items-center justify-between gap-2 rounded-md text-left text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                    <span className="flex items-center gap-2">
                      <HistoryIcon className="size-4 text-muted-foreground" aria-hidden="true" /> Histórico de versões
                    </span>
                    <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[panel-open]/hist:rotate-180" aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    {revisions === null ? (
                      <Skeleton className="h-16 w-full" />
                    ) : revisions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma versão anterior.</p>
                    ) : (
                      <ol className="grid gap-1">
                        {revisions.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted/60">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={cn('size-1.5 shrink-0 rounded-full', r.kind === 'publish' ? 'bg-success' : 'bg-muted-foreground/40')} aria-hidden="true" />
                              <span className="truncate">{r.kind === 'publish' ? 'Publicada' : 'Editada'}</span>
                              <span className="text-xs text-muted-foreground">
                                <TimeAgo value={r.created_at} />
                              </span>
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setDraft(pick({ ...r.snapshot, published: null }));
                                setDirty(true);
                                notify.info('Versão carregada no editor', 'Salve para mantê-la.');
                              }}
                            >
                              Carregar
                            </Button>
                          </li>
                        ))}
                      </ol>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </section>
            )}
          </aside>
        </div>
      </div>
      {picker && (
        <MediaPicker
          onClose={() => setPicker(null)}
          onSelect={(m) => {
            setImages((x) => ({ ...x, [m.id]: m }));
            update(picker === 'featured' ? 'featured_image_id' : 'og_image_id', m.id);
            setPicker(null);
          }}
        />
      )}
    </>
  );
}
