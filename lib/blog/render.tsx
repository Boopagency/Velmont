import type { ReactNode } from 'react';
import type { Block } from './types';
import { Inline, mediaUrl } from './inline';

// Renders validated blocks as semantic HTML. Unknown or malformed blocks are
// skipped, so even content that bypassed validation cannot inject markup.

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const optional = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.slice(0, max) : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 10000 ? Math.round(v) : null);

function renderBlock(block: Block, key: number, mediaBase: string): ReactNode {
  switch (block?.type) {
    case 'paragraph': {
      const text = str(block.text, 5000);
      return text.trim() ? <p key={key}><Inline text={text} /></p> : null;
    }
    case 'heading': {
      const text = str(block.text, 200);
      if (!text.trim()) return null;
      return block.level === 2 ? <h2 key={key}><Inline text={text} /></h2> : <h3 key={key}><Inline text={text} /></h3>;
    }
    case 'list': {
      const items = Array.isArray(block.items) ? block.items.map((i) => str(i, 1000)).filter((i) => i.trim()).slice(0, 50) : [];
      if (!items.length) return null;
      const children = items.map((item, i) => <li key={i}><Inline text={item} /></li>);
      return block.style === 'ordered' ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>;
    }
    case 'quote': {
      const text = str(block.text, 2000);
      const cite = optional(block.cite, 200);
      return text.trim() ? <blockquote key={key} className="article-quote"><p><Inline text={text} /></p>{cite && <cite>{cite}</cite>}</blockquote> : null;
    }
    case 'callout': {
      const text = str(block.text, 2000);
      const title = optional(block.title, 120);
      return text.trim() ? <aside key={key} className="article-callout">{title && <p className="article-callout-title">{title}</p>}<p><Inline text={text} /></p></aside> : null;
    }
    case 'faq': {
      const question = str(block.question, 300);
      const answer = str(block.answer, 3000);
      return question.trim() && answer.trim() ? <div key={key} className="article-faq"><h3>{question}</h3><p><Inline text={answer} /></p></div> : null;
    }
    case 'table': {
      const header = Array.isArray(block.header) ? block.header.map((h) => str(h, 200)).slice(0, 6) : [];
      const rows = Array.isArray(block.rows) ? block.rows.filter(Array.isArray).slice(0, 30).map((r) => header.map((_, i) => str(r[i], 500))) : [];
      if (!header.length || !rows.length) return null;
      const caption = optional(block.caption, 200);
      return <div key={key} className="article-table"><table>{caption && <caption>{caption}</caption>}<thead><tr>{header.map((h, i) => <th scope="col" key={i}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>)}</tbody></table></div>;
    }
    case 'image': {
      const src = mediaUrl(mediaBase, str(block.path, 60));
      const width = num(block.width);
      const height = num(block.height);
      if (!src || !width || !height) return null;
      const caption = optional(block.caption, 300);
      return <figure key={key} className="article-figure"><img src={src} width={width} height={height} alt={str(block.alt, 300)} loading="lazy" decoding="async" />{caption && <figcaption>{caption}</figcaption>}</figure>;
    }
    default:
      return null;
  }
}

/** Groups blocks under each H2 in a <section>, matching the existing article markup. */
export function ArticleBlocks({ blocks, mediaBase }: { blocks: Block[]; mediaBase: string }) {
  const groups: { heading: Block | null; body: Block[] }[] = [];
  for (const block of Array.isArray(blocks) ? blocks.slice(0, 400) : []) {
    if (block?.type === 'heading' && block.level === 2) groups.push({ heading: block, body: [] });
    else if (groups.length) groups[groups.length - 1].body.push(block);
    else groups.push({ heading: null, body: [block] });
  }
  return <>{groups.map((group, i) => {
    const body = group.body.map((b, j) => renderBlock(b, j, mediaBase)).filter(Boolean);
    const heading = group.heading && renderBlock(group.heading, -1, mediaBase);
    if (heading) return <section key={i}>{heading}{body}</section>;
    return body.length ? <div key={i} className="article-lead">{body}</div> : null;
  })}</>;
}
