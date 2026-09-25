import { useState } from 'react';
import { ExternalLinkIcon, ImagePlusIcon, LinkIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Link } from '../router';
import { MediaImage } from '../signed';
import { adminApi, explain, supabase } from '../supabase';
import { mediaColumns, MediaThumb, UploadButton, useMedia, useMediaUsage, usageOf, type Usage } from '../media';
import type { MediaItem } from '../types';
import { EmptyState, FilterSelect, fullDate, notify, Page, PageHeader, SearchInput, StatusBadge, useConfirm, useCrumbs } from '../ui';

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const kind = (mime: string) => mime.replace('image/', '').toUpperCase();
const filters: [string, string][] = [['all', 'Todas as imagens'], ['used', 'Em uso'], ['unused', 'Sem uso'], ['no-alt', 'Sem descrição']];

function InUse({ uses }: { uses: Usage[] }) {
  return (
    <Tooltip>
      <TooltipTrigger className="relative z-[1] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40" aria-label={`Em uso em: ${uses.map((u) => u.title).join('; ')}`}>
        <StatusBadge tone="success">Em uso{uses.length > 1 ? ` · ${uses.length}` : ''}</StatusBadge>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{uses.map((u) => u.title).join(' · ')}</TooltipContent>
    </Tooltip>
  );
}

function MediaDetails({ item, uses, onClose, onSaved, onDeleted }: { item: MediaItem | null; uses: Usage[] | null; onClose: () => void; onSaved: (m: MediaItem) => void; onDeleted: (id: string) => void }) {
  const { confirm, dialog } = useConfirm();
  const [edit, setEdit] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const alt = edit && edit.id === item?.id ? edit.value : item?.alt || '';
  const setAlt = (value: string) => item && setEdit({ id: item.id, value });
  const inUse = (uses?.length ?? 0) > 0;

  async function save() {
    if (!item) return;
    setBusy('save');
    const { data, error } = await supabase.from('media').update({ alt: alt.trim().slice(0, 300) }).eq('id', item.id).select(mediaColumns).single();
    setBusy(null);
    if (error) notify.error(explain(error));
    else {
      onSaved(data as MediaItem);
      notify.ok('Descrição salva', 'Artigos publicados passam a usá-la na próxima publicação.');
    }
  }
  async function remove() {
    if (!item || !(await confirm('Excluir imagem?', 'A imagem será removida definitivamente da biblioteca.', 'Excluir', true))) return;
    setBusy('delete');
    const result = await adminApi('/api/admin/media', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
    setBusy(null);
    if (result.ok) {
      onDeleted(item.id);
      notify.ok('Imagem excluída');
    } else notify.error('Não foi possível excluir', result.status === 409 ? 'Esta imagem está em uso em um artigo. Troque-a no artigo antes de excluir.' : 'Tente novamente.');
  }

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {dialog}
        {item && (
          <>
            <SheetHeader className="border-b p-4 pr-12">
              <SheetTitle className="text-[15px] font-semibold">Detalhes da imagem</SheetTitle>
              <SheetDescription>
                {item.width}×{item.height} · {size(item.bytes)} · {kind(item.mime_type)}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-6 p-4">
              <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border bg-muted">
                <MediaImage path={item.path} alt={item.alt || 'Imagem sem descrição'} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="media-alt" className="text-[13px]">
                  Descrição (texto alternativo)
                </Label>
                <Textarea id="media-alt" rows={3} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} placeholder="O que a imagem mostra? Ex.: Frasco de perfume com rótulo em relevo" aria-describedby="media-alt-hint" />
                <p id="media-alt-hint" className="text-xs text-muted-foreground">
                  Lida por leitores de tela e usada pelos buscadores. Descreva o que aparece, sem “imagem de”.
                </p>
                <Button className="w-fit" disabled={busy === 'save' || alt === item.alt} onClick={() => void save()}>
                  {busy === 'save' && <Spinner data-icon="inline-start" aria-hidden="true" />}
                  {busy === 'save' ? 'Salvando…' : 'Salvar descrição'}
                </Button>
              </div>
              <div className="grid gap-2">
                <h3 className="text-[13px] font-semibold">Onde é usada</h3>
                {uses === null ? (
                  <Skeleton className="h-10 w-full" />
                ) : uses.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Nenhum artigo usa esta imagem.</p>
                ) : (
                  <ul className="grid gap-1">
                    {uses.map((u) => (
                      <li key={`${u.id}-${u.live}`}>
                        <Link href={`/admin/artigos/${u.id}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[13px] hover:bg-muted/60">
                          <span className="flex min-w-0 items-center gap-2">
                            <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="truncate">{u.title}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{u.live ? 'No site' : 'Rascunho'}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/50 p-3 text-[13px]">
                <dt className="text-muted-foreground">Enviada em</dt>
                <dd className="text-right">{fullDate(item.created_at)}</dd>
                <dt className="text-muted-foreground">Visibilidade</dt>
                <dd className="text-right">{uses?.some((u) => u.live) ? 'Pública (artigo no site)' : 'Privada'}</dd>
              </dl>
            </div>
            <SheetFooter className="mt-auto border-t p-4">
              {inUse ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Esta imagem está em uso em {uses!.length === 1 ? '1 artigo' : `${uses!.length} artigos`}. Para excluí-la, troque-a {uses!.length === 1 ? 'nesse artigo' : 'nesses artigos'} primeiro.
                </p>
              ) : null}
              <Button variant="destructive" className="w-fit" disabled={inUse || uses === null || busy === 'delete'} onClick={() => void remove()}>
                {busy === 'delete' ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Trash2Icon data-icon="inline-start" aria-hidden="true" />}
                Excluir imagem
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function Media() {
  const { items, setItems } = useMedia();
  const usage = useMediaUsage();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  useCrumbs([{ label: 'Mídia' }]);

  const term = query.trim().toLowerCase();
  const shown = (items || []).filter((m) => {
    const uses = usageOf(usage, m);
    if (term && !m.alt.toLowerCase().includes(term)) return false;
    if (filter === 'used') return !!uses?.length;
    if (filter === 'unused') return uses !== null && uses.length === 0;
    if (filter === 'no-alt') return !m.alt.trim();
    return true;
  });
  const open = items?.find((m) => m.id === openId) || null;

  return (
    <Page>
      <PageHeader
        title="Mídia"
        description="Imagens JPG, PNG ou WebP, otimizadas no envio. Ficam privadas até serem usadas em um artigo publicado."
        actions={<UploadButton onUploaded={(m) => setItems([m, ...(items || [])])} />}
      />

      {items && items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput label="Buscar por descrição" placeholder="Buscar por descrição" value={query} onChange={setQuery} />
          <FilterSelect label="Filtrar imagens" value={filter} onChange={setFilter} options={filters} />
          <span className="ml-auto text-[13px] text-muted-foreground tabular" aria-live="polite">
            {shown.length === 1 ? '1 imagem' : `${shown.length} imagens`}
          </span>
        </div>
      )}

      {!items ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" aria-busy="true" aria-label="Carregando imagens">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="overflow-hidden rounded-xl border bg-card">
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState icon={<ImagePlusIcon />} title="Sua biblioteca está vazia." description="Envie imagens para usar como capa ou dentro dos artigos. Elas são otimizadas automaticamente." action={<UploadButton variant="outline" onUploaded={(m) => setItems([m])} label="Enviar a primeira imagem" />} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<ImagePlusIcon />} title="Nenhuma imagem encontrada" description="Tente outra busca ou outro filtro." action={<Button variant="outline" onClick={() => { setQuery(''); setFilter('all'); }}>Limpar filtros</Button>} />
      ) : (
        <ul className="media-cards grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {shown.map((m) => {
            const uses = usageOf(usage, m);
            return (
              <li key={m.id} className="media-card group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-[0_6px_20px_-10px_rgba(29,21,23,0.25)]">
                <button type="button" className="block w-full text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50" onClick={() => setOpenId(m.id)} aria-label={`Abrir detalhes: ${m.alt || 'imagem sem descrição'}`}>
                  <MediaThumb item={m} />
                </button>
                <div className="grid grid-cols-1 gap-1.5 border-t p-3">
                  <p className={cn('line-clamp-1 text-[13px] font-medium', !m.alt && 'font-normal text-champagne-foreground italic')}>{m.alt || 'Sem descrição'}</p>
                  <div className="flex min-h-[22px] flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="truncate text-xs text-muted-foreground tabular">
                      {m.width}×{m.height} · {size(m.bytes)}
                    </span>
                    <span className="relative z-[1]">{uses === null ? <Skeleton className="h-5 w-14 rounded-full" /> : uses.length > 0 ? <InUse uses={uses} /> : null}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
        Os endereços das imagens no painel expiram em minutos: não servem para compartilhar.
      </p>

      <MediaDetails
        item={open}
        uses={open ? usageOf(usage, open) : null}
        onClose={() => setOpenId(null)}
        onSaved={(saved) => setItems((items || []).map((x) => (x.id === saved.id ? saved : x)))}
        onDeleted={(id) => {
          setOpenId(null);
          setItems((items || []).filter((x) => x.id !== id));
        }}
      />
    </Page>
  );
}
