import { Home } from '@/components/velmont/home';
import { pageSchema } from '@/lib/seo';
export default function Page() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema('/')).replace(/</g, '\\u003c') }} /><Home /></>;
}
