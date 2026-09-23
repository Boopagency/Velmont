import { useEffect, useState } from 'react';
import { Link, navigate } from '../router';
import { supabase } from '../supabase';
import { articleStatusLabel, dateTime, hasUnpublishedChanges, type ArticleRow, type ArticleStatus } from '../types';
import { Empty, Loading, PageHeader, Pill } from '../ui';

type Row = Pick<ArticleRow, 'id' | 'title' | 'slug' | 'status' | 'category' | 'version' | 'updated_at' | 'published'>;
const filters: [string, string][] = [['', 'Todos'], ['draft', 'Rascunhos'], ['review', 'Em revisão'], ['published', 'Publicados'], ['archived', 'Arquivados']];

/** Keeps only characters that are safe inside a PostgREST filter value. */
export const searchTerm = (value: string) => value.replace(/[^\p{L}\p{N}\s@_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

export function Articles() {
  const params = new URLSearchParams(location.search);
  const [status, setStatus] = useState(params.get('status') || '');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        let q = supabase.from('articles').select('id, title, slug, status, category, version, updated_at, published:published_articles(slug, source_version, published_at, modified_at)').order('updated_at', { ascending: false }).limit(200);
        if (status === 'draft') q = q.in('status', ['draft', 'review']);
        else if (status) q = q.eq('status', status);
        else q = q.neq('status', 'archived');
        const term = searchTerm(query);
        if (term) q = q.ilike('title', `%${term}%`);
        const { data } = await q;
        setRows((data as unknown as Row[]) || []);
      })();
    }, 200);
    return () => clearTimeout(timer);
  }, [status, query]);

  return (
    <>
      <PageHeader eyebrow="Conteúdo" title="Artigos" actions={<Link className="btn btn-primary" href="/admin/artigos/novo">Novo artigo</Link>} />
      <div className="toolbar">
        <fieldset className="segmented"><legend className="sr-only">Filtrar por status</legend>
          {filters.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); navigate(value ? `/admin/artigos?status=${value}` : '/admin/artigos', { replace: true }); }}>
              {label}
            </button>
          ))}
        </fieldset>
        <input type="search" placeholder="Buscar por título" aria-label="Buscar por título" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} />
      </div>
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>Nenhum artigo encontrado.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th scope="col">Título</th><th scope="col">Categoria</th><th scope="col">Status</th><th scope="col">Atualizado</th></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/admin/artigos/${a.id}`} className="row-title">{a.title || 'Sem título'}</Link>
                    <span className="row-sub">/blog/{a.published?.slug || a.slug}</span>
                  </td>
                  <td>{a.category}</td>
                  <td>
                    <Pill tone={a.status}>{articleStatusLabel[a.status as ArticleStatus]}</Pill>
                    {hasUnpublishedChanges(a) && <span className="row-sub">Alterações não publicadas</span>}
                  </td>
                  <td>{dateTime(a.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
