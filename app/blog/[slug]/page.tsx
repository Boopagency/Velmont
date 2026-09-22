import { notFound } from 'next/navigation';
import { legacyPosts } from '@/lib/blog/legacy';
import { postPath, summarize } from '@/lib/blog/types';
import { ArticleView } from '@/components/velmont/article-view';
import { nextMetadata, pageSchema } from '@/lib/seo';
// Vinext scaffold route. Production pages are prerendered by scripts/build-static.mjs from the CMS.
export function generateStaticParams() { return legacyPosts.map(a => ({ slug: a.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return nextMetadata(postPath(slug), legacyPosts.find(a => a.slug === slug) ?? null); }
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = legacyPosts.find(a => a.slug === slug);
  if (!post) notFound();
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema(postPath(slug), post)).replace(/</g, '\\u003c') }} /><ArticleView post={post} related={legacyPosts.filter(p => p.slug !== slug).map(summarize)} /></>;
}
