import { BLOG_BASE } from '@/lib/blog/types';
export function Breadcrumbs({ current, article = false }: { current: string; article?: boolean }) {
  return <nav className="breadcrumbs" aria-label="Caminho de navegação"><ol><li><a href="/">Início</a></li>{article && <li><a href={BLOG_BASE}>Insights</a></li>}<li aria-current="page">{current}</li></ol></nav>;
}
