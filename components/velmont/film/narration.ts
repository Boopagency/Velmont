// Relevo — brand film. The narration is the film's clock: every image, cut,
// word on screen and sound is anchored to a line (or to a word inside a line)
// of this cue sheet, never to an absolute second. Replacing the estimated
// times below with the measured times of the final voice track re-times the
// whole film. See docs/brand-film.md and scripts/film-align.mjs.

export type NarrationLine = {
  id: string;
  text: string;
  /** Seconds from the start of the film. */
  start: number;
  end: number;
  /** Measured word onsets (seconds), when known. Otherwise words are placed proportionally inside the line. */
  words?: Record<string, number>;
};

/**
 * Estimated timing for a calm Brazilian Portuguese read (about six syllables
 * per second, with the pauses the direction asks for). Replace with the real
 * voice track's timing.
 */
export const narration: NarrationLine[] = [
  { id: 'origem', text: 'Tudo começa pequeno.', start: 2.4, end: 3.6 },
  { id: 'traco', text: 'Um traço. Uma ideia. Um nome que ninguém conhece ainda.', start: 4.6, end: 8.7 },
  { id: 'trabalho', text: 'Então vem o trabalho.', start: 9.8, end: 11.0 },
  { id: 'camadas', text: 'O nome ganha forma. A ideia vira produto. O produto encontra clientes. O código ganha usuários.', start: 11.4, end: 17.9 },
  { id: 'valor', text: 'E o que começou pequeno ganha reputação. Ganha valor. Muito mais do que aparece no balanço.', start: 18.5, end: 24.2 },
  { id: 'pergunta', text: 'Mas quanto do que você construiu está, de fato, protegido?', start: 26.0, end: 29.4 },
  { id: 'olhar', text: 'Olhe de novo.', start: 31.8, end: 32.7 },
  { id: 'revelacao', text: 'Existe uma marca. Um desenho reconhecível. Um software com autoria. Uma invenção. A prova de quem chegou primeiro.', start: 33.2, end: 41.3 },
  { id: 'ativos', text: 'Não são só documentos. São ativos.', start: 42.0, end: 44.3 },
  { id: 'velmont', text: 'A Velmont olha para o negócio antes do processo: identifica o que existe, analisa riscos e mostra, com clareza, os caminhos possíveis.', start: 45.3, end: 53.7 },
  { id: 'jornada', text: 'Quando a jornada pede outros olhares, conecta você a especialistas que ajudam a estruturar e a crescer.', start: 54.3, end: 60.9 },
  { id: 'patrimonio', text: 'O que você está construindo hoje pode ser o patrimônio de amanhã.', start: 62.0, end: 65.8 },
  { id: 'assinatura', text: 'Velmont. Protegendo ideias. Estruturando negócios.', start: 66.9, end: 70.7 },
];

/** The closing card after the last line; it is written, never spoken. */
export const closingLine = 'Vamos conversar sobre o que você está construindo.';
/** Seconds of image and sound after the last spoken line. */
export const tail = 3.5;

/**
 * The final voice track. Keep it in public/film/ (same origin: the site's
 * Content-Security-Policy only allows media from 'self'). `offset` shifts the
 * track against the film clock when it starts with silence of its own.
 */
export const voice: { src: string | null; offset: number } = { src: null, offset: 0 };

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

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
/** Onset of a word inside a line: measured when available, otherwise proportional to its position in the text. */
export function word(id: string, needle: string, occurrence = 1): number {
  const l = line(id);
  if (l.words && needle in l.words) return l.words[needle];
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
