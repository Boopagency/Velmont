// Identifies images by their bytes, never by name or declared type.
// Only raster formats the site needs; SVG (scriptable) is never accepted.

export type ImageInfo = { mime: 'image/webp' | 'image/jpeg' | 'image/png' | 'image/avif'; ext: 'webp' | 'jpg' | 'png' | 'avif'; width: number; height: number };

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 8000;
const MAX_PIXELS = 40_000_000;

const ascii = (b: Uint8Array, start: number, length: number) => String.fromCharCode(...b.subarray(start, start + length));
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

function png(b: Uint8Array): ImageInfo | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !signature.every((v, i) => b[i] === v) || ascii(b, 12, 4) !== 'IHDR') return null;
  return { mime: 'image/png', ext: 'png', width: u32be(b, 16), height: u32be(b, 20) };
}

function jpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    const length = u16be(b, i + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) return { mime: 'image/jpeg', ext: 'jpg', width: u16be(b, i + 7), height: u16be(b, i + 5) };
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

function webp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { mime: 'image/webp', ext: 'webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (chunk === 'VP8L' && b[20] === 0x2f) {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { mime: 'image/webp', ext: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { mime: 'image/webp', ext: 'webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  return null;
}

function avif(b: Uint8Array): ImageInfo | null {
  if (b.length < 32 || ascii(b, 4, 4) !== 'ftyp') return null;
  const brands = ascii(b, 8, Math.min(u32be(b, 0), 64) - 8);
  if (!/avif|avis/.test(brands)) return null;
  const limit = Math.min(b.length - 20, 4096);
  for (let i = 0; i < limit; i++) {
    if (b[i] === 0x69 && ascii(b, i, 4) === 'ispe') return { mime: 'image/avif', ext: 'avif', width: u32be(b, i + 8), height: u32be(b, i + 12) };
  }
  return null;
}

export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  const info = png(bytes) || jpeg(bytes) || webp(bytes) || avif(bytes);
  if (!info) return null;
  const { width, height } = info;
  if (!width || !height || width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) return null;
  return info;
}

/** The file name's extension must agree with the detected format. */
export function extensionMatches(fileName: string, info: ImageInfo) {
  const ext = /\.([a-z0-9]{2,5})$/i.exec(fileName)?.[1]?.toLowerCase();
  const allowed: Record<ImageInfo['ext'], string[]> = { jpg: ['jpg', 'jpeg'], png: ['png'], webp: ['webp'], avif: ['avif'] };
  return Boolean(ext && allowed[info.ext].includes(ext));
}
