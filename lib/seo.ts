import type { Metadata } from 'next';
import { faqs } from '@/content/faqs';
import { articleVisuals } from '@/content/insights';
import { authors } from '@/lib/blog/authors';
import { plainText, publicMedia } from '@/lib/blog/inline';
import { BLOG_BASE, type BlogPost } from '@/lib/blog/types';
import { coverFor, uploadedImage } from '@/lib/blog/visuals';
import { publicEnv } from './public-env';
import { organization, siteUrl } from './site';
const absolute = (src: string) => (src.startsWith('http') ? src : siteUrl + src);
export function pageSeo(path: string, article: BlogPost | null = null) {
  const defaults: Record<string, [string, string]> = {
    '/': ['Registro de marcas, patentes e software | Velmont', 'Consultoria em propriedade intelectual em Curitiba, com atendimento digital. Registro de marcas, patentes e software com análise de riscos e acompanhamento.'],
    [BLOG_BASE]: ['Guias sobre marcas, patentes e software | Velmont', 'Entenda o registro de marca, a proteção de software e os critérios de uma patente. Conteúdos da Velmont para decidir com clareza sobre propriedade intelectual.'],
    '/privacidade': ['Privacidade e uso de dados | Velmont', 'Saiba como o site da Velmont prepara sua mensagem de contato, quais dados utiliza e como falar com a equipe sobre privacidade.'],
  };
  const [title, description] = article ? [article.seo.title || `${article.title} | Velmont`, article.seo.description || article.excerpt] : defaults[path] || ['Página não encontrada | Velmont', 'Esta página não está disponível. Acesse a Velmont ou consulte nossos conteúdos sobre marcas, patentes e software.'];
  const media = publicMedia(publicEnv.supabaseUrl);
  const cover = article && (uploadedImage(article.seo.ogImage, media) || coverFor(article, media));
  const url = `${siteUrl}${path === '/' ? '/' : path}`;
  return { title, description, ogTitle: article?.seo.ogTitle || title, ogDescription: article?.seo.ogDescription || description, url, canonical: article?.seo.canonical || url, image: cover ? absolute(cover.src) : `${siteUrl}/images/velmont-social.png`, imageAlt: cover ? cover.alt || article.title : 'Velmont — Marca é patrimônio', imageWidth: cover ? cover.width : 1536, imageHeight: cover ? cover.height : 1024, index: path !== '/404' && (article ? article.seo.index : true), article };
}
export function nextMetadata(path: string, article: BlogPost | null = null): Metadata {
  const data = pageSeo(path, article);
  return { title: { absolute: data.title }, description: data.description, alternates: { canonical: data.canonical }, robots: { index: data.index, follow: true, 'max-image-preview': 'large' }, openGraph: { title: data.ogTitle, description: data.ogDescription, url: data.canonical, siteName: 'Velmont', locale: 'pt_BR', type: data.article ? 'article' : 'website', images: [{ url: data.image, width: data.imageWidth, height: data.imageHeight, alt: data.imageAlt }] }, twitter: { card: 'summary_large_image', title: data.ogTitle, description: data.ogDescription, images: [{ url: data.image, alt: data.imageAlt }] } };
}
export function pageSchema(path: string, article: BlogPost | null = null) {
  const data = pageSeo(path, article);
  if (!data.index) return null;
  const orgId = `${siteUrl}/#organization`;
  const siteId = `${siteUrl}/#website`;
  const pageId = `${data.url}#webpage`;
  const org = { ...organization, '@context': undefined, '@id': orgId, founder: [{ '@id': `${siteUrl}/#danielle` }, { '@id': `${siteUrl}/#lisandra` }] };
  const graph: Record<string, unknown>[] = [
    org,
    { '@type': 'WebSite', '@id': siteId, url: `${siteUrl}/`, name: 'Velmont', inLanguage: 'pt-BR', publisher: { '@id': orgId } },
    { '@type': path === BLOG_BASE ? 'CollectionPage' : 'WebPage', '@id': pageId, url: data.url, name: data.title, description: data.description, inLanguage: 'pt-BR', isPartOf: { '@id': siteId }, about: { '@id': orgId }, ...(path !== '/' ? { breadcrumb: { '@id': `${data.url}#breadcrumb` } } : {}) },
    { '@type': 'Person', '@id': `${siteUrl}/#danielle`, name: 'Danielle Cubas de Azevedo', jobTitle: 'Founder & CEO', url: `${siteUrl}/#fundadoras`, image: `${siteUrl}/images/danielle-velmont-1024.webp`, worksFor: { '@id': orgId } },
    { '@type': 'Person', '@id': `${siteUrl}/#lisandra`, name: 'Lisandra Ferreira dos Santos', jobTitle: 'Founder & CEO', url: `${siteUrl}/#fundadoras`, image: `${siteUrl}/images/lisandra-velmont-1024.webp`, worksFor: { '@id': orgId } },
  ];
  if (path !== '/') {
    const crumbs = [{ name: 'Início', item: `${siteUrl}/` }, ...(data.article ? [{ name: 'Insights', item: `${siteUrl}${BLOG_BASE}` }] : []), { name: data.article?.title || (path === BLOG_BASE ? 'Insights' : 'Privacidade'), item: data.url }];
    graph.push({ '@type': 'BreadcrumbList', '@id': `${data.url}#breadcrumb`, itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })) });
  }
  if (path === '/') {
    graph.push({ '@type': 'FAQPage', '@id': `${siteUrl}/#perguntas`, isPartOf: { '@id': pageId }, mainEntity: faqs.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) });
    for (const [category, visual] of Object.entries(articleVisuals)) graph.push({ '@type': 'Service', '@id': `${siteUrl}/#${visual.service}`, name: visual.serviceLabel, serviceType: category === 'MARCAS' ? 'Registro de marca' : category === 'SOFTWARE' ? 'Registro de programa de computador' : 'Patentes e desenho industrial', provider: { '@id': orgId }, url: `${siteUrl}/#${visual.service}` });
  }
  if (data.article) {
    const a = data.article;
    const author = authors[a.author];
    graph.push({ '@type': 'BlogPosting', '@id': `${data.url}#article`, headline: plainText(a.title), description: a.excerpt, image: [data.image], author: { '@id': `${siteUrl}/#${author.schemaId}` }, publisher: { '@id': orgId }, mainEntityOfPage: { '@id': pageId }, inLanguage: 'pt-BR', articleSection: a.category, ...(a.publishedAt ? { datePublished: a.publishedAt } : {}), ...(a.modifiedAt || a.publishedAt ? { dateModified: a.modifiedAt || a.publishedAt } : {}) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
