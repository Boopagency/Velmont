import { whatsappUrl } from '@/lib/site';
import { Arrow } from '@/components/velmont/icons';
import { articles, type Article } from '@/content/insights';
const visuals: Record<string, string> = { MARCAS: 'velmont-trademark-ownership', SOFTWARE: 'velmont-software-authorship', PATENTES: 'velmont-patent-engineering' };
function Cover({ article, large = false }: { article: Article; large?: boolean }) {
  return <img src={`/generated/${visuals[article.category]}-${large ? '1000' : '640'}.webp`} alt="" width="640" height="640" loading="lazy" decoding="async" />;
}
export function InsightCards() {
  const featured = articles[0];
  return <div className="journal">
    <div className="journal-top">
      <article className="journal-feature"><a href={`/insights/${featured.slug}`}><Cover article={featured} large /><div className="journal-feature-copy"><span className="journal-category">{featured.category}</span><h3>{featured.title}</h3><span className="journal-meta">{featured.readTime} de leitura <Arrow /></span></div></a></article>
      <aside className="journal-latest" aria-label="Artigos em pauta"><div className="journal-label"><h3>Em pauta</h3><span>VELMONT INSIGHTS</span></div>{articles.map(article => <a className="journal-compact" href={`/insights/${article.slug}`} key={article.slug}><Cover article={article} /><div><h4>{article.title}</h4><span>{article.category} · {article.readTime}</span></div></a>)}<p>Leituras para entender, proteger<br />e construir com mais clareza.</p></aside>
    </div>
    <div className="journal-divider"><h3>Olhares sobre o seu patrimônio</h3><span>03 LEITURAS ESSENCIAIS</span></div>
    <div className="journal-cards">{articles.map(article => <article className="journal-card" key={article.slug}><a href={`/insights/${article.slug}`}><div className="journal-card-image"><Cover article={article} /></div><div className="journal-card-copy"><span className="journal-category">{article.category}</span><h3>{article.title}</h3><p>{article.description}</p><span className="journal-meta">{article.readTime} de leitura <Arrow /></span></div></a></article>)}</div>
    <div className="journal-footer"><span>CONHECIMENTO QUE APROXIMA.</span><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">Vamos conversar sobre seu negócio <Arrow /></a></div>
  </div>;
}
