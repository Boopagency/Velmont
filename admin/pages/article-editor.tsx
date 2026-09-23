import { useEffect, useMemo, useRef, useState } from 'react';
import { contentSchema, SLUG_RE, sourceSchema } from '@/lib/blog/schema';
import { readingMinutes } from '@/lib/blog/posts';
import { authorKeys, categories, type Block } from '@/lib/blog/types';
import { useStaff } from '../auth';
import { BlockEditor, cleanBlocks, emptyBlock } from '../blocks';
import { MediaPicker } from '../media';
import { MediaImage } from '../signed';
import { Link, navigate } from '../router';
import { adminApi, explain, supabase } from '../supabase';
import { articleStatusLabel, authorLabel, dateTime, editableArticleFields, hasUnpublishedChanges, type ArticleDraft, type ArticleRow, type MediaItem } from '../types';
import { Button, Field, Loading, PageHeader, Pill, useConfirm, useToast } from '../ui';

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

export function ArticleEditor({ id }: { id: string | null }) {
  const staff = useStaff();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [row, setRow] = useState<ArticleRow | null>(null);
  const [draft, setDraft] = useState<ArticleDraft | null>(id ? null : blank());
  const [dirty, setDirty] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [picker, setPicker] = useState<'featured' | 'og' | null>(null);
  const [images, setImages] = useState<Record<string, MediaItem>>({});
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const backupKey = `vm-draft:${id || 'novo'}`;
  const [fallbackSlug] = useState(() => `rascunho-${Math.random().toString(36).slice(2, 8)}`);
  const [reloadKey, setReloadKey] = useState(0);
  const confirmRef = useRef(confirm);
  useEffect(() => {
    confirmRef.current = confirm;
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
    const { data, error } = await supabase.from('articles').select(select).eq('id', id).maybeSingle();
    if (cancelled) return;
    if (error || !data) {
      toast('error', 'Artigo não encontrado.');
      navigate('/admin/artigos', { replace: true });
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
  }, [id, reloadKey, toast]);

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

  const words = useMemo(() => (draft ? readingMinutes({ version: 1, blocks: cleanBlocks(draft.content.blocks) }) : 0), [draft]);
  const featured = draft?.featured_image_id ? images[draft.featured_image_id] || null : null;
  const checks = draft ? checklist(draft, featured) : [];
  const live = row?.published;
  const pending = row ? hasUnpublishedChanges(row) : false;

  async function save(): Promise<ArticleRow | null> {
    if (!draft) return null;
    const { payload, problems } = toPayload(draft, fallbackSlug);
    if (problems.length) {
      toast('error', problems[0]);
      return null;
    }
    setBusy('save');
    const query = row
      ? supabase.from('articles').update(payload).eq('id', row.id).eq('version', row.version).select(select).maybeSingle()
      : supabase.from('articles').insert(payload).select(select).single();
    const { data, error } = await query;
    setBusy(null);
    if (error) {
      toast('error', explain(error));
      return null;
    }
    if (!data) {
      toast('error', explain({ code: '40001' }));
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
    if (!row) navigate(`/admin/artigos/${saved.id}`, { replace: true });
    return saved;
  }

  async function saveAndToast() {
    const saved = await save();
    if (saved) toast('ok', saved.status === 'published' ? 'Salvo. O site continua mostrando a versão publicada até você publicar as alterações.' : 'Rascunho salvo.');
  }

  async function workflow(action: 'publish' | 'review' | 'draft' | 'unpublish' | 'archive') {
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
        toast('error', messages[String(result.body.error)] || 'Não foi possível concluir. Tente novamente.');
        return;
      }
      const updating = result.body.site === 'updating';
      toast(updating ? 'ok' : 'error', updating ? 'Feito. O site será atualizado em cerca de 1 a 2 minutos.' : 'Status alterado, mas a atualização automática do site falhou. Use "Atualizar site agora" no Dashboard.');
    } else {
      const rpc = action === 'review' ? 'submit_article_for_review' : 'return_article_to_draft';
      const { error } = await supabase.rpc(rpc, { p_id: current.id });
      if (error) {
        setBusy(null);
        toast('error', explain(error));
        return;
      }
      toast('ok', 'Status atualizado.');
    }
    setBusy(null);
    setReloadKey((k) => k + 1);
  }

  async function remove() {
    if (!row || !(await confirm('Excluir definitivamente?', 'O artigo e todo o histórico de versões serão apagados. Esta ação não pode ser desfeita.', 'Excluir', true))) return;
    const { error } = await supabase.from('articles').delete().eq('id', row.id);
    if (error) toast('error', explain(error));
    else {
      toast('ok', 'Artigo excluído.');
      navigate('/admin/artigos');
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

  if (!draft) return <Loading />;
  const status = row?.status || 'draft';
  const canPublish = checks.filter((c) => c.required).every((c) => c.ok);

  return (
    <>
      {dialog}
      <PageHeader
        eyebrow={row ? `Artigo · ${articleStatusLabel[status]}` : 'Novo artigo'}
        title={draft.title || 'Sem título'}
        actions={<Link href="/admin/artigos" className="text-link">← Todos os artigos</Link>}
      />
      {pending && <p className="notice">Este artigo tem alterações salvas que ainda não estão no site. Clique em <strong>Publicar alterações</strong> quando estiver pronto.</p>}
      {status === 'archived' && <p className="notice">Artigo arquivado. Restaure como rascunho para voltar a editar e publicar.</p>}
      <div className="editor">
        <div className="editor-main">
          <Field label="Título" id="title">
            <input id="title" className="title-input" value={draft.title} onChange={(e) => update('title', e.target.value)} maxLength={200} placeholder="Um título claro, que diga do que o artigo trata" />
          </Field>
          <Field label="Resumo" id="excerpt" hint={`${draft.excerpt.trim().length} caracteres. Ideal entre 50 e 160: aparece nos cards do site e nos resultados de busca.`}>
            <textarea id="excerpt" rows={3} value={draft.excerpt} onChange={(e) => update('excerpt', e.target.value)} maxLength={400} />
          </Field>
          <div className="field">
            <span className="label">Conteúdo <small>· cerca de {words} min de leitura</small></span>
            <BlockEditor blocks={draft.content.blocks} onChange={(blocks: Block[]) => update('content', { version: 1, blocks })} />
          </div>
          <fieldset className="field sources">
            <legend>Referências</legend>
            <p className="field-hint">Fontes oficiais citadas no texto. Aparecem ao final do artigo.</p>
            {draft.sources.map((s, i) => (
              <div className="row" key={i}>
                <input aria-label={`Título da referência ${i + 1}`} placeholder="Ex.: INPI — Guia básico de marcas" value={s.title} onChange={(e) => update('sources', draft.sources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} maxLength={200} />
                <input aria-label={`Endereço da referência ${i + 1}`} placeholder="https://" type="url" value={s.url} onChange={(e) => update('sources', draft.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} maxLength={500} />
                <button type="button" onClick={() => update('sources', draft.sources.filter((_, j) => j !== i))} aria-label={`Remover referência ${i + 1}`}>Remover</button>
              </div>
            ))}
            {draft.sources.length < 20 && <button type="button" className="text-button" onClick={() => update('sources', [...draft.sources, { title: '', url: '' }])}>+ Adicionar referência</button>}
          </fieldset>
          <details className="advanced">
            <summary>Configurações avançadas de SEO</summary>
            <p className="field-hint">Opcional. Sem preenchimento, o site usa o título, o resumo e a imagem principal.</p>
            <Field label="Endereço do artigo" id="slug" hint={live ? `Publicado em /blog/${live.slug}. Se mudar, o endereço antigo redirecionará permanentemente para o novo.` : `Ficará em /blog/${draft.slug || '…'}`}>
              <input id="slug" value={draft.slug} onChange={(e) => { setSlugTouched(true); update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 120)); }} maxLength={120} />
            </Field>
            <Field label="Título para buscadores" id="seo_title" hint={`${(draft.seo_title || '').length}/60 recomendados`}>
              <input id="seo_title" value={draft.seo_title || ''} onChange={(e) => update('seo_title', e.target.value)} maxLength={120} />
            </Field>
            <Field label="Descrição para buscadores" id="seo_description" hint={`${(draft.seo_description || '').length}/155 recomendados`}>
              <textarea id="seo_description" rows={2} value={draft.seo_description || ''} onChange={(e) => update('seo_description', e.target.value)} maxLength={320} />
            </Field>
            <Field label="Título para redes sociais" id="og_title">
              <input id="og_title" value={draft.og_title || ''} onChange={(e) => update('og_title', e.target.value)} maxLength={120} />
            </Field>
            <Field label="Descrição para redes sociais" id="og_description">
              <textarea id="og_description" rows={2} value={draft.og_description || ''} onChange={(e) => update('og_description', e.target.value)} maxLength={320} />
            </Field>
            <div className="field">
              <span className="label">Imagem para redes sociais</span>
              <div className="row">
                {draft.og_image_id && images[draft.og_image_id] && <MediaImage className="thumb" path={images[draft.og_image_id].path} />}
                <Button variant="secondary" onClick={() => setPicker('og')}>{draft.og_image_id ? 'Trocar' : 'Escolher'}</Button>
                {draft.og_image_id && <Button variant="ghost" onClick={() => update('og_image_id', null)}>Usar a imagem principal</Button>}
              </div>
            </div>
            <Field label="URL canônica" id="canonical" hint="Somente se este texto foi publicado primeiro em outro site. Um valor errado pode tirar o artigo das buscas.">
              <input id="canonical" type="url" value={draft.canonical_url || ''} onChange={(e) => update('canonical_url', e.target.value)} maxLength={500} placeholder="Deixe vazio na maioria dos casos" />
            </Field>
            <label className="check">
              <input type="checkbox" checked={draft.robots_index} onChange={(e) => update('robots_index', e.target.checked)} /> Permitir que buscadores mostrem este artigo
            </label>
          </details>
        </div>

        <aside className="editor-side">
          <section className="panel actions-panel">
            <p className="meta">
              <Pill tone={status}>{articleStatusLabel[status]}</Pill> {dirty ? 'Alterações não salvas' : row ? `Salvo ${dateTime(row.updated_at)}` : 'Ainda não salvo'}
            </p>
            {status !== 'archived' && <Button onClick={() => void saveAndToast()} busy={busy === 'save'} disabled={!dirty && !!row}>Salvar</Button>}
            {status !== 'archived' && <Button variant="secondary" onClick={() => void preview()}>Visualizar</Button>}
            {status !== 'archived' && (status !== 'published' || pending || dirty) && (
              <Button onClick={() => void workflow('publish')} busy={busy === 'publish'} disabled={!canPublish}>{status === 'published' ? 'Publicar alterações' : 'Publicar'}</Button>
            )}
            {status === 'draft' && row && <Button variant="ghost" onClick={() => void workflow('review')}>Enviar para revisão</Button>}
            {status === 'review' && <Button variant="ghost" onClick={() => void workflow('draft')}>Voltar para rascunho</Button>}
            {status === 'published' && <Button variant="ghost" onClick={() => void workflow('unpublish')}>Despublicar</Button>}
            {row && status !== 'archived' && <Button variant="ghost" onClick={() => void workflow('archive')}>Arquivar</Button>}
            {status === 'archived' && <Button onClick={() => void workflow('draft')}>Restaurar como rascunho</Button>}
            {status === 'archived' && staff.role === 'owner' && <Button variant="danger" onClick={() => void remove()}>Excluir definitivamente</Button>}
            {live && <a className="text-link" href={`/blog/${live.slug}`} target="_blank" rel="noopener noreferrer">Ver no site ↗</a>}
          </section>

          <section className="panel">
            <h2>Antes de publicar</h2>
            <ul className="checklist">
              {checks.map((c) => (
                <li key={c.label} className={c.ok ? 'ok' : c.required ? 'missing' : 'todo'}>
                  <span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {c.label}{!c.ok && c.required && <em> (obrigatório)</em>}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Organização</h2>
            <Field label="Autoria" id="author">
              <select id="author" value={draft.author_key} onChange={(e) => update('author_key', e.target.value as ArticleDraft['author_key'])}>
                {authorKeys.map((k) => <option key={k} value={k}>{authorLabel[k]}</option>)}
              </select>
            </Field>
            <Field label="Categoria" id="category">
              <select id="category" value={draft.category} onChange={(e) => update('category', e.target.value as ArticleDraft['category'])}>
                {categories.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </Field>
            <Field label="Tags" id="tags" hint="Separe por vírgulas. Usadas para organizar e relacionar artigos.">
              <input id="tags" value={draft.tags.join(', ')} onChange={(e) => update('tags', e.target.value.split(',').map((t) => t.trimStart().slice(0, 40)).slice(0, 12))} />
            </Field>
            <div className="field">
              <span className="label">Imagem principal</span>
              {featured ? (
                <figure className="cover-preview">
                  <MediaImage path={featured.path} width={featured.width} height={featured.height} />
                  <figcaption>{featured.alt || <em>Sem descrição — edite em Mídia</em>}</figcaption>
                </figure>
              ) : (
                <p className="field-hint">Sem imagem, o site usa a ilustração da categoria.</p>
              )}
              <div className="row">
                <Button variant="secondary" onClick={() => setPicker('featured')}>{featured ? 'Trocar' : 'Escolher imagem'}</Button>
                {featured && <Button variant="ghost" onClick={() => update('featured_image_id', null)}>Remover</Button>}
              </div>
            </div>
          </section>

          {row && (
            <section className="panel">
              <h2>Histórico</h2>
              {revisions === null ? (
                <button type="button" className="text-button" onClick={() => void showRevisions()}>Ver versões anteriores</button>
              ) : revisions.length === 0 ? (
                <p className="field-hint">Nenhuma versão anterior.</p>
              ) : (
                <ul className="list compact">
                  {revisions.map((r) => (
                    <li key={r.id}>
                      <span>{r.kind === 'publish' ? 'Publicada' : 'Editada'} · {dateTime(r.created_at)}</span>
                      <button type="button" className="text-button" onClick={() => { setDraft(pick({ ...r.snapshot, published: null })); setDirty(true); toast('info', 'Versão carregada no editor. Salve para mantê-la.'); }}>Carregar</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </aside>
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
