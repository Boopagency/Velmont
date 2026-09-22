export const BLOG_BASE = '/blog';

export const categories = ['MARCAS', 'PATENTES', 'SOFTWARE', 'PROPRIEDADE INTELECTUAL'] as const;
export type Category = (typeof categories)[number];

export const authorKeys = ['velmont', 'danielle', 'lisandra'] as const;
export type AuthorKey = (typeof authorKeys)[number];

export type ImageRef = { path: string; width: number; height: number; alt: string };

export type Block =
  | { id?: string; type: 'paragraph'; text: string }
  | { id?: string; type: 'heading'; level: 2 | 3; text: string }
  | { id?: string; type: 'list'; style: 'bullet' | 'ordered'; items: string[] }
  | { id?: string; type: 'quote'; text: string; cite?: string | null }
  | { id?: string; type: 'callout'; title?: string | null; text: string }
  | { id?: string; type: 'faq'; question: string; answer: string }
  | { id?: string; type: 'table'; caption?: string | null; header: string[]; rows: string[][] }
  | ({ id?: string; type: 'image'; mediaId: string; caption?: string | null } & ImageRef);

export type BlockType = Block['type'];
export type ArticleContent = { version: 1; blocks: Block[] };
export type Source = { title: string; url: string };

/** What the public site knows about a published article. */
export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  content: ArticleContent;
  category: Category;
  tags: string[];
  author: AuthorKey;
  sources: Source[];
  featuredImage: ImageRef | null;
  seo: {
    title: string | null;
    description: string | null;
    canonical: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: ImageRef | null;
    index: boolean;
  };
  publishedAt: string | null;
  modifiedAt: string | null;
  readingMinutes: number;
};

export type BlogSummary = Pick<BlogPost, 'slug' | 'title' | 'excerpt' | 'category' | 'featuredImage' | 'readingMinutes'>;

export const postPath = (slug: string) => `${BLOG_BASE}/${slug}`;

export const summarize = ({ slug, title, excerpt, category, featuredImage, readingMinutes }: BlogPost): BlogSummary => ({
  slug,
  title,
  excerpt,
  category,
  featuredImage,
  readingMinutes,
});
