import React from 'react';
import { AbsoluteFill, Html5Audio, Series, staticFile } from 'remotion';
import { C } from '../theme';

export type SceneDef = { id: string; dur: number; el: React.ReactNode };

export const total = (scenes: SceneDef[]) => scenes.reduce((n, s) => n + s.dur, 0);

/** Um episódio: cenas em corte seco e a base rítmica (opcional). O grão entra no FFmpeg (tools/render.mjs). */
export const Episode: React.FC<{ scenes: SceneDef[]; bed?: string | false; bedVol?: number }> = ({ scenes, bed = 'bed', bedVol = 0.5 }) => (
  <AbsoluteFill style={{ backgroundColor: C.night }}>
    <Series>
      {scenes.map((s) => (
        <Series.Sequence key={s.id} durationInFrames={s.dur} name={s.id}>
          {s.el}
        </Series.Sequence>
      ))}
    </Series>
    {bed && <Html5Audio src={staticFile(`sfx/${bed}.wav`)} volume={bedVol} loop />}
  </AbsoluteFill>
);
