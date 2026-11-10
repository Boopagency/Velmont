import React, { useMemo } from 'react';
import { rng } from '../lib/rng';
import { C, SANS } from '../theme';
import { SHADOW } from './Paper';

/** Mancha de tinta: contorno orgânico, recortado em papel. */
export const Blob: React.FC<{ w: number; h: number; color?: string; seed?: number; shadow?: boolean }> = ({ w, h, color = C.wine, seed = 1, shadow }) => {
  const d = useMemo(() => {
    const r = rng(seed * 23 + 1);
    const n = 14;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const k = 0.72 + r() * 0.28 + (r() < 0.25 ? 0.12 : 0);
      return [w / 2 + Math.cos(a) * (w / 2) * k, h / 2 + Math.sin(a) * (h / 2) * k];
    });
    let path = '';
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      path += i === 0 ? `M ${mx} ${my}` : '';
      const nx = pts[(i + 2) % n];
      path += ` Q ${q[0]} ${q[1]} ${(q[0] + nx[0]) / 2} ${(q[1] + nx[1]) / 2}`;
    }
    return path + ' Z';
  }, [w, h, seed]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible', filter: shadow ? SHADOW : undefined }}>
      <path d={d} fill={color} />
    </svg>
  );
};

/** Clarão de flash: estrela de papel. */
export const Flash: React.FC<{ size: number; color?: string; seed?: number }> = ({ size, color = C.white, seed = 1 }) => {
  const pts = useMemo(() => {
    const r = rng(seed * 41 + 2);
    const n = 11;
    return Array.from({ length: n * 2 }, (_, i) => {
      const a = (i / (n * 2)) * Math.PI * 2;
      const k = i % 2 ? 0.34 + r() * 0.1 : 0.78 + r() * 0.22;
      return `${size / 2 + Math.cos(a) * (size / 2) * k},${size / 2 + Math.sin(a) * (size / 2) * k}`;
    }).join(' ');
  }, [size, seed]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', filter: SHADOW }}>
      <polygon points={pts} fill={color} />
    </svg>
  );
};

/** Lata de tinta em papel recortado. */
export const PaintCan: React.FC<{ w: number; label?: string }> = ({ w, label = 'TINTA' }) => {
  const h = w * 1.18;
  return (
    <svg width={w} height={h} viewBox="0 0 200 236" style={{ display: 'block', overflow: 'visible', filter: SHADOW }}>
      <path d="M40 34 C 40 -18, 160 -18, 160 34" fill="none" stroke={C.winedeep} strokeWidth="6" strokeLinecap="round" />
      <path d="M14 46 L186 46 L178 224 Q100 240 22 224 Z" fill={C.apoio} />
      <ellipse cx="100" cy="46" rx="86" ry="20" fill={C.wine} />
      <ellipse cx="100" cy="46" rx="86" ry="20" fill="none" stroke={C.cream} strokeWidth="5" />
      <path d="M18 54 Q 30 62 38 56 L 44 150 Q 46 168 56 150 L 58 70 Q 80 80 92 70 L 96 118 Q 99 132 104 118 L 106 72 Q 150 78 182 56 L 181 84 Q 100 104 19 84 Z" fill={C.wine} />
      <path d="M24 122 Q100 140 176 122 L172 198 Q100 214 28 198 Z" fill={C.cream} />
      <text x="100" y="178" textAnchor="middle" fontFamily={SANS} fontWeight="800" fontSize="40" letterSpacing="2" fill={C.wine}>{label}</text>
    </svg>
  );
};

/** Brinco de identificação: etiqueta kraft com furo e o ® no meio. */
export const EarTag: React.FC<{ w: number; text?: string }> = ({ w, text = 'R' }) => {
  const h = w * 1.5;
  return (
    <svg width={w} height={h} viewBox="0 0 100 150" style={{ display: 'block', overflow: 'visible', filter: SHADOW }}>
      <path d="M50 -34 C 30 -20, 62 -8, 50 12" fill="none" stroke={C.cream} strokeWidth="4" strokeLinecap="round" />
      <path d="M22 6 L78 6 L96 34 L92 144 L8 146 L4 34 Z" fill={C.kraft} />
      <circle cx="50" cy="26" r="9" fill={C.winedeep} />
      <circle cx="50" cy="90" r="30" fill="none" stroke={C.wine} strokeWidth="6" />
      <text x="50" y="106" textAnchor="middle" fontFamily={SANS} fontWeight="800" fontSize="44" fill={C.wine}>{text}</text>
    </svg>
  );
};
