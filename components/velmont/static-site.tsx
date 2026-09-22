import { useEffect } from 'react';
import { Home } from './home';
import Privacy from '@/app/privacidade/page';
import NotFound from '@/app/not-found';
import { ArticleView } from './article-view';
import { BlogIndex } from './blog-index';
import { captureAttribution } from '@/lib/lead-capture';
import { BLOG_BASE, type BlogPost, type BlogSummary } from '@/lib/blog/types';
export type PageData = { posts?: BlogSummary[]; post?: BlogPost; related?: BlogSummary[] };
export function StaticSite({path,data}:{path:string;data:PageData}) {
 useEffect(captureAttribution,[]);
 const route=path.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
 if(route==='/')return <Home posts={data.posts||[]}/>;
 if(route===BLOG_BASE)return <BlogIndex posts={data.posts||[]}/>;
 if(route==='/privacidade')return <Privacy/>;
 return data.post&&route===`${BLOG_BASE}/${data.post.slug}`?<ArticleView post={data.post} related={data.related||[]}/>:<NotFound/>;
}
