import { Easing, interpolate, random } from "remotion";

/**
 * Stop motion "on twos": the render is 30 fps but poses change every 2 frames.
 * Every collage animation reads its frame through this.
 */
export const onTwos = (frame: number) => Math.floor(frame / 2) * 2;

/**
 * "Boil": a cutout cycles through 3 almost identical poses every 3 frames,
 * like paper trembling under the animation camera. `seed` desyncs neighbours.
 */
export const boil = (frame: number, seed: number, strength = 1) => {
  const variant = (Math.floor(frame / 3) + seed) % 3;
  const r = (k: string) => (random(`${seed}-${variant}-${k}`) - 0.5) * 2;
  return {
    variant,
    x: r("x") * 1.6 * strength,
    y: r("y") * 1.6 * strength,
    rotate: r("r") * 0.45 * strength,
  };
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 -> 1 with a short overshoot (~8%), for paper sliding onto the table. */
export const slide = (frame: number, start: number, duration = 10) =>
  interpolate(onTwos(frame), [start, start + duration], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.back(1.6)),
  });

/**
 * Stamp hit: scale 1.4 -> 1 in 4 frames, then a decaying tremble.
 * Returns `visible: false` before the hit.
 */
export const stampHit = (frame: number, at: number, seed = 1) => {
  const f = onTwos(frame) - at;
  if (f < 0) return { visible: false, scale: 1.4, x: 0, y: 0, rotate: 0 };
  const scale = interpolate(f, [0, 4], [1.4, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const shake = interpolate(f, [4, 14], [1, 0], clamp);
  const r = (k: string) => (random(`stamp-${seed}-${f}-${k}`) - 0.5) * 2;
  return { visible: true, scale, x: r("x") * 7 * shake, y: r("y") * 7 * shake, rotate: r("r") * 1.5 * shake };
};

/** Slow camera drift across a scene, on twos. */
export const drift = (frame: number, duration: number, seed: number) => {
  const t = onTwos(frame) / duration;
  const dir = random(`drift-${seed}`) > 0.5 ? 1 : -1;
  return {
    scale: 1 + 0.025 * t,
    x: dir * 14 * t,
    y: -10 * t,
  };
};
