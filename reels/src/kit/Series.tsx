import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { C, SANS, SERIF, W } from '../theme';
import { Paper } from './Paper';
import { Piece } from './Piece';
import { Scene } from './Scene';
import { Sfx } from './Sfx';
import { Reveal, T } from './Txt';

/** Peças fixas da série Papel Passado, iguais em todos os episódios. */

export const mono: React.CSSProperties = { fontFamily: SANS, fontWeight: 800, fontSize: 22, letterSpacing: '0.14em', textTransform: 'uppercase' };

/** Etiqueta da série no alto da primeira cena. */
export const SeriesTag: React.FC<{ n: string; at?: number; dark?: boolean }> = ({ n, at = 0, dark }) => (
  <Piece x={64} y={372} rot={-1.5} seed={90} enter={{ kind: 'slide', at, from: 'left', dist: 500, dur: 8 }}>
    <Paper w={372} h={58} color={dark ? 'kraft' : 'wine'} torn="r" seed={90} shadow="soft" style={{ display: 'flex', alignItems: 'center', paddingLeft: 18 }}>
      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 21, letterSpacing: '0.16em' }}>PAPEL PASSADO · Nº {n}</span>
    </Paper>
  </Piece>
);

/** Rodapé de fonte: pequeno, sempre no mesmo lugar, acima do @. */
export const Source: React.FC<{ at?: number; dark?: boolean; children: React.ReactNode }> = ({ at = 0, dark, children }) => (
  <Piece x={64} y={1346} seed={77} boil={false} enter={{ kind: 'cut', at }}>
    <T size={20} weight={500} color={dark ? C.cream : C.winedeep} ls="0" lh={1.3} w={880} style={{ opacity: 0.74 }}>{children}</T>
  </Piece>
);

/** Linha de documento: rótulo pequeno e valor. */
export const Row: React.FC<{ k: string; v: React.ReactNode; kw?: number }> = ({ k, v, kw = 138 }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, borderTop: `2px solid ${C.apoio}`, padding: '10px 0' }}>
    <span style={{ ...mono, fontSize: 18, opacity: 0.7, width: kw, flexShrink: 0 }}>{k}</span>
    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 31, lineHeight: 1.1 }}>{v}</span>
  </div>
);

/** Documento com moldura dupla: certificado, contrato, portaria. */
export const Doc: React.FC<{ w: number; h: number; title: string; seed?: number; color?: 'cream' | 'white' | 'kraft'; children?: React.ReactNode }> = ({ w, h, title, seed = 1, color = 'cream', children }) => (
  <Paper w={w} h={h} color={color} seed={seed} style={{ padding: 20, color: C.winedeep }}>
    <div style={{ border: `3px double ${C.wine}`, height: '100%', boxSizing: 'border-box', padding: '18px 26px' }}>
      <div style={{ ...mono, color: C.wine, fontSize: 23, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  </Paper>
);

/** Ficha de arquivo com aba: um conceito por ficha. */
export const Ficha: React.FC<{ w: number; h: number; tab: string; seed?: number; color?: 'cream' | 'white' | 'kraft' | 'wine'; children?: React.ReactNode }> = ({ w, h, tab, seed = 1, color = 'cream', children }) => (
  <div style={{ position: 'relative', width: w, height: h + 40 }}>
    <div style={{ position: 'absolute', left: 26, top: 0 }}>
      <Paper w={Math.min(w - 60, 40 + tab.length * 17)} h={52} color={color} seed={seed + 50} shadow={false} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...mono, fontSize: 19 }}>{tab}</span>
      </Paper>
    </div>
    <div style={{ position: 'absolute', left: 0, top: 40 }}>
      <Paper w={w} h={h} color={color} seed={seed} style={{ padding: '22px 26px', boxSizing: 'border-box' }}>{children}</Paper>
    </div>
  </div>
);

/** Cartão final da série: logo, assinatura e @. */
export const EndCard: React.FC<{ line?: React.ReactNode }> = ({ line }) => (
  <Scene bg="winedeep" topo={1} seed={9} cam={[1.04, 1.0]} logo={false}>
    <Piece x={(W - 620) / 2} y={620} seed={140} boil={0.5} enter={{ kind: 'stamp', at: 4 }}>
      <Img src={staticFile('brand/logo-kraft.png')} style={{ display: 'block', width: 620, height: 'auto' }} />
    </Piece>
    <Piece x={(W - 560) / 2} y={980} rot={-2} seed={141} enter={{ kind: 'slide', at: 14, from: 'left', dist: 1100, dur: 8 }}>
      <Paper w={560} h={92} color="kraft" torn="lr" seed={141} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, letterSpacing: '0.2em', color: C.winedeep }}>PAPEL PASSADO</span>
      </Paper>
    </Piece>
    <AbsoluteFill style={{ top: 1110, height: 200, alignItems: 'center' }}>
      <Reveal at={24}>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 58, color: C.cream, textAlign: 'center', lineHeight: 1.1 }}>{line ?? <>O que é seu, de papel passado.</>}</div>
      </Reveal>
    </AbsoluteFill>
    <Sfx name="stamp" at={4} vol={0.8} />
    <Sfx name="slide" at={14} vol={0.5} />
  </Scene>
);
