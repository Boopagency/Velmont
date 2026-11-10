import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif";

// Same tokens as the site (docs/design-system.md) and the carousels.
export const color = {
  wine: "#3d101e",
  wineDeep: "#210b12",
  wineSurface: "#32151e",
  ink: "#160b0f",
  ivory: "#f4efe6",
  champagne: "#ddc5a1",
  support: "#c1b1b1",
  white: "#fbf8f2",
} as const;

export const sans = loadManrope("normal", {
  weights: ["400", "500", "700", "800"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

export const serif = loadInstrumentSerif("italic", {
  weights: ["400"],
  subsets: ["latin", "latin-ext"],
}).fontFamily;

// Instagram Reels UI covers the top 250px, the bottom 420px and the right 140px:
// scenes keep text and key objects inside x 80..940, y 250..1500.
export const W = 1080;
export const H = 1920;
