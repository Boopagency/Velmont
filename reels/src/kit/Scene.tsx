import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { lerp, onTwos } from '../lib/motion';
import { rng } from '../lib/rng';
import { C, H, isDark, SAFE, SANS, W, type PaperColor } from '../theme';

/** Moldura fixa da marca: logo, assinatura e @, sempre dentro da área segura. */
export const Brand: React.FC<{ dark: boolean; logo?: boolean }> = ({ dark, logo = true }) => {
  const color = dark ? C.kraft : C.wine;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {logo && <Img src={staticFile(`brand/logo-${dark ? 'kraft' : 'wine'}.png`)} style={{ position: 'absolute', left: SAFE.left, top: SAFE.top + 14, width: 178, height: 'auto' }} />}
      <div style={{ position: 'absolute', right: SAFE.left, top: SAFE.top + 40, fontFamily: SANS, fontWeight: 500, fontSize: 22, letterSpacing: '0.02em', color, opacity: 0.86 }}>by velmont | marcas e patentes</div>
      <div style={{ position: 'absolute', left: SAFE.left, top: H - SAFE.bottom - 46, fontFamily: SANS, fontWeight: 700, fontSize: 24, letterSpacing: '0.02em', color, opacity: 0.9 }}>//@velmontmarcas</div>
    </AbsoluteFill>
  );
};

/**
 * Uma cena: fundo de papel com curvas de nível, deriva leve de câmera,
 * os recortes (children) e a moldura da marca por cima.
 */
export const Scene: React.FC<{
  bg?: PaperColor;
  topo?: 0 | 1 | false;
  seed?: number;
  /** escala da câmera no começo e no fim da cena */
  cam?: [number, number];
  /** para onde a câmera deriva, em px */
  pan?: [number, number];
  /** pulo seco de câmera (jump cut) em um quadro: [quadro, escala extra] */
  punch?: [number, number][];
  brand?: boolean;
  logo?: boolean;
  children: React.ReactNode;
}> = ({ bg = 'cream', topo = 0, seed = 1, cam = [1, 1.035], pan = [0, 0], punch = [], brand = true, logo = true, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dark = isDark(bg);
  const t = Math.min(1, onTwos(frame) / Math.max(1, durationInFrames));
  let s = lerp(cam[0], cam[1], t);
  for (const [at, extra] of punch) if (frame >= at) s += extra;
  const r = rng(seed * 5 + Math.floor(frame / 12));
  const jx = (r() - 0.5) * 6, jy = (r() - 0.5) * 6;
  const src = topo === false ? `tex/${bg}.jpg` : `tex/bg-${bg}-${topo}.jpg`;
  return (
    <AbsoluteFill style={{ backgroundColor: C[bg], overflow: 'hidden' }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', left: -120 + jx + pan[0] * t * 0.5, top: -210 + jy + pan[1] * t * 0.5, width: 1320, height: 2340, transform: `scale(${(1 + (s - 1) * 0.5).toFixed(4)}) scaleX(${seed % 2 ? -1 : 1})` }} />
      <AbsoluteFill style={{ transformOrigin: `${W / 2}px ${H * 0.44}px`, transform: `translate(${(pan[0] * t).toFixed(1)}px, ${(pan[1] * t).toFixed(1)}px) scale(${s.toFixed(4)})` }}>{children}</AbsoluteFill>
      {brand && <Brand dark={dark} logo={logo} />}
    </AbsoluteFill>
  );
};
