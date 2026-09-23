import type { ArticleContent, AuthorKey, Category, Source } from '@/lib/blog/types';

export type Role = 'owner' | 'editor';
export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'archived';

export type MediaItem = { id: string; path: string; mime_type: string; bytes: number; width: number; height: number; alt: string; created_at: string };

export type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: ArticleContent;
  featured_image_id: string | null;
  author_key: AuthorKey;
  category: Category;
  tags: string[];
  sources: Source[];
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_id: string | null;
  robots_index: boolean;
  reading_minutes: number | null;
  status: ArticleStatus;
  version: number;
  first_published_at: string | null;
  created_at: string;
  updated_at: string;
  published: { slug: string; source_version: number; published_at: string | null; modified_at: string | null } | null;
};

export const editableArticleFields = [
  'title', 'slug', 'excerpt', 'content', 'featured_image_id', 'author_key', 'category', 'tags', 'sources',
  'seo_title', 'seo_description', 'canonical_url', 'og_title', 'og_description', 'og_image_id', 'robots_index',
] as const;
export type ArticleDraft = Pick<ArticleRow, (typeof editableArticleFields)[number]>;

export type Lead = {
  id: string;
  created_at: string;
  name: string;
  company: string | null;
  interest: string;
  source: string;
  channel: string;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  status: LeadStatus;
  notes: string;
  updated_at: string;
};

export const articleStatusLabel: Record<ArticleStatus, string> = { draft: 'Rascunho', review: 'Em revisão', published: 'Publicado', archived: 'Arquivado' };
export const leadStatusLabel: Record<LeadStatus, string> = { new: 'Novo', contacted: 'Contatado', qualified: 'Qualificado', converted: 'Convertido', archived: 'Arquivado' };
export const authorLabel: Record<AuthorKey, string> = { velmont: 'Velmont (institucional)', danielle: 'Danielle Cubas de Azevedo', lisandra: 'Lisandra Ferreira dos Santos' };

export const hasUnpublishedChanges = (a: Pick<ArticleRow, 'status' | 'version' | 'published'>) => a.status === 'published' && !!a.published && a.published.source_version !== a.version;

export const dateTime = (value: string | null) => (value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—');
export const date = (value: string | null) => (value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value)) : '—');
