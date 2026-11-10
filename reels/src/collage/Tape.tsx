import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";
import { boil, onTwos } from "./motion";

/**
 * Strip of masking tape with zigzag torn ends. Slaps down at `at`
 * (scale 1.12 -> 1 in 4 frames). Children are written on it.
 */
export const Tape: React.FC<{
  at: number;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotate?: number;
  seed: number;
  children?: React.ReactNode;
}> = ({ at, x, y, width, height = 64, rotate = 0, seed, children }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const b = boil(frame, seed, 0.6);
  const scale = interpolate(onTwos(frame) - at, [0, 4], [1.12, 1], { extrapolateRight: "clamp" });
  const teeth = Math.max(4, Math.round(height / 9));
  const end = (side: 0 | 1) =>
    Array.from({ length: teeth + 1 }, (_, i) => {
      const yy = (i / teeth) * height;
      const d = (i % 2 ? 7 : 1) + random(`${seed}-${side}-${i}-${b.variant}`) * 3;
      return side ? `${width - d}px ${height - yy}px` : `${d}px ${yy}px`;
    });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        translate: `-50% -50%`,
        transform: `translate(${b.x}px, ${b.y}px) rotate(${rotate + b.rotate}deg) scale(${scale})`,
        filter: "drop-shadow(0 2px 2px rgba(22,11,15,0.22))",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `polygon(${[...end(0), ...end(1)].join(", ")})`,
          // translucent kraft tape, with the faint lengthwise fibres of the real thing
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 2px, rgba(0,0,0,0.025) 2px 5px), rgba(226,205,170,0.86)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
};
