import { Home } from './home';
import Insights from '@/app/insights/page';
import Privacy from '@/app/privacidade/page';
import NotFound from '@/app/not-found';
import { ArticleView } from './article-view';
import { articles } from '@/content/insights';
export function StaticSite({path}:{path:string}) {
 const route=path.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
 if(route==='/')return <Home/>;
 if(route==='/insights')return <Insights/>;
 if(route==='/privacidade')return <Privacy/>;
 const article=articles.find(a=>`/insights/${a.slug}`===route);
 return article?<ArticleView article={article}/>:<NotFound/>;
}
