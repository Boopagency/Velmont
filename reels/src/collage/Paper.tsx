import React from "react";
import { AbsoluteFill, Solid, random, useCurrentFrame } from "remotion";
import { paper } from "@remotion/effects/paper";
import { noise } from "@remotion/effects/noise";
import { color, H, W } from "../brand";
import { boil, onTwos } from "./motion";

export type Tone = "cream" | "white" | "kraft" | "wine" | "wineDeep";

// base: the paper color. front/back: the light the paper() fibres and folds pick up
// (multiplied over the base). rim: the paler core that shows where paper is torn.
// lift: paper() shades the whole sheet ~10-20% darker; a brightness() on the canvas
// brings the average back to the brand colour.
const tones: Record<Tone, { base: string; front: string; back: string; rim: string; lift: number }> = {
  cream: { base: color.ivory, front: "#f1e8d8", back: "#ffffff", rim: "#fffdf7", lift: 1.12 },
  white: { base: color.white, front: "#f1ebe0", back: "#ffffff", rim: "#ffffff", lift: 1.16 },
  kraft: { base: color.champagne, front: "#d6bd96", back: "#fbf1de", rim: "#f3e8d3", lift: 1.12 },
  wine: { base: color.wine, front: "#c7b4b6", back: "#ffffff", rim: "#e7d8cc", lift: 1.2 },
  wineDeep: { base: color.wineDeep, front: "#c7b4b6", back: "#ffffff", rim: "#d9c6bb", lift: 1.2 },
};

export const toneBase = (tone: Tone) => tones[tone].base;

/** The texture itself: a Solid run through paper(). `seed` picks the sheet. */
export const PaperTexture: React.FC<{ tone: Tone; width: number; height: number; seed: number; style?: React.CSSProperties }> = ({
  tone,
  width,
  height,
  seed,
  style,
}) => {
  const t = tones[tone];
  return (
    <Solid
      color={t.base}
      width={Math.round(width)}
      height={Math.round(height)}
      style={{ position: "absolute", left: 0, top: 0, filter: `brightness(${t.lift})`, ...style }}
      effects={[
        paper({
          colorFront: t.front,
          colorBack: t.back,
          amount: 0.75,
          contrast: 0.22,
          roughness: 0.4,
          fiber: 0.35,
          fiberSize: 0.22,
          crumples: 0.3,
          crumpleSize: 0.45,
          folds: 0.18,
          foldCount: 3,
          drops: 0.04,
          seed,
          scale: 0.7,
        }),
      ]}
    />
  );
};

/**
 * Full-bleed paper on the table. The sheet seed changes every 10 frames among
 * three values (the paper "lives") and the grain changes on twos.
 */
export const PaperBackground: React.FC<{ tone: Tone; seed?: number }> = ({ tone, seed = 0 }) => {
  const frame = useCurrentFrame();
  const sheet = seed * 7 + (Math.floor(frame / 10) % 3);
  const t = tones[tone];
  return (
    <AbsoluteFill style={{ backgroundColor: t.base }}>
      <Solid
        color={t.base}
        width={W}
        height={H}
        style={{ filter: `brightness(${t.lift})` }}
        effects={[
          paper({
            colorFront: t.front,
            colorBack: t.back,
            amount: 0.5,
            contrast: 0.18,
            roughness: 0.25,
            fiber: 0.3,
            fiberSize: 0.25,
            crumples: 0.22,
            crumpleSize: 0.55,
            folds: 0.1,
            foldCount: 2,
            drops: 0.03,
            seed: sheet,
            scale: 0.9,
          }),
          noise({ amount: tone.startsWith("wine") ? 0.05 : 0.04, seed: onTwos(frame), premultiply: true }),
        ]}
      />
    </AbsoluteFill>
  );
};

type Sides = { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };

/**
 * Clip path for a sheet whose `sides` are torn (the rest are scissor cuts).
 * `inset` pulls the torn sides inward, which draws the paler torn rim when
 * layered over the same path with inset 0. `variant` adds the boil jitter.
 */
export const tornPath = (w: number, h: number, o: { seed: number; variant: number; sides: Sides; amp?: number; inset?: number }) => {
  const amp = o.amp ?? 9;
  const inset = o.inset ?? 0;
  const pts: string[] = [];
  const side = (name: keyof Sides, len: number, at: (t: number, d: number) => [number, number]) => {
    const n = Math.max(2, Math.round(len / 13));
    for (let i = 0; i <= n; i++) {
      let d = 0;
      if (o.sides[name]) {
        const k = `${o.seed}-${name}`;
        const knot = i / 4;
        const a = random(`${k}-k${Math.floor(knot)}`);
        const b = random(`${k}-k${Math.floor(knot) + 1}`);
        const wave = a + (b - a) * (knot % 1);
        d = amp * (0.15 + 0.55 * wave + 0.3 * random(`${k}-${i}`));
        if (inset) d += inset * (0.6 + random(`${k}-rim-${i}`));
        d += (random(`${k}-${i}-v${o.variant}`) - 0.5) * 1.6;
      }
      const [x, y] = at(i / n, Math.max(0, d));
      pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    }
  };
  side("top", w, (t, d) => [t * w, d]);
  side("right", h, (t, d) => [w - d, t * h]);
  side("bottom", w, (t, d) => [w - t * w, h - d]);
  side("left", h, (t, d) => [d, h - t * h]);
  return `path("M ${pts.join(" L ")} Z")`;
};

/**
 * A piece of paper on the table: texture, torn or cut edges, short soft shadow
 * and the boil. Children are laid out inside the sheet.
 */
export const TornPaper: React.FC<{
  tone: Tone;
  width: number;
  height: number;
  x: number;
  y: number;
  rotate?: number;
  seed: number;
  torn?: Sides;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ tone, width, height, x, y, rotate = 0, seed, torn = { top: true, right: true, bottom: true, left: true }, style, children }) => {
  const frame = useCurrentFrame();
  const b = boil(frame, seed);
  const t = tones[tone];
  const anyTorn = torn.top || torn.right || torn.bottom || torn.left;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        rotate: `${rotate + b.rotate}deg`,
        translate: `${b.x}px ${b.y}px`,
        filter: tone.startsWith("wine")
          ? "drop-shadow(0 6px 7px rgba(10,4,6,0.45))"
          : "drop-shadow(0 5px 6px rgba(22,11,15,0.28))",
        ...style,
      }}
    >
      {anyTorn ? (
        <div style={{ position: "absolute", inset: 0, background: t.rim, clipPath: tornPath(width, height, { seed, variant: b.variant, sides: torn }) }} />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          clipPath: tornPath(width, height, { seed, variant: b.variant, sides: torn, inset: anyTorn ? 5 : 0 }),
        }}
      >
        <PaperTexture tone={tone} width={width} height={height} seed={seed} />
        <div style={{ position: "absolute", inset: 0 }}>{children}</div>
      </div>
    </div>
  );
};
