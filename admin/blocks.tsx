import { useRef, useState, type ClipboardEvent } from 'react';
import type { Block, BlockType } from '@/lib/blog/types';
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
const blockHints: Partial<Record<BlockType, string>> = {
  callout: 'Uma resposta direta e curta. Ajuda leitores e buscadores a entender o essencial.',
  faq: 'Uma dúvida real de clientes, respondida de forma objetiva.',
};

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

function RichText({ value, onChange, label, rows = 4, onPasteParagraphs }: { value: string; onChange: (v: string) => void; label: string; rows?: number; onPasteParagraphs?: (parts: string[]) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');
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
  const addLink = () => {
    const target = url.trim();
    if (!/^(https?:\/\/|\/|mailto:)/.test(target)) return;
    wrap('[', `](${target})`);
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
    <div className="rich">
      <div className="rich-tools" role="toolbar" aria-label={`Formatação: ${label}`}>
        <button type="button" onClick={() => wrap('**')} title="Negrito"><b>N</b></button>
        <button type="button" onClick={() => wrap('*')} title="Itálico"><i>I</i></button>
        <button type="button" onClick={() => setLinking(!linking)} aria-expanded={linking}>Link</button>
      </div>
      {linking && (
        <div className="rich-link">
          <input type="url" placeholder="https://… ou /blog/…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Endereço do link" maxLength={500} />
          <button type="button" onClick={addLink}>Aplicar ao texto selecionado</button>
        </div>
      )}
      <textarea ref={ref} aria-label={label} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} onPaste={paste} maxLength={5000} />
    </div>
  );
}

function TableEditor({ block, set }: { block: Extract<Block, { type: 'table' }>; set: (b: Block) => void }) {
  const cols = block.header.length;
  const update = (header: string[], rows: string[][]) => set({ ...block, header, rows });
  return (
    <div className="table-editor">
      <input placeholder="Legenda da tabela (opcional)" aria-label="Legenda da tabela" value={block.caption || ''} onChange={(e) => set({ ...block, caption: e.target.value })} maxLength={200} />
      <div className="table-grid" data-cols={cols}>
        {block.header.map((h, i) => (
          <input key={`h${i}`} className="th" placeholder={`Coluna ${i + 1}`} aria-label={`Cabeçalho ${i + 1}`} value={h} onChange={(e) => update(block.header.map((x, j) => (j === i ? e.target.value : x)), block.rows)} maxLength={200} />
        ))}
        {block.rows.map((row, r) => row.map((cell, c) => (
          <input key={`${r}-${c}`} aria-label={`Linha ${r + 1}, coluna ${c + 1}`} value={cell} onChange={(e) => update(block.header, block.rows.map((x, i) => (i === r ? x.map((y, j) => (j === c ? e.target.value : y)) : x)))} maxLength={500} />
        )))}
      </div>
      <div className="inline-actions">
        <button type="button" disabled={block.rows.length >= 30} onClick={() => update(block.header, [...block.rows, Array(cols).fill('')])}>+ Linha</button>
        <button type="button" disabled={block.rows.length <= 1} onClick={() => update(block.header, block.rows.slice(0, -1))}>− Linha</button>
        <button type="button" disabled={cols >= 6} onClick={() => update([...block.header, ''], block.rows.map((r) => [...r, '']))}>+ Coluna</button>
        <button type="button" disabled={cols <= 1} onClick={() => update(block.header.slice(0, -1), block.rows.map((r) => r.slice(0, -1)))}>− Coluna</button>
      </div>
    </div>
  );
}

function BlockFields({ block, set, replaceWith }: { block: Block; set: (b: Block) => void; replaceWith: (blocks: Block[]) => void }) {
  const [picking, setPicking] = useState(false);
  switch (block.type) {
    case 'paragraph':
      return <RichText label="Parágrafo" value={block.text} onChange={(text) => set({ ...block, text })} onPasteParagraphs={(parts) => replaceWith(parts.map((text) => ({ id: newId(), type: 'paragraph', text })))} />;
    case 'heading':
      return (
        <div className="row">
          <select aria-label="Nível do título" value={block.level} onChange={(e) => set({ ...block, level: Number(e.target.value) === 3 ? 3 : 2 })}>
            <option value={2}>Seção (H2)</option>
            <option value={3}>Subseção (H3)</option>
          </select>
          <input className="grow heading-input" aria-label="Texto do título" placeholder="Ex.: O que muda com o registro?" value={block.text} onChange={(e) => set({ ...block, text: e.target.value })} maxLength={200} />
        </div>
      );
    case 'list':
      return (
        <>
          <select aria-label="Tipo de lista" value={block.style} onChange={(e) => set({ ...block, style: e.target.value === 'ordered' ? 'ordered' : 'bullet' })}>
            <option value="bullet">Com marcadores</option>
            <option value="ordered">Numerada (passo a passo)</option>
          </select>
          <textarea aria-label="Itens da lista, um por linha" rows={4} placeholder="Um item por linha" value={block.items.join('\n')} onChange={(e) => set({ ...block, items: e.target.value.split('\n').slice(0, 50) })} maxLength={20000} />
        </>
      );
    case 'quote':
      return (
        <>
          <RichText label="Citação" rows={3} value={block.text} onChange={(text) => set({ ...block, text })} />
          <input aria-label="Autor ou fonte da citação" placeholder="Autor ou fonte (opcional)" value={block.cite || ''} onChange={(e) => set({ ...block, cite: e.target.value })} maxLength={200} />
        </>
      );
    case 'callout':
      return (
        <>
          <input aria-label="Título do destaque" value={block.title || ''} onChange={(e) => set({ ...block, title: e.target.value })} maxLength={120} />
          <RichText label="Texto do destaque" rows={3} value={block.text} onChange={(text) => set({ ...block, text })} />
        </>
      );
    case 'faq':
      return (
        <>
          <input className="heading-input" aria-label="Pergunta" placeholder="Pergunta" value={block.question} onChange={(e) => set({ ...block, question: e.target.value })} maxLength={300} />
          <RichText label="Resposta" rows={3} value={block.answer} onChange={(answer) => set({ ...block, answer })} />
        </>
      );
    case 'table':
      return <TableEditor block={block} set={set} />;
    case 'image':
      return (
        <div className="image-block">
          {block.path ? <MediaImage path={block.path} width={block.width} height={block.height} /> : <p className="empty">Nenhuma imagem escolhida.</p>}
          <div className="stack">
            <button type="button" className="btn btn-secondary" onClick={() => setPicking(true)}>{block.path ? 'Trocar imagem' : 'Escolher imagem'}</button>
            <input aria-label="Descrição da imagem (texto alternativo)" placeholder="Descreva a imagem para quem não pode vê-la" value={block.alt} onChange={(e) => set({ ...block, alt: e.target.value })} maxLength={300} />
            <input aria-label="Legenda" placeholder="Legenda (opcional)" value={block.caption || ''} onChange={(e) => set({ ...block, caption: e.target.value })} maxLength={300} />
          </div>
          {picking && <MediaPicker onClose={() => setPicking(false)} onSelect={(m: MediaItem) => { set({ ...block, mediaId: m.id, path: m.path, width: m.width, height: m.height, alt: block.alt || m.alt }); setPicking(false); }} />}
        </div>
      );
  }
}

function AddBlock({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="add-block">
      <button type="button" className="add-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>+ Adicionar bloco</button>
      {open && (
        <div className="add-menu">
          {(Object.keys(blockLabels) as BlockType[]).map((type) => (
            <button key={type} type="button" onClick={() => { onAdd(type); setOpen(false); }}>{blockLabels[type]}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlockEditor({ blocks, onChange }: { blocks: Block[]; onChange: (blocks: Block[]) => void }) {
  const keyed = blocks.map((b) => (b.id ? b : { ...b, id: newId() }));
  const setAt = (i: number, b: Block) => onChange(keyed.map((x, j) => (j === i ? b : x)));
  const insertAt = (i: number, items: Block[]) => onChange([...keyed.slice(0, i), ...items, ...keyed.slice(i)]);
  const move = (i: number, d: -1 | 1) => {
    const next = [...keyed];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="blocks">
      {keyed.length === 0 && <p className="empty">Comece adicionando um parágrafo ou um título de seção.</p>}
      {keyed.map((block, i) => (
        <section key={block.id} className={`block block-${block.type}`} aria-label={`${blockLabels[block.type]} ${i + 1}`}>
          <header className="block-head">
            <span>{blockLabels[block.type]}</span>
            <div className="block-tools">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover para cima">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === keyed.length - 1} aria-label="Mover para baixo">↓</button>
              <button type="button" onClick={() => onChange(keyed.filter((_, j) => j !== i))} aria-label="Remover bloco">Remover</button>
            </div>
          </header>
          {blockHints[block.type] && <p className="field-hint">{blockHints[block.type]}</p>}
          <BlockFields block={block} set={(b) => setAt(i, b)} replaceWith={(items) => onChange([...keyed.slice(0, i), ...items, ...keyed.slice(i + 1)])} />
          <AddBlock onAdd={(type) => insertAt(i + 1, [emptyBlock(type)])} />
        </section>
      ))}
      {keyed.length === 0 && <AddBlock onAdd={(type) => insertAt(0, [emptyBlock(type)])} />}
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
