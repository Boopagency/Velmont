// Relevo — brand film. The narration is the film's clock: every image, cut,
// word on screen and sound is anchored to a line (or to a word inside a line)
// of this cue sheet, never to an absolute second. See docs/brand-film.md.

export type NarrationLine = {
  id: string;
  text: string;
  /** Seconds from the start of the film. */
  start: number;
  end: number;
  /** Measured onset of every word (film seconds). Without it, words are placed proportionally inside the line. */
  words?: [string, number][];
};

/**
 * The approved voice (Adriana, ElevenLabs), measured word by word: phrase
 * boundaries from the track's energy, word onsets from a speech recogniser,
 * corrected against those boundaries. Times are film time, after the edit
 * in `voice.clips` below.
 */
export const narration: NarrationLine[] = [
  {
    id: 'origem', text: 'Tudo começa com um traço.', start: 1.95, end: 3.59,
    words: [['Tudo', 1.95], ['começa', 2.17], ['com', 2.65], ['um', 2.89], ['traço', 3.05]],
  },
  {
    id: 'traco', text: 'Uma ideia. Um nome que ninguém conhece ainda.', start: 3.96, end: 7.06,
    words: [['Uma', 3.96], ['ideia', 4.24], ['Um', 5.08], ['nome', 5.36], ['que', 5.64], ['ninguém', 5.82], ['conhece', 6.08], ['ainda', 6.72]],
  },
  {
    id: 'trabalho', text: 'Então vem o trabalho.', start: 7.54, end: 8.76,
    words: [['Então', 7.54], ['vem', 8.08], ['o', 8.26], ['trabalho', 8.36]],
  },
  {
    id: 'camadas', text: 'O nome ganha forma. A ideia vira produto. O produto encontra clientes. O código ganha usuários.', start: 9.32, end: 16.62,
    words: [['O', 9.32], ['nome', 9.36], ['ganha', 9.70], ['forma', 10.04], ['A', 11.08], ['ideia', 11.12], ['vira', 11.48], ['produto', 11.84], ['O', 12.86], ['produto', 12.96], ['encontra', 13.36], ['clientes', 13.74], ['O', 14.96], ['código', 15.06], ['ganha', 15.52], ['usuários', 15.98]],
  },
  {
    id: 'valor', text: 'E aquilo que começou pequeno ganha reputação. Ganha espaço. Ganha valor. Muito mais valor do que aquilo que aparece no balanço.', start: 17.13, end: 25.53,
    words: [['E', 17.13], ['aquilo', 17.37], ['que', 17.63], ['começou', 17.81], ['pequeno', 18.19], ['ganha', 18.81], ['reputação', 19.13], ['Ganha', 20.43], ['espaço', 20.57], ['Ganha', 21.67], ['valor', 21.77], ['Muito', 22.67], ['mais', 23.09], ['valor', 23.35], ['do', 23.73], ['que', 23.93], ['aquilo', 24.03], ['que', 24.27], ['aparece', 24.41], ['no', 24.73], ['balanço', 24.95]],
  },
  {
    id: 'pergunta', text: 'Mas quanto do que você construiu está, de fato, protegido?', start: 26.48, end: 30.68,
    words: [['Mas', 26.48], ['quanto', 26.88], ['do', 27.28], ['que', 27.48], ['você', 27.58], ['construiu', 27.82], ['está', 28.52], ['de', 28.98], ['fato', 29.16], ['protegido', 30.02]],
  },
  {
    id: 'olhar', text: 'Olhe de novo.', start: 32.88, end: 33.64,
    words: [['Olhe', 32.88], ['de', 33.24], ['novo', 33.36]],
  },
  {
    id: 'revelacao', text: 'Existe uma marca. Um desenho reconhecível. Um software com autoria. Uma invenção. A prova de quem chegou primeiro.', start: 34.56, end: 43.21,
    words: [['Existe', 34.56], ['uma', 35.04], ['marca', 35.24], ['Um', 36.00], ['desenho', 36.26], ['reconhecível', 36.68], ['Um', 37.93], ['software', 38.19], ['com', 38.71], ['autoria', 39.01], ['Uma', 39.95], ['invenção', 40.23], ['A', 41.17], ['prova', 41.41], ['de', 41.81], ['quem', 42.05], ['chegou', 42.35], ['primeiro', 42.67]],
  },
  {
    id: 'ativos', text: 'Não são apenas documentos. São ativos.', start: 43.60, end: 46.34,
    words: [['Não', 43.60], ['são', 43.86], ['apenas', 44.08], ['documentos', 44.38], ['São', 45.40], ['ativos', 45.70]],
  },
  {
    id: 'velmont', text: 'A Velmont olha para o negócio antes de olhar para o processo.', start: 47.46, end: 50.98,
    words: [['A', 47.46], ['Velmont', 47.74], ['olha', 48.20], ['para', 48.60], ['o', 48.82], ['negócio', 48.90], ['antes', 49.38], ['de', 49.88], ['olhar', 50.08], ['para', 50.32], ['o', 50.48], ['processo', 50.60]],
  },
  {
    id: 'clareza', text: 'Identifica o que existe. Analisa os riscos. E mostra, com clareza, os caminhos possíveis.', start: 51.46, end: 57.93,
    words: [['Identifica', 51.46], ['o', 52.26], ['que', 52.42], ['existe', 52.50], ['Analisa', 53.50], ['os', 53.88], ['riscos', 54.06], ['E', 54.85], ['mostra', 55.13], ['com', 55.49], ['clareza', 55.85], ['os', 56.51], ['caminhos', 56.81], ['possíveis', 57.23]],
  },
  {
    id: 'jornada', text: 'E quando a jornada pede outros olhares, conecta você a especialistas que ajudam o negócio a se estruturar e crescer.', start: 58.36, end: 65.48,
    words: [['E', 58.36], ['quando', 58.60], ['a', 58.78], ['jornada', 58.90], ['pede', 59.32], ['outros', 59.62], ['olhares', 59.98], ['conecta', 60.98], ['você', 61.38], ['a', 61.74], ['especialistas', 61.92], ['que', 62.72], ['ajudam', 62.98], ['o', 63.40], ['negócio', 63.54], ['a', 63.88], ['se', 64.12], ['estruturar', 64.20], ['e', 64.82], ['crescer', 65.02]],
  },
  {
    id: 'patrimonio', text: 'Porque aquilo que você está construindo hoje pode se tornar o patrimônio da sua empresa amanhã.', start: 66.24, end: 71.95,
    words: [['Porque', 66.24], ['aquilo', 66.58], ['que', 66.92], ['você', 67.10], ['está', 67.32], ['construindo', 67.56], ['hoje', 68.20], ['pode', 68.99], ['se', 69.33], ['tornar', 69.49], ['o', 69.79], ['patrimônio', 70.01], ['da', 70.77], ['sua', 70.91], ['empresa', 71.07], ['amanhã', 71.45]],
  },
  {
    id: 'assinatura', text: 'Velmont. Protegendo ideias. Estruturando negócios.', start: 72.64, end: 76.64,
    words: [['Velmont', 72.64], ['Protegendo', 73.66], ['ideias', 74.40], ['Estruturando', 75.36], ['negócios', 76.00]],
  },
];

/** The closing card after the last line; it is written, never spoken. */
export const closingLine = 'Vamos conversar sobre o que você está construindo.';
/** Seconds of image and sound after the last spoken line. */
export const tail = 3.3;

/**
 * The approved voice track, kept unaltered in public/film/ (same origin: the
 * site's Content-Security-Policy only allows media from 'self').
 *
 * `clips` is the edit: [source start, source end, film start], in seconds.
 * Every cut falls in a silence between two phrases, never inside a word; the
 * gaps it opens give the film its breaks: after "balanço", the long silence
 * after "protegido?", a beat after "Olhe de novo", after "São ativos",
 * before "Porque aquilo…" and before the signature.
 */
export const voice: { src: string | null; clips: [number, number, number][] } = {
  src: '/film/narracao.mp3',
  clips: [
    [0, 23.86, 1.8],
    [23.86, 28.55, 26.26],
    [28.55, 29.91, 32.55],
    [29.91, 42.25, 34.31],
    [42.25, 60.64, 47.25],
    [60.64, 66.64, 66.04],
    [66.64, 71.08, 72.44],
  ],
};

/**
 * Official partner logos (public/film/partners/, kept unaltered). The film
 * shows them as a one-colour ivory version so they sit in its palette:
 * `silhouette` keeps the logo's outline, `luminance` keeps its inner detail in
 * two flat tones (Boop's eyes). `height` is in pixels of a 1080p frame. With `null` the
 * partner is named in the film's typography instead; no logo is ever redrawn.
 */
export type PartnerLogo = { src: string; tone: 'silhouette' | 'luminance'; height: number };
export const partnerLogos: { bwise: PartnerLogo | null; boop: PartnerLogo | null } = {
  bwise: { src: '/film/partners/bwise.png', tone: 'silhouette', height: 40 },
  boop: { src: '/film/partners/boop.png', tone: 'luminance', height: 40 },
};

export const filmDuration = () => narration[narration.length - 1].end + tail;

const byId = new Map(narration.map(line => [line.id, line]));
export function line(id: string): NarrationLine {
  const found = byId.get(id);
  if (!found) throw new Error(`Unknown narration line: ${id}`);
  return found;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
/** Onset of a word (or of the first word of a phrase) inside a line: measured when available, otherwise proportional to its position in the text. */
export function word(id: string, needle: string, occurrence = 1): number {
  const l = line(id);
  if (l.words) {
    const tokens = fold(needle).split(' ');
    const said = l.words.map(([w]) => fold(w));
    let seen = 0;
    for (let i = 0; i + tokens.length <= said.length; i++) {
      if (tokens.every((tk, j) => said[i + j] === tk) && ++seen === occurrence) return l.words[i][1];
    }
    throw new Error(`"${needle}" is not in narration line ${id}`);
  }
  const text = fold(l.text);
  const target = fold(needle);
  let index = -1;
  for (let n = 0; n < occurrence; n++) index = text.indexOf(target, index + 1);
  if (index < 0) throw new Error(`"${needle}" is not in narration line ${id}`);
  return l.start + ((l.end - l.start) * index) / text.length;
}

/** The narration line being spoken (or just finished) at time t, for captions. */
export function captionAt(t: number): NarrationLine | null {
  for (const l of narration) if (t >= l.start - 0.1 && t < l.end + 0.35) return l;
  return null;
}
