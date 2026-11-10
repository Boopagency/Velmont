import React from 'react';
import { Html5Audio, Sequence, staticFile } from 'remotion';

/** Efeito sonoro no quadro `at` (relativo à cena). Sons gerados por tools/build_sfx.py. */
export const Sfx: React.FC<{ name: string; at?: number; vol?: number; rate?: number }> = ({ name, at = 0, vol = 0.8, rate = 1 }) => (
  <Sequence from={at} layout="none">
    <Html5Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} playbackRate={rate} />
  </Sequence>
);
