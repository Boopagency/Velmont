// Measures a voice track for Relevo: every spoken phrase and the silence after
// it, in the track's own time. Use it to (re)build `voice.clips` and the line
// times in components/velmont/film/narration.ts — cuts belong inside the
// silences it reports, never inside a phrase. See docs/brand-film.md.
// Usage: node scripts/film-align.mjs public/film/narracao.mp3 [--threshold 32]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/film-align.mjs <voice file> [--threshold 32]'); process.exit(1); }
const i = process.argv.indexOf('--threshold');
const below = i > 0 ? Number(process.argv[i + 1]) : 32;

const browser = await chromium.launch();
const page = await browser.newPage();
const bytes = await fs.readFile(path.resolve(file));
const { rms, duration } = await page.evaluate(async b64 => {
  const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  const buffer = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
  const hop = Math.round(buffer.sampleRate * 0.01);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const out = [];
  for (let s = 0; s + hop <= buffer.length; s += hop) {
    let sum = 0;
    for (const ch of channels) for (let j = s; j < s + hop; j++) sum += ch[j] * ch[j];
    out.push(Math.sqrt(sum / (hop * channels.length)));
  }
  return { rms: out, duration: buffer.duration };
}, bytes.toString('base64'));
await browser.close();

const db = rms.map(v => 20 * Math.log10(v + 1e-9));
const threshold = [...db].sort((a, b) => b - a)[Math.floor(db.length * 0.05)] - below;
// Voiced 10 ms frames, joined across gaps shorter than a breath.
const phrases = [];
db.forEach((v, k) => {
  if (v < threshold) return;
  const t = k * 0.01, last = phrases[phrases.length - 1];
  if (last && t - last[1] < 0.25) last[1] = t + 0.01; else phrases.push([t, t + 0.01]);
});
const spoken = phrases.filter(([a, b]) => b - a > 0.08);
console.log(`${file}: ${duration.toFixed(2)} s, ${spoken.length} phrases\n`);
console.log('  start     end    silence after   (cut at the middle of a silence)');
spoken.forEach(([a, b], k) => {
  const next = spoken[k + 1];
  const gap = next ? next[0] - b : duration - b;
  console.log(`${a.toFixed(2).padStart(7)} ${b.toFixed(2).padStart(7)}   ${gap.toFixed(2).padStart(5)} s${next ? `   cut ≈ ${((b + next[0]) / 2).toFixed(2)}` : ''}`);
});
