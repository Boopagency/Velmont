import React from "react";
import { AbsoluteFill, Solid, useCurrentFrame } from "remotion";
import { contourLines } from "@remotion/effects/contour-lines";
import { H, W } from "../brand";
import { onTwos } from "./motion";

/** Thin contour lines over the background, drifting very slowly. */
export const TopoLines: React.FC<{ color: string; opacity?: number; seed?: number }> = ({ color, opacity = 0.35, seed = 4 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Solid
        color="transparent"
        width={W}
        height={H}
        effects={[
          contourLines({
            lineColor: color,
            lineWidth: 1.3,
            spacing: 40,
            scale: 760,
            complexity: 0.55,
            smoothness: 0.75,
            seed,
            offsetX: onTwos(frame) * 0.12,
            offsetY: onTwos(frame) * -0.06,
            opacity,
          }),
        ]}
      />
    </AbsoluteFill>
  );
};
