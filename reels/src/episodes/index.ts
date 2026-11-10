import type { SceneDef } from '../kit';
import { EP01 } from './ep01';
import { EP06 } from './ep06';
import { EP07 } from './ep07';
import { EP08 } from './ep08';

/** Episódios prontos. Os demais entram aqui conforme forem animados. */
export const EPISODES: { id: string; title: string; scenes: SceneDef[] }[] = [
  { id: 'EP01', title: 'A vaca roxa era um morango', scenes: EP01 },
  { id: 'EP06', title: 'Uma flor de 1,3 milhão', scenes: EP06 },
  { id: 'EP07', title: 'O Burger King sem nome', scenes: EP07 },
  { id: 'EP08', title: 'A marca que não parou', scenes: EP08 },
];
