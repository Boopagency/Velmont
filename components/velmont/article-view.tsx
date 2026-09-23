import { whatsappUrl } from '@/lib/site';
import { publicEnv } from '@/lib/public-env';
import { authors } from '@/lib/blog/authors';
import { ArticleBlocks } from '@/lib/blog/render';
import { coverFor, serviceFor } from '@/lib/blog/visuals';
import { publicMedia, type MediaResolver } from '@/lib/blog/inline';
import { postPath, type BlogPost, type BlogSummary } from '@/lib/blog/types';
import { Header, Footer } from './home';
import { Arrow } from './icons';
import { Breadcrumbs } from './breadcrumbs';
const dateLabel = (date: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date));
export function ArticleView({ post: a, related, resolveMedia = publicMedia(publicEnv.supabaseUrl) }: { post: BlogPost; related: BlogSummary[]; resolveMedia?: MediaResolver }) {
  const cover = coverFor(a, resolveMedia);
  const service = serviceFor(a.category);
  const author = authors[a.author];
  return <><Header inner /><main className="editorial wrap" id="inicio"><Breadcrumbs current={a.title} article /><h1>{a.title}</h1><p className="editorial-intro">{a.excerpt}</p><div className="article-byline"><span>Por <a href={author.url} rel="author">{author.name}</a></span><span>{a.category} · {a.readingMinutes} min de leitura</span>{a.publishedAt && <span>Publicado em <time dateTime={a.publishedAt}>{dateLabel(a.publishedAt)}</time></span>}{a.modifiedAt && <span>Atualizado em <time dateTime={a.modifiedAt}>{dateLabel(a.modifiedAt)}</time></span>}</div><img className="article-cover" src={cover.src} srcSet={cover.srcSet} sizes={cover.srcSet ? '(max-width: 767px) 100vw, 1000px' : undefined} width={cover.width} height={cover.height} alt={cover.alt} decoding="async" /><article className="article-body"><ArticleBlocks blocks={a.content.blocks} resolveMedia={resolveMedia} />{a.sources.length > 0 && <aside className="article-sources"><p>Referências para aprofundar</p>{a.sources.map(s => <a className="article-source-link" href={s.url} target="_blank" rel="noopener noreferrer" key={s.url}>{s.title}<Arrow /></a>)}<p className="article-note">Conteúdo informativo. As possibilidades de proteção dependem da análise do caso.</p></aside>}<div className="article-cta"><h2>Como isso se aplica<br /><em>ao seu negócio?</em></h2><a className="text-link" href={service ? `/#${service}` : '/#atuacao'}>{service ? `Conheça nossa atuação em ${a.category.toLowerCase()}` : 'Conheça nossa atuação'} <Arrow /></a><br /><a className="text-link" href={whatsappUrl()} target="_blank" rel="noopener noreferrer">Solicitar uma análise estratégica <Arrow /></a></div>{related.length > 0 && <aside className="article-related"><h2>Continue a leitura</h2>{related.map(item => <a href={postPath(item.slug)} key={item.slug}>{item.title} <Arrow /></a>)}</aside>}</article></main><Footer /></>;
}
