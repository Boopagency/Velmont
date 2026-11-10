import { rng } from './rng';

export type Edges = { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };

export const edges = (s: string | Edges | undefined): Edges => {
  if (!s) return {};
  if (typeof s !== 'string') return s;
  if (s === 'all') return { top: true, right: true, bottom: true, left: true };
  return { top: s.includes('t'), right: s.includes('r'), bottom: s.includes('b'), left: s.includes('l') };
};

/**
 * Contorno de um pedaço de papel: lados rasgados (irregulares, com mordidas)
 * ou cortados a tesoura (quase retos). Devolve os pontos de um clip-path.
 */
export const tornPoints = (w: number, h: number, seed: number, e: Edges, rough = 7, grow = 0): [number, number][] => {
  const r = rng(seed);
  const pts: [number, number][] = [];
  const side = (len: number, torn: boolean | undefined) => {
    const out: number[] = [];
    const step = torn ? 11 + r() * 5 : 90;
    const n = Math.max(2, Math.round(len / step));
    let walk = 0;
    for (let i = 0; i <= n; i++) {
      if (torn) {
        walk = walk * 0.55 + (r() - 0.5) * rough * 1.6;
        const bite = r() < 0.07 ? (r() - 0.3) * rough * 1.8 : 0;
        out.push(walk + bite);
      } else {
        out.push((r() - 0.5) * 1.6);
      }
    }
    return out;
  };
  const m = rough + 2; // margem para o rasgo não sair da caixa
  const top = side(w, e.top);
  const right = side(h, e.right);
  const bottom = side(w, e.bottom);
  const left = side(h, e.left);
  // `grow` só empurra os lados rasgados (é a fibra clara que aparece no rasgo)
  const x0 = e.left ? m - grow : 1;
  const x1 = w - (e.right ? m - grow : 1);
  const y0 = e.top ? m - grow : 1;
  const y1 = h - (e.bottom ? m - grow : 1);
  top.forEach((d, i) => pts.push([x0 + ((x1 - x0) * i) / (top.length - 1), y0 + d]));
  right.forEach((d, i) => i > 0 && pts.push([x1 + d, y0 + ((y1 - y0) * i) / (right.length - 1)]));
  bottom.forEach((d, i) => i > 0 && pts.push([x1 - ((x1 - x0) * i) / (bottom.length - 1), y1 + d]));
  left.forEach((d, i) => i > 0 && i < left.length - 1 && pts.push([x0 + d, y1 - ((y1 - y0) * i) / (left.length - 1)]));
  return pts;
};

export const polygon = (pts: [number, number][]) => `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
