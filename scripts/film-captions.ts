// Writes the film's captions (the MP4's timeline is the film's timeline):
// - public/film/relevo-pt.vtt: the editorial captions shown by the site's
//   player (components/velmont/film/captions.ts), also used by native video
//   fullscreen on iPhone;
// - public/film/relevo-pt-integral.vtt: the full narration in short cues that
//   follow the voice word by word, for platforms such as YouTube or LinkedIn.
// Usage: node --import tsx scripts/film-captions.ts
import fs from 'node:fs/promises';
import { editorialCaptions } from '../components/velmont/film/captions';
import { narration } from '../components/velmont/film/narration';

const stamp = (t: number) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};
const cues: [number, number, string][] = [];
narration.forEach((line, n) => {
  const words = line.text.split(' ');
  const times = line.words?.map(([, t]) => t) ?? words.map((_, i) => line.start + ((line.end - line.start) * i) / words.length);
  const groups: number[][] = [];
  let current: number[] = [];
  words.forEach((w, i) => {
    current.push(i);
    const text = current.map(k => words[k]).join(' ');
    const next = words[i + 1];
    const pause = /[.?!]$/.test(w) || (w.endsWith(',') && text.length > 18);
    if (!next || pause || text.length + next.length + 1 > 42) { groups.push(current); current = []; }
  });
  const limit = narration[n + 1]?.start ?? line.end + 2;
  groups.forEach((g, i) => {
    const start = times[g[0]];
    const end = i < groups.length - 1 ? times[groups[i + 1][0]] - 0.02 : Math.min(line.end + 0.35, limit - 0.05);
    cues.push([start, end, g.map(k => words[k]).join(' ')]);
  });
});
const vtt = (list: [number, number, string][]) => `WEBVTT\n\n${list.map(([a, b, text], i) => `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${text}`).join('\n\n')}\n`;
await fs.writeFile('public/film/relevo-pt-integral.vtt', vtt(cues));
await fs.writeFile('public/film/relevo-pt.vtt', vtt(editorialCaptions.map(c => [c.start, c.end, c.text])));
console.log(`${editorialCaptions.length} editorial cues → public/film/relevo-pt.vtt; ${cues.length} full cues → public/film/relevo-pt-integral.vtt`);
