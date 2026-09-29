// Editorial captions for Relevo: echoes of the narration, not a transcript.
// Each cue appears only after its last word has been spoken, so the visitor
// hears (or senses) the idea first and reads its synthesis just after. Lines
// the film already writes on screen — "protegido?", the asset labels,
// "ativos.", the partners, the signature — are left to the film.
import { narration } from './narration';

export type Caption = { start: number; end: number; text: string };

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The moment a word has finished being said: its onset plus its length, never past the next word or the line's end. */
function spoken(id: string, needle: string, occurrence = 1): number {
  const line = narration.find(l => l.id === id);
  if (!line?.words) throw new Error(`No measured words for line ${id}`);
  let seen = 0;
  const i = line.words.findIndex(([w]) => fold(w) === fold(needle) && ++seen === occurrence);
  if (i < 0) throw new Error(`"${needle}" is not in narration line ${id}`);
  const [w, onset] = line.words[i];
  return Math.min(line.words[i + 1]?.[1] ?? line.end, onset + 0.1 + fold(w).length * 0.085);
}

const echo = 0.12; // a breath after the word, never before it
const cues: [line: string, afterWord: string, text: string, until?: number][] = [
  ['origem', 'traço', 'Tudo começa com um traço.'],
  ['traco', 'ideia', 'Uma ideia.'],
  ['traco', 'ainda', 'Um nome que ninguém conhece ainda.'],
  ['trabalho', 'trabalho', 'Então vem o trabalho.'],
  ['camadas', 'forma', 'O nome ganha forma.'],
  ['camadas', 'produto', 'A ideia vira produto.'],
  ['camadas', 'clientes', 'O produto encontra clientes.'],
  ['camadas', 'usuários', 'O código ganha usuários.'],
  ['valor', 'reputação', 'Reputação.'],
  ['valor', 'espaço', 'Reputação. Espaço.'],
  ['valor', 'valor', 'Reputação. Espaço. Valor.'],
  ['valor', 'balanço', 'Muito mais do que aparece no balanço.', 27.3],
  // The film writes "protegido?" itself: the caption only sets it up.
  ['pergunta', 'construiu', 'Quanto do que você construiu…', 30.3],
  ['olhar', 'novo', 'Olhe de novo.'],
  ['revelacao', 'primeiro', 'A prova de quem chegou primeiro.'],
  ['ativos', 'documentos', 'Não são apenas documentos.', 47.1],
  ['velmont', 'negócio', 'A Velmont olha para o negócio'],
  ['velmont', 'processo', 'antes de olhar para o processo.'],
  ['clareza', 'existe', 'Identifica o que existe.'],
  ['clareza', 'riscos', 'Analisa os riscos.'],
  ['clareza', 'possíveis', 'Mostra, com clareza, os caminhos possíveis.'],
  ['jornada', 'olhares', 'Quando a jornada pede outros olhares,'],
  ['jornada', 'especialistas', 'conecta você a especialistas.'],
  ['patrimonio', 'hoje', 'Porque aquilo que você está construindo hoje…'],
  ['patrimonio', 'patrimônio', '…pode se tornar o patrimônio', 72.5],
];

export const editorialCaptions: Caption[] = cues
  .map(([id, word, text, until]) => ({ start: +(spoken(id, word) + echo).toFixed(2), until, text }))
  .map((cue, i, all) => {
    const next = all[i + 1]?.start ?? Infinity;
    const end = cue.until ?? Math.min(next - 0.05, cue.start + 2.4);
    return { start: cue.start, end: +end.toFixed(2), text: cue.text };
  });

/** The cue on screen at time t, if any. */
export function captionAt(t: number): Caption | null {
  for (const cue of editorialCaptions) if (t >= cue.start && t < cue.end) return cue;
  return null;
}
