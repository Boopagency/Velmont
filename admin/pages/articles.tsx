import { useEffect, useState } from 'react';
import { ExternalLinkIcon, EyeIcon, FileTextIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, SearchXIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { authorKeys, categories } from '@/lib/blog/types';
import { Link, navigate } from '../router';
import { supabase } from '../supabase';
import { authorShort, categoryLabel, hasUnpublishedChanges, type ArticleRow } from '../types';
import { ArticleStatusBadge, EmptyState, FilterSelect, LoadingRows, Page, PageHeader, SearchInput, TimeAgo, useCrumbs } from '../ui';

type Row = Pick<ArticleRow, 'id' | 'title' | 'slug' | 'status' | 'category' | 'author_key' | 'version' | 'updated_at' | 'published'>;

const statusOptions: [string, string][] = [['all', 'Todos os status'], ['published', 'Publicados'], ['draft', 'Rascunhos'], ['review', 'Em revisão'], ['archived', 'Arquivados']];
const authorOptions: [string, string][] = [['all', 'Toda autoria'], ...authorKeys.map((k): [string, string] => [k, authorShort[k]])];
const categoryOptions: [string, string][] = [['all', 'Todas as categorias'], ...categories.map((c): [string, string] => [c, categoryLabel[c]])];

/** Keeps only characters that are safe inside a PostgREST filter value. */
export const searchTerm = (value: string) => value.replace(/[^\p{L}\p{N}\s@_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

export function Articles() {
  const params = new URLSearchParams(location.search);
  const [status, setStatus] = useState(params.get('status') || 'all');
  const [author, setAuthor] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  useCrumbs([{ label: 'Artigos' }]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        let q = supabase
          .from('articles')
          .select('id, title, slug, status, category, author_key, version, updated_at, published:published_articles(slug, source_version, published_at, modified_at)')
          .order('updated_at', { ascending: false })
          .limit(200);
        // "Rascunhos" keeps its former meaning: everything not yet published (draft and review).
        if (status === 'draft') q = q.in('status', ['draft', 'review']);
        else if (status !== 'all') q = q.eq('status', status);
        else q = q.neq('status', 'archived');
        if (author !== 'all') q = q.eq('author_key', author);
        if (category !== 'all') q = q.eq('category', category);
        const term = searchTerm(query);
        if (term) q = q.ilike('title', `%${term}%`);
        const { data } = await q;
        setRows((data as unknown as Row[]) || []);
      })();
    }, 200);
    return () => clearTimeout(timer);
  }, [status, author, category, query]);

  const filtered = status !== 'all' || author !== 'all' || category !== 'all' || !!query.trim();
  const clear = () => {
    setStatus('all');
    setAuthor('all');
    setCategory('all');
    setQuery('');
    navigate('/admin/artigos', { replace: true });
  };

  return (
    <Page>
      <PageHeader
        title="Artigos"
        description="Escreva, revise e publique os conteúdos do blog da Velmont."
        actions={
          <Link href="/admin/artigos/novo" className={buttonVariants({ size: 'lg', className: 'h-9 px-3.5' })}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Novo artigo
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput label="Buscar por título" placeholder="Buscar por título" value={query} onChange={setQuery} />
        <FilterSelect
          label="Filtrar por status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            navigate(v === 'all' ? '/admin/artigos' : `/admin/artigos?status=${v}`, { replace: true });
          }}
          options={statusOptions}
        />
        <FilterSelect label="Filtrar por autoria" value={author} onChange={setAuthor} options={authorOptions} />
        <FilterSelect label="Filtrar por categoria" value={category} onChange={setCategory} options={categoryOptions} />
        {filtered && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clear}>
            Limpar filtros
          </Button>
        )}
        {rows && (
          <span className="ml-auto text-[13px] text-muted-foreground tabular" aria-live="polite">
            {rows.length === 1 ? '1 artigo' : `${rows.length} artigos`}
          </span>
        )}
      </div>

      {!rows ? (
        <div className="rounded-xl border bg-card p-5">
          <LoadingRows rows={5} />
        </div>
      ) : rows.length === 0 ? (
        query.trim() || author !== 'all' || category !== 'all' ? (
          <EmptyState icon={<SearchXIcon />} title="Nenhum artigo encontrado" description="Tente outro termo ou limpe os filtros." action={<Button variant="outline" onClick={clear}>Limpar filtros</Button>} />
        ) : status === 'draft' ? (
          <EmptyState icon={<FileTextIcon />} title="Nenhum rascunho." description="Artigos salvos e ainda não publicados aparecem aqui." />
        ) : status === 'review' ? (
          <EmptyState icon={<FileTextIcon />} title="Nada em revisão." description="Quando alguém enviar um artigo para revisão, ele aparece aqui." />
        ) : status === 'archived' ? (
          <EmptyState icon={<FileTextIcon />} title="Nenhum artigo arquivado." />
        ) : (
          <EmptyState
            icon={<FileTextIcon />}
            title={status === 'published' ? 'Nenhum artigo publicado.' : 'Nenhum artigo ainda.'}
            description="Comece pelo que os clientes mais perguntam: um artigo claro ajuda a Velmont a ser encontrada."
            action={
              <Link href="/admin/artigos/novo" className={buttonVariants({ variant: 'outline' })}>
                Escrever um artigo
              </Link>
            }
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 w-full pl-4 text-xs font-medium text-muted-foreground">Artigo</TableHead>
                <TableHead className="hidden h-10 pr-6 text-xs font-medium text-muted-foreground md:table-cell">Status</TableHead>
                <TableHead className="hidden h-10 pr-6 text-xs font-medium text-muted-foreground lg:table-cell">Autoria</TableHead>
                <TableHead className="hidden h-10 pr-6 text-xs font-medium text-muted-foreground sm:table-cell">Atualizado</TableHead>
                <TableHead className="h-10 w-12 pr-3">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const pending = hasUnpublishedChanges(a);
                const live = a.published?.slug;
                return (
                  <TableRow key={a.id} className="group">
                    <TableCell className="max-w-0 py-3 pl-4 whitespace-normal">
                      <Link href={`/admin/artigos/${a.id}`} className="line-clamp-2 text-sm font-semibold text-foreground outline-none hover:text-brand focus-visible:text-brand focus-visible:underline">
                        {a.title || 'Sem título'}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        <span>{categoryLabel[a.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">/blog/{live || a.slug}</span>
                        <span className="contents md:hidden">
                          <span aria-hidden="true">·</span>
                          <ArticleStatusBadge status={a.status} />
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden py-3 pr-6 align-middle md:table-cell">
                      <div className="flex flex-col items-start gap-1">
                        <ArticleStatusBadge status={a.status} />
                        {pending && <span className="text-[11px] font-medium text-champagne-foreground">Alterações não publicadas</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden py-3 pr-6 text-[13px] text-muted-foreground lg:table-cell">{authorShort[a.author_key]}</TableCell>
                    <TableCell className="hidden py-3 pr-6 text-[13px] text-muted-foreground sm:table-cell">
                      <TimeAgo value={a.updated_at} />
                    </TableCell>
                    <TableCell className="py-3 pr-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações para ${a.title || 'artigo sem título'}`} className="text-muted-foreground" />}>
                          <MoreHorizontalIcon aria-hidden="true" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => navigate(`/admin/artigos/${a.id}`)}>
                            <PencilIcon aria-hidden="true" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`/admin/preview?id=${a.id}`, '_blank', 'noopener')}>
                            <EyeIcon aria-hidden="true" /> Pré-visualizar
                          </DropdownMenuItem>
                          {live && a.status === 'published' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => window.open(`/blog/${live}`, '_blank', 'noopener')}>
                                <ExternalLinkIcon aria-hidden="true" /> Ver no site
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Page>
  );
}
