import { nextMetadata } from '@/lib/seo';
import { BLOG_BASE, summarize } from '@/lib/blog/types';
import { legacyPosts } from '@/lib/blog/legacy';
import { BlogIndex } from '@/components/velmont/blog-index';
export const metadata = nextMetadata(BLOG_BASE);
export default function Blog(){return <BlogIndex posts={legacyPosts.map(summarize)} />}
