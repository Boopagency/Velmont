// Exports Relevo to MP4, frame-accurately, from the built site.
// Usage: pnpm build && node scripts/film-render.mjs [out.mp4] [--width 3840] [--fps 30] [--crf 16] [--downscale 1920] [--captions] [--audio-only out.wav]
// The master is drawn at --width (4K by default); --downscale also writes a sharper
// supersampled copy at that width (for example relevo-1920.mp4).
// Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg). Chromium comes from Playwright.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const output = path.resolve(args.find(a => !a.startsWith('--') && !['--width', '--fps', '--crf', '--downscale', '--quality', '--audio-only'].includes(args[args.indexOf(a) - 1])) || 'relevo.mp4');
const width = Number(flag('--width', 3840)), height = Math.round((width * 9) / 16) & ~1, fps = Number(flag('--fps', 30));
const captions = args.includes('--captions');
const crf = String(flag('--crf', 16)), quality = Number(flag('--quality', 0.96)), downscale = Number(flag('--downscale', 0));
const audioOnly = flag('--audio-only', null);
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

const root = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg' };
const server = http.createServer(async (req, res) => {
  let file = path.resolve(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, ''));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try { if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html'); res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(await fs.readFile(file)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`${origin}/filme?export`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__relevo, null, { timeout: 30000 });
const duration = await page.evaluate(() => window.__relevo.duration);

console.log(`Rendering sound (${duration.toFixed(1)} s)…`);
const { wav, peak } = await page.evaluate(() => window.__relevo.audio());
console.log(`Mix peak: ${(20 * Math.log10(peak || 1e-9)).toFixed(1)} dBFS`);
const wavPath = audioOnly ? path.resolve(audioOnly) : output.replace(/\.mp4$/, '') + '.wav';
await fs.writeFile(wavPath, Buffer.from(wav, 'base64'));
if (audioOnly) { await browser.close(); server.close(); process.exit(0); }

const total = Math.ceil(duration * fps);
console.log(`Rendering ${total} frames at ${width}×${height}, ${fps} fps…`);
const encoder = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-i', wavPath,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-profile:v', 'high', '-bf', '2', '-g', String(fps * 2), '-pix_fmt', 'yuv420p', '-tune', 'grain', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', output], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let f = 0; f < total; f++) {
  const data = await page.evaluate(([t, w, h, c, q]) => window.__relevo.frame(t, w, h, c, q), [f / fps, width, height, captions, quality]);
  if (!encoder.stdin.write(Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'))) await new Promise(r => encoder.stdin.once('drain', r));
  if (f % (fps * 5) === 0) console.log(`  ${(f / fps).toFixed(0)} s`);
}
encoder.stdin.end();
await new Promise((resolve, reject) => encoder.on('close', code => (code ? reject(new Error(`ffmpeg exited with ${code}`)) : resolve())));
await fs.rm(wavPath);
if (downscale) {
  const small = output.replace(/\.mp4$/, '') + `-${downscale}.mp4`;
  console.log(`Downscaling to ${downscale} px…`);
  const down = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-i', output, '-vf', `scale=${downscale}:-2:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-tune', 'grain', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', small], { stdio: 'inherit' });
  await new Promise((resolve, reject) => down.on('close', code => (code ? reject(new Error(`ffmpeg exited with ${code}`)) : resolve())));
  console.log(`Done: ${small}`);
}
await browser.close();
server.close();
console.log(`Done: ${output}`);
