import React from 'react';
import { useCurrentFrame } from 'remotion';
import { onTwos } from '../lib/motion';
import { rng } from '../lib/rng';
import { C, SANS, SERIF } from '../theme';

type TProps = {
  size?: number;
  weight?: 500 | 700 | 800;
  color?: string;
  upper?: boolean;
  lh?: number;
  ls?: string;
  align?: 'left' | 'center' | 'right';
  w?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/** Texto em Manrope. Títulos em caixa alta e peso 800. */
export const T: React.FC<TProps> = ({ size = 64, weight = 800, color, upper, lh = 1.04, ls = '-0.02em', align = 'left', w, style, children }) => (
  <div style={{ fontFamily: SANS, fontWeight: weight, fontSize: size, lineHeight: lh, letterSpacing: ls, color, textTransform: upper ? 'uppercase' : undefined, textAlign: align, width: w, ...style }}>{children}</div>
);

/** Palavra de ênfase em Instrument Serif itálico. */
export const Em: React.FC<{ children: React.ReactNode; color?: string; scale?: number }> = ({ children, color, scale = 1.12 }) => (
  <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, textTransform: 'none', letterSpacing: '-0.01em', fontSize: `${scale}em`, color }}>{children}</span>
);

/** Caixa de destaque: vinho com texto claro, ou clara com texto escuro. */
export const Hl: React.FC<{ children: React.ReactNode; bg?: string; color?: string; rot?: number }> = ({ children, bg = C.wine, color = C.cream, rot = -1 }) => (
  <span style={{ display: 'inline-block', background: bg, color, padding: '0.06em 0.26em 0.1em', transform: `rotate(${rot}deg)`, boxShadow: '0 4px 5px rgba(10,2,6,0.25)' }}>{children}</span>
);

/** Sublinhado à mão que se desenha a partir do quadro `at`. */
export const Mark: React.FC<{ children: React.ReactNode; at?: number; dur?: number; color?: string; seed?: number; thick?: number }> = ({ children, at = 0, dur = 8, color = 'currentColor', seed = 1, thick = 0.09 }) => {
  const frame = useCurrentFrame();
  const p = Math.max(0, Math.min(1, (onTwos(frame) - at) / dur));
  const r = rng(seed * 9 + (Math.floor(frame / 3) % 3));
  const y = [r(), r(), r(), r()].map((v) => 5 + v * 5);
  return (
    <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
      {children}
      <svg viewBox="0 0 100 14" preserveAspectRatio="none" style={{ position: 'absolute', left: '-2%', bottom: '-0.2em', width: '104%', height: '0.34em', overflow: 'visible' }}>
        <path d={`M1 ${y[0]} C 25 ${y[1] - 3}, 45 ${y[2] + 3}, 99 ${y[3]}`} fill="none" stroke={color} strokeWidth={thick * 44} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      </svg>
    </span>
  );
};

/** Revela blocos um a um, em corte seco com um pequeno assentamento. */
export const Reveal: React.FC<{ at: number; children: React.ReactNode; rise?: number; style?: React.CSSProperties }> = ({ at, children, rise = 26, style }) => {
  const frame = useCurrentFrame();
  if (frame < at) return <div style={{ visibility: 'hidden', ...style }}>{children}</div>;
  const t = Math.min(1, onTwos(frame - at) / 6);
  const k = 1 - (1 - t) * (1 - t);
  return <div style={{ transform: `translateY(${((1 - k) * rise).toFixed(1)}px)`, opacity: Math.min(1, (frame - at + 1) / 2), ...style }}>{children}</div>;
};

/** Texto que aparece letra a letra, como digitação. */
export const Typed: React.FC<{ text: string; at?: number; cps?: number; caret?: boolean }> = ({ text, at = 0, cps = 14, caret = true }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor(((onTwos(frame) - at) / 30) * cps)));
  const blink = Math.floor(frame / 8) % 2 === 0;
  return (
    <span>
      {text.slice(0, n)}
      {caret && <span style={{ opacity: n < text.length || blink ? 1 : 0 }}>|</span>}
    </span>
  );
};
