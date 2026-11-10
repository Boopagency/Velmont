import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { drift } from "./motion";

/** Slow drift over the whole table for one scene (the brand frame stays outside). */
export const Camera: React.FC<{ duration: number; seed: number; children: React.ReactNode }> = ({ duration, seed, children }) => {
  const frame = useCurrentFrame();
  const d = drift(frame, duration, seed);
  return <AbsoluteFill style={{ scale: d.scale, translate: `${d.x}px ${d.y}px` }}>{children}</AbsoluteFill>;
};
