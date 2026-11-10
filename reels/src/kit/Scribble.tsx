import React from 'react';
import { useCurrentFrame } from 'remotion';
import { onTwos } from '../lib/motion';
import { rng } from '../lib/rng';
import { C } from '../theme';

type Kind = 'arrow' | 'circle' | 'underline' | 'cross' | 'check' | 'strike' | 'burst' | 'zig' | 'loop';

const j = (r: () => number, a: number) => (r() - 0.5) * a;

const paths = (kind: Kind, w: number, h: number, r: () => number): string[] => {
  const a = Math.min(w, h) * 0.05;
  switch (kind) {
    case 'arrow': {
      const x1 = w * 0.92 + j(r, a), y1 = h * 0.1 + j(r, a);
      return [
        `M ${w * 0.06 + j(r, a)} ${h * 0.92 + j(r, a)} C ${w * 0.1 + j(r, a)} ${h * 0.3 + j(r, a)}, ${w * 0.55 + j(r, a)} ${h * 0.05 + j(r, a)}, ${x1} ${y1}`,
        `M ${x1 - w * 0.2 + j(r, a)} ${y1 - h * 0.02 + j(r, a)} L ${x1} ${y1} L ${x1 - w * 0.06 + j(r, a)} ${y1 + h * 0.2 + j(r, a)}`,
      ];
    }
    case 'circle':
      return [`M ${w * 0.5 + j(r, a)} ${h * 0.04 + j(r, a)} C ${w * 1.02} ${h * 0.02 + j(r, a)}, ${w * 1.02 + j(r, a)} ${h * 0.98}, ${w * 0.5 + j(r, a)} ${h * 0.96} C ${-w * 0.03} ${h * 0.98 + j(r, a)}, ${-w * 0.02 + j(r, a)} ${h * 0.02}, ${w * 0.56 + j(r, a)} ${h * 0.1 + j(r, a)}`];
    case 'underline':
      return [`M ${j(r, a)} ${h * 0.5 + j(r, a)} C ${w * 0.3} ${h * 0.2 + j(r, a)}, ${w * 0.6} ${h * 0.8 + j(r, a)}, ${w + j(r, a)} ${h * 0.45 + j(r, a)}`];
    case 'cross':
      return [`M ${j(r, a)} ${j(r, a)} L ${w + j(r, a)} ${h + j(r, a)}`, `M ${w + j(r, a)} ${j(r, a)} L ${j(r, a)} ${h + j(r, a)}`];
    case 'check':
      return [`M ${w * 0.05 + j(r, a)} ${h * 0.55 + j(r, a)} L ${w * 0.36 + j(r, a)} ${h * 0.92 + j(r, a)} L ${w * 0.96 + j(r, a)} ${h * 0.08 + j(r, a)}`];
    case 'strike':
      return [`M ${j(r, a)} ${h * 0.55 + j(r, a)} L ${w * 0.5} ${h * 0.4 + j(r, a)} L ${w + j(r, a)} ${h * 0.6 + j(r, a)}`];
    case 'zig': {
      const n = 7;
      let d = `M 0 ${h * 0.5}`;
      for (let i = 1; i <= n; i++) d += ` L ${(w * i) / n + j(r, a)} ${i % 2 ? h * 0.1 + j(r, a) : h * 0.9 + j(r, a)}`;
      return [d];
    }
    case 'loop':
      return [`M ${j(r, a)} ${h * 0.7} C ${w * 0.3} ${h * 0.1 + j(r, a)}, ${w * 0.55} ${h * 0.1}, ${w * 0.5 + j(r, a)} ${h * 0.5} C ${w * 0.45} ${h * 0.95}, ${w * 0.25 + j(r, a)} ${h * 0.6}, ${w * 0.55} ${h * 0.35} C ${w * 0.75} ${h * 0.2 + j(r, a)}, ${w * 0.9} ${h * 0.4}, ${w + j(r, a)} ${h * 0.3}`];
    default: {
      // burst: três riscos em leque, do canto inferior esquerdo para fora
      return [-78, -52, -26].map((deg) => {
        const ang = ((deg + j(r, 8)) * Math.PI) / 180;
        const r0 = 0.34 + r() * 0.06, r1 = 0.92 + r() * 0.08;
        return `M ${Math.cos(ang) * w * r0} ${h + Math.sin(ang) * h * r0} L ${Math.cos(ang) * w * r1} ${h + Math.sin(ang) * h * r1}`;
      });
    }
  }
};

/** Rabisco à mão em vinho: seta, círculo, risco, xis. Desenha-se e depois treme (boil). */
export const Scribble: React.FC<{ kind: Kind; w: number; h: number; at?: number; dur?: number; color?: string; stroke?: number; seed?: number }> = ({ kind, w, h, at = 0, dur = 8, color = C.wine, stroke = 7, seed = 1 }) => {
  const frame = useCurrentFrame();
  if (frame < at) return <div style={{ width: w, height: h }} />;
  const r = rng(seed * 13 + (Math.floor(frame / 3) % 3) * 7 + 1);
  const ds = paths(kind, w, h, r);
  const p = Math.max(0, Math.min(1, (onTwos(frame) - at + 2) / dur));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      {ds.map((d, i) => {
        const seg = Math.max(0, Math.min(1, p * ds.length - i));
        return <path key={i} d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - seg} opacity={seg > 0 ? 1 : 0} />;
      })}
    </svg>
  );
};
