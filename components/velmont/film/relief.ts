// The film's single visual material: a relief described by contour lines.
// A point becomes a ring, rings become layers, layers become a mountain —
// the same mountain that signs the Velmont logo. Deterministic: the same
// relief is computed on every device and on every frame.

export type Loop = { x: Float32Array; y: Float32Array; len: Float32Array; total: number; closed: boolean };
export type Level = { h: number; loops: Loop[] };
export type Relief = { levels: Level[]; summit: { x: number; y: number; h: number }; extent: number };

// Deterministic value noise.
function hash(i: number, j: number) {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function valueNoise(x: number, y: number) {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x: number, y: number) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < 4; o++) { sum += amp * (valueNoise(x * freq + 17.1, y * freq - 3.7) * 2 - 1); freq *= 2.03; amp *= 0.5; }
  return sum;
}

const peak = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, h: number, sharp: number) => {
  const r = Math.hypot((x - cx) / rx, (y - cy) / ry);
  return h * Math.exp(-Math.pow(r, sharp));
};

/** Height of the relief: a main summit with two shoulders, echoing the logo's three peaks. */
export function height(x: number, y: number) {
  const k = 14;
  const a = peak(x, y, 0.04, -0.02, 0.62, 0.56, 1, 1.25);
  const b = peak(x, y, -0.6, 0.16, 0.36, 0.32, 0.56, 1.5);
  const c = peak(x, y, 0.62, 0.2, 0.33, 0.3, 0.5, 1.5);
  const smooth = Math.log(Math.exp(k * a) + Math.exp(k * b) + Math.exp(k * c)) / k - Math.log(3) / k;
  return smooth + 0.05 * fbm(x * 2.3, y * 2.3) * (0.35 + smooth);
}

function march(field: Float32Array, n: number, extent: number, level: number): Loop[] {
  const step = (extent * 2) / (n - 1);
  const px = (i: number) => -extent + i * step;
  // Edge ids: horizontal edge (i,j)-(i+1,j) = j*n+i ; vertical edge (i,j)-(i,j+1) = n*n + j*n+i.
  const points = new Map<number, [number, number]>();
  const segments: [number, number][] = [];
  const at = (i: number, j: number) => field[j * n + i];
  const edgePoint = (id: number) => {
    if (points.has(id)) return;
    const vertical = id >= n * n;
    const k = vertical ? id - n * n : id;
    const i = k % n, j = Math.floor(k / n);
    const i2 = vertical ? i : i + 1, j2 = vertical ? j + 1 : j;
    const a = at(i, j), b = at(i2, j2);
    const f = (level - a) / (b - a);
    points.set(id, [px(i) + (px(i2) - px(i)) * f, px(j) + (px(j2) - px(j)) * f]);
  };
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const v0 = at(i, j), v1 = at(i + 1, j), v2 = at(i + 1, j + 1), v3 = at(i, j + 1);
    const c = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
    if (c === 0 || c === 15) continue;
    const top = j * n + i, bottom = (j + 1) * n + i, left = n * n + j * n + i, right = n * n + j * n + i + 1;
    const add = (a: number, b: number) => { edgePoint(a); edgePoint(b); segments.push([a, b]); };
    const center = (v0 + v1 + v2 + v3) / 4 > level;
    switch (c) {
      case 1: case 14: add(left, top); break;
      case 2: case 13: add(top, right); break;
      case 3: case 12: add(left, right); break;
      case 4: case 11: add(right, bottom); break;
      case 6: case 9: add(top, bottom); break;
      case 7: case 8: add(left, bottom); break;
      case 5: if (center) { add(left, top); add(right, bottom); } else { add(left, bottom); add(top, right); } break;
      case 10: if (center) { add(top, right); add(left, bottom); } else { add(left, top); add(right, bottom); } break;
    }
  }
  const byEdge = new Map<number, number[]>();
  segments.forEach(([a, b], s) => { for (const e of [a, b]) { const list = byEdge.get(e); if (list) list.push(s); else byEdge.set(e, [s]); } });
  const used = new Uint8Array(segments.length);
  const loops: Loop[] = [];
  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const chain = [segments[s][0], segments[s][1]];
    const extend = (forward: boolean) => {
      for (;;) {
        const tip = forward ? chain[chain.length - 1] : chain[0];
        const next = (byEdge.get(tip) || []).find(k => !used[k]);
        if (next === undefined) return;
        used[next] = 1;
        const [a, b] = segments[next];
        const other = a === tip ? b : a;
        if (forward) chain.push(other); else chain.unshift(other);
      }
    };
    extend(true); extend(false);
    const closed = chain.length > 3 && chain[0] === chain[chain.length - 1];
    let coords = chain.map(e => points.get(e)!);
    if (closed) {
      coords.pop();
      // Every ring is drawn starting from its eastmost point, clockwise on screen.
      let best = 0;
      coords.forEach((p, k) => { if (p[0] > coords[best][0]) best = k; });
      coords = [...coords.slice(best), ...coords.slice(0, best)];
      let area = 0;
      coords.forEach((p, k) => { const q = coords[(k + 1) % coords.length]; area += p[0] * q[1] - q[0] * p[1]; });
      if (area < 0) coords = [coords[0], ...coords.slice(1).reverse()];
      coords.push(coords[0]);
    }
    const x = new Float32Array(coords.length), y = new Float32Array(coords.length), len = new Float32Array(coords.length);
    coords.forEach((p, k) => { x[k] = p[0]; y[k] = p[1]; if (k) len[k] = len[k - 1] + Math.hypot(p[0] - x[k - 1], p[1] - y[k - 1]); });
    const total = len[len.length - 1];
    if (total > 0.06) loops.push({ x, y, len, total, closed });
  }
  return loops.sort((a, b) => b.total - a.total);
}

let cached: Relief | null = null;
/** Level 0 is the summit ring; each following level is a wider layer below it. */
export function relief(count = 24, n = 190, extent = 1.25): Relief {
  if (cached) return cached;
  const field = new Float32Array(n * n);
  const step = (extent * 2) / (n - 1);
  let summit = { x: 0, y: 0, h: -Infinity };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -extent + i * step, y = -extent + j * step;
    const h = height(x, y);
    field[j * n + i] = h;
    if (h > summit.h) summit = { x, y, h };
  }
  const low = 0.045, high = summit.h - 0.035;
  const levels: Level[] = [];
  for (let k = 0; k < count; k++) {
    const h = high - ((high - low) * k) / (count - 1);
    levels.push({ h, loops: march(field, n, extent, h) });
  }
  cached = { levels, summit, extent };
  return cached;
}

/** A path that climbs the relief by steepest ascent: how a trail crosses contour lines. */
export function ascent(x: number, y: number, steps = 900, stride = 0.006): [number, number][] {
  const pts: [number, number][] = [[x, y]];
  const e = 0.004;
  for (let s = 0; s < steps; s++) {
    const gx = (height(x + e, y) - height(x - e, y)) / (2 * e);
    const gy = (height(x, y + e) - height(x, y - e)) / (2 * e);
    const g = Math.hypot(gx, gy);
    if (g < 0.02) break;
    x += (gx / g) * stride; y += (gy / g) * stride;
    pts.push([x, y]);
  }
  return pts;
}
