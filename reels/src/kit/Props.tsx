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

/** Morango em papel recortado, com borda de adesivo. `stick` vira "morango do amor" no palito. */
export const Strawberry: React.FC<{ w: number; shadow?: boolean; stick?: boolean; seed?: number }> = ({ w, shadow = true, stick, seed = 1 }) => {
  const seeds = useMemo(() => {
    const r = rng(seed * 7 + 3);
    const out: [number, number, number][] = [];
    for (let row = 0; row < 5; row++) {
      const y = 104 + row * 27;
      const half = 62 - row * 11;
      const n = Math.max(1, 4 - Math.floor(row / 1.4));
      for (let i = 0; i < n; i++) out.push([100 + (n === 1 ? 0 : -half + (2 * half * i) / (n - 1)) + (r() - 0.5) * 8 + (row % 2 ? 9 : 0), y + (r() - 0.5) * 6, (r() - 0.5) * 30]);
    }
    return out;
  }, [seed]);
  const body = 'M100 240 C 46 202, 10 142, 20 94 C 28 54, 72 44, 100 64 C 128 44, 172 54, 180 94 C 190 142, 154 202, 100 240 Z';
  const leaves = 'M100 70 L 62 30 L 88 48 L 84 14 L 102 44 L 122 12 L 116 48 L 142 32 L 100 70 Z';
  return (
    <svg width={w} height={w * 1.25} viewBox="0 0 200 250" style={{ display: 'block', overflow: 'visible', filter: shadow ? SHADOW : undefined }}>
      {stick && <rect x="94" y="-70" width="12" height="130" rx="5" fill={C.kraft} stroke={C.white} strokeWidth="6" transform="rotate(14 100 60)" />}
      <path d={body} fill={C.wine} stroke={C.white} strokeWidth="16" strokeLinejoin="round" paintOrder="stroke" />
      <path d="M46 104 C 40 146, 62 186, 88 210" fill="none" stroke={C.cream} strokeWidth="9" strokeLinecap="round" opacity="0.2" />
      {seeds.map(([x, y, a], i) => (
        <ellipse key={i} cx={x} cy={y} rx="4.2" ry="7" fill={C.kraft} transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <path d={leaves} fill={C.kraftdeep} stroke={C.white} strokeWidth="12" strokeLinejoin="round" paintOrder="stroke" />
    </svg>
  );
};

/** Pirulito em papel recortado. */
export const Lollipop: React.FC<{ w: number }> = ({ w }) => {
  const spiral = useMemo(() => {
    let d = '';
    for (let i = 0; i <= 90; i++) {
      const t = (i / 90) * Math.PI * 5.2;
      const rad = 6 + t * 3.5;
      d += `${i ? 'L' : 'M'} ${(80 + Math.cos(t) * rad).toFixed(1)} ${(80 + Math.sin(t) * rad).toFixed(1)} `;
    }
    return d;
  }, []);
  return (
    <svg width={w} height={w * 1.9} viewBox="0 0 160 304" style={{ display: 'block', overflow: 'visible', filter: SHADOW }}>
      <rect x="73" y="128" width="14" height="170" rx="6" fill={C.cream} stroke={C.white} strokeWidth="6" />
      <circle cx="80" cy="80" r="70" fill={C.cream} stroke={C.white} strokeWidth="14" />
      <path d={spiral} fill="none" stroke={C.wine} strokeWidth="11" strokeLinecap="round" />
    </svg>
  );
};

/** Lupa em papel recortado: aro, vidro claro e cabo. O vidro deixa ver o que está embaixo. */
export const Loupe: React.FC<{ w: number }> = ({ w }) => (
  <svg width={w} height={w} viewBox="0 0 300 300" style={{ display: 'block', overflow: 'visible', filter: SHADOW }}>
    <line x1="196" y1="196" x2="282" y2="282" stroke={C.white} strokeWidth="44" strokeLinecap="round" />
    <line x1="200" y1="200" x2="280" y2="280" stroke={C.winedeep} strokeWidth="30" strokeLinecap="round" />
    <circle cx="120" cy="120" r="104" fill="rgba(251,248,241,0.13)" stroke={C.white} strokeWidth="34" />
    <circle cx="120" cy="120" r="104" fill="none" stroke={C.winedeep} strokeWidth="18" />
    <path d="M62 96 A 64 64 0 0 1 112 56" fill="none" stroke={C.white} strokeWidth="9" strokeLinecap="round" opacity="0.8" />
  </svg>
);
