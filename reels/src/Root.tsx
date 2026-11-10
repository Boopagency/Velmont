import React from 'react';
import { Composition } from 'remotion';
import { EPISODES } from './episodes';
import { Episode, total } from './kit';
import { FPS, H, W } from './theme';

type Props = { bed: string | false; bedVol: number };

// As cenas são JSX e não passam por props serializáveis: cada episódio vira um componente.
const COMPONENTS = Object.fromEntries(EPISODES.map((ep) => [ep.id, ((p: Props) => <Episode scenes={ep.scenes} bed={p.bed} bedVol={p.bedVol} />) as React.FC<Props>]));

export const Root: React.FC = () => (
  <>
    {EPISODES.map((ep) => (
      <Composition key={ep.id} id={ep.id} component={COMPONENTS[ep.id]} defaultProps={{ bed: false, bedVol: 0.12 }} width={W} height={H} fps={FPS} durationInFrames={total(ep.scenes)} />
    ))}
  </>
);
