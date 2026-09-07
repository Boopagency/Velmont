import {siteUrl} from '@/lib/site';
import {articles} from '@/content/insights';
export default function sitemap(){return ['/','/insights','/privacidade',...articles.map(a=>`/insights/${a.slug}`)].map(path=>({url:`${siteUrl}${path}`,changeFrequency:'monthly' as const,priority:path==='/'?1:.6}));}
