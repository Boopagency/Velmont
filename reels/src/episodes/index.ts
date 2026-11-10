import React from 'react';
import type { SceneDef } from '../kit';
import { EP01 } from './ep01';
import { HOOKS } from './hooks';

/** Episódios prontos. Os de 02 a 10 entram aqui conforme forem animados. */
export const EPISODES: { id: string; title: string; scenes: SceneDef[] }[] = [
  { id: 'EP01', title: 'A vaca roxa', scenes: EP01 },
  // Capas (ganchos) dos episódios 02 a 10, três segundos cada, para o storyboard.
  { id: 'CAPAS', title: 'Capas 02 a 10', scenes: HOOKS.map((Hook, i) => ({ id: `capa-${i + 2}`, dur: 90, el: React.createElement(Hook) })) },
];
