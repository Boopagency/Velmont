import React from "react";
import { useCurrentFrame } from "remotion";
import { color, sans } from "../brand";
import { stampHit } from "./motion";

/**
 * Rubber stamp that hits the paper: scale 1.4 -> 1 with a tremble, then
 * stays as uneven ink. `rect` is a text stamp, `seal` a round ® badge.
 */
export const Stamp: React.FC<{
  at: number;
  x: number;
  y: number;
  rotate?: number;
  seed: number;
  variant?: "rect" | "seal";
  size?: number;
  ink?: string;
  children?: React.ReactNode;
}> = ({ at, x, y, rotate = 0, seed, variant = "rect", size = 64, ink = color.wine, children }) => {
  const frame = useCurrentFrame();
  const hit = stampHit(frame, at, seed);
  if (!hit.visible) return null;
  const id = `stamp-ink-${seed}`;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: `-50% -50%`,
        transform: `translate(${hit.x}px, ${hit.y}px) rotate(${rotate + hit.rotate}deg) scale(${hit.scale})`,
        filter: `url(#${id})`,
        opacity: 0.95,
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        {/* speckled ink: noise punches small holes and roughens the edge */}
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed={seed} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.6" result="holes" />
          <feComposite in="SourceGraphic" in2="holes" operator="in" result="inked" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed={seed + 3} result="warp" />
          <feDisplacementMap in="inked" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {variant === "rect" ? (
        <div
          style={{
            border: `${Math.round(size * 0.11)}px solid ${ink}`,
            borderRadius: size * 0.16,
            padding: `${size * 0.18}px ${size * 0.38}px`,
            color: ink,
            fontFamily: sans,
            fontWeight: 800,
            fontSize: size,
            lineHeight: 1,
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
          }}
        >
          {children}
        </div>
      ) : (
        <svg width={size * 3} height={size * 3} viewBox="0 0 300 300">
          <path
            fill={ink}
            d={Array.from({ length: 48 }, (_, i) => {
              const a = (i / 48) * Math.PI * 2;
              const r = i % 2 ? 140 : 150;
              return `${i ? "L" : "M"} ${150 + Math.cos(a) * r} ${150 + Math.sin(a) * r}`;
            }).join(" ") + " Z"}
          />
          <circle cx="150" cy="150" r="112" fill="none" stroke={color.ivory} strokeWidth="5" />
          <circle cx="150" cy="150" r="98" fill="none" stroke={color.ivory} strokeWidth="2" />
          <text x="150" y="152" textAnchor="middle" dominantBaseline="central" fill={color.ivory} fontFamily={sans} fontWeight={800} fontSize="150">
            ®
          </text>
        </svg>
      )}
    </div>
  );
};
