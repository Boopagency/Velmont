// Editorial captions for Relevo: short syntheses of the narration, not a full
// transcript. Each cue appears as its first word is spoken — never before —
// and stays until shortly after its last word, so reading keeps pace with the
// voice. Lines the film already writes on screen — "protegido?", the asset
// labels, "ativos.", the partners, the signature — are left to the film.
import { narration } from './narration';

export type Caption = { start: number; end: number; text: string };

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Onset of a word in a line, and the moment it has finished being said. */
function word(id: string, needle: string, occurrence = 1): { onset: number; done: number } {
  const line = narration.find(l => l.id === id);
  if (!line?.words) throw new Error(`No measured words for line ${id}`);
  let seen = 0;
  const i = line.words.findIndex(([w]) => fold(w) === fold(needle) && ++seen === occurrence);
  if (i < 0) throw new Error(`"${needle}" is not in narration line ${id}`);
  const [w, onset] = line.words[i];
  return { onset, done: Math.min(line.words[i + 1]?.[1] ?? line.end, onset + 0.1 + fold(w).length * 0.085) };
}

const lead = 0.05; // appears with the first syllable, never ahead of it
const hold = 0.8; // stays a moment after the last word
const cues: [line: string, firstWord: string, lastWord: string, text: string, until?: number][] = [
  ['origem', 'tudo', 'traço', 'Tudo começa com um traço.'],
  ['traco', 'uma', 'ideia', 'Uma ideia.'],
  ['traco', 'um', 'ainda', 'Um nome que ninguém conhece ainda.'],
  ['trabalho', 'então', 'trabalho', 'Então vem o trabalho.'],
  ['camadas', 'nome', 'forma', 'O nome ganha forma.'],
  ['camadas', 'ideia', 'produto', 'A ideia vira produto.'],
  ['camadas', 'encontra', 'clientes', 'O produto encontra clientes.'],
  ['camadas', 'código', 'usuários', 'O código ganha usuários.'],
  ['valor', 'reputação', 'reputação', 'Reputação.'],
  ['valor', 'espaço', 'espaço', 'Reputação. Espaço.'],
  ['valor', 'valor', 'valor', 'Reputação. Espaço. Valor.'],
  ['valor', 'muito', 'balanço', 'Muito mais do que aparece no balanço.'],
  // The film writes "protegido?" itself: the caption only sets it up.
  ['pergunta', 'quanto', 'construiu', 'Quanto do que você construiu…', 30.3],
  ['olhar', 'olhe', 'novo', 'Olhe de novo.'],
  ['revelacao', 'prova', 'primeiro', 'A prova de quem chegou primeiro.'],
  ['ativos', 'não', 'documentos', 'Não são apenas documentos.'],
  ['velmont', 'velmont', 'negócio', 'A Velmont olha para o negócio'],
  ['velmont', 'antes', 'processo', 'antes de olhar para o processo.'],
  ['clareza', 'identifica', 'existe', 'Identifica o que existe.'],
  ['clareza', 'analisa', 'riscos', 'Analisa os riscos.'],
  ['clareza', 'mostra', 'possíveis', 'Mostra, com clareza, os caminhos possíveis.'],
  ['jornada', 'quando', 'olhares', 'Quando a jornada pede outros olhares,'],
  ['jornada', 'conecta', 'especialistas', 'conecta você a especialistas.'],
  ['patrimonio', 'porque', 'hoje', 'Porque aquilo que você está construindo hoje…'],
  ['patrimonio', 'pode', 'patrimônio', '…pode se tornar o patrimônio', 72.5],
];

export const editorialCaptions: Caption[] = cues
  .map(([id, first, last, text, until]) => ({ start: word(id, first).onset + lead, finish: word(id, last).done + hold, until, text }))
  .map((cue, i, all) => {
    const next = all[i + 1]?.start ?? Infinity;
    const end = Math.min(cue.until ?? cue.finish, next - 0.05);
    return { start: +cue.start.toFixed(2), end: +end.toFixed(2), text: cue.text };
  });

/** The cue on screen at time t, if any. */
export function captionAt(t: number): Caption | null {
  for (const cue of editorialCaptions) if (t >= cue.start && t < cue.end) return cue;
  return null;
}
