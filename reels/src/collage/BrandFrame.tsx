import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { color, sans, SAFE, W, H } from "../brand";

type Shade = "light" | "dark";
const ink = (on: Shade) => (on === "light" ? color.wine : color.ivory);

/**
 * The carousel frame, moved inside the Reels safe area: logo top left,
 * "by velmont | marcas e patentes ®" top right, "//@velmontmarcas" at the foot.
 * `top`/`bottom` say what the frame sits on (light paper or wine).
 */
export const BrandFrame: React.FC<{ top: Shade; bottom: Shade; largeHandle?: boolean }> = ({ top, bottom, largeHandle }) => (
  <AbsoluteFill>
    {/* the logo file is champagne on transparent: use it as a mask to ink it in either colour */}
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        top: SAFE.top + 12,
        width: 156,
        height: 78,
        backgroundColor: top === "light" ? color.wine : color.champagne,
        maskImage: `url(${staticFile("brand/velmont-logo.webp")})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
      }}
    />
    <div
      style={{
        position: "absolute",
        right: SAFE.right,
        top: SAFE.top + 34,
        fontFamily: sans,
        fontWeight: 500,
        fontSize: 23,
        letterSpacing: "0.01em",
        color: ink(top),
      }}
    >
      by velmont | marcas e patentes <span style={{ fontSize: 15, verticalAlign: "super" }}>®</span>
    </div>
    <div
      style={{
        position: "absolute",
        left: 0,
        width: W - SAFE.right / 2,
        top: H - SAFE.bottom - (largeHandle ? 78 : 58),
        textAlign: "center",
        fontFamily: sans,
        fontWeight: largeHandle ? 700 : 500,
        fontSize: largeHandle ? 40 : 23,
        color: largeHandle ? color.champagne : ink(bottom),
      }}
    >
      //@velmontmarcas
    </div>
  </AbsoluteFill>
);
