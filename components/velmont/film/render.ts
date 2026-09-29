// Renders one frame of the film as a pure function of time, so the film can
// play, seek, pause and be exported frame by frame with identical results.
import { captionAt, closingLine, partnerLogos } from './narration';
import { cues } from './cues';
import { ascent, relief, type Loop } from './relief';

export type FilmAssets = { mountain: CanvasImageSource | null; logo: CanvasImageSource | null; bwise?: CanvasImageSource | null; boop?: CanvasImageSource | null };
export type FrameOptions = { reduced?: boolean; captions?: boolean };

type RGB = [number, number, number];
const IVORY: RGB = [244, 239, 230];
const CHAMPAGNE: RGB = [221, 197, 161];
const MUTED: RGB = [193, 177, 177];
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a < 0 ? 0 : a > 1 ? 1 : a})`;
const mix = (a: RGB, b: RGB, f: number): RGB => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const inOut = (v: number) => { v = clamp01(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const ramp = (t: number, a: number, b: number) => (b <= a ? (t >= a ? 1 : 0) : clamp01((t - a) / (b - a)));
/** 0 → 1 → 0 window with soft edges. */
const win = (t: number, a: number, b: number, fin = 0.5, fout = 0.5) => Math.min(smooth(ramp(t, a, a + fin)), 1 - smooth(ramp(t, b - fout, b)));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

// ——— Camera ————————————————————————————————————————————————————————————
type Cam = { x: number; y: number; z: number; yaw: number; pitch: number; dist: number };
let keys: [number, Cam][] | null = null;
function cameraKeys(): [number, Cam][] {
  if (keys) return keys;
  const { T } = cues();
  const s = relief().summit;
  const top = (dist: number, x = 0, y = 0): Cam => ({ x, y, z: 0, yaw: -90, pitch: 89.5, dist });
  keys = [
    [0, top(1.0, s.x, s.y)],
    [T.trabalho, top(0.86, s.x, s.y)],
    [T.forma + 0.5, { x: s.x * 0.6, y: s.y * 0.6, z: 0.1, yaw: -84, pitch: 72, dist: 2.3 }],
    [T.usuarios + 0.9, { x: 0, y: 0, z: 0.24, yaw: -64, pitch: 50, dist: 3.8 }],
    [T.valor + 0.3, { x: 0, y: 0, z: 0.3, yaw: -50, pitch: 37, dist: 3.95 }],
    [T.balanco + 0.6, { x: 0, y: 0, z: 0.4, yaw: -90, pitch: 1.5, dist: 4.4 }],
    [T.olhar, { x: 0, y: 0, z: 0.4, yaw: -90, pitch: 1.5, dist: 4.05 }],
    [T.marca + 0.7, { x: 0, y: 0, z: 0.28, yaw: -67, pitch: 30, dist: 3.9 }],
    [T.revelacaoEnd, { x: 0, y: 0, z: 0.22, yaw: -52, pitch: 34, dist: 4.2 }],
    [T.ativosEnd, { x: 0, y: 0, z: 0.2, yaw: -47, pitch: 36, dist: 4.35 }],
    [T.velmont + 1.5, top(5.4)],
    [T.velmontEnd, top(5.1)],
    [T.olhares + 1.3, top(10.8, 0, -0.5)],
    [T.jornadaEnd, top(11.2, 0, -0.5)],
    [T.patrimonio, { x: 0, y: 0, z: 0.42, yaw: -90, pitch: 7, dist: 4.1 }],
    [T.assinatura, { x: 0, y: 0, z: 0.42, yaw: -90, pitch: 7, dist: 3.9 }],
    [T.end + 2, { x: 0, y: 0, z: 0.42, yaw: -90, pitch: 7, dist: 3.75 }],
  ];
  return keys;
}
/** Camera at time t. With reduced motion, moves become cuts through a short dip to black. */
function cameraAt(t: number, reduced: boolean): { cam: Cam; dip: number } {
  const k = cameraKeys();
  if (t <= k[0][0]) return { cam: k[0][1], dip: 1 };
  for (let i = 0; i < k.length - 1; i++) {
    const [ta, a] = k[i], [tb, b] = k[i + 1];
    if (t > tb) continue;
    const u = (t - ta) / (tb - ta);
    // Long holds (pure drifts) stay continuous even with reduced motion.
    const travel = Math.abs(a.pitch - b.pitch) + Math.abs(a.yaw - b.yaw) + Math.abs(a.dist - b.dist) * 12;
    if (reduced && travel > 8) {
      const f = u < 0.5 ? 0 : 1;
      const dip = 1 - 0.95 * Math.max(0, 1 - Math.abs(u - 0.5) / 0.12);
      return { cam: f ? b : a, dip };
    }
    const f = inOut(u);
    return { cam: { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f), yaw: lerp(a.yaw, b.yaw, f), pitch: lerp(a.pitch, b.pitch, f), dist: lerp(a.dist, b.dist, f) }, dip: 1 };
  }
  return { cam: k[k.length - 1][1], dip: 1 };
}

type Projector = { p: (x: number, y: number, z: number) => boolean; sx: number; sy: number; depth: number };
function projector(cam: Cam, w: number, h: number): Projector {
  const yaw = (cam.yaw * Math.PI) / 180, pitch = (cam.pitch * Math.PI) / 180;
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const ex = cam.x + cam.dist * cp * cy, ey = cam.y + cam.dist * cp * sy, ez = cam.z + cam.dist * sp;
  const fx = -cp * cy, fy = -cp * sy, fz = -sp;
  const rx = -sy, ry = cy; // right, rz = 0
  const ux = ry * fz, uy = -rx * fz, uz = rx * fy - ry * fx; // up = right × forward
  const focal = 1 / Math.tan((30 * Math.PI) / 360);
  const scale = h / 2;
  const cx = w / 2, cyy = h / 2;
  const out: Projector = {
    sx: 0, sy: 0, depth: 0,
    p(x, y, z) {
      const dx = x - ex, dy = y - ey, dz = z - ez;
      const Z = dx * fx + dy * fy + dz * fz;
      if (Z < 0.05) return false;
      const X = dx * rx + dy * ry, Y = dx * ux + dy * uy + dz * uz;
      out.sx = cx + (focal * X * scale) / Z;
      out.sy = cyy - (focal * Y * scale) / Z;
      out.depth = Z;
      return true;
    },
  };
  return out;
}

// ——— Texture ———————————————————————————————————————————————————————————
let grain: HTMLCanvasElement[] | null = null;
function grainTiles(): HTMLCanvasElement[] | null {
  if (grain || typeof document === 'undefined') return grain;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  grain = Array.from({ length: 4 }, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 220;
    const g = c.getContext('2d')!;
    const img = g.createImageData(220, 220);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rand() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  });
  return grain;
}

// The photograph dissolves into the dark at its base instead of ending on an edge.
let featherCache: [CanvasImageSource, HTMLCanvasElement] | null = null;
function feathered(src: CanvasImageSource): HTMLCanvasElement {
  if (featherCache && featherCache[0] === src) return featherCache[1];
  const img = src as HTMLImageElement;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  const fade = g.createLinearGradient(0, c.height * 0.62, 0, c.height * 0.93);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade;
  g.fillRect(0, 0, c.width, c.height);
  for (const [x0, x1] of [[0, 0.1], [1, 0.9]]) {
    const side = g.createLinearGradient(c.width * x0, 0, c.width * x1, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)');
    side.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = side;
    g.fillRect(0, 0, c.width, c.height);
  }
  featherCache = [src, c];
  return c;
}

// ——— Drawing helpers ———————————————————————————————————————————————————
function strokeLoop(ctx: CanvasRenderingContext2D, loop: Loop, z: number, pr: Projector, frac = 1) {
  if (frac <= 0) return;
  const limit = loop.total * Math.min(1, frac);
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < loop.x.length; i++) {
    if (loop.len[i] > limit) {
      const f = (limit - loop.len[i - 1]) / (loop.len[i] - loop.len[i - 1]);
      if (pr.p(lerp(loop.x[i - 1], loop.x[i], f), lerp(loop.y[i - 1], loop.y[i], f), z)) ctx.lineTo(pr.sx, pr.sy);
      break;
    }
    if (!pr.p(loop.x[i], loop.y[i], z)) { pen = false; continue; }
    if (pen) ctx.lineTo(pr.sx, pr.sy); else { ctx.moveTo(pr.sx, pr.sy); pen = true; }
  }
  ctx.stroke();
}
function polyline(ctx: CanvasRenderingContext2D, pts: [number, number, number][], pr: Projector, frac = 1) {
  const n = Math.max(2, Math.floor(pts.length * clamp01(frac)));
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < n; i++) {
    if (!pr.p(pts[i][0], pts[i][1], pts[i][2])) { pen = false; continue; }
    if (pen) ctx.lineTo(pr.sx, pr.sy); else { ctx.moveTo(pr.sx, pr.sy); pen = true; }
  }
  ctx.stroke();
}
function font(ctx: CanvasRenderingContext2D, css: string, spacing = 0) {
  ctx.font = css;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
}
function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, css: string, color: string, align: CanvasTextAlign = 'center', spacing = 0) {
  font(ctx, css, spacing);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}
function mainLoop(level: number) { return relief().levels[level].loops[0]; }

// Risk area: the band between two layers, on one flank of the relief.
let riskPolygon: [number, number][] | null = null;
function risk(): [number, number][] {
  if (riskPolygon) return riskPolygon;
  const { summit } = relief();
  const a0 = (196 * Math.PI) / 180, a1 = (256 * Math.PI) / 180;
  const pick = (loop: Loop) => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < loop.x.length; i++) {
      let a = Math.atan2(loop.y[i] - summit.y, loop.x[i] - summit.x);
      if (a < 0) a += Math.PI * 2;
      if (a >= a0 && a <= a1) pts.push([loop.x[i], loop.y[i], a]);
    }
    return pts.sort((p, q) => p[2] - q[2]).map(p => [p[0], p[1]] as [number, number]);
  };
  riskPolygon = [...pick(mainLoop(17)), ...pick(mainLoop(12)).reverse()];
  return riskPolygon;
}
let trails: [number, number][][] | null = null;
const trailStarts: [number, number, string][] = [[-1.12, -0.98, 'A'], [1.16, -0.86, 'B'], [-0.2, 1.18, 'C']];
function paths() { return (trails ??= trailStarts.map(([x, y]) => ascent(x, y))); }

// ——— Frame ———————————————————————————————————————————————————————————————
export function drawFrame(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, assets: FilmAssets, opts: FrameOptions = {}) {
  const { T, reveal, found } = cues();
  const R = relief();
  const { cam, dip } = cameraAt(t, !!opts.reduced);
  const pr = projector(cam, w, h);
  const u = h / 1080; // one "pixel" of a 1080p frame
  const A = inOut(ramp(t, T.trabalho, T.valor + 0.6)) * 0.95; // how tall the relief has grown
  const zOf = (level: number) => R.levels[level].h * A;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#140a0d';
  ctx.fillRect(0, 0, w, h);

  // Atmosphere: a low wine light that warms as the film moves towards clarity.
  const warmth = 0.28 + 0.2 * win(t, T.velmont, T.jornadaEnd + 1, 2, 2) + 0.3 * smooth(ramp(t, T.hoje, T.patrimonio + 1.5)) - 0.18 * win(t, T.pergunta, T.olhar + 0.5, 1.5, 0.6);
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, w * 0.72);
  glow.addColorStop(0, `rgba(72,20,36,${warmth})`);
  glow.addColorStop(1, 'rgba(33,11,18,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const opening = smooth(ramp(t, 0, 0.4));
  ctx.globalAlpha = opening * dip;

  // ——— Words that sit behind the relief ———
  const ativosA = win(t, T.ativos - 0.05, T.velmont + 1.1, 0.55, 0.8);
  if (ativosA > 0) {
    text(ctx, 'ativos.', w / 2, h * 0.6, `400 ${Math.round(250 * u)}px Instrument, Georgia, serif`, rgba(CHAMPAGNE, 0.9 * ativosA), 'center', -4 * u);
  }

  // ——— Mountain photograph (the drawing becomes matter) ———
  const photoA = smooth(ramp(t, T.patrimonio - 0.5, T.patrimonio + 1.9)) * (1 - 0.9 * smooth(ramp(t, T.assinatura - 0.2, T.assinatura + 1.1))) * (1 - smooth(ramp(t, T.assinaturaEnd + 0.5, T.assinaturaEnd + 1.5)));
  if (photoA > 0 && assets.mountain) {
    const img = feathered(assets.mountain);
    const iw = img.width, ih = img.height;
    if (pr.p(R.summit.x, R.summit.y, R.summit.h * A)) {
      const peakX = pr.sx, peakY = pr.sy;
      pr.p(0, 0, 0);
      const baseY = pr.sy;
      const s = ((baseY - peakY) / ((0.9 - 0.19) * ih)) * 1.02;
      ctx.save();
      ctx.globalAlpha = opening * dip * photoA;
      ctx.drawImage(img, peakX - 0.508 * iw * s, peakY - 0.19 * ih * s, iw * s, ih * s);
      ctx.restore();
    }
  }

  // ——— Map sheets of the wider journey (top view) ———
  const sheetsA = win(t, T.olhares - 0.3, T.hoje + 0.8, 1, 1);
  const frameA = win(t, T.velmont + 0.9, T.hoje + 0.8, 0.9, 0.9);
  const sheet = (cx: number, alpha: number) => {
    if (alpha <= 0) return;
    const e = 1.25, tick = 0.14;
    ctx.lineWidth = 1 * u;
    ctx.strokeStyle = rgba(IVORY, 0.14 * alpha);
    polyline(ctx, [[cx - e, -e, 0], [cx + e, -e, 0], [cx + e, e, 0], [cx - e, e, 0], [cx - e, -e, 0]], pr);
    ctx.strokeStyle = rgba(CHAMPAGNE, 0.75 * alpha);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      polyline(ctx, [[cx + sx * e, sy * (e - tick), 0], [cx + sx * e, sy * e, 0], [cx + sx * (e - tick), sy * e, 0]], pr);
    }
  };
  sheet(0, frameA);
  if (frameA > 0 && pr.p(-1.18, 1.14, 0)) text(ctx, 'VELMONT', pr.sx, pr.sy, `600 ${Math.round(13 * u)}px Manrope, Arial, sans-serif`, rgba(CHAMPAGNE, 0.8 * frameA * (1 - sheetsA)), 'left', 4 * u);
  if (sheetsA > 0) {
    const side = 2.95;
    sheet(-side, sheetsA);
    sheet(side, sheetsA);
    // Structure: an orthogonal order.
    ctx.lineWidth = 1 * u;
    for (let i = -4; i <= 4; i++) {
      const v = i * 0.25;
      ctx.strokeStyle = rgba(IVORY, 0.1 * sheetsA);
      polyline(ctx, [[-side + v, -1.25, 0], [-side + v, 1.25, 0]], pr);
      polyline(ctx, [[-side - 1.25, v, 0], [-side + 1.25, v, 0]], pr);
    }
    const struct = smooth(ramp(t, T.estruturar - 0.4, T.estruturar + 1.2)) * sheetsA;
    ctx.strokeStyle = rgba(IVORY, 0.55 * struct);
    ctx.lineWidth = 1.2 * u;
    polyline(ctx, [[-side - 0.75, -1.25, 0], [-side - 0.75, 1.25, 0]], pr, struct);
    polyline(ctx, [[-side - 1.25, 0.5, 0], [-side + 1.25, 0.5, 0]], pr, struct);
    polyline(ctx, [[-side + 0.25, 0.5, 0], [-side + 0.25, -1.25, 0]], pr, struct);
    polyline(ctx, [[-side + 0.25, -0.25, 0], [-side + 1.25, -0.25, 0]], pr, struct);
    // Growth: reach that keeps widening.
    const grow = smooth(ramp(t, T.crescer - 0.5, T.crescer + 1)) * sheetsA;
    for (let i = 0; i < 8; i++) {
      const r = ((i + ((t - T.olhares) * 0.22) % 1) / 8) * 1.2;
      if (r <= 0.02) continue;
      const circle: [number, number, number][] = [];
      for (let a = 0; a <= 72; a++) circle.push([side + Math.cos((a / 72) * Math.PI * 2) * r, Math.sin((a / 72) * Math.PI * 2) * r, 0]);
      ctx.strokeStyle = rgba(IVORY, (0.16 + 0.5 * grow) * sheetsA * (1 - r / 1.25));
      polyline(ctx, circle, pr);
    }
    // Connections from the centre outwards.
    const link = inOut(ramp(t, T.conecta - 0.2, T.conecta + 1.1)) * sheetsA;
    ctx.setLineDash([5 * u, 6 * u]);
    ctx.strokeStyle = rgba(CHAMPAGNE, 0.8 * link);
    polyline(ctx, [[-1.25, 0, 0], [-1.25 - 0.45 * link, 0, 0]], pr);
    polyline(ctx, [[1.25, 0, 0], [1.25 + 0.45 * link, 0, 0]], pr);
    ctx.setLineDash([]);
  }

  // ——— The relief ———
  const dim = 1 - 0.84 * smooth(ramp(t, T.pergunta - 0.3, T.protegido + 0.5));
  const clarity = smooth(ramp(t, T.velmont + 0.3, T.velmont + 2));
  const finale = smooth(ramp(t, T.hoje - 0.2, T.construindo + 0.8));
  const matter = 1 - 0.92 * smooth(ramp(t, T.patrimonio + 0.1, T.patrimonio + 2.4));
  const fadeTail = 1 - smooth(ramp(t, T.assinatura - 0.4, T.assinatura + 0.6));
  // The second look: a reading plane that descends layer by layer.
  const scanKeys: [number, number][] = [[T.olhar - 0.2, -1.5], ...found.map(f => [f.at, f.level] as [number, number]), [T.ativos, 25]];
  let scan = -10;
  if (t > scanKeys[0][0] && t < scanKeys[scanKeys.length - 1][0]) {
    for (let i = 0; i < scanKeys.length - 1; i++) if (t <= scanKeys[i + 1][0]) { scan = lerp(scanKeys[i][1], scanKeys[i + 1][1], smooth((t - scanKeys[i][0]) / (scanKeys[i + 1][0] - scanKeys[i][0]))); break; }
  }
  const scanA = win(t, T.olhar - 0.2, T.ativos, 0.4, 0.6);
  const foundAt = new Map(found.map(f => [f.level, f.at]));
  for (let k = R.levels.length - 1; k >= 0; k--) {
    const start = reveal[k];
    if (t < start) continue;
    const level = R.levels[k];
    const draw = k === 0 ? 1 : inOut(ramp(t, start, start + 1.05));
    const fresh = 1 - smooth(ramp(t, start + 0.4, start + 2.4));
    const f = foundAt.get(k);
    const isFound = f !== undefined && t >= f - 0.05;
    const foundF = f !== undefined && isFound ? smooth(ramp(t, f - 0.05, f + 0.35)) * (1 - finale * 0.6) : 0;
    let alpha = (0.42 + 0.3 * fresh) * (0.7 + 0.3 * (1 - k / R.levels.length));
    alpha *= dim;
    alpha = lerp(alpha, 0.34, clarity * (1 - finale));
    alpha = lerp(alpha, 0.62, finale);
    const pass = scanA * Math.max(0, 1 - Math.abs(k - scan) / 1.3);
    alpha += pass * 0.75;
    let pulse = 0;
    if (isFound) {
      const order = found.findIndex(x => x.level === k);
      pulse = Math.max(0, 1 - Math.abs(t - (T.identifica + order * 0.13) - 0.25) / 0.35);
      alpha = lerp(alpha, 0.95, foundF) + pulse * 0.3;
    }
    alpha *= matter * fadeTail;
    if (alpha <= 0.003) continue;
    const color = mix(IVORY, CHAMPAGNE, Math.max(foundF, finale * 0.65));
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = (1 + 0.55 * foundF + 0.5 * pass + 0.6 * pulse) * u * (k === 0 ? 1.25 : 1);
    const z = zOf(k);
    // The first ring is a single gesture; stray islands at the summit's height are left out.
    for (const loop of k === 0 ? level.loops.slice(0, 1) : level.loops) {
      if (k === 0) strokeLoop(ctx, loop, z, pr, inOut(ramp(t, T.ideia - 0.1, T.ideia + 1.5)));
      else strokeLoop(ctx, loop, z, pr, draw);
    }
  }

  // ——— The first stroke: from the point to the first ring ———
  const s = R.summit;
  const first = mainLoop(0);
  const strokeA = 1 - smooth(ramp(t, T.nome + 0.2, T.nome + 1.2));
  const stroke = inOut(ramp(t, T.traco - 0.05, T.traco + 0.85));
  if (stroke > 0 && strokeA > 0) {
    ctx.strokeStyle = rgba(CHAMPAGNE, 0.95 * strokeA);
    ctx.lineWidth = 1.4 * u;
    polyline(ctx, [[s.x, s.y, 0], [lerp(s.x, first.x[0], stroke), lerp(s.y, first.y[0], stroke), 0]], pr);
  }

  // ——— Risk and possible paths (top view) ———
  const riskA = win(t, T.riscos - 0.1, T.hoje + 0.5, 0.8, 0.9);
  if (riskA > 0) {
    const poly = risk();
    ctx.save();
    ctx.beginPath();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, cx = 0, cy = 0, n = 0;
    poly.forEach(([x, y], i) => {
      if (!pr.p(x, y, 0)) return;
      if (i) ctx.lineTo(pr.sx, pr.sy); else ctx.moveTo(pr.sx, pr.sy);
      minX = Math.min(minX, pr.sx); maxX = Math.max(maxX, pr.sx); minY = Math.min(minY, pr.sy); maxY = Math.max(maxY, pr.sy);
      cx += pr.sx; cy += pr.sy; n++;
    });
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = rgba(CHAMPAGNE, 0.5 * riskA);
    ctx.lineWidth = 1 * u;
    const gap = 9 * u;
    const sweep = inOut(ramp(t, T.riscos - 0.1, T.riscos + 1));
    ctx.beginPath();
    for (let d = minX - (maxY - minY); d < maxX; d += gap) {
      if (d > minX - (maxY - minY) + (maxX - minX + maxY - minY) * sweep) break;
      ctx.moveTo(d, maxY); ctx.lineTo(d + (maxY - minY), minY);
    }
    ctx.stroke();
    ctx.restore();
    if (n) text(ctx, 'RISCO', minX - 18 * u, cy / n + 5 * u, `600 ${Math.round(14 * u)}px Manrope, Arial, sans-serif`, rgba(CHAMPAGNE, 0.9 * riskA * (1 - sheetsA)), 'right', 4 * u);
  }
  const pathsA = win(t, T.caminhos - 0.2, T.hoje + 0.4, 0.3, 0.9);
  if (pathsA > 0) {
    ctx.setLineDash([6 * u, 7 * u]);
    ctx.lineWidth = 1.3 * u;
    paths().forEach((trail, i) => {
      const f = inOut(ramp(t, T.caminhos + i * 0.35, T.caminhos + i * 0.35 + 2));
      if (f <= 0) return;
      ctx.strokeStyle = rgba(CHAMPAGNE, 0.9 * pathsA);
      polyline(ctx, trail.map(([x, y]) => [x, y, 0] as [number, number, number]), pr, f);
      if (pr.p(trail[0][0], trail[0][1], 0)) {
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(pr.sx, pr.sy, 4 * u, 0, Math.PI * 2); ctx.stroke();
        text(ctx, trailStarts[i][2], pr.sx + 12 * u, pr.sy + 5 * u, `600 ${Math.round(14 * u)}px Manrope, Arial, sans-serif`, rgba(CHAMPAGNE, 0.9 * pathsA * smooth(f * 3) * (1 - sheetsA)), 'left', 2 * u);
        ctx.setLineDash([6 * u, 7 * u]);
      }
    });
    ctx.setLineDash([]);
  }

  // ——— The point: the origin, and later the summit ———
  const pointA = smooth(ramp(t, T.point, T.point + 1.1)) * (1 - smooth(ramp(t, T.patrimonio + 0.4, T.patrimonio + 2)));
  if (pointA > 0 && pr.p(s.x, s.y, s.h * A)) {
    const breathe = 1 + 0.18 * Math.sin(t * 1.7) * (1 - smooth(ramp(t, T.traco, T.trabalho)));
    const halo = ctx.createRadialGradient(pr.sx, pr.sy, 0, pr.sx, pr.sy, 16 * u * breathe);
    halo.addColorStop(0, rgba(CHAMPAGNE, 0.22 * pointA));
    halo.addColorStop(1, rgba(CHAMPAGNE, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(pr.sx - 20 * u, pr.sy - 20 * u, 40 * u, 40 * u);
    ctx.fillStyle = rgba(CHAMPAGNE, pointA);
    ctx.beginPath(); ctx.arc(pr.sx, pr.sy, 2.6 * u * breathe, 0, Math.PI * 2); ctx.fill();
  }

  // ——— A name nobody knows yet: empty letter slots ———
  const slotsA = win(t, T.nome, T.trabalho + 0.9, 0.5, 0.7);
  if (slotsA > 0 && pr.p(s.x, s.y, 0)) {
    const y = pr.sy + 150 * u;
    const count = 7, sw = 26 * u, gap = 12 * u;
    const x0 = pr.sx - (count * sw + (count - 1) * gap) / 2;
    ctx.strokeStyle = rgba(IVORY, 0.7 * slotsA);
    ctx.lineWidth = 1 * u;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const appear = smooth(ramp(t, T.nome + i * 0.06, T.nome + i * 0.06 + 0.3));
      ctx.moveTo(x0 + i * (sw + gap), y);
      ctx.lineTo(x0 + i * (sw + gap) + sw * appear, y);
    }
    ctx.stroke();
    if (Math.floor((t - T.nome) / 0.53) % 2 === 0) {
      ctx.fillStyle = rgba(CHAMPAGNE, 0.9 * slotsA);
      ctx.fillRect(x0 - 2 * u, y - 34 * u, 1.5 * u, 28 * u);
    }
  }

  // ——— What the balance sheet shows: a flat line ———
  const groundA = win(t, T.balanco - 0.3, T.olhar + 0.7, 0.3, 0.9);
  if (groundA > 0) {
    const base = mainLoop(R.levels.length - 1);
    let y = 0;
    for (let j = 0; j < base.x.length; j += 3) if (pr.p(base.x[j], base.y[j], zOf(R.levels.length - 1)) && pr.sy > y) y = pr.sy;
    y += 6 * u;
    const reach = inOut(ramp(t, T.balanco - 0.3, T.balanco + 1.2));
    ctx.strokeStyle = rgba(IVORY, 0.8 * groundA);
    ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w * reach, y); ctx.stroke();
  }

  // ——— What the second look finds ———
  const labelsOut = 1 - smooth(ramp(t, T.velmont + 0.2, T.velmont + 1));
  const labelsDim = 1 - 0.6 * smooth(ramp(t, T.documentos, T.documentos + 0.6));
  found.forEach((f, i) => {
    const a = smooth(ramp(t, f.at, f.at + 0.5)) * labelsOut * labelsDim;
    if (a <= 0) return;
    const loop = mainLoop(f.level);
    const z = zOf(f.level);
    let ax = f.side < 0 ? Infinity : -Infinity, ay = 0;
    for (let j = 0; j < loop.x.length; j += 2) {
      if (!pr.p(loop.x[j], loop.y[j], z)) continue;
      if ((f.side < 0 && pr.sx < ax) || (f.side > 0 && pr.sx > ax)) { ax = pr.sx; ay = pr.sy; }
    }
    if (!Number.isFinite(ax)) return;
    ay = Math.min(h * 0.86, Math.max(h * 0.14, ay));
    const edge = f.side < 0 ? w * 0.065 : w * 0.935;
    const align: CanvasTextAlign = f.side < 0 ? 'left' : 'right';
    font(ctx, `500 ${Math.round(24 * u)}px Manrope, Arial, sans-serif`, 5 * u);
    const block = Math.max(ctx.measureText(f.label).width, 160 * u);
    const lead = f.side < 0 ? edge + block + 26 * u : edge - block - 26 * u;
    const reach = inOut(ramp(t, f.at, f.at + 0.6));
    ctx.strokeStyle = rgba(CHAMPAGNE, 0.7 * a);
    ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, lead, reach), ay); ctx.stroke();
    ctx.fillStyle = rgba(CHAMPAGNE, a);
    ctx.beginPath(); ctx.arc(ax, ay, 3 * u, 0, Math.PI * 2); ctx.fill();
    text(ctx, `0${i + 1}`, edge, ay - 30 * u, `600 ${Math.round(13 * u)}px Manrope, Arial, sans-serif`, rgba(CHAMPAGNE, a), align, 3 * u);
    text(ctx, f.label, edge, ay + 9 * u, `500 ${Math.round(24 * u)}px Manrope, Arial, sans-serif`, rgba(IVORY, a), align, 5 * u);
    text(ctx, f.note, edge, ay + 40 * u, `400 ${Math.round(17 * u)}px Manrope, Arial, sans-serif`, rgba(MUTED, 0.9 * a), align, 0.5 * u);
  });

  // ——— The question ———
  const questionA = win(t, T.protegido - 0.05, T.olhar - 0.4, 0.7, 1);
  if (questionA > 0) text(ctx, 'protegido?', w / 2, h * 0.33, `400 ${Math.round(140 * u)}px Instrument, Georgia, serif`, rgba(IVORY, questionA), 'center', -2 * u);

  // ——— The journey, named ———
  if (sheetsA > 0) {
    const label = (x: number, at: number, verb: string, who: string, what: string, logo: CanvasImageSource | null | undefined) => {
      const a = smooth(ramp(t, at, at + 0.7)) * sheetsA;
      if (a <= 0 || !pr.p(x, -1.25 - 0.28, 0)) return;
      text(ctx, verb, pr.sx, pr.sy, `500 ${Math.round(22 * u)}px Manrope, Arial, sans-serif`, rgba(IVORY, a), 'center', 6 * u);
      if (logo) {
        const img = logo as HTMLImageElement;
        const lh = 26 * u, lw = ((img.naturalWidth || img.width) / (img.naturalHeight || img.height)) * lh;
        ctx.globalAlpha = opening * dip * a;
        ctx.drawImage(img, pr.sx - lw / 2, pr.sy + 22 * u, lw, lh);
        ctx.globalAlpha = opening * dip;
        text(ctx, what, pr.sx, pr.sy + 78 * u, `400 ${Math.round(16 * u)}px Manrope, Arial, sans-serif`, rgba(MUTED, a), 'center', 0.3 * u);
      } else {
        text(ctx, who, pr.sx, pr.sy + 42 * u, `600 ${Math.round(16 * u)}px Manrope, Arial, sans-serif`, rgba(CHAMPAGNE, a), 'center', 2.5 * u);
        text(ctx, what, pr.sx, pr.sy + 68 * u, `400 ${Math.round(16 * u)}px Manrope, Arial, sans-serif`, rgba(MUTED, a), 'center', 0.3 * u);
      }
    };
    label(0, T.jornada + 0.2, 'PROTEGER', 'VELMONT', 'propriedade intelectual', null);
    label(-2.95, T.estruturar - 0.2, 'ESTRUTURAR', 'BWISE', 'contabilidade e estrutura empresarial', partnerLogos.bwise ? assets.bwise : null);
    label(2.95, T.crescer - 0.2, 'POSICIONAR E CRESCER', 'BOOP', 'marca, digital e crescimento', partnerLogos.boop ? assets.boop : null);
  }

  // ——— Signature ———
  const logoA = win(t, T.assinatura - 0.1, T.assinaturaEnd + 1.5, 1, 0.9);
  if (logoA > 0) {
    const lw = w * 0.3, lh = lw / 2, ly = h * 0.43;
    if (assets.logo) {
      ctx.globalAlpha = opening * dip * logoA;
      ctx.drawImage(assets.logo, w / 2 - lw / 2, ly - lh / 2 - (1 - logoA) * 6 * u, lw, lh);
      ctx.globalAlpha = opening * dip;
    }
    const a1 = win(t, T.protegendo - 0.1, T.assinaturaEnd + 1.5, 0.8, 0.9);
    const a2 = win(t, T.estruturando - 0.1, T.assinaturaEnd + 1.5, 0.8, 0.9);
    const css = `400 ${Math.round(46 * u)}px Instrument, Georgia, serif`;
    font(ctx, css, 0);
    const p1 = 'Protegendo ideias. ', p2 = 'Estruturando negócios.';
    const w1 = ctx.measureText(p1).width, w2 = ctx.measureText(p2).width;
    const x0 = w / 2 - (w1 + w2) / 2, y = ly + lh / 2 + 70 * u;
    text(ctx, p1, x0, y, css, rgba(IVORY, a1), 'left');
    text(ctx, p2, x0 + w1, y, css, rgba(CHAMPAGNE, a2), 'left');
  }

  // ——— Closing: back to a single point ———
  const endPoint = smooth(ramp(t, T.assinaturaEnd + 1.3, T.assinaturaEnd + 2.1));
  if (endPoint > 0) {
    const y = h * 0.47;
    const halo = ctx.createRadialGradient(w / 2, y, 0, w / 2, y, 16 * u);
    halo.addColorStop(0, rgba(CHAMPAGNE, 0.22 * endPoint));
    halo.addColorStop(1, rgba(CHAMPAGNE, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(w / 2 - 20 * u, y - 20 * u, 40 * u, 40 * u);
    ctx.fillStyle = rgba(CHAMPAGNE, endPoint);
    ctx.beginPath(); ctx.arc(w / 2, y, 2.6 * u, 0, Math.PI * 2); ctx.fill();
    const lineA = smooth(ramp(t, T.assinaturaEnd + 1.9, T.assinaturaEnd + 2.9));
    text(ctx, closingLine, w / 2, y + 74 * u, `300 ${Math.round(30 * u)}px Manrope, Arial, sans-serif`, rgba(IVORY, 0.92 * lineA), 'center', 0.5 * u);
  }

  ctx.globalAlpha = 1;

  // ——— Lens: vignette and grain ———
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.72);
  vignette.addColorStop(0, 'rgba(12,5,8,0)');
  vignette.addColorStop(1, 'rgba(12,5,8,0.6)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  const tiles = grainTiles();
  if (tiles) {
    const tile = tiles[Math.floor(t * 12) % tiles.length];
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern) {
      ctx.globalAlpha = 0.045;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }

  if (opts.captions) {
    const c = captionAt(t);
    if (c) {
      const a = win(t, c.start - 0.1, c.end + 0.35, 0.15, 0.25);
      font(ctx, `500 ${Math.round(30 * u)}px Manrope, Arial, sans-serif`, 0);
      ctx.textAlign = 'center';
      const words = c.text.split(' ');
      const rows: string[] = [];
      let row = '';
      for (const wd of words) {
        const next = row ? `${row} ${wd}` : wd;
        if (ctx.measureText(next).width > w * 0.62 && row) { rows.push(row); row = wd; } else row = next;
      }
      rows.push(row);
      rows.forEach((r, i) => {
        const y = h * 0.9 - (rows.length - 1 - i) * 42 * u;
        const tw = ctx.measureText(r).width;
        ctx.fillStyle = `rgba(12,5,8,${0.62 * a})`;
        ctx.fillRect(w / 2 - tw / 2 - 12 * u, y - 31 * u, tw + 24 * u, 42 * u);
        ctx.fillStyle = rgba(IVORY, a);
        ctx.fillText(r, w / 2, y);
      });
    }
  }
  ctx.restore();
}
