import type { BlogSummary } from '@/lib/blog/types';
import { Breadcrumbs } from './breadcrumbs';
import { Header, Footer } from './home';
import { InsightCards } from './insight-cards';
export function BlogIndex({ posts }: { posts: BlogSummary[] }){return <><Header inner/><main className="editorial wrap" id="inicio"><Breadcrumbs current="Insights" /><span className="eyebrow">INSIGHTS VELMONT</span><h1>Conhecimento para<br/><em>decidir com clareza.</em></h1><p className="editorial-intro">Marcas, patentes e software. Conversas importantes para quem está construindo um negócio.</p><InsightCards posts={posts} /></main><Footer/></>}
