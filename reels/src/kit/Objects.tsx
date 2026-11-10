import React, { useMemo } from 'react';
import { C, SANS } from '../theme';
import { SHADOW } from './Paper';

/**
 * Objetos de papel recortado dos episódios 06, 07 e 08.
 * Todos genéricos: nenhum reproduz logo, embalagem ou desenho de marca de terceiros.
 */

type Base = { w: number; shadow?: boolean };
const sh = (shadow: boolean | undefined): React.CSSProperties => ({ display: 'block', overflow: 'visible', filter: shadow === false ? undefined : SHADOW });
const edge = { stroke: C.white, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const };

/** Flor genérica de quatro pétalas em X, com miolo. Não é o desenho de nenhuma marca. */
export const Flower4: React.FC<Base & { color?: string; core?: string }> = ({ w, shadow = false, color = C.wine, core = C.kraft }) => (
  <svg width={w} height={w} viewBox="0 0 100 100" style={sh(shadow)}>
    {[45, 135, 225, 315].map((a) => (
      <path key={a} d="M50 50 C 34 38, 36 16, 50 4 C 64 16, 66 38, 50 50 Z" fill={color} transform={`rotate(${a} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="8" fill={core} />
  </svg>
);

/** Copo de papel com tampa e cinta. `mark` é o que vai estampado na cinta. */
export const Cup: React.FC<Base & { mark?: React.ReactNode }> = ({ w, shadow, mark }) => (
  <div style={{ position: 'relative', width: w, height: w * 1.4 }}>
    <svg width={w} height={w * 1.4} viewBox="0 0 200 280" style={sh(shadow)}>
      <path d="M26 46 L174 46 L154 272 L46 272 Z" fill={C.cream} {...edge} strokeWidth="12" />
      <path d="M32 112 L168 112 L160 204 L40 204 Z" fill={C.kraft} />
      <rect x="14" y="28" width="172" height="20" rx="6" fill={C.apoio} {...edge} strokeWidth="10" />
      <rect x="30" y="8" width="140" height="24" rx="10" fill={C.apoio} {...edge} strokeWidth="10" />
    </svg>
    {mark && <div style={{ position: 'absolute', left: 0, right: 0, top: w * 0.56, height: w * 0.46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{mark}</div>}
  </div>
);

/** Hambúrguer genérico em camadas de papel. */
export const Burger: React.FC<Base> = ({ w, shadow }) => (
  <svg width={w} height={w * 0.84} viewBox="0 0 240 202" style={sh(shadow)}>
    <path d="M20 96 C 20 30, 70 8, 120 8 C 170 8, 220 30, 220 96 L 224 176 C 224 196, 16 196, 16 176 Z" fill={C.white} {...edge} strokeWidth="14" />
    <path d="M22 92 C 22 34, 72 12, 120 12 C 168 12, 218 34, 218 92 Z" fill={C.kraft} />
    {[[78, 44, -20], [120, 32, 10], [160, 48, 30], [100, 66, 15], [146, 72, -10]].map(([x, y, a], i) => (
      <ellipse key={i} cx={x} cy={y} rx="7" ry="3.6" fill={C.cream} transform={`rotate(${a} ${x} ${y})`} />
    ))}
    <path d="M14 98 Q 30 112 46 100 T 78 100 T 110 100 T 142 100 T 174 100 T 206 100 T 226 98 L 226 110 L 14 110 Z" fill={C.apoio} />
    <path d="M24 108 L216 108 L196 128 L172 112 L150 126 Z" fill={C.cream} />
    <rect x="20" y="118" width="200" height="32" rx="14" fill={C.winedeep} />
    <path d="M22 154 L218 154 L218 172 C 218 190, 22 190, 22 172 Z" fill={C.kraftdeep} />
  </svg>
);

// Contorno simplificado da Austrália (longitude, latitude), no sentido horário a partir do noroeste.
const AU: [number, number][] = [
  [114.0, -22.0], [116.8, -20.6], [119.0, -20.0], [122.2, -18.0], [123.6, -16.6], [125.0, -14.5], [127.0, -13.9], [128.5, -14.8], [129.8, -14.9], [130.9, -12.4], [132.6, -11.4], [135.5, -12.1], [136.9, -12.3], [135.9, -14.9],
  [137.8, -16.1], [139.6, -17.5], [140.9, -17.4], [141.6, -15.0], [141.7, -12.6], [142.5, -10.7], [143.5, -12.8], [145.3, -14.9], [146.0, -17.0], [146.9, -19.2], [149.2, -21.2], [150.8, -23.4], [152.9, -25.3], [153.4, -27.5],
  [153.6, -28.7], [152.9, -31.4], [151.3, -33.9], [150.2, -36.0], [149.9, -37.5], [147.6, -38.0], [146.3, -39.0], [144.7, -38.3], [143.5, -38.8], [141.0, -38.1], [139.8, -37.0], [139.5, -35.8], [138.5, -35.4], [137.8, -33.0],
  [136.0, -34.8], [134.2, -32.9], [133.6, -32.1], [131.2, -31.5], [128.9, -31.7], [126.0, -32.3], [123.9, -33.9], [120.0, -33.9], [118.0, -35.0], [115.1, -34.3], [115.7, -32.0], [115.0, -30.0], [114.2, -27.5], [113.4, -25.5], [113.8, -23.5],
];
const TAS: [number, number][] = [[144.7, -40.8], [148.3, -40.9], [148.2, -42.2], [147.0, -43.6], [145.8, -43.2], [145.2, -42.0]];
const AU_BOX = { lon0: 112.4, lon1: 154.6, lat0: -9.8, lat1: -44.4 };
const AU_RATIO = ((AU_BOX.lat0 - AU_BOX.lat1) / (AU_BOX.lon1 - AU_BOX.lon0)) * 1.1; // 1,1 compensa a latitude

/** Converte longitude e latitude em posição dentro de um mapa de largura `w` (para alfinetes e setas). */
export const auPoint = (lon: number, lat: number, w: number): [number, number] => [((lon - AU_BOX.lon0) / (AU_BOX.lon1 - AU_BOX.lon0)) * w, ((AU_BOX.lat0 - lat) / (AU_BOX.lat0 - AU_BOX.lat1)) * w * AU_RATIO];
export const AU_CITY = { adelaide: [138.6, -34.9], perth: [115.9, -31.95], sydney: [151.2, -33.9], melbourne: [145.0, -37.8], brisbane: [153.0, -27.5], darwin: [130.9, -12.5] } as const;

/** Mapa da Austrália em papel recortado. */
export const MapAU: React.FC<Base & { color?: string }> = ({ w, shadow, color = C.wine }) => {
  const d = useMemo(() => {
    const path = (pts: [number, number][]) => pts.map(([lon, lat], i) => `${i ? 'L' : 'M'} ${auPoint(lon, lat, 1000).map((v) => v.toFixed(1)).join(' ')}`).join(' ') + ' Z';
    return `${path(AU)} ${path(TAS)}`;
  }, []);
  return (
    <svg width={w} height={w * AU_RATIO} viewBox={`0 0 1000 ${1000 * AU_RATIO}`} style={sh(shadow)}>
      <path d={d} fill={color} {...edge} strokeWidth="26" />
    </svg>
  );
};

/** Alfinete de mapa. A ponta fica no canto inferior, no centro. */
export const Pin: React.FC<Base & { color?: string }> = ({ w, shadow, color = C.cream }) => (
  <svg width={w} height={w * 1.4} viewBox="0 0 100 140" style={sh(shadow)}>
    <path d="M50 136 C 30 96, 8 78, 8 48 A 42 42 0 1 1 92 48 C 92 78, 70 96, 50 136 Z" fill={color} {...edge} strokeWidth="10" />
    <circle cx="50" cy="48" r="16" fill={C.winedeep} />
  </svg>
);

export const PaperPlane: React.FC<Base> = ({ w, shadow }) => (
  <svg width={w} height={w * 0.7} viewBox="0 0 200 140" style={sh(shadow)}>
    <path d="M4 60 L196 6 L120 134 L92 86 Z" fill={C.cream} {...edge} strokeWidth="10" />
    <path d="M196 6 L92 86 L100 124 Z" fill={C.apoio} />
  </svg>
);

/** Placa de loja: tábua de papel com moldura e, se quiser, haste. */
export const Sign: React.FC<{ text: string; sub?: string; w: number; h?: number; color?: 'cream' | 'kraft' | 'wine' | 'white'; size?: number; pole?: number; shadow?: boolean }> = ({ text, sub, w, h = w * 0.36, color = 'cream', size: sizeProp, pole = 0, shadow = true }) => {
  // o texto sempre cabe na placa: o corpo diminui conforme o comprimento
  const size = sizeProp ?? Math.min(w * 0.13, (w * 0.84) / (text.length * 0.64));
  const bg = color === 'wine' ? C.wine : color === 'kraft' ? C.kraft : color === 'white' ? C.white : C.cream;
  const fg = color === 'wine' ? C.cream : C.winedeep;
  return (
    <div style={{ position: 'relative', width: w, height: h + pole }}>
      {pole > 0 && <div style={{ position: 'absolute', left: w / 2 - 7, top: h - 4, width: 14, height: pole, background: C.kraftdeep, boxShadow: shadow ? '0 4px 5px rgba(10,2,6,0.3)' : undefined }} />}
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, background: bg, boxShadow: shadow ? '0 6px 7px rgba(10,2,6,0.32)' : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', border: `${Math.max(4, w * 0.018)}px solid ${fg}`, outline: `${Math.max(3, w * 0.014)}px solid ${bg}`, color: fg }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: size, letterSpacing: '0.03em', lineHeight: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{text}</span>
        {sub && <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: size * 0.4, letterSpacing: '0.14em', marginTop: size * 0.2, textTransform: 'uppercase', opacity: 0.8 }}>{sub}</span>}
      </div>
    </div>
  );
};

export const Ladder: React.FC<Base> = ({ w, shadow }) => (
  <svg width={w} height={w * 3} viewBox="0 0 100 300" style={sh(shadow)}>
    {[30, 80, 130, 180, 230, 280].map((y) => <rect key={y} x="14" y={y - 5} width="72" height="10" fill={C.kraftdeep} />)}
    <rect x="8" y="0" width="12" height="300" fill={C.kraft} />
    <rect x="80" y="0" width="12" height="300" fill={C.kraft} />
  </svg>
);

export const Pancakes: React.FC<Base> = ({ w, shadow }) => (
  <svg width={w} height={w * 0.72} viewBox="0 0 200 144" style={sh(shadow)}>
    {[104, 78, 52].map((y, i) => (
      <g key={y}>
        <ellipse cx="100" cy={y + 12} rx={90 - i * 4} ry="22" fill={C.kraftdeep} {...edge} strokeWidth={i === 0 ? 10 : 0} />
        <ellipse cx="100" cy={y} rx={90 - i * 4} ry="22" fill={C.kraft} />
      </g>
    ))}
    <path d="M40 50 C 60 30, 140 30, 162 50 C 170 64, 156 70, 150 60 C 146 84, 132 84, 130 64 C 100 72, 70 70, 60 62 C 56 78, 42 74, 40 50 Z" fill={C.wine} />
    <rect x="84" y="30" width="34" height="22" rx="4" fill={C.cream} transform="rotate(-8 100 40)" />
  </svg>
);

export const Cap: React.FC<Base> = ({ w, shadow }) => (
  <svg width={w} height={w * 0.62} viewBox="0 0 220 136" style={sh(shadow)}>
    <path d="M24 100 C 24 36, 70 10, 112 10 C 152 10, 180 44, 180 100 Z" fill={C.wine} {...edge} strokeWidth="12" />
    <path d="M24 100 C 80 86, 150 88, 214 108 C 216 124, 150 126, 24 118 Z" fill={C.winedeep} {...edge} strokeWidth="12" />
    <circle cx="110" cy="12" r="7" fill={C.cream} />
    <path d="M70 100 C 72 54, 92 26, 110 14 M150 100 C 148 54, 128 26, 110 14" fill="none" stroke={C.cream} strokeWidth="3" opacity="0.45" />
  </svg>
);

export const Tee: React.FC<Base> = ({ w, shadow }) => (
  <svg width={w} height={w * 0.9} viewBox="0 0 220 198" style={sh(shadow)}>
    <path d="M70 10 C 86 30, 134 30, 150 10 L 212 44 L 186 92 L 164 80 L 164 190 L 56 190 L 56 80 L 34 92 L 8 44 Z" fill={C.cream} {...edge} strokeWidth="12" />
    <path d="M70 10 C 86 30, 134 30, 150 10 L 140 6 C 126 20, 94 20, 80 6 Z" fill={C.wine} />
  </svg>
);

export const Sneaker: React.FC<Base> = ({ w, shadow }) => (
  <svg width={w} height={w * 0.52} viewBox="0 0 240 124" style={sh(shadow)}>
    <path d="M14 30 C 30 26, 44 30, 56 20 L 120 58 C 150 72, 196 70, 226 88 L 226 104 L 14 104 Z" fill={C.kraft} {...edge} strokeWidth="12" />
    <path d="M10 98 L 230 98 L 228 116 L 12 116 Z" fill={C.cream} {...edge} strokeWidth="10" />
    {[[74, 34], [92, 44], [110, 54]].map(([x, y], i) => <line key={i} x1={x} y1={y} x2={x - 12} y2={y + 18} stroke={C.winedeep} strokeWidth="5" strokeLinecap="round" />)}
    <path d="M14 30 C 30 26, 44 30, 56 20 L 56 62 C 40 64, 26 62, 14 60 Z" fill={C.wine} />
  </svg>
);

export const Watch: React.FC<Base> = ({ w, shadow }) => (
  <svg width={w} height={w * 1.8} viewBox="0 0 120 216" style={sh(shadow)}>
    <rect x="36" y="4" width="48" height="208" rx="10" fill={C.wine} {...edge} strokeWidth="10" />
    <circle cx="60" cy="108" r="50" fill={C.cream} {...edge} strokeWidth="12" />
    <circle cx="60" cy="108" r="50" fill="none" stroke={C.winedeep} strokeWidth="7" />
    <path d="M60 108 L60 76 M60 108 L84 120" fill="none" stroke={C.winedeep} strokeWidth="6" strokeLinecap="round" />
  </svg>
);

export const Key: React.FC<Base> = ({ w, shadow }) => (
  <svg width={w} height={w * 0.42} viewBox="0 0 260 110" style={sh(shadow)}>
    <path d="M96 46 L246 46 L246 86 L226 86 L226 66 L206 66 L206 86 L186 86 L186 66 L96 66 Z" fill={C.kraft} {...edge} strokeWidth="12" />
    <circle cx="56" cy="56" r="46" fill={C.kraft} {...edge} strokeWidth="12" />
    <circle cx="56" cy="56" r="20" fill={C.winedeep} />
  </svg>
);

/** Pilha de cadernos: cresce de baixo para cima conforme `n`. */
export const Notebooks: React.FC<{ w: number; n: number }> = ({ w, n }) => {
  const h = w * 0.2;
  const colors = [C.kraft, C.cream, C.kraftdeep, C.apoio, C.cream, C.kraft];
  return (
    <div style={{ position: 'relative', width: w, height: h * 6 }}>
      {Array.from({ length: Math.min(6, n) }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: (i % 2 ? 10 : -6) + (i % 3) * 4, bottom: i * h * 0.92, width: w, height: h, background: colors[i], boxShadow: '0 5px 6px rgba(10,2,6,0.32)', transform: `rotate(${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg)`, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 16, height: '100%', background: C.wine, marginLeft: 12 }} />
          <div style={{ flex: 1, margin: '0 18px', height: 6, background: C.winedeep, opacity: 0.25 }} />
        </div>
      ))}
    </div>
  );
};

/** Clipe de papel. */
export const Clip: React.FC<Base> = ({ w }) => (
  <svg width={w} height={w * 2.4} viewBox="0 0 50 120" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M14 34 L14 92 A 11 11 0 0 0 36 92 L36 22 A 16 16 0 0 0 4 22 L4 96 A 21 21 0 0 0 46 96 L46 40" fill="none" stroke={C.apoio} strokeWidth="6" strokeLinecap="round" />
  </svg>
);
