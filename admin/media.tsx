import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { mediaUrl } from '@/lib/blog/inline';
import { publicEnv } from '@/lib/public-env';
import { adminApi, supabase } from './supabase';
import type { MediaItem } from './types';
import { Button, Empty, Loading, useToast } from './ui';

const MAX_SIDE = 2000;
export const mediaSrc = (path: string) => mediaUrl(publicEnv.supabaseUrl, path) || '';

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

export function UploadButton({ onUploaded, label = 'Enviar imagem' }: { onUploaded: (m: MediaItem) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function change(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onUploaded(await uploadImage(file, ''));
      toast('ok', 'Imagem enviada. Lembre-se de descrever a imagem (texto alternativo).');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Falha no envio.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic" hidden onChange={(e) => void change(e)} />
      <Button variant="secondary" busy={busy} onClick={() => input.current?.click()}>
        {busy ? 'Enviando…' : label}
      </Button>
    </>
  );
}

export function useMedia() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('media').select('id, path, mime_type, bytes, width, height, alt, created_at').order('created_at', { ascending: false }).limit(300);
      setItems((data as MediaItem[]) || []);
    })();
  }, []);
  return { items, setItems };
}

export function MediaPicker({ onSelect, onClose }: { onSelect: (m: MediaItem) => void; onClose: () => void }) {
  const { items, setItems } = useMedia();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="dialog dialog-wide" onCancel={onClose} aria-labelledby="picker-title">
      <div className="dialog-head">
        <h2 id="picker-title">Escolher imagem</h2>
        <UploadButton onUploaded={(m) => { setItems([m, ...(items || [])]); onSelect(m); }} />
      </div>
      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty>Nenhuma imagem ainda. Envie a primeira.</Empty>
      ) : (
        <ul className="media-grid">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onSelect(m)}>
                <img src={mediaSrc(m.path)} alt={m.alt} width={m.width} height={m.height} loading="lazy" />
                <span>{m.alt || 'Sem descrição'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </div>
    </dialog>
  );
}
