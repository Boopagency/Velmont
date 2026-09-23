import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArticleView } from '@/components/velmont/article-view';
import { readingMinutes } from '@/lib/blog/posts';
import type { BlogPost, ImageRef } from '@/lib/blog/types';
import { supabase } from './supabase';

// Private preview of the working copy, rendered with the public components.
// Access relies on the staff session: RLS returns nothing to anyone else.

type Row = {
  title: string; slug: string; excerpt: string; content: BlogPost['content']; category: BlogPost['category']; tags: string[]; author_key: BlogPost['author'];
  sources: BlogPost['sources']; reading_minutes: number | null; first_published_at: string | null; updated_at: string; status: string;
  featured: ImageRef | null;
};

function Preview() {
  const [id] = useState(() => new URLSearchParams(location.search).get('id') || '');
  const [state, setState] = useState<{ post: BlogPost; status: string } | 'denied' | null>(() => (/^[0-9a-f-]{36}$/.test(id) ? null : 'denied'));
  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/.test(id)) return;
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== 'aal2') return setState('denied');
      const { data } = await supabase.from('articles').select('title, slug, excerpt, content, category, tags, author_key, sources, reading_minutes, first_published_at, updated_at, status, featured:media!articles_featured_image_id_fkey(path, width, height, alt)').eq('id', id).maybeSingle();
      if (!data) return setState('denied');
      const row = data as unknown as Row;
      setState({
        status: row.status,
        post: {
          slug: row.slug, title: row.title || 'Sem título', excerpt: row.excerpt, content: row.content, category: row.category, tags: row.tags, author: row.author_key, sources: row.sources,
          featuredImage: row.featured, seo: { title: null, description: null, canonical: null, ogTitle: null, ogDescription: null, ogImage: null, index: false },
          publishedAt: row.first_published_at, modifiedAt: null, readingMinutes: row.reading_minutes ?? readingMinutes(row.content, row.excerpt),
        },
      });
    })();
  }, [id]);
  if (state === null) return <p className="preview-bar">Carregando pré-visualização…</p>;
  if (state === 'denied') return <p className="preview-bar">Pré-visualização indisponível. Entre no painel em <a href="/admin">/admin</a> e abra o artigo novamente.</p>;
  return (
    <>
      <output className="preview-bar">Pré-visualização · {state.status === 'published' ? 'versão salva (pode diferir da publicada)' : 'não publicado'} · <a href="/admin">Voltar ao painel</a></output>
      <ArticleView post={state.post} related={[]} />
    </>
  );
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
