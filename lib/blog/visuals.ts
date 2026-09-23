import { articleVisuals } from '@/content/insights';
import { isMediaPath, type MediaResolver } from './inline';
import type { BlogSummary, Category, ImageRef } from './types';

// Articles without an uploaded image keep the site's existing category art.
const fallback: Record<Category, { image: string; alt: string; service: string | null }> = {
  MARCAS: { ...articleVisuals.MARCAS },
  SOFTWARE: { ...articleVisuals.SOFTWARE },
  PATENTES: { ...articleVisuals.PATENTES },
  'PROPRIEDADE INTELECTUAL': { image: 'velmont-brand-monolith', alt: 'Monólito delimitado, metáfora de identidade e proteção', service: null },
};

export type Cover = { src: string; srcSet?: string; width: number; height: number; alt: string; uploaded: boolean };

export function uploadedImage(image: ImageRef | null, resolveMedia: MediaResolver): Cover | null {
  const src = image && isMediaPath(image.path) ? resolveMedia(image.path) : null;
  return src && image ? { src, width: image.width, height: image.height, alt: image.alt, uploaded: true } : null;
}

export function coverFor(post: Pick<BlogSummary, 'category' | 'featuredImage'>, resolveMedia: MediaResolver, size: '640' | '1000' = '1000'): Cover {
  const uploaded = uploadedImage(post.featuredImage, resolveMedia);
  if (uploaded) return uploaded;
  const visual = fallback[post.category] || fallback.MARCAS;
  return {
    src: `/generated/${visual.image}-${size}.webp`,
    srcSet: `/generated/${visual.image}-640.webp 640w, /generated/${visual.image}-1000.webp 1000w`,
    width: Number(size),
    height: Number(size),
    alt: visual.alt,
    uploaded: false,
  };
}

/** Service section on the home page that matches an article category. */
export const serviceFor = (category: Category) => fallback[category]?.service ?? null;
