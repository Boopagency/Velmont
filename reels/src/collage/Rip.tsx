import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { H, W } from "../brand";
import { onTwos } from "./motion";

/** Jagged line across the frame at height `y`, left to right. */
const seam = (y: number, seed: number, shift = 0) =>
  Array.from({ length: 41 }, (_, i) => {
    const x = (i / 40) * W;
    const wave = Math.sin(i * 0.45 + seed) * 18;
    const jag = (random(`${seed}-seam-${i}`) - 0.5) * 22;
    return `${x.toFixed(1)}px ${(y + wave + jag + shift).toFixed(1)}px`;
  });

/**
 * Tears the sheet (children) across at height `y` at frame `at`: the lower
 * piece falls away and reveals whatever is underneath. The upper piece keeps a
 * pale torn rim and casts a short shadow.
 */
export const Rip: React.FC<{ at: number; y: number; seed: number; rim: string; children: React.ReactNode }> = ({ at, y, seed, rim, children }) => {
  const frame = useCurrentFrame();
  if (frame < at) return <AbsoluteFill>{children}</AbsoluteFill>;
  const f = onTwos(frame) - at;
  const line = seam(y, seed);
  const top = `polygon(0px 0px, ${W}px 0px, ${[...line].reverse().join(", ")})`;
  const rimEdge = `polygon(0px 0px, ${W}px 0px, ${[...seam(y, seed, 7)].reverse().join(", ")})`;
  const bottom = `polygon(${line.join(", ")}, ${W}px ${H}px, 0px ${H}px)`;
  return (
    <AbsoluteFill>
      {f < 14 ? (
        <AbsoluteFill
          style={{
            clipPath: bottom,
            transformOrigin: `${W * 0.2}px ${y}px`,
            translate: `${f * 6}px ${f * f * 10}px`,
            rotate: `${interpolate(f, [0, 14], [0, 12])}deg`,
          }}
        >
          {children}
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ filter: "drop-shadow(0 8px 8px rgba(10,4,6,0.45))" }}>
        <AbsoluteFill style={{ clipPath: rimEdge, background: rim }} />
        <AbsoluteFill style={{ clipPath: top }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
