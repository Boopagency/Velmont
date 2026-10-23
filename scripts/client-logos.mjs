// One-colour versions of the client logos for "Parceiros da nossa história".
// Originals stay unaltered in assets/client-logos/; each becomes an ivory mark
// in public/images/clients/<name>.webp. No shape is redrawn: every pixel keeps
// the logo's own contrast against its background (light, dark or coloured) as
// opacity, so outlines and inner detail survive. Marks are centred on a 16:9
// canvas with optical sizing (equal area), so wordmarks and emblems weigh alike.
// Usage: node scripts/client-logos.mjs  (then list the file in content/partners.ts)
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const from = 'assets/client-logos', to = 'public/images/clients';
const IVORY = [244, 239, 230], W = 640, H = 360;
const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
// PDF extracts: Quimitec sits in a circular crop with a grey rim; Arte em Foto is
// photographed on a textured wall. `circle` keeps only the centre, `t0` drops faint texture.
const tune = { quimitec: { circle: 0.44 }, 'arte-em-foto': { circle: 0.4, t0: 0.18 } };
await fs.mkdir(to, { recursive: true });

for (const file of (await fs.readdir(from)).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort()) {
  const { circle = 0, t0 = 0.08 } = tune[file.replace(/\.\w+$/, '')] ?? {};
  const { data, info: { width: w, height: h } } = await sharp(path.join(from, file)).flatten({ background: '#fff' }).raw().toBuffer({ resolveWithObject: true });
  // Background: median of the two outer pixel rings.
  const ring = [];
  for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) ring.push((y * w + x) * 3);
  for (let y = 0; y < h; y++) for (const x of [0, 1, w - 2, w - 1]) ring.push((y * w + x) * 3);
  const bg = [0, 1, 2].map(c => ring.map(i => data[i + c]).sort((a, b) => a - b)[ring.length >> 1]);
  const lbg = lum(...bg);
  // Contrast against the background: luminance, or colour for same-brightness hues.
  const dist = new Float32Array(w * h);
  for (let k = 0, i = 0; k < dist.length; k++, i += 3) {
    dist[k] = Math.max(Math.abs(lum(data[i], data[i + 1], data[i + 2]) - lbg), Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]) / 441 * 0.75);
  }
  // Below t0 is background noise; the logo's strongest contrast becomes solid ivory.
  const strongest = Float32Array.from(dist).sort()[Math.floor(dist.length * 0.995)];
  const t1 = Math.max(t0 + 0.05, strongest * 0.7);
  const rgba = Buffer.alloc(w * h * 4);
  for (let k = 0; k < dist.length; k++) {
    const outside = circle && Math.hypot(k % w - w / 2, Math.floor(k / w) - h / 2) > circle * Math.min(w, h);
    rgba.set([...IVORY, outside ? 0 : Math.round(255 * Math.min(1, Math.max(0, (dist[k] - t0) / (t1 - t0))))], k * 4);
  }
  const mark = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 10 }).png().toBuffer({ resolveWithObject: true });
  const ratio = mark.info.width / mark.info.height;
  // Same area for every mark, capped by the canvas margins.
  const mh = Math.round(Math.min(Math.sqrt(W * H * 0.2 / ratio), H * 0.72, W * 0.84 / ratio));
  const mw = Math.round(mh * ratio);
  const sized = await sharp(mark.data).resize(mw, mh).toBuffer();
  const out = path.join(to, file.replace(/\.\w+$/, '.webp'));
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: sized, left: Math.round((W - mw) / 2), top: Math.round((H - mh) / 2) }])
    .webp({ quality: 90, alphaQuality: 90 }).toFile(out);
  console.log(`${out} (${mw}×${mh}, background ${bg.join(',')})`);
}
