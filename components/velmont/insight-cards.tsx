import { whatsappUrl } from '@/lib/site';
import { publicEnv } from '@/lib/public-env';
import { coverFor } from '@/lib/blog/visuals';
import { publicMedia } from '@/lib/blog/inline';
import { postPath, type BlogSummary } from '@/lib/blog/types';
import { Arrow } from '@/components/velmont/icons';
function Cover({ article, large = false }: { article: BlogSummary; large?: boolean }) {
  const cover = coverFor(article, publicMedia(publicEnv.supabaseUrl), large ? '1000' : '640');
  return <img src={cover.src} alt="" width={cover.uploaded ? cover.width : 640} height={cover.uploaded ? cover.height : 640} loading="lazy" decoding="async" />;
}
export function InsightCards({ posts }: { posts: BlogSummary[] }) {
  const featured = posts[0];
  if (!featured) return null;
  return <div className="journal">
    <div className="journal-top">
      <article className="journal-feature"><a href={postPath(featured.slug)}><Cover article={featured} large /><div className="journal-feature-copy"><span className="journal-category">{featured.category}</span><h3>{featured.title}</h3><span className="journal-meta">{featured.readingMinutes} min de leitura <Arrow /></span></div></a></article>
      <aside className="journal-latest" aria-label="Artigos em pauta"><div className="journal-label"><h3>Em pauta</h3><span>VELMONT INSIGHTS</span></div>{posts.slice(0, 3).map(article => <a className="journal-compact" href={postPath(article.slug)} key={article.slug}><Cover article={article} /><div><h4>{article.title}</h4><span>{article.category} · {article.readingMinutes} min</span></div></a>)}<p>Leituras para entender, proteger<br />e construir com mais clareza.</p></aside>
    </div>
    <div className="journal-divider"><h3>Olhares sobre o seu patrimônio</h3><span>{String(posts.length).padStart(2, '0')} LEITURAS ESSENCIAIS</span></div>
    <div className="journal-cards">{posts.map(article => <article className="journal-card" key={article.slug}><a href={postPath(article.slug)}><div className="journal-card-image"><Cover article={article} /></div><div className="journal-card-copy"><span className="journal-category">{article.category}</span><h3>{article.title}</h3><p>{article.excerpt}</p><span className="journal-meta">{article.readingMinutes} min de leitura <Arrow /></span></div></a></article>)}</div>
    <div className="journal-footer"><span>CONHECIMENTO QUE APROXIMA.</span><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">Vamos conversar sobre seu negócio <Arrow /></a></div>
  </div>;
}
