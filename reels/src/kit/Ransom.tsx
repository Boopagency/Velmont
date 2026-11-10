import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { boil } from '../lib/motion';
import { rng } from '../lib/rng';
import { C, inkOn, SANS, SERIF, type PaperColor } from '../theme';
import { texture } from './Paper';

const DEFAULT: PaperColor[] = ['cream', 'kraft', 'wine', 'white', 'winedeep', 'kraftdeep'];

/**
 * Título em letras recortadas: cada letra num pedaço de papel diferente,
 * colada meio torta. As letras entram uma a uma, como se alguém colasse na hora.
 */
export const Ransom: React.FC<{
  lines: string[];
  size?: number;
  at?: number;
  stagger?: number;
  seed?: number;
  palette?: PaperColor[];
  align?: 'left' | 'center';
  gap?: number;
}> = ({ lines, size = 130, at = 0, stagger = 1, seed = 1, palette = DEFAULT, align = 'left', gap }) => {
  const frame = useCurrentFrame();
  const tiles = useMemo(() => {
    const r = rng(seed * 101 + 3);
    let n = 0;
    let last: PaperColor | null = null;
    return lines.map((line) =>
      line.split(' ').map((word) =>
        [...word].map((ch) => {
          let color = palette[Math.floor(r() * palette.length)];
          if (color === last) color = palette[(palette.indexOf(color) + 1) % palette.length];
          last = color;
          const f = r();
          return { ch, i: n++, color, rot: (r() - 0.5) * 11, dy: (r() - 0.5) * size * 0.1, k: 0.9 + r() * 0.22, font: f < 0.62 ? 'sans' : f < 0.86 ? 'serif' : 'sansm', sd: Math.floor(r() * 1000) };
        }),
      ),
    );
  }, [lines, seed, size, palette]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'center' ? 'center' : 'flex-start', gap: gap ?? size * 0.16 }}>
      {tiles.map((words, li) => (
        <div key={li} style={{ display: 'flex', gap: size * 0.3 }}>
          {words.map((word, wi) => (
            <div key={wi} style={{ display: 'flex', gap: size * 0.035 }}>
              {word.map((t) => {
                const start = at + t.i * stagger;
                if (frame < start) return <div key={t.i} style={{ width: size * 0.62 * t.k, height: size * 1.06 }} />;
                const f = frame - start;
                const b = boil(frame, t.sd, 0.7, 3);
                const land = f < 2 ? 1.22 : f < 4 ? 0.96 : 1;
                const fs = size * t.k;
                return (
                  <div
                    key={t.i}
                    style={{
                      ...texture(t.color, 200, 240, t.sd),
                      color: inkOn(t.color),
                      minWidth: size * 0.5,
                      height: size * 1.06,
                      padding: `0 ${size * 0.09}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: t.font === 'serif' ? SERIF : SANS,
                      fontStyle: t.font === 'serif' ? 'italic' : 'normal',
                      fontWeight: t.font === 'sans' ? 800 : t.font === 'sansm' ? 500 : 400,
                      fontSize: t.font === 'serif' ? fs * 1.08 : fs * 0.9,
                      lineHeight: 1,
                      textTransform: 'uppercase',
                      boxShadow: '0 5px 7px rgba(10,2,6,0.32)',
                      borderRadius: 2,
                      transform: `translate(${b.x.toFixed(1)}px, ${(t.dy + b.y).toFixed(1)}px) rotate(${(t.rot + b.rot).toFixed(2)}deg) scale(${land})`,
                    }}
                  >
                    {t.ch}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export const RANSOM_INK = C.winedeep;
