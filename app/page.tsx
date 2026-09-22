import { Home } from '@/components/velmont/home';
import { legacyPosts } from '@/lib/blog/legacy';
import { summarize } from '@/lib/blog/types';
import { pageSchema } from '@/lib/seo';
export default function Page() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema('/')).replace(/</g, '\\u003c') }} /><Home posts={legacyPosts.slice(0, 3).map(summarize)} /></>;
}
