import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { supabase } from './supabase';

// Draft media is in a private bucket. The panel shows it through short-lived
// signed URLs; Storage only signs them for active, MFA-verified staff (RLS).
export const PRIVATE_BUCKET = 'media-private';
export const SIGNED_URL_SECONDS = 600;

const cache = new Map<string, { url: string; expires: number }>();
let queue = new Map<string, ((url: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

const cached = (path: string) => {
  const hit = cache.get(path);
  return hit && hit.expires > Date.now() + 60_000 ? hit.url : null;
};

async function flush() {
  const batch = queue;
  queue = new Map();
  timer = null;
  const paths = [...batch.keys()];
  const { data } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  const byPath = new Map((data || []).filter((d) => d.path && d.signedUrl).map((d) => [d.path!, d.signedUrl]));
  for (const [path, resolvers] of batch) {
    const url = byPath.get(path) || null;
    if (url) cache.set(path, { url, expires: Date.now() + SIGNED_URL_SECONDS * 1000 });
    resolvers.forEach((resolve) => resolve(url));
  }
}

/** Signed URL for a private media path (batched; cached until shortly before expiry). */
export function signedUrl(path: string): Promise<string | null> {
  const hit = cached(path);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    queue.set(path, [...(queue.get(path) || []), resolve]);
    timer ??= setTimeout(() => void flush(), 15);
  });
}

export async function signedUrls(paths: string[]) {
  const urls = await Promise.all(paths.map((p) => signedUrl(p)));
  return new Map(paths.map((p, i) => [p, urls[i]]));
}

export function MediaImage({ path, alt = '', ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { path: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void signedUrl(path).then((url) => {
      if (active) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [path]);
  return src ? <img {...props} src={src} alt={alt} /> : <span className={`media-placeholder ${props.className || ''}`} aria-hidden="true" />;
}
