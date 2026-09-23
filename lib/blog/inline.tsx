import type { ReactNode } from 'react';

// Article text is plain text with three inline marks: **bold**, *italic* and
// [label](url). Output is React elements only (no HTML strings), so markup in
// the text is always escaped. Links are limited to safe protocols.

const MEDIA_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|avif)$/;

function hasControlCharacter(value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (!url || url.length > 500 || /[\s<>"'`\\]/.test(url) || hasControlCharacter(url)) return null;
  if (url.startsWith('#')) return /^#[\w-]+$/.test(url) ? url : null;
  if (url.startsWith('/')) return url.startsWith('//') ? null : url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    if (parsed.protocol === 'mailto:') return url;
  } catch {
    return null;
  }
  return null;
}

export const isExternal = (href: string) => /^https?:\/\//.test(href);

export const isMediaPath = (path: string) => MEDIA_PATH.test(path);

/** Public URL of an image copied to the public bucket at publish time. */
export function mediaUrl(base: string, path: string): string | null {
  if (!base || !MEDIA_PATH.test(path)) return null;
  return `${base}/storage/v1/object/public/media/${path}`;
}

/** Maps a media path to a URL: public bucket on the site, signed URLs in the private preview. */
export type MediaResolver = (path: string) => string | null;
export const publicMedia = (base: string): MediaResolver => (path) => mediaUrl(base, path);

const TOKEN = /\*\*([^*]+?)\*\*|\*([^*]+?)\*|\[([^\]\n]{1,300})\]\(([^()\s]{1,500})\)/g;

export function Inline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const pushText = (value: string) => {
    value.split('\n').forEach((line, i) => {
      if (i > 0) nodes.push(<br key={`br-${key++}`} />);
      if (line) nodes.push(line);
    });
  };
  for (const match of text.matchAll(TOKEN)) {
    pushText(text.slice(last, match.index));
    last = match.index + match[0].length;
    if (match[1] !== undefined) nodes.push(<strong key={key++}>{match[1]}</strong>);
    else if (match[2] !== undefined) nodes.push(<em key={key++}>{match[2]}</em>);
    else {
      const href = safeHref(match[4]);
      if (!href) pushText(match[3]);
      else if (isExternal(href))
        nodes.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer">
            {match[3]}
          </a>,
        );
      else
        nodes.push(
          <a key={key++} href={href}>
            {match[3]}
          </a>,
        );
    }
  }
  pushText(text.slice(last));
  return <>{nodes}</>;
}

/** Plain-text version, used for metadata, JSON-LD and reading time. */
export const plainText = (text: string) =>
  text.replace(TOKEN, (_all, bold, italic, label) => bold ?? italic ?? label ?? '');
