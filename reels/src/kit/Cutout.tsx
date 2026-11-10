import React from 'react';
import { Img, staticFile } from 'remotion';

/** Margem que a sombra embutida ocupa em volta do recorte, no arquivo (ver build_assets.py). */
const PAD = 26;

/**
 * Recorte em halftone com borda branca de adesivo e sombra curta já impressa
 * (gerado por tools/build_assets.py). `w` é a largura do recorte, sem a sombra.
 */
export const Cutout: React.FC<{ name: string; w: number; srcW?: number; flip?: boolean; style?: React.CSSProperties }> = ({ name, w, srcW = 1140, flip, style }) => {
  const k = w / srcW;
  return <Img src={staticFile(`cut/${name}.png`)} style={{ display: 'block', width: (srcW + PAD * 2) * k, height: 'auto', margin: -PAD * k, transform: flip ? 'scaleX(-1)' : undefined, ...style }} />;
};
