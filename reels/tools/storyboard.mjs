// Renderiza quadros parados de uma composição, direto do Remotion.
// Uso: node tools/storyboard.mjs EP01 30,90,200 [--scale 0.5] [--out out/storyboard]
//      node tools/storyboard.mjs EP01 every:45     (um quadro a cada 45)
import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';

const [id, spec = 'every:60', ...rest] = process.argv.slice(2);
const arg = (name, def) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def; };
const scale = Number(arg('scale', '0.5'));
const outDir = arg('out', 'out/storyboard');
export const CHROME = process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const browserExecutable = fs.existsSync(CHROME) ? CHROME : undefined;

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public') });
const browser = await openBrowser('chrome', { browserExecutable });
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, browserExecutable });
const frames = spec.startsWith('every:')
  ? Array.from({ length: Math.ceil(composition.durationInFrames / Number(spec.slice(6))) }, (_, i) => i * Number(spec.slice(6)))
  : spec.split(',').map(Number);
fs.mkdirSync(outDir, { recursive: true });
for (const frame of frames) {
  const output = path.join(outDir, `${id}-${String(frame).padStart(4, '0')}.jpg`);
  await renderStill({ composition, serveUrl, output, frame: Math.min(frame, composition.durationInFrames - 1), puppeteerInstance: browser, imageFormat: 'jpeg', jpegQuality: 90, scale, browserExecutable, overwrite: true });
  console.log(output);
}
await browser.close({ silent: true });
