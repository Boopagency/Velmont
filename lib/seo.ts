import type { Metadata } from 'next';
import { articles, articleVisuals } from '@/content/insights';
import { faqs } from '@/content/faqs';
import { organization, siteUrl } from './site';
export function pageSeo(path: string) {
  const article = articles.find(a => `/insights/${a.slug}` === path);
  const defaults: Record<string, [string, string]> = {
    '/': ['Registro de marcas, patentes e software | Velmont', 'Consultoria em propriedade intelectual em Curitiba, com atendimento digital. Registro de marcas, patentes e software com análise de riscos e acompanhamento.'],
    '/insights': ['Guias sobre marcas, patentes e software | Velmont', 'Entenda o registro de marca, a proteção de software e os critérios de uma patente. Conteúdos da Velmont para decidir com clareza sobre propriedade intelectual.'],
    '/privacidade': ['Privacidade e uso de dados | Velmont', 'Saiba como o site da Velmont prepara sua mensagem de contato, quais dados utiliza e como falar com a equipe sobre privacidade.'],
  };
  const [title, description] = article ? [`${article.title} | Velmont`, article.description] : defaults[path] || ['Página não encontrada | Velmont', 'Esta página não está disponível. Acesse a Velmont ou consulte nossos conteúdos sobre marcas, patentes e software.'];
  const image = article ? `/generated/${articleVisuals[article.category].image}-1000.webp` : '/images/velmont-social.png';
  return { title, description, canonical: `${siteUrl}${path === '/' ? '/' : path}`, image: siteUrl + image, imageAlt: article ? articleVisuals[article.category].alt : 'Velmont — Marca é patrimônio', imageWidth: article ? 1000 : 1536, imageHeight: article ? 1000 : 1024, index: path !== '/404', article };
}
export function nextMetadata(path: string): Metadata {
  const data = pageSeo(path);
  return { title: { absolute: data.title }, description: data.description, alternates: { canonical: data.canonical }, robots: { index: data.index, follow: true, 'max-image-preview': 'large' }, openGraph: { title: data.title, description: data.description, url: data.canonical, siteName: 'Velmont', locale: 'pt_BR', type: data.article ? 'article' : 'website', images: [{ url: data.image, width: data.imageWidth, height: data.imageHeight, alt: data.imageAlt }] }, twitter: { card: 'summary_large_image', title: data.title, description: data.description, images: [{ url: data.image, alt: data.imageAlt }] } };
}
export function pageSchema(path: string) {
  const data = pageSeo(path);
  if (!data.index) return null;
  const orgId = `${siteUrl}/#organization`;
  const siteId = `${siteUrl}/#website`;
  const pageId = `${data.canonical}#webpage`;
  const org = { ...organization, '@context': undefined, '@id': orgId, founder: [{ '@id': `${siteUrl}/#danielle` }, { '@id': `${siteUrl}/#lisandra` }] };
  const graph: Record<string, unknown>[] = [
    org,
    { '@type': 'WebSite', '@id': siteId, url: `${siteUrl}/`, name: 'Velmont', inLanguage: 'pt-BR', publisher: { '@id': orgId } },
    { '@type': path === '/insights' ? 'CollectionPage' : 'WebPage', '@id': pageId, url: data.canonical, name: data.title, description: data.description, inLanguage: 'pt-BR', isPartOf: { '@id': siteId }, about: { '@id': orgId }, ...(path !== '/' ? { breadcrumb: { '@id': `${data.canonical}#breadcrumb` } } : {}) },
    { '@type': 'Person', '@id': `${siteUrl}/#danielle`, name: 'Danielle Cubas de Azevedo', jobTitle: 'Founder & CEO', url: `${siteUrl}/#fundadoras`, image: `${siteUrl}/images/danielle-velmont-1024.webp`, worksFor: { '@id': orgId } },
    { '@type': 'Person', '@id': `${siteUrl}/#lisandra`, name: 'Lisandra Ferreira dos Santos', jobTitle: 'Founder & CEO', url: `${siteUrl}/#fundadoras`, image: `${siteUrl}/images/lisandra-velmont-1024.webp`, worksFor: { '@id': orgId } },
  ];
  if (path !== '/') {
    const crumbs = [{ name: 'Início', item: `${siteUrl}/` }, ...(data.article ? [{ name: 'Insights', item: `${siteUrl}/insights` }] : []), { name: data.article?.title || (path === '/insights' ? 'Insights' : 'Privacidade'), item: data.canonical }];
    graph.push({ '@type': 'BreadcrumbList', '@id': `${data.canonical}#breadcrumb`, itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, ...crumb })) });
  }
  if (path === '/') {
    graph.push({ '@type': 'FAQPage', '@id': `${siteUrl}/#perguntas`, isPartOf: { '@id': pageId }, mainEntity: faqs.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) });
    for (const [category, visual] of Object.entries(articleVisuals)) graph.push({ '@type': 'Service', '@id': `${siteUrl}/#${visual.service}`, name: visual.serviceLabel, serviceType: category === 'MARCAS' ? 'Registro de marca' : category === 'SOFTWARE' ? 'Registro de programa de computador' : 'Patentes e desenho industrial', provider: { '@id': orgId }, url: `${siteUrl}/#${visual.service}` });
  }
  if (data.article) {
    const a = data.article;
    graph.push({ '@type': 'BlogPosting', '@id': `${data.canonical}#article`, headline: a.title, description: a.description, image: [data.image], author: { '@id': orgId }, publisher: { '@id': orgId }, mainEntityOfPage: { '@id': pageId }, inLanguage: 'pt-BR', articleSection: a.category, ...(a.datePublished ? { datePublished: a.datePublished } : {}), ...(a.dateModified ? { dateModified: a.dateModified } : {}) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
