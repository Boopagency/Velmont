import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlusIcon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { MediaImage } from './signed';
import { adminApi, supabase } from './supabase';
import type { ArticleStatus, MediaItem } from './types';
import { EmptyState, notify, SearchInput } from './ui';

const MAX_SIDE = 2000;
export const mediaColumns = 'id, path, mime_type, bytes, width, height, alt, created_at';

/**
 * Re-encodes the photo in the browser: caps the size for fast pages and drops
 * metadata such as GPS. The server still verifies the resulting bytes.
 */
async function prepare(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('Formato não suportado. Use JPG, PNG ou WebP.');
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.84));
  let blob = await encode('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
  if (!blob) throw new Error('Não foi possível processar a imagem.');
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `imagem.${ext}`, { type: blob.type });
}

export async function uploadImage(file: File, alt: string): Promise<MediaItem> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Arquivo muito grande (máximo 25 MB antes da otimização).');
  const prepared = await prepare(file);
  const form = new FormData();
  form.set('file', prepared);
  form.set('alt', alt);
  const result = await adminApi('/api/admin/media', { method: 'POST', body: form });
  if (!result.ok) {
    const messages: Record<number, string> = { 413: 'Imagem muito grande.', 415: 'Tipo de arquivo não permitido.', 429: 'Muitos envios em pouco tempo. Aguarde alguns minutos.', 401: 'Sessão expirada. Entre novamente.', 403: 'Sem permissão.' };
    throw new Error(messages[result.status] || 'Falha no envio da imagem.');
  }
  return result.body.media as MediaItem;
}

export function UploadButton({ onUploaded, label = 'Enviar imagem', variant = 'default' }: { onUploaded: (m: MediaItem) => void; label?: string; variant?: 'default' | 'outline' }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function change(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onUploaded(await uploadImage(file, ''));
      notify.ok('Imagem enviada', 'Lembre-se de descrever a imagem (texto alternativo).');
    } catch (error) {
      notify.error('Não foi possível enviar a imagem', error instanceof Error ? error.message : 'Falha no envio.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic" hidden onChange={(e) => void change(e)} />
      <Button variant={variant} disabled={busy} aria-busy={busy || undefined} onClick={() => input.current?.click()} className={variant === 'default' ? 'h-9 px-3.5' : undefined}>
        {busy ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <UploadIcon data-icon="inline-start" aria-hidden="true" />}
        {busy ? 'Enviando…' : label}
      </Button>
    </>
  );
}

export function useMedia() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('media').select(mediaColumns).order('created_at', { ascending: false }).limit(300);
      setItems((data as MediaItem[]) || []);
    })();
  }, []);
  return { items, setItems };
}

export type Usage = { id: string; title: string; status: ArticleStatus; live: boolean };
type Refs = { featured_image_id?: string | null; og_image_id?: string | null; content?: { blocks?: { type?: string; mediaId?: unknown; path?: unknown }[] } };

/**
 * Which articles use each image, with the same references the server checks
 * before a deletion (drafts and the published copies). Read-only.
 */
export function useMediaUsage() {
  const [usage, setUsage] = useState<Map<string, Usage[]> | null>(null);
  useEffect(() => {
    void (async () => {
      const [drafts, live] = await Promise.all([
        supabase.from('articles').select('id, title, status, featured_image_id, og_image_id, content').limit(500),
        supabase.from('published_articles').select('article_id, title, featured_image, og_image, content').limit(500),
      ]);
      const map = new Map<string, Usage[]>();
      const add = (key: unknown, use: Usage) => {
        if (typeof key !== 'string' || !key) return;
        const list = map.get(key) || [];
        if (!list.some((u) => u.id === use.id && u.live === use.live)) map.set(key, [...list, use]);
      };
      for (const a of (drafts.data as (Refs & { id: string; title: string; status: ArticleStatus })[]) || []) {
        const use = { id: a.id, title: a.title || 'Sem título', status: a.status, live: false };
        add(a.featured_image_id, use);
        add(a.og_image_id, use);
        for (const b of a.content?.blocks || []) if (b?.type === 'image') add(b.mediaId, use);
      }
      for (const p of (live.data as { article_id: string; title: string; featured_image: { path?: string } | null; og_image: { path?: string } | null; content: Refs['content'] }[]) || []) {
        const use = { id: p.article_id, title: p.title, status: 'published' as const, live: true };
        add(p.featured_image?.path, use);
        add(p.og_image?.path, use);
        for (const b of p.content?.blocks || []) if (b?.type === 'image') add(b.mediaId, use);
      }
      setUsage(map);
    })();
  }, []);
  return usage;
}

/** Articles using an image (by id or by path), each article once. */
export function usageOf(usage: Map<string, Usage[]> | null, item: MediaItem) {
  if (!usage) return null;
  const all = [...(usage.get(item.id) || []), ...(usage.get(item.path) || [])];
  return all.filter((u, i) => all.findIndex((x) => x.id === u.id) === i);
}

export function MediaThumb({ item, className }: { item: MediaItem; className?: string }) {
  return (
    <div className={cn('aspect-[4/3] w-full overflow-hidden bg-muted', className)}>
      <MediaImage path={item.path} alt={item.alt || 'Imagem sem descrição'} loading="lazy" decoding="async" className="size-full object-cover" />
    </div>
  );
}

export function MediaPicker({ onSelect, onClose }: { onSelect: (m: MediaItem) => void; onClose: () => void }) {
  const { items, setItems } = useMedia();
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const shown = items?.filter((m) => !term || m.alt.toLowerCase().includes(term)) ?? null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(88svh,760px)] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="gap-1 border-b p-4 pr-12">
          <DialogTitle className="text-[15px] font-semibold">Escolher imagem</DialogTitle>
          <DialogDescription>Selecione uma imagem da biblioteca ou envie uma nova.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <SearchInput label="Buscar por descrição" placeholder="Buscar por descrição" value={query} onChange={setQuery} className="sm:w-64" />
          <div className="ml-auto">
            <UploadButton
              variant="outline"
              onUploaded={(m) => {
                setItems([m, ...(items || [])]);
                onSelect(m);
              }}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!shown ? (
            <output className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Carregando imagens">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
              ))}
            </output>
          ) : items && items.length === 0 ? (
            <EmptyState icon={<ImagePlusIcon />} title="Sua biblioteca está vazia." description="Envie a primeira imagem para usá-la no artigo." className="border-0" />
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma imagem com essa descrição.</p>
          ) : (
            <ul className="media-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {shown.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => onSelect(m)} className="group grid w-full gap-1.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <MediaThumb item={m} className="rounded-lg border transition-[box-shadow,border-color] group-hover:border-brand/40 group-hover:shadow-[0_0_0_3px_var(--brand-soft)]" />
                    <span className={cn('line-clamp-1 text-xs', m.alt ? 'text-foreground/80' : 'text-muted-foreground italic')}>{m.alt || 'Sem descrição'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-b-xl">
          <DialogClose render={<Button variant="outline" />}>Fechar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
