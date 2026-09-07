import { notFound } from 'next/navigation';
import { articles } from '@/content/insights';
import { ArticleView } from '@/components/velmont/article-view';
import { nextMetadata, pageSchema } from '@/lib/seo';
export function generateStaticParams() { return articles.map(a => ({ slug: a.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return nextMetadata(`/insights/${slug}`); }
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articles.find(a => a.slug === slug);
  if (!article) notFound();
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema(`/insights/${slug}`)).replace(/</g, '\\u003c') }} /><ArticleView article={article} /></>;
}
