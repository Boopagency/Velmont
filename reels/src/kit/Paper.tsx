import React, { useMemo } from 'react';
import { staticFile, useCurrentFrame } from 'remotion';
import { rng } from '../lib/rng';
import { edges, polygon, tornPoints, type Edges } from '../lib/torn';
import { C, inkOn, type PaperColor } from '../theme';

const TEX_W = 1320;
const TEX_H = 2340;

export const texture = (color: PaperColor, w: number, h: number, seed: number): React.CSSProperties => {
  const r = rng(seed + 77);
  return {
    backgroundColor: C[color],
    backgroundImage: `url(${staticFile(`tex/${color}.jpg`)})`,
    backgroundSize: `${TEX_W}px ${TEX_H}px`,
    backgroundPosition: `-${Math.floor(r() * Math.max(1, TEX_W - w))}px -${Math.floor(r() * Math.max(1, TEX_H - h))}px`,
  };
};

/** Sombra por filtro: cara no render. Só para os poucos objetos em SVG. */
export const SHADOW = 'drop-shadow(0px 7px 6px rgba(10, 2, 6, 0.34))';

/**
 * Sombra de papel sobre papel sem filtro: duas cópias escuras do contorno,
 * deslocadas (uma curta e firme, outra mais longa e leve). Render rápido.
 */
const Shade: React.FC<{ clip?: string; soft?: boolean }> = ({ clip, soft }) => (
  <>
    <div style={{ position: 'absolute', inset: 0, transform: `translate(0px, ${soft ? 6 : 11}px) scale(1.012)`, backgroundColor: 'rgba(10, 2, 6, 0.13)', clipPath: clip }} />
    <div style={{ position: 'absolute', inset: 0, transform: `translate(0px, ${soft ? 3 : 5}px)`, backgroundColor: 'rgba(10, 2, 6, 0.24)', clipPath: clip }} />
  </>
);

/**
 * Pedaço de papel com textura. `torn` diz quais lados são rasgados
 * ("t", "r", "b", "l", combinados, ou "all"); os outros são cortados a tesoura.
 * No rasgo aparece a fibra clara do papel, e a borda troca entre 3 desenhos (boil).
 */
export const Paper: React.FC<{
  w: number;
  h: number;
  color?: PaperColor;
  torn?: string | Edges;
  seed?: number;
  rough?: number;
  shadow?: boolean | 'soft';
  pad?: number | string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ w, h, color = 'cream', torn, seed = 1, rough = 7, shadow = true, pad = 0, style, children }) => {
  const frame = useCurrentFrame();
  const e = edges(torn);
  const anyTorn = Boolean(e.top || e.right || e.bottom || e.left);
  const shapes = useMemo(
    () =>
      [0, 1, 2].map((k) => ({
        paper: polygon(tornPoints(w, h, seed * 13 + k * 3 + 1, e, rough, 0)),
        fiber: polygon(tornPoints(w, h, seed * 17 + k * 5 + 9, e, rough * 1.2, 4.5)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, h, seed, rough, e.top, e.right, e.bottom, e.left],
  );
  const k = anyTorn ? Math.floor(frame / 3) % 3 : 0;
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      {shadow && <Shade clip={anyTorn ? shapes[k].fiber : shapes[k].paper} soft={shadow === 'soft'} />}
      {anyTorn && <div style={{ position: 'absolute', inset: 0, backgroundColor: color === 'white' || color === 'cream' ? '#e2d8c6' : '#fdfaf4', clipPath: shapes[k].fiber }} />}
      <div style={{ position: 'absolute', inset: 0, clipPath: shapes[k].paper, ...texture(color, w, h, seed), color: inkOn(color), padding: pad, boxSizing: 'border-box', ...style }}>{children}</div>
    </div>
  );
};

/** Fita adesiva: tira semitransparente, pontas em zigue-zague. */
export const Tape: React.FC<{ w?: number; h?: number; color?: PaperColor; seed?: number; opacity?: number }> = ({ w = 190, h = 52, color = 'kraft', seed = 1, opacity = 0.86 }) => {
  const clip = useMemo(() => {
    const r = rng(seed + 400);
    const teeth = 6;
    const pts: [number, number][] = [];
    for (let i = 0; i <= teeth; i++) pts.push([i % 2 ? 7 + r() * 3 : r() * 2, (h * i) / teeth]);
    for (let i = teeth; i >= 0; i--) pts.push([w - (i % 2 ? 7 + r() * 3 : r() * 2), (h * i) / teeth]);
    return polygon(pts);
  }, [w, h, seed]);
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      <div style={{ position: 'absolute', inset: 0, transform: 'translate(0px, 3px)', backgroundColor: 'rgba(10, 2, 6, 0.2)', clipPath: clip }} />
      <div style={{ position: 'relative', width: w, height: h, clipPath: clip, opacity, ...texture(color, w, h, seed), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 40%, rgba(0,0,0,0.06))' }} />
      </div>
    </div>
  );
};
