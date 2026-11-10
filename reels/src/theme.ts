import { continueRender, delayRender, staticFile } from 'remotion';

export const W = 1080;
export const H = 1920;
export const FPS = 30;

/** Área segura do Reels: nada importante fora dela. */
export const SAFE = { top: 250, bottom: 420, right: 140, left: 64 };

export const C = {
  cream: '#f4efe6',
  white: '#fbf8f1',
  kraft: '#ddc5a1',
  kraftdeep: '#c9ab80',
  apoio: '#c1b1b1',
  wine: '#3d101e',
  winemid: '#32151e',
  winedeep: '#210b12',
  night: '#160b0f',
  ink: '#1e0e14',
} as const;

export type PaperColor = 'cream' | 'white' | 'kraft' | 'kraftdeep' | 'apoio' | 'wine' | 'winemid' | 'winedeep' | 'night';

export const isDark = (c: PaperColor) => c === 'wine' || c === 'winemid' || c === 'winedeep' || c === 'night';

/** Cor de texto que funciona sobre cada papel. */
export const inkOn = (c: PaperColor) => (isDark(c) ? C.cream : C.winedeep);

export const SANS = 'Manrope';
export const SERIF = 'Instrument Serif';

/**
 * Fontes locais (public/fonts, licença OFL): as mesmas Manrope e Instrument Serif
 * do site. O render espera as três carregarem antes do primeiro quadro.
 */
const load = (family: string, file: string, descriptors: FontFaceDescriptors) => {
  const handle = delayRender(`fonte ${file}`);
  const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)})`, descriptors);
  face
    .load()
    .then(() => {
      document.fonts.add(face);
      continueRender(handle);
    })
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
};

if (typeof document !== 'undefined') {
  load(SANS, 'Manrope.ttf', { weight: '200 800', style: 'normal' });
  load(SERIF, 'InstrumentSerif-Regular.ttf', { weight: '400', style: 'normal' });
  load(SERIF, 'InstrumentSerif-Italic-latin.woff2', { weight: '400', style: 'italic' });
}
