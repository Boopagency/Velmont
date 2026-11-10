import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { slide } from "./motion";

/**
 * Entrance for any cutout: slides from `from` (px offset) with a short
 * overshoot, on twos. Optional starting rotation and scale ("slap" on the table).
 * Nothing is drawn before `at`.
 */
export const SlideIn: React.FC<{
  at: number;
  from?: [number, number];
  rotateFrom?: number;
  scaleFrom?: number;
  duration?: number;
  /** transform origin, in frame pixels: put it on the element's centre */
  origin?: [number, number];
  children: React.ReactNode;
}> = ({ at, from = [0, 0], rotateFrom = 0, scaleFrom = 1, duration = 10, origin = [540, 960], children }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = slide(frame, at, duration);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${origin[0]}px ${origin[1]}px`,
        translate: `${interpolate(p, [0, 1], [from[0], 0])}px ${interpolate(p, [0, 1], [from[1], 0])}px`,
        rotate: `${interpolate(p, [0, 1], [rotateFrom, 0])}deg`,
        scale: interpolate(p, [0, 1], [scaleFrom, 1]),
      }}
    >
      {children}
    </div>
  );
};
