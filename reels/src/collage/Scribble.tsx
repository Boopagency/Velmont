import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { color } from "../brand";
import { boil, onTwos } from "./motion";

/** Hand-drawn marks, in a 200x200 box unless noted. */
export const marks = {
  // curved arrow, pointing right/down
  arrow: "M 18 40 C 70 10, 150 30, 168 120 M 140 100 L 168 124 L 186 92",
  // short strokes radiating to the right, like the marks around the hands in the carousels
  burst: "M 20 100 L 70 100 M 26 52 L 66 74 M 26 148 L 66 126 M 60 18 L 84 54 M 60 182 L 84 146",
  // loose loop that doesn't quite close
  circle: "M 150 30 C 90 6, 14 40, 18 104 C 22 170, 120 196, 170 150 C 204 116, 190 52, 120 34",
} as const;

/**
 * A mark drawn by hand in wine, revealed stroke by stroke on twos.
 */
export const Scribble: React.FC<{
  d: string;
  at: number;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotate?: number;
  duration?: number;
  stroke?: string;
  strokeWidth?: number;
  seed: number;
}> = ({ d, at, x, y, width, height = width, rotate = 0, duration = 10, stroke = color.wine, strokeWidth = 7, seed }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const b = boil(frame, seed, 1.2);
  const progress = interpolate(onTwos(frame), [at, at + duration], [0, 1], { extrapolateRight: "clamp" });
  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        overflow: "visible",
        rotate: `${rotate + b.rotate * 2}deg`,
        translate: `${b.x}px ${b.y}px`,
      }}
    >
      <path
        d={d}
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - progress}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth * (200 / width)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
