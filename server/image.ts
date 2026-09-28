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

const includes = (b: Uint8Array, text: string) => Buffer.from(b.buffer, b.byteOffset, b.byteLength).includes(text, 0, 'latin1');

/**
 * Whether the file carries metadata that can identify people or places:
 * EXIF (GPS, camera, dates), XMP, IPTC, comments or PNG text chunks.
 */
export function hasMetadata(b: Uint8Array, info: ImageInfo) {
  if (info.ext === 'jpg') {
    for (let i = 2; i + 4 <= b.length; ) {
      if (b[i] !== 0xff) return true; // unexpected layout: treat as unsafe
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      if (marker === 0xda || marker === 0xd9) return false; // image data: metadata comes before it
      const length = u16be(b, i + 2);
      // APP1..APP15 (EXIF, XMP, IPTC…) and comments. APP0 (JFIF), APP2 (ICC colour
      // profile) and APP14 (Adobe colour transform) describe only how to draw the image.
      if ((marker >= 0xe1 && marker <= 0xef && marker !== 0xe2 && marker !== 0xee) || marker === 0xfe) return true;
      i += 2 + length;
    }
    return false;
  }
  if (info.ext === 'png') {
    for (let i = 8; i + 8 <= b.length; ) {
      const type = ascii(b, i + 4, 4);
      if (['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(type)) return true;
      if (type === 'IEND') return false;
      i += 12 + u32be(b, i);
    }
    return false;
  }
  if (info.ext === 'webp') {
    for (let i = 12; i + 8 <= b.length; ) {
      const type = ascii(b, i, 4);
      if (type === 'EXIF' || type === 'XMP ') return true;
      const size = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
      i += 8 + size + (size % 2);
    }
    return false;
  }
  // AVIF keeps EXIF/XMP as items of the container.
  return includes(b, 'Exif') || includes(b, 'xmpmeta') || includes(b, 'application/rdf+xml');
}

/**
 * Re-encodes the image without any metadata (orientation applied first).
 * AVIF becomes WebP. Used when an upload carries metadata, whoever sent it.
 */
// Only the calls used here (the project's type setup stubs the 'sharp' module).
type Pipeline = { rotate(): Pipeline; png(): Pipeline; jpeg(options: { quality: number; mozjpeg: boolean }): Pipeline; webp(options: { quality: number }): Pipeline; toBuffer(): Promise<Buffer> };
type Sharp = (input: Uint8Array, options: { limitInputPixels: number; failOn: 'error' }) => Pipeline;

export async function withoutMetadata(bytes: Uint8Array, info: ImageInfo): Promise<{ bytes: Uint8Array; info: ImageInfo } | null> {
  const { default: sharp } = (await import('sharp')) as unknown as { default: Sharp };
  const image = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).rotate();
  const output = info.ext === 'png' ? await image.png().toBuffer() : info.ext === 'jpg' ? await image.jpeg({ quality: 90, mozjpeg: true }).toBuffer() : await image.webp({ quality: 90 }).toBuffer();
  const clean = new Uint8Array(output);
  const next = sniffImage(clean);
  return next && !hasMetadata(clean, next) ? { bytes: clean, info: next } : null;
}
