import { nextMetadata } from '@/lib/seo';
import { Breadcrumbs } from '@/components/velmont/breadcrumbs';
import { Header, Footer } from '@/components/velmont/home';
import { InsightCards } from '@/components/velmont/insight-cards';
export const metadata = nextMetadata('/insights');
export default function Insights(){return <><Header inner/><main className="editorial wrap" id="inicio"><Breadcrumbs current="Insights" /><span className="eyebrow">INSIGHTS VELMONT</span><h1>Conhecimento para<br/><em>decidir com clareza.</em></h1><p className="editorial-intro">Marcas, patentes e software. Conversas importantes para quem está construindo um negócio.</p><InsightCards /></main><Footer/></>}
