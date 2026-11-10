import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { boil } from "./motion";

/**
 * Halftone photo sticker made by tools/cutout.py. The boil swaps between the
 * three exported border variants (`<src>-0.png` .. `-2.png`) and nudges the pose.
 */
export const Cutout: React.FC<{
  src: string;
  width: number;
  x: number;
  y: number;
  rotate?: number;
  seed: number;
  style?: React.CSSProperties;
}> = ({ src, width, x, y, rotate = 0, seed, style }) => {
  const frame = useCurrentFrame();
  const b = boil(frame, seed);
  return (
    <Img
      src={staticFile(`${src}-${b.variant}.png`)}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        rotate: `${rotate + b.rotate}deg`,
        translate: `${b.x}px ${b.y}px`,
        filter: "drop-shadow(0 6px 6px rgba(22,11,15,0.35))",
        ...style,
      }}
    />
  );
};
