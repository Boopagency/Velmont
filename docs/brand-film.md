# Relevo — brand film

Um filme de marca de cerca de 74 segundos, construído em torno da narração, para o site da Velmont (`/filme`).

## Ideia

**Relevo** tem dois sentidos: o desenho de um terreno em curvas de nível e a importância de algo ("de relevo"). O filme usa uma única matéria visual, linhas de contorno, e acompanha a transformação de um ponto em uma montanha:

1. **Um ponto.** Algo que ainda não tem valor aparente.
2. **Um traço, um anel.** A ideia ganha forma; um nome aparece como sete espaços vazios ainda sem letras.
3. **Camadas.** Cada frase da narração acrescenta anéis. O relevo cresce e ganha altura. O ponto original vira o cume.
4. **O balanço.** Vista de perfil: uma linha reta, o que aparece no balanço, sob tudo o que foi construído.
5. **A pergunta.** A trilha sai. As linhas quase se apagam. Uma palavra: *protegido?*. Depois, silêncio de verdade.
6. **O segundo olhar.** Um plano de leitura desce camada por camada, e algumas camadas se revelam: marca, desenho industrial, software, invenção, anterioridade, titularidade. Elas sempre estiveram ali. *ativos.*
7. **Clareza.** Vista de cima, como um mapa: o que existe está identificado, o risco aparece hachurado e caminhos possíveis sobem ao cume. Não há promessa de chegada, e sim caminhos.
8. **Outros olhares.** O mapa se abre para duas folhas vizinhas: a estrutura ortogonal (**Bwise**, contabilidade e estrutura empresarial) e o alcance em expansão (**Boop**, marca, digital e crescimento). A Velmont permanece no centro: *proteger*. Os parceiros entram no ponto da narração que pede outros olhares, de forma breve e em tipografia, sem aparecer como uma parede de patrocinadores.
9. **Patrimônio.** A câmera desce ao horizonte e o desenho vira matéria: a montanha da Velmont surge por dentro das linhas.
10. **Assinatura e retorno.** Logo, *Protegendo ideias. Estruturando negócios.* Então tudo volta a ser um ponto, com a última frase escrita: *Vamos conversar sobre o que você está construindo.*

A progressão emocional é simples, crescimento, tensão, percepção, clareza e resolução, e é sempre contada do lado do visitante: "o que você está construindo", não "o que nós fazemos".

## Narração (roteiro)

O texto está em `components/velmont/film/narration.ts`. É a partir dele que a locução deve ser gravada.

> Tudo começa pequeno.
> Um traço. Uma ideia. Um nome que ninguém conhece ainda.
> Então vem o trabalho.
> O nome ganha forma. A ideia vira produto. O produto encontra clientes. O código ganha usuários.
> E o que começou pequeno ganha reputação. Ganha valor. Muito mais do que aparece no balanço.
> *(silêncio)*
> Mas quanto do que você construiu está, de fato, protegido?
> *(silêncio longo: a virada)*
> Olhe de novo.
> Existe uma marca. Um desenho reconhecível. Um software com autoria. Uma invenção. A prova de quem chegou primeiro.
> Não são só documentos. São ativos.
> A Velmont olha para o negócio antes do processo: identifica o que existe, analisa riscos e mostra, com clareza, os caminhos possíveis.
> Quando a jornada pede outros olhares, conecta você a especialistas que ajudam a estruturar e a crescer.
> O que você está construindo hoje pode ser o patrimônio de amanhã.
> Velmont. Protegendo ideias. Estruturando negócios.

Direção de locução: voz próxima, sem tom publicitário, ritmo calmo (cerca de 6 sílabas por segundo), respeitando as pausas entre as frases. As duas pausas marcadas são parte do filme e não devem ser cortadas na edição da voz.

O texto em tela complementa a voz em vez de legendá-la. Uma palavra (*protegido?*, *ativos.*), rótulos que a voz não diz (titularidade, anterioridade) e nomes que só aparecem escritos (Bwise, Boop).

## Como a voz comanda o filme

- Cada linha da narração tem `start` e `end`. Cada acontecimento visual ou sonoro está ancorado em uma **palavra** de uma linha (`word('revelacao', 'software')`, em `cues.ts`), nunca em um segundo fixo.
- Enquanto a voz final não existe, os tempos são uma estimativa. Com a faixa real, só a tabela muda, e imagem, cortes, palavras em tela e som se reposicionam juntos.
- Dentro de uma linha, a palavra é posicionada proporcionalmente ao texto. Quando for necessário precisão maior, `words: { software: 37.42 }` fixa o instante medido.

### Ao receber a faixa de voz

1. Salve o arquivo em `public/film/` (por exemplo `public/film/narracao.mp3`). A política de segurança do site só aceita mídia da própria origem.
2. `pnpm build` e depois `pnpm film:align public/film/narracao.mp3` mostram os tempos medidos de cada linha.
3. Confira as fronteiras e rode `pnpm film:align public/film/narracao.mp3 --write`: os tempos são gravados em `narration.ts` e `voice.src` passa a apontar para o arquivo.
4. Ajuste fino, se preciso: `words` para palavras-chave, `voice.offset` se a faixa tiver silêncio inicial próprio.
5. Com a voz presente, as legendas passam a ficar desligadas por padrão, a nota de prévia some e a página `/filme` passa a ser indexada e a entrar no sitemap.

## Sound design

Todo o som é sintetizado no navegador (`sound.ts`), sem trilhas de terceiros, e agendado pela mesma tabela de tempos:

- **Silêncio com textura:** room tone de ruído grave filtrado, sempre presente, que baixa quase a zero na pausa depois da pergunta.
- **Gestos físicos:** grafite no papel no primeiro traço e no anel, nos caminhos e nas hachuras; cliques secos quando cada camada é identificada; uma respiração antes do primeiro som e outra antes da virada.
- **Construção musical:** cada camada acrescenta uma nota (pluck). Os acordes sobem com o negócio, em ré menor, até uma dominante que não resolve. Um pequeno impacto grave marca cada frase.
- **Tensão e corte:** na pergunta, um ruído ascendente e uma nota sustentada param de uma vez na palavra *protegido*. Segue silêncio.
- **Revelação:** um impacto grave em *Olhe de novo*, e o filme passa para ré maior. Sinos discretos, posicionados à esquerda ou à direita conforme o rótulo em tela, acompanham cada ativo encontrado.
- **Clareza e ecossistema:** acordes abertos. Na abertura do mapa, uma nota à esquerda (estruturar) e outra à direita (crescer) alargam o campo estéreo.
- **Resolução:** um pedal grave, ré maior completo quando a montanha aparece, um sino na assinatura e, no fim, o mesmo som do ponto inicial.
- **A voz na frente:** a música abaixa cerca de 3,5 dB automaticamente sempre que há fala (ducking pela tabela de tempos) e tudo passa por um compressor suave.

Mix sem voz: pico de −4,5 dBFS e cerca de −26 LUFS integrados, deixando espaço para a locução ficar em torno de −16 LUFS.

## Direção de arte

- Paleta do site: fundo tinta e vinho, linhas em marfim e identificação em champanhe (acento, não dourado). Manrope para rótulos, Instrument Serif para as palavras em destaque.
- Composições próprias do filme: não reproduz seções, cards nem rolagem do site. A montanha e o logo aparecem só no desfecho, como matéria da marca.
- Evitados de propósito: cadeados, escudos, balança, martelo, gráficos crescendo, partículas decorativas, glow e hologramas. A ideia de proteção é conceitual: identificar, delimitar, ler o terreno.
- Grão fílmico leve e vinheta. Formato 16:9, desenhado em tempo real, nítido em qualquer resolução.

## Parceiros

Não havia logos oficiais da Bwise e da Boop no projeto, e o filme não recria logos. Os nomes aparecem na tipografia do filme. Quando os arquivos oficiais chegarem, salve-os em `public/film/partners/` e preencha `partnerLogos` em `narration.ts`. O filme passa a usar as imagens nesse momento.

## Acessibilidade

- O filme nunca começa sozinho: o som exige um gesto do visitante.
- Legendas sob demanda (`C`) e narração completa em texto na página.
- Controles por teclado: espaço/`K` reproduz e pausa, setas avançam e voltam 5 s, `M` silencia, `F` abre tela cheia, `Home` volta ao início.
- `prefers-reduced-motion`: os movimentos de câmera viram cortes com uma breve passagem pelo preto; nada gira nem voa.
- Sem JavaScript, a página mantém o texto da narração.

## Exportar em vídeo

`pnpm build && FFMPEG=/caminho/ffmpeg pnpm film:render relevo.mp4 [--width 1920] [--fps 30] [--captions]` exporta um MP4 quadro a quadro (imagem idêntica à do site) com o som mixado offline, incluindo a voz quando houver. `--audio-only mix.wav` exporta só o áudio.

## Arquivos

| Arquivo | Papel |
|---|---|
| `components/velmont/film/narration.ts` | Roteiro, tempos da voz, faixa de voz, logos de parceiros |
| `components/velmont/film/cues.ts` | Momentos do filme ancorados em palavras |
| `components/velmont/film/relief.ts` | Relevo procedural e curvas de nível |
| `components/velmont/film/render.ts` | Câmera e desenho de cada quadro (função pura do tempo) |
| `components/velmont/film/sound.ts` | Sound design sintetizado (tempo real e offline) |
| `components/velmont/film/film-player.tsx` | Player acessível |
| `components/velmont/film/film-page.tsx` | Página `/filme` |
| `scripts/film-align.mjs` | Mede a voz e grava os tempos |
| `scripts/film-render.mjs` | Exporta MP4/WAV |
