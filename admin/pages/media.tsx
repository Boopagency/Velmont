import { useState } from 'react';
import { adminApi, explain, supabase } from '../supabase';
import { mediaSrc, UploadButton, useMedia } from '../media';
import { date, type MediaItem } from '../types';
import { Button, Empty, Loading, PageHeader, useConfirm, useToast } from '../ui';

function MediaCard({ item, onSaved, onDeleted }: { item: MediaItem; onSaved: (m: MediaItem) => void; onDeleted: () => void }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [alt, setAlt] = useState(item.alt);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { data, error } = await supabase.from('media').update({ alt: alt.trim().slice(0, 300) }).eq('id', item.id).select('id, path, mime_type, bytes, width, height, alt, created_at').single();
    setBusy(false);
    if (error) toast('error', explain(error));
    else {
      onSaved(data as MediaItem);
      toast('ok', 'Descrição salva. Artigos publicados passam a usá-la na próxima publicação.');
    }
  }
  async function remove() {
    if (!(await confirm('Excluir imagem?', 'A imagem será removida definitivamente.', 'Excluir', true))) return;
    const result = await adminApi('/api/admin/media', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    if (result.ok) onDeleted();
    else toast('error', result.status === 409 ? 'Esta imagem está em uso em um artigo. Troque-a no artigo antes de excluir.' : 'Não foi possível excluir.');
  }
  return (
    <li className="media-card">
      {dialog}
      <img src={mediaSrc(item.path)} alt="" width={item.width} height={item.height} loading="lazy" />
      <label>
        <span>Descrição (texto alternativo)</span>
        <textarea rows={2} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} placeholder="O que a imagem mostra?" />
      </label>
      <p className="field-hint">{item.width}×{item.height} · {Math.round(item.bytes / 1024)} KB · {date(item.created_at)}</p>
      <div className="row">
        <Button variant="secondary" busy={busy} disabled={alt === item.alt} onClick={() => void save()}>Salvar descrição</Button>
        <Button variant="ghost" onClick={() => void remove()}>Excluir</Button>
      </div>
    </li>
  );
}

export function Media() {
  const { items, setItems } = useMedia();
  return (
    <>
      <PageHeader eyebrow="Biblioteca" title="Mídia" actions={<UploadButton onUploaded={(m) => setItems([m, ...(items || [])])} />} />
      <p className="field-hint intro">Imagens JPG, PNG ou WebP. Elas são otimizadas automaticamente antes do envio. Descreva cada imagem: a descrição é lida por leitores de tela e ajuda os buscadores.</p>
      {!items ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty>Nenhuma imagem enviada.</Empty>
      ) : (
        <ul className="media-cards">
          {items.map((m) => (
            <MediaCard key={m.id} item={m} onSaved={(saved) => setItems(items.map((x) => (x.id === saved.id ? saved : x)))} onDeleted={() => setItems(items.filter((x) => x.id !== m.id))} />
          ))}
        </ul>
      )}
    </>
  );
}
