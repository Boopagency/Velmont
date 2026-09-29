// Every moment of the film, named after the words that cause it. Image and
// sound read from the same table, so they cannot drift from the voice.
import { filmDuration, line, word } from './narration';

export type Found = { level: number; at: number; label: string; note: string; side: -1 | 1 };

function build() {
  const T = {
    point: 0.9,
    origem: line('origem').start,
    traco: word('traco', 'traço'),
    ideia: word('traco', 'ideia'),
    nome: word('traco', 'nome'),
    tracoEnd: line('traco').end,
    trabalho: line('trabalho').start,
    forma: word('camadas', 'forma'),
    produto: word('camadas', 'produto'),
    clientes: word('camadas', 'clientes'),
    usuarios: word('camadas', 'usuários'),
    reputacao: word('valor', 'reputação'),
    valor: word('valor', 'Ganha valor') + 0.35,
    balanco: word('valor', 'balanço'),
    valorEnd: line('valor').end,
    pergunta: line('pergunta').start,
    protegido: word('pergunta', 'protegido'),
    perguntaEnd: line('pergunta').end,
    olhar: line('olhar').start,
    marca: word('revelacao', 'marca'),
    desenho: word('revelacao', 'desenho'),
    software: word('revelacao', 'software'),
    invencao: word('revelacao', 'invenção'),
    prova: word('revelacao', 'prova'),
    primeiro: word('revelacao', 'primeiro'),
    revelacaoEnd: line('revelacao').end,
    documentos: word('ativos', 'documentos'),
    ativos: word('ativos', 'São ativos') + 0.3,
    ativosEnd: line('ativos').end,
    velmont: line('velmont').start,
    identifica: word('velmont', 'identifica'),
    riscos: word('velmont', 'riscos'),
    caminhos: word('velmont', 'caminhos'),
    velmontEnd: line('velmont').end,
    jornada: line('jornada').start,
    olhares: word('jornada', 'olhares'),
    conecta: word('jornada', 'conecta'),
    estruturar: word('jornada', 'estruturar'),
    crescer: word('jornada', 'crescer'),
    jornadaEnd: line('jornada').end,
    hoje: line('patrimonio').start,
    construindo: word('patrimonio', 'construindo'),
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
    [[1, 2], T.trabalho + 0.45],
    [[3, 4, 5], T.forma],
    [[6, 7, 8, 9], T.produto],
    [[10, 11, 12, 13], T.clientes],
    [[14, 15, 16, 17], T.usuarios],
    [[18, 19, 20], T.reputacao],
    [[21, 22, 23], T.valor],
  ];
  const reveal: number[] = [T.ideia];
  for (const [levels, at] of batches) levels.forEach((k, i) => { reveal[k] = at + i * 0.16; });

  // What the second look finds inside the same relief.
  const found: Found[] = [
    { level: 3, at: T.marca, label: 'MARCA', note: 'nome e identidade', side: -1 },
    { level: 7, at: T.desenho, label: 'DESENHO INDUSTRIAL', note: 'forma reconhecível', side: 1 },
    { level: 11, at: T.software, label: 'SOFTWARE', note: 'código e autoria', side: -1 },
    { level: 15, at: T.invencao, label: 'INVENÇÃO', note: 'patente', side: 1 },
    { level: 19, at: T.prova, label: 'ANTERIORIDADE', note: 'prova no tempo', side: -1 },
    { level: 22, at: T.primeiro + 0.75, label: 'TITULARIDADE', note: 'contratos e direitos', side: 1 },
  ];

  return { T, batches, reveal, found };
}

let memo: ReturnType<typeof build> | null = null;
export const cues = () => (memo ??= build());
