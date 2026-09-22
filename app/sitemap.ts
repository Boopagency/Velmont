import {siteUrl} from '@/lib/site';
import {legacyPosts} from '@/lib/blog/legacy';
import {BLOG_BASE, postPath} from '@/lib/blog/types';
export default function sitemap(){return ['/',BLOG_BASE,'/privacidade',...legacyPosts.map(a=>postPath(a.slug))].map(path=>({url:`${siteUrl}${path}`,changeFrequency:'monthly' as const,priority:path==='/'?1:.6}));}
