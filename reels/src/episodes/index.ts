import type { SceneDef } from '../kit';
import { EP01 } from './ep01';

/** Episódios prontos. Os de 02 a 10 entram aqui conforme forem animados. */
export const EPISODES: { id: string; title: string; scenes: SceneDef[] }[] = [{ id: 'EP01', title: 'A vaca roxa era um morango', scenes: EP01 }];
