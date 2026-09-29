// Every moment of the film, named after the words that cause it. Image and
// sound read from the same table, so they cannot drift from the voice.
import { filmDuration, line, word } from './narration';

export type Found = { level: number; at: number; label: string; note: string; side: -1 | 1 };

function build() {
  const T = {
    point: 0.55,
    origem: line('origem').start,
    traco: word('origem', 'traço'),
    ideia: word('traco', 'ideia'),
    nome: word('traco', 'nome'),
    tracoEnd: line('traco').end,
    trabalho: line('trabalho').start,
    // "Então vem o trabalho." — the construction gains energy on the last word.
    trabalhoWord: word('trabalho', 'trabalho'),
    forma: word('camadas', 'forma'),
    produto: word('camadas', 'produto'),
    clientes: word('camadas', 'clientes'),
    usuarios: word('camadas', 'usuários'),
    // "Ganha reputação. Ganha espaço. Ganha valor." — three precise, rising hits.
    reputacao: word('valor', 'reputação'),
    espaco: word('valor', 'espaço'),
    valor: word('valor', 'valor'),
    muito: word('valor', 'muito'),
    balanco: word('valor', 'balanço'),
    valorEnd: line('valor').end,
    pergunta: line('pergunta').start,
    protegido: word('pergunta', 'protegido'),
    perguntaEnd: line('pergunta').end,
    // "Olhe de novo." — a hard cut on the first syllable.
    olhar: line('olhar').start - 0.04,
    marca: word('revelacao', 'marca'),
    desenho: word('revelacao', 'desenho'),
    software: word('revelacao', 'software'),
    invencao: word('revelacao', 'invenção'),
    prova: word('revelacao', 'prova'),
    primeiro: word('revelacao', 'primeiro'),
    revelacaoEnd: line('revelacao').end,
    documentos: word('ativos', 'documentos'),
    ativos: word('ativos', 'ativos'),
    ativosEnd: line('ativos').end,
    velmont: line('velmont').start,
    velmontWord: word('velmont', 'Velmont'),
    olha: word('velmont', 'olha'),
    processo: word('velmont', 'processo'),
    velmontEnd: line('velmont').end,
    identifica: word('clareza', 'identifica'),
    riscos: word('clareza', 'riscos'),
    caminhos: word('clareza', 'caminhos'),
    clarezaEnd: line('clareza').end,
    jornada: line('jornada').start,
    olhares: word('jornada', 'olhares'),
    conecta: word('jornada', 'conecta'),
    estruturar: word('jornada', 'estruturar'),
    crescer: word('jornada', 'crescer'),
    jornadaEnd: line('jornada').end,
    // "Porque aquilo que você está construindo hoje…" — the resolution begins.
    hoje: line('patrimonio').start,
    construindo: word('patrimonio', 'construindo'),
    hojeWord: word('patrimonio', 'hoje'),
    patrimonio: word('patrimonio', 'patrimônio'),
    amanha: word('patrimonio', 'amanhã'),
    patrimonioEnd: line('patrimonio').end,
    assinatura: line('assinatura').start,
    protegendo: word('assinatura', 'Protegendo'),
    estruturando: word('assinatura', 'Estruturando'),
    assinaturaEnd: line('assinatura').end,
    end: filmDuration(),
  };

  // The layers the business builds, one batch per clause of the narration.
  const batches: [number[], number][] = [
    [[1, 2], T.trabalhoWord],
    [[3, 4, 5], T.forma],
    [[6, 7, 8, 9], T.produto],
    [[10, 11, 12, 13], T.clientes],
    [[14, 15, 16, 17], T.usuarios],
    [[18, 19], T.reputacao],
    [[20, 21], T.espaco],
    [[22, 23], T.valor],
  ];
  const reveal: number[] = [T.ideia];
  for (const [levels, at] of batches) levels.forEach((k, i) => { reveal[k] = at + i * 0.12; });

  // What the second look finds inside the same relief.
  const found: Found[] = [
    { level: 3, at: T.marca + 0.2, label: 'MARCA', note: 'nome e identidade', side: -1 },
    { level: 7, at: T.desenho + 0.2, label: 'DESENHO INDUSTRIAL', note: 'forma reconhecível', side: 1 },
    { level: 11, at: T.software + 0.2, label: 'SOFTWARE', note: 'código e autoria', side: -1 },
    { level: 15, at: T.invencao + 0.2, label: 'INVENÇÃO', note: 'patente', side: 1 },
    { level: 19, at: T.prova + 0.2, label: 'ANTERIORIDADE', note: 'prova no tempo', side: -1 },
    { level: 22, at: T.primeiro + 0.55, label: 'TITULARIDADE', note: 'contratos e direitos', side: 1 },
  ];

  return { T, batches, reveal, found };
}

let memo: ReturnType<typeof build> | null = null;
export const cues = () => (memo ??= build());
