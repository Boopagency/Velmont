import { useEffect, useRef, useState, type ClipboardEvent, type ComponentType, type ReactNode } from 'react';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BadgeInfoIcon,
  BoldIcon,
  CircleHelpIcon,
  Heading2Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
  Table2Icon,
  Trash2Icon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Block, BlockType } from '@/lib/blog/types';
import { cn } from '@/lib/utils';
import { MediaPicker } from './media';
import { MediaImage } from './signed';
import type { MediaItem } from './types';

// Structured editor: each block maps 1:1 to the validated JSON content.
// Nobody types HTML; formatting is limited to **bold**, *italic* and links.

const blockLabels: Record<BlockType, string> = {
  paragraph: 'Parágrafo',
  heading: 'Título de seção',
  list: 'Lista',
  callout: 'Resumo em destaque',
  faq: 'Pergunta e resposta',
  quote: 'Citação',
  table: 'Tabela',
  image: 'Imagem',
};
const blockHints: Record<BlockType, string> = {
  paragraph: 'Texto corrido. Colar vários parágrafos cria um bloco para cada.',
  heading: 'Organiza o texto em seções (H2) e subseções (H3).',
  list: 'Itens com marcadores ou passo a passo numerado.',
  callout: 'Uma resposta direta e curta. Ajuda leitores e buscadores a entender o essencial.',
  faq: 'Uma dúvida real de clientes, respondida de forma objetiva.',
  quote: 'Um trecho citado, com autor ou fonte.',
  table: 'Comparações e dados em linhas e colunas.',
  image: 'Uma imagem da biblioteca, com descrição e legenda.',
};
const blockIcons: Record<BlockType, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  paragraph: PilcrowIcon,
  heading: Heading2Icon,
  list: ListIcon,
  callout: BadgeInfoIcon,
  faq: CircleHelpIcon,
  quote: QuoteIcon,
  table: Table2Icon,
  image: ImageIcon,
};
const blockOrder: BlockType[] = ['paragraph', 'heading', 'list', 'callout', 'faq', 'quote', 'table', 'image'];

let counter = 0;
const newId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

export function emptyBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'heading': return { id, type, level: 2, text: '' };
    case 'list': return { id, type, style: 'bullet', items: [''] };
    case 'quote': return { id, type, text: '', cite: '' };
    case 'callout': return { id, type, title: 'Em resumo', text: '' };
    case 'faq': return { id, type, question: '', answer: '' };
    case 'table': return { id, type, caption: '', header: ['', ''], rows: [['', '']] };
    case 'image': return { id, type, mediaId: '', path: '', alt: '', width: 1, height: 1, caption: '' };
    default: return { id, type: 'paragraph', text: '' };
  }
}

/** True when removing the block would throw away something the person wrote. */
function hasContent(b: Block) {
  switch (b.type) {
    case 'paragraph': case 'heading': case 'quote': return !!b.text.trim();
    case 'callout': return !!b.text.trim();
    case 'list': return b.items.some((i) => i.trim());
    case 'faq': return !!(b.question.trim() || b.answer.trim());
    case 'table': return b.header.some((h) => h.trim()) || b.rows.some((r) => r.some((c) => c.trim()));
    case 'image': return !!b.path;
  }
}

/** Textarea that grows with its content, drawn as part of the page. */
function useGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

const bare = 'block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground/60';

function Tool({ name, pressed, onClick, children }: { name: string; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label={name} aria-pressed={pressed} className="text-muted-foreground hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground" onClick={onClick} />}>{children}</TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Plain text with **bold**, *italic* and [links](url). With `floating`, the
 * formatting tools sit in the block header row instead of above the text.
 */
function RichText({ value, onChange, label, placeholder, className, onPasteParagraphs, floating }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string; onPasteParagraphs?: (parts: string[]) => void; floating?: boolean }) {
  const ref = useGrow(value);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');
  const linkInput = useRef<HTMLInputElement>(null);
  // Opening the link field moves the cursor there (instead of autoFocus).
  useEffect(() => {
    if (linking) linkInput.current?.focus();
  }, [linking]);
  const wrap = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || 'texto';
    onChange(value.slice(0, s) + before + selected + after + value.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };
  const validUrl = /^(https?:\/\/|\/|mailto:)/.test(url.trim());
  const addLink = () => {
    if (!validUrl) return;
    wrap('[', `](${url.trim()})`);
    setLinking(false);
    setUrl('');
  };
  const paste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (onPasteParagraphs && parts.length > 1 && !value.trim()) {
      e.preventDefault();
      onPasteParagraphs(parts);
    }
  };
  return (
    <div className={cn('rich grid gap-1', floating && 'relative')}>
      <div className={cn('rich-tools flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/block:opacity-100 group-hover/block:opacity-100 [@media(hover:none)]:opacity-100', floating && 'absolute -top-7 right-[84px] h-6')} role="toolbar" aria-label={`Formatação: ${label}`}>
        <Tool name="Negrito" onClick={() => wrap('**')}>
          <BoldIcon aria-hidden="true" />
        </Tool>
        <Tool name="Itálico" onClick={() => wrap('*')}>
          <ItalicIcon aria-hidden="true" />
        </Tool>
        <Tool name="Link" pressed={linking} onClick={() => setLinking(!linking)}>
          <LinkIcon aria-hidden="true" />
        </Tool>
      </div>
      {linking && (
        <div className="rich-link flex flex-wrap items-center gap-2 rounded-md bg-muted/60 p-1.5">
          <Input type="url" placeholder="https://… ou /blog/…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())} aria-label="Endereço do link" maxLength={500} className="h-7 flex-1 bg-background text-[13px] md:text-[13px]" ref={linkInput} />
          <Button size="sm" onClick={addLink} disabled={!validUrl}>
            Aplicar ao texto selecionado
          </Button>
        </div>
      )}
      <textarea ref={ref} aria-label={label} rows={2} value={value} onChange={(e) => onChange(e.target.value)} onPaste={paste} maxLength={5000} placeholder={placeholder} className={cn(bare, 'text-[15px] leading-7', className)} />
    </div>
  );
}

/** Heading text wraps like the published title; Enter never adds a line break. */
function HeadingText({ block, set }: { block: Extract<Block, { type: 'heading' }>; set: (b: Block) => void }) {
  const ref = useGrow(block.text);
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label="Texto do título"
      placeholder="Ex.: O que muda com o registro?"
      value={block.text}
      onChange={(e) => set({ ...block, text: e.target.value.replace(/\n/g, ' ') })}
      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
      maxLength={200}
      className={cn(bare, 'heading-input font-semibold tracking-[-0.015em]', block.level === 2 ? 'text-xl leading-snug' : 'text-[17px] leading-snug')}
    />
  );
}

/** H2/H3 choice, shown in the block header next to the block type. */
function HeadingLevel({ block, set }: { block: Extract<Block, { type: 'heading' }>; set: (b: Block) => void }) {
  return (
    <NativeSelect aria-label="Nível do título" size="sm" value={block.level} onChange={(e) => set({ ...block, level: Number(e.target.value) === 3 ? 3 : 2 })} className="[&_select]:h-6 [&_select]:py-0 [&_select]:pr-7 [&_select]:pl-2 [&_select]:text-xs [&_svg]:right-2 [&_svg]:size-3.5">
      <NativeSelectOption value={2}>Seção (H2)</NativeSelectOption>
      <NativeSelectOption value={3}>Subseção (H3)</NativeSelectOption>
    </NativeSelect>
  );
}

function ListItems({ block, set }: { block: Extract<Block, { type: 'list' }>; set: (b: Block) => void }) {
  const text = block.items.join('\n');
  const ref = useGrow(text);
  return (
    <div className="grid gap-2">
      <NativeSelect aria-label="Tipo de lista" size="sm" value={block.style} onChange={(e) => set({ ...block, style: e.target.value === 'ordered' ? 'ordered' : 'bullet' })} className="w-fit">
        <NativeSelectOption value="bullet">Com marcadores</NativeSelectOption>
        <NativeSelectOption value="ordered">Numerada (passo a passo)</NativeSelectOption>
      </NativeSelect>
      <textarea ref={ref} aria-label="Itens da lista, um por linha" rows={3} placeholder="Um item por linha" value={text} onChange={(e) => set({ ...block, items: e.target.value.split('\n').slice(0, 50) })} maxLength={20000} className={cn(bare, 'border-l-2 border-border pl-3 text-[15px] leading-7')} />
    </div>
  );
}

function TableEditor({ block, set }: { block: Extract<Block, { type: 'table' }>; set: (b: Block) => void }) {
  const cols = block.header.length;
  const update = (header: string[], rows: string[][]) => set({ ...block, header, rows });
  const cell = 'h-8 rounded-none border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0 focus-visible:bg-accent/60 md:text-[13px]';
  return (
    <div className="table-editor grid gap-2">
      <Input placeholder="Legenda da tabela (opcional)" aria-label="Legenda da tabela" value={block.caption || ''} onChange={(e) => set({ ...block, caption: e.target.value })} maxLength={200} className="h-8 text-[13px] md:text-[13px]" />
      <div className="overflow-x-auto rounded-lg border">
        <div className="table-grid grid min-w-[420px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {block.header.map((h, i) => (
            <Input key={`h${i}`} className={cn(cell, 'th border-b bg-muted/50 font-semibold', i > 0 && 'border-l')} placeholder={`Coluna ${i + 1}`} aria-label={`Cabeçalho ${i + 1}`} value={h} onChange={(e) => update(block.header.map((x, j) => (j === i ? e.target.value : x)), block.rows)} maxLength={200} />
          ))}
          {block.rows.map((row, r) =>
            row.map((value, c) => (
              <Input key={`${r}-${c}`} className={cn(cell, c > 0 && 'border-l', r < block.rows.length - 1 && 'border-b')} aria-label={`Linha ${r + 1}, coluna ${c + 1}`} value={value} onChange={(e) => update(block.header, block.rows.map((x, i) => (i === r ? x.map((y, j) => (j === c ? e.target.value : y)) : x)))} maxLength={500} />
            )),
          )}
        </div>
      </div>
      <div className="inline-actions flex flex-wrap gap-1">
        <Button variant="ghost" size="xs" disabled={block.rows.length >= 30} onClick={() => update(block.header, [...block.rows, Array(cols).fill('')])}>+ Linha</Button>
        <Button variant="ghost" size="xs" disabled={block.rows.length <= 1} onClick={() => update(block.header, block.rows.slice(0, -1))}>− Linha</Button>
        <Button variant="ghost" size="xs" disabled={cols >= 6} onClick={() => update([...block.header, ''], block.rows.map((r) => [...r, '']))}>+ Coluna</Button>
        <Button variant="ghost" size="xs" disabled={cols <= 1} onClick={() => update(block.header.slice(0, -1), block.rows.map((r) => r.slice(0, -1)))}>− Coluna</Button>
      </div>
    </div>
  );
}

function BlockFields({ block, set, replaceWith }: { block: Block; set: (b: Block) => void; replaceWith: (blocks: Block[]) => void }) {
  const [picking, setPicking] = useState(false);
  switch (block.type) {
    case 'paragraph':
      return <RichText floating label="Parágrafo" placeholder="Escreva ou cole o texto…" value={block.text} onChange={(text) => set({ ...block, text })} onPasteParagraphs={(parts) => replaceWith(parts.map((text) => ({ id: newId(), type: 'paragraph', text })))} />;
    case 'heading':
      return <HeadingText block={block} set={set} />;
    case 'list':
      return <ListItems block={block} set={set} />;
    case 'quote':
      return (
        <div className="grid gap-2 border-l-2 border-champagne pl-4">
          <RichText floating label="Citação" placeholder="O trecho citado" className="italic" value={block.text} onChange={(text) => set({ ...block, text })} />
          <input aria-label="Autor ou fonte da citação" placeholder="— Autor ou fonte (opcional)" value={block.cite || ''} onChange={(e) => set({ ...block, cite: e.target.value })} maxLength={200} className="bg-transparent text-[13px] text-muted-foreground outline-none placeholder:text-muted-foreground/60" />
        </div>
      );
    case 'callout':
      return (
        <div className="grid gap-1 rounded-lg bg-champagne-soft px-4 py-3">
          <input aria-label="Título do destaque" value={block.title || ''} onChange={(e) => set({ ...block, title: e.target.value })} maxLength={120} className="bg-transparent text-[13px] font-semibold tracking-wide text-champagne-foreground uppercase outline-none" />
          <RichText label="Texto do destaque" placeholder="A resposta direta, em poucas linhas." value={block.text} onChange={(text) => set({ ...block, text })} />
        </div>
      );
    case 'faq':
      return (
        <div className="grid gap-1">
          <input className="heading-input bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/60" aria-label="Pergunta" placeholder="Pergunta" value={block.question} onChange={(e) => set({ ...block, question: e.target.value })} maxLength={300} />
          <RichText label="Resposta" placeholder="Resposta objetiva" value={block.answer} onChange={(answer) => set({ ...block, answer })} />
        </div>
      );
    case 'table':
      return <TableEditor block={block} set={set} />;
    case 'image':
      return (
        <div className="image-block grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
            {block.path ? (
              <MediaImage path={block.path} alt={block.alt ? `Imagem do bloco: ${block.alt}` : 'Imagem do bloco, sem descrição'} className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-xs text-muted-foreground">Nenhuma imagem escolhida</div>
            )}
          </div>
          <div className="grid content-start gap-2">
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setPicking(true)}>
              {block.path ? 'Trocar imagem' : 'Selecionar imagem'}
            </Button>
            <Input aria-label="Descrição da imagem (texto alternativo)" placeholder="Descreva a imagem para quem não pode vê-la" value={block.alt} onChange={(e) => set({ ...block, alt: e.target.value })} maxLength={300} className="h-8 text-[13px] md:text-[13px]" />
            <Input aria-label="Legenda" placeholder="Legenda (opcional)" value={block.caption || ''} onChange={(e) => set({ ...block, caption: e.target.value })} maxLength={300} className="h-8 text-[13px] md:text-[13px]" />
          </div>
          {picking && <MediaPicker onClose={() => setPicking(false)} onSelect={(m: MediaItem) => { set({ ...block, mediaId: m.id, path: m.path, width: m.width, height: m.height, alt: block.alt || m.alt }); setPicking(false); }} />}
        </div>
      );
  }
}

function AddBlock({ onAdd, variant }: { onAdd: (type: BlockType) => void; variant: 'between' | 'end' }) {
  const trigger =
    variant === 'end' ? (
      <Button variant="outline" className="w-full justify-start border-dashed text-muted-foreground hover:text-foreground" />
    ) : (
      <Button variant="ghost" size="xs" className="add-toggle h-6 gap-1 rounded-full bg-background px-2 text-xs text-muted-foreground shadow-xs ring-1 ring-border hover:text-brand" />
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>
        <PlusIcon aria-hidden="true" />
        {variant === 'end' ? 'Adicionar bloco' : <span>Adicionar bloco</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tipo de bloco</DropdownMenuLabel>
          {blockOrder.map((type) => {
            const Icon = blockIcons[type];
            return (
              <DropdownMenuItem key={type} onClick={() => onAdd(type)} className="items-start gap-2.5 py-2">
                <Icon className="mt-0.5 text-muted-foreground" aria-hidden />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">{blockLabels[type]}</span>
                  <span className="text-xs leading-snug text-muted-foreground">{blockHints[type]}</span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BlockEditor({ blocks, onChange, confirm }: { blocks: Block[]; onChange: (blocks: Block[]) => void; confirm: (title: string, text: string, action?: string, danger?: boolean) => Promise<boolean> }) {
  const keyed = blocks.map((b) => (b.id ? b : { ...b, id: newId() }));
  const setAt = (i: number, b: Block) => onChange(keyed.map((x, j) => (j === i ? b : x)));
  const insertAt = (i: number, items: Block[]) => onChange([...keyed.slice(0, i), ...items, ...keyed.slice(i)]);
  const move = (i: number, d: -1 | 1) => {
    const next = [...keyed];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const remove = async (i: number) => {
    const block = keyed[i];
    if (hasContent(block) && !(await confirm('Remover este bloco?', `O ${blockLabels[block.type].toLowerCase()} e o que foi escrito nele saem do artigo. Se o artigo já estiver salvo, o texto ainda pode ser recuperado no histórico de versões.`, 'Remover bloco', true))) return;
    onChange(keyed.filter((x) => x.id !== block.id));
  };
  const action = (label: string, icon: ReactNode, onClick: () => void, disabled = false, danger = false) => (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label={label} disabled={disabled} onClick={onClick} className={cn('text-muted-foreground hover:text-foreground', danger && 'hover:bg-destructive/10 hover:text-destructive')} />}>{icon}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
  return (
    <div className="blocks grid">
      {keyed.length === 0 && <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Comece adicionando um parágrafo ou um título de seção.</p>}
      {keyed.map((block, i) => {
        const Icon = blockIcons[block.type];
        return (
          <section key={block.id} className={`block block-${block.type} group/block relative -mx-3 rounded-lg px-3 pt-2 pb-5 transition-colors hover:bg-muted/35 focus-within:bg-muted/45`} aria-label={`${blockLabels[block.type]} ${i + 1}`}>
            <header className="block-head mb-1 flex min-h-6 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.04em] text-muted-foreground uppercase">
                  <Icon className="size-3.5" aria-hidden />
                  {blockLabels[block.type]}
                </span>
                {block.type === 'heading' && <HeadingLevel block={block} set={(b) => setAt(i, b)} />}
              </div>
              <div className="block-tools flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within/block:opacity-100 group-hover/block:opacity-100 [@media(hover:none)]:opacity-100">
                {action('Mover para cima', <ArrowUpIcon aria-hidden="true" />, () => move(i, -1), i === 0)}
                {action('Mover para baixo', <ArrowDownIcon aria-hidden="true" />, () => move(i, 1), i === keyed.length - 1)}
                {action('Remover bloco', <Trash2Icon aria-hidden="true" />, () => void remove(i), false, true)}
              </div>
            </header>
            <BlockFields block={block} set={(b) => setAt(i, b)} replaceWith={(items) => onChange([...keyed.slice(0, i), ...items, ...keyed.slice(i + 1)])} />
            {/* Insert after this block: appears between blocks on hover or focus. */}
            <div className="absolute inset-x-0 -bottom-3 z-[1] flex justify-center opacity-0 transition-opacity group-focus-within/block:opacity-100 group-hover/block:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
              <AddBlock variant="between" onAdd={(type) => insertAt(i + 1, [emptyBlock(type)])} />
            </div>
          </section>
        );
      })}
      <div className="mt-5">
        <AddBlock variant="end" onAdd={(type) => insertAt(keyed.length, [emptyBlock(type)])} />
      </div>
    </div>
  );
}

/** Drops empty blocks and trims list items before saving. */
export function cleanBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((b): Block[] => {
    switch (b.type) {
      case 'paragraph': case 'heading': return b.text.trim() ? [{ ...b, text: b.text.trim() }] : [];
      case 'list': { const items = b.items.map((x) => x.trim()).filter(Boolean); return items.length ? [{ ...b, items }] : []; }
      case 'quote': return b.text.trim() ? [{ ...b, text: b.text.trim(), cite: b.cite?.trim() || null }] : [];
      case 'callout': return b.text.trim() ? [{ ...b, text: b.text.trim(), title: b.title?.trim() || null }] : [];
      case 'faq': return b.question.trim() && b.answer.trim() ? [{ ...b, question: b.question.trim(), answer: b.answer.trim() }] : [];
      case 'table': return b.header.some((h) => h.trim()) || b.rows.some((r) => r.some((c) => c.trim())) ? [{ ...b, caption: b.caption?.trim() || null }] : [];
      case 'image': return b.path ? [{ ...b, alt: b.alt.trim(), caption: b.caption?.trim() || null }] : [];
    }
  });
}
