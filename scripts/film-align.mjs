// Measures the final voice track and re-times Relevo to it.
// Usage: node scripts/film-align.mjs public/film/narracao.mp3 [--write]
// Speech is found from the track's energy; the pauses between narration lines
// are the longest silences, so the N−1 longest gaps split the N lines. Without
// --write it only prints the measured cue sheet; with --write it updates the
// times in components/velmont/film/narration.ts and points `voice.src` at the file.
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const file = process.argv[2];
const write = process.argv.includes('--write');
if (!file) { console.error('Usage: node scripts/film-align.mjs <voice file in public/film/> [--write]'); process.exit(1); }
const absolute = path.resolve(file);
const publicDir = path.resolve('public');
const narrationPath = path.resolve('components/velmont/film/narration.ts');
const source = await fs.readFile(narrationPath, 'utf8');
const ids = [...source.matchAll(/\{ id: '([^']+)', text: '((?:[^'\\]|\\.)*)', start: [\d.]+, end: [\d.]+/g)].map(m => ({ id: m[1], text: m[2] }));

const browser = await chromium.launch();
const page = await browser.newPage();
const bytes = await fs.readFile(absolute);
const envelope = await page.evaluate(async b64 => {
  const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const buffer = await ctx.decodeAudioData(data);
  const hop = Math.round(buffer.sampleRate * 0.01);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const rms = [];
  for (let i = 0; i + hop <= buffer.length; i += hop) {
    let sum = 0;
    for (const ch of channels) for (let j = i; j < i + hop; j++) sum += ch[j] * ch[j];
    rms.push(Math.sqrt(sum / (hop * channels.length)));
  }
  return { rms, duration: buffer.duration };
}, bytes.toString('base64'));
await browser.close();

const db = envelope.rms.map(v => 20 * Math.log10(v + 1e-9));
const loud = [...db].sort((a, b) => b - a)[Math.floor(db.length * 0.05)];
const threshold = loud - 30;
// Voiced 10 ms frames, joined across short gaps (breaths, consonants, commas).
const segments = [];
db.forEach((v, i) => {
  if (v < threshold) return;
  const t = i * 0.01, last = segments[segments.length - 1];
  if (last && t - last[1] < 0.18) last[1] = t + 0.01; else segments.push([t, t + 0.01]);
});
const speech = segments.filter(([a, b]) => b - a > 0.06);
if (speech.length < ids.length) { console.error(`Found ${speech.length} spoken segments for ${ids.length} lines; check the file or the threshold.`); process.exit(1); }
const gaps = speech.slice(1).map((s, i) => ({ i, size: s[0] - speech[i][1] }));
const cuts = gaps.sort((a, b) => b.size - a.size).slice(0, ids.length - 1).map(g => g.i).sort((a, b) => a - b);
const lines = [];
let first = 0;
for (const cut of [...cuts, speech.length - 1]) { lines.push([speech[first][0], speech[cut][1]]); first = cut + 1; }

const round = v => Math.round(v * 100) / 100;
console.log(`Voice: ${envelope.duration.toFixed(2)} s · film: ${(lines[lines.length - 1][1] + 3.5).toFixed(2)} s\n`);
lines.forEach(([a, b], i) => console.log(`${ids[i].id.padEnd(12)} ${round(a).toFixed(2).padStart(6)} → ${round(b).toFixed(2).padStart(6)}  ${ids[i].text}`));
console.log('\nListen to each boundary before trusting it: a long pause inside a line can move a cut.');

if (write) {
  let next = source;
  lines.forEach(([a, b], i) => {
    const pattern = new RegExp(`(\\{ id: '${ids[i].id}', text: '(?:[^'\\\\]|\\\\.)*', )start: [\\d.]+, end: [\\d.]+`);
    next = next.replace(pattern, `$1start: ${round(a)}, end: ${round(b)}`);
  });
  if (absolute.startsWith(publicDir + path.sep)) {
    const url = '/' + path.relative(publicDir, absolute).split(path.sep).join('/');
    next = next.replace(/export const voice: \{ src: string \| null; offset: number \} = \{ src: [^,]+, offset: [\d.]+ \};/, `export const voice: { src: string | null; offset: number } = { src: '${url}', offset: 0 };`);
  } else console.warn('\nThe file is not inside public/, so voice.src was not changed.');
  await fs.writeFile(narrationPath, next);
  console.log('\nUpdated components/velmont/film/narration.ts.');
}
