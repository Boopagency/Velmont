// Renderiza um ou todos os episódios: Remotion gera as imagens e o som,
// o FFmpeg finaliza (grão de papel, H.264 yuv420p). O som sai baixo de propósito:
// só efeitos discretos, para a narração entrar por cima.
// Uso: node tools/render.mjs EP01            (final, 1080x1920)
//      node tools/render.mjs EP01 --preview  (metade da resolução, rápido)
//      node tools/render.mjs all --bed       (com a base rítmica, bem baixa)
//      node tools/render.mjs EP01 --capa 70  (também salva o quadro 70 como capa PNG)
//      node tools/render.mjs EP01 --keep-raw / --post-only  (guarda o bruto; refaz só a finalização)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const [which = 'all', ...rest] = process.argv.slice(2);
const has = (f) => rest.includes(`--${f}`);
const val = (f) => { const i = rest.indexOf(`--${f}`); return i >= 0 ? rest[i + 1] : undefined; };
const CHROME = process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chrome = fs.existsSync(CHROME) ? [`--browser-executable=${CHROME}`] : [];
export const NAMES = {
  EP01: 'velmont-pp01-vaca-roxa', EP02: 'velmont-pp02-tenho-cnpj', EP03: 'velmont-pp03-senha-001', EP04: 'velmont-pp04-nao-apareceu-nada', EP05: 'velmont-pp05-nome-de-todo-mundo',
  EP06: 'velmont-pp06-45-gavetas', EP07: 'velmont-pp07-cupom-inteiro', EP08: 'velmont-pp08-semana-que-vem', EP09: 'velmont-pp09-alugar-um-nome', EP10: 'velmont-pp10-marca-crescer',
};
const ids = which === 'all' ? Object.keys(NAMES) : which.split(',');
fs.mkdirSync('out/tmp', { recursive: true });
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });

// Grão "em dois": o ruído muda a cada 2 quadros, como papel filmado em stop motion,
// e entra só na luminância (softlight), sem mexer nas cores da marca.
const post = (raw, out, preview) => {
  const size = preview ? '540x960' : '1080x1920';
  run('ffmpeg', [
    '-v', 'error', '-y', '-i', raw,
    '-f', 'lavfi', '-i', `color=c=gray:s=${size}:r=15,format=gray,noise=alls=${preview ? 12 : 17}:allf=t+u,fps=30,format=yuv420p`,
    '-filter_complex', '[0:v]format=yuv420p[v];[v][1:v]blend=c0_mode=softlight:c1_mode=normal:c2_mode=normal:shortest=1[o]',
    '-map', '[o]', '-map', '0:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', preview ? '24' : '20', '-maxrate', preview ? '4M' : '10M', '-bufsize', preview ? '8M' : '20M',
    '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', out,
  ]);
};

for (const id of ids) {
  const preview = has('preview');
  const raw = `out/tmp/${id}${preview ? '-previa' : ''}-raw.mp4`;
  const out = `out/${NAMES[id] ?? id}${preview ? '-previa' : ''}.mp4`;
  const t0 = Date.now();
  console.log('>', id, '→', out);
  if (!(has('post-only') && fs.existsSync(raw))) {
    const args = ['remotion', 'render', 'src/index.ts', id, raw, ...chrome, '--codec=h264', '--pixel-format=yuv420p', '--crf=10', '--audio-codec=aac', '--audio-bitrate=320k', '--concurrency=4', '--log=error'];
    if (preview) args.push('--scale=0.5');
    if (has('bed')) args.push('--props={"bed":"bed","bedVol":0.12}');
    if (val('frames')) args.push(`--frames=${val('frames')}`);
    run('npx', args);
  }
  post(raw, out, preview);
  if (!has('keep-raw')) fs.rmSync(raw);
  console.log(`  ${((Date.now() - t0) / 1000).toFixed(0)} s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  const capa = val('capa');
  if (capa) run('npx', ['remotion', 'still', 'src/index.ts', id, `out/${NAMES[id] ?? id}-capa.png`, ...chrome, `--frame=${capa}`, '--log=error']);
}
