import React from 'react';
import { staticFile } from 'remotion';
import { C, SANS } from '../theme';

/** Carimbo: moldura dupla e tinta falhada. A batida vem do Piece (enter: stamp). */
export const Stamp: React.FC<{ text: string; sub?: string; size?: number; color?: string; round?: boolean; pad?: string }> = ({ text, sub, size = 110, color = C.wine, round, pad }) => {
  const mask = `url(${staticFile('tex/ink-mask.png')})`;
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        border: `${Math.max(5, size * 0.07)}px solid ${color}`,
        borderRadius: round ? '50%' : size * 0.14,
        outline: `${Math.max(2, size * 0.025)}px solid ${color}`,
        outlineOffset: -Math.max(12, size * (round ? 0.2 : 0.17)),
        padding: round ? 0 : (pad ?? `${size * 0.22}px ${size * 0.42}px`),
        width: round ? size * 1.7 : undefined,
        height: round ? size * 1.7 : undefined,
        boxSizing: 'border-box',
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: '520px 520px',
        maskSize: '520px 520px',
      }}
    >
      <span>{text}</span>
      {sub && <span style={{ fontSize: size * 0.24, letterSpacing: '0.16em', marginTop: size * 0.12, fontWeight: 700 }}>{sub}</span>}
    </div>
  );
};
