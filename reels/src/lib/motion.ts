import { rng } from './rng';

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** "Em dois": o movimento só muda a cada `step` quadros, como stop motion a 15 fps. */
export const onTwos = (frame: number, step = 2) => Math.floor(frame / step) * step;

export const backOut = (t: number, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Progresso 0..1 de `at` até `at + dur`, já quantizado em dois. */
export const prog = (frame: number, at: number, dur: number, step = 2) => clamp01((onTwos(frame, step) - at) / dur);

/** "Boil": o recorte alterna entre 3 poses mínimas, como papel tremendo na mesa. */
export const boil = (frame: number, seed: number, amp = 1, period = 3) => {
  const k = Math.floor(frame / period) % 3;
  const r = rng(seed * 31 + k * 977 + 5);
  return { k, x: (r() - 0.5) * 2.6 * amp, y: (r() - 0.5) * 2.6 * amp, rot: (r() - 0.5) * 0.9 * amp };
};

export type Enter =
  | { kind: 'slide'; at: number; from?: 'left' | 'right' | 'top' | 'bottom'; dist?: number; dur?: number }
  | { kind: 'stamp'; at: number }
  | { kind: 'pop'; at: number; dur?: number }
  | { kind: 'drop'; at: number; dur?: number }
  | { kind: 'cut'; at: number };

export type Exit = { kind: 'slide' | 'cut'; at: number; to?: 'left' | 'right' | 'top' | 'bottom'; dist?: number; dur?: number };

export type Pose = { x: number; y: number; rot: number; scale: number; opacity: number };

const dirVec = (d: 'left' | 'right' | 'top' | 'bottom') => (d === 'left' ? [-1, 0] : d === 'right' ? [1, 0] : d === 'top' ? [0, -1] : [0, 1]);

export const enterPose = (frame: number, e: Enter | undefined, seed: number): Pose => {
  const p: Pose = { x: 0, y: 0, rot: 0, scale: 1, opacity: 1 };
  if (!e) return p;
  if (frame < e.at) return { ...p, opacity: 0 };
  const f = frame - e.at;
  if (e.kind === 'cut') return p;
  if (e.kind === 'slide') {
    const dur = e.dur ?? 10;
    const t = clamp01(onTwos(f) / dur);
    const k = 1 - backOut(t, 1.5);
    const [dx, dy] = dirVec(e.from ?? 'left');
    const dist = e.dist ?? 1200;
    const r = rng(seed + 11);
    return { ...p, x: dx * dist * k, y: dy * dist * k, rot: (r() - 0.5) * 14 * k };
  }
  if (e.kind === 'stamp') {
    // bate: grande e rápido, depois treme
    const t = clamp01(f / 4);
    const scale = lerp(1.45, 1, easeOut(t));
    const shakeT = clamp01((f - 3) / 9);
    const amp = f < 3 ? 0 : (1 - shakeT) * 7;
    const r = rng(seed * 7 + Math.floor(f / 2));
    return { x: (r() - 0.5) * 2 * amp, y: (r() - 0.5) * 2 * amp, rot: (r() - 0.5) * amp * 0.5, scale, opacity: clamp01(f / 1.5) };
  }
  if (e.kind === 'pop') {
    const dur = e.dur ?? 8;
    const t = clamp01(onTwos(f) / dur);
    return { ...p, scale: Math.max(0.001, backOut(t, 2.4)), opacity: 1 };
  }
  // drop: cai de cima, gira e assenta
  const dur = e.dur ?? 12;
  const t = clamp01(onTwos(f) / dur);
  const k = 1 - backOut(t, 1.2);
  const r = rng(seed + 3);
  return { ...p, y: -900 * k, rot: (r() - 0.5) * 40 * k, scale: 1 + 0.12 * k };
};

export const exitPose = (frame: number, e: Exit | undefined, seed: number): Pose => {
  const p: Pose = { x: 0, y: 0, rot: 0, scale: 1, opacity: 1 };
  if (!e || frame < e.at) return p;
  if (e.kind === 'cut') return { ...p, opacity: 0 };
  const dur = e.dur ?? 8;
  const t = clamp01(onTwos(frame - e.at) / dur);
  const k = t * t;
  const [dx, dy] = dirVec(e.to ?? 'right');
  const dist = e.dist ?? 1400;
  const r = rng(seed + 19);
  return { ...p, x: dx * dist * k, y: dy * dist * k, rot: (r() - 0.5) * 18 * k };
};
