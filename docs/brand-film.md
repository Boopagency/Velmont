# Relevo — brand film

Um filme de marca de cerca de 80 segundos, construído em torno da narração, para o site da Velmont (`/filme`).

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

## Narração

A locução final aprovada (voz Adriana, ElevenLabs) está em `public/film/narracao.mp3`, sem nenhuma alteração no arquivo.

> Tudo começa com um traço. Uma ideia. Um nome que ninguém conhece ainda.
> Então vem o trabalho. O nome ganha forma. A ideia vira produto. O produto encontra clientes. O código ganha usuários.
> E aquilo que começou pequeno ganha reputação. Ganha espaço. Ganha valor. Muito mais valor do que aquilo que aparece no balanço.
> Mas quanto do que você construiu está, de fato, protegido?
> Olhe de novo.
> Existe uma marca. Um desenho reconhecível. Um software com autoria. Uma invenção. A prova de quem chegou primeiro.
> Não são apenas documentos. São ativos.
> A Velmont olha para o negócio antes de olhar para o processo.
> Identifica o que existe. Analisa os riscos. E mostra, com clareza, os caminhos possíveis.
> E quando a jornada pede outros olhares, conecta você a especialistas que ajudam o negócio a se estruturar e crescer.
> Porque aquilo que você está construindo hoje pode se tornar o patrimônio da sua empresa amanhã.
> Velmont. Protegendo ideias. Estruturando negócios.

### Medição

- **Frases e pausas:** medidas pela energia do próprio áudio (`pnpm film:align public/film/narracao.mp3`).
- **Palavras:** o instante de cada uma veio de reconhecimento de fala (Whisper small, rodado offline) e foi corrigido contra as fronteiras de energia. O reconhecimento adiantava todas as palavras em cerca de 0,15 s de forma constante.
- **Onde ficam:** todas as palavras, com o seu instante no filme, estão em `narration.ts`.

### Montagem da voz

A locução é contínua, com pausas de 0,3 a 0,7 s. Para que a pergunta e as viradas tenham peso, o filme posiciona a voz frase por frase (`voice.clips`). Os cortes ficam sempre no meio de um silêncio, nunca dentro de uma palavra, e nada da fala é removido. O filme ganha respiro:

| Onde | Respiro acrescentado |
|---|---|
| Antes da primeira palavra | 1,8 s (o ponto aparece, uma respiração) |
| Depois de "…no balanço." | 0,6 s |
| Depois de "…protegido?" | 1,6 s (≈ 2,2 s de silêncio real) |
| Depois de "Olhe de novo." | 0,4 s |
| Depois de "São ativos." | 0,6 s |
| Antes de "Porque aquilo…" | 0,4 s |
| Antes de "Velmont." | 0,4 s |

Duração final: 79,9 s (71,1 s de voz, 4 s de respiros, abertura e 3,3 s de fecho).

## Como a voz comanda o filme

Cada acontecimento visual ou sonoro está ancorado em uma **palavra** falada (`cues.ts`), nunca em um segundo fixo. As mudanças de intenção da voz são os pontos de edição:

- **"Então vem o trabalho."** A câmera decola na palavra *trabalho*, com impacto grave. Entra um pulso rítmico que subdivide o tempo entre as orações e respira com a fala.
- **"Ganha reputação. Ganha espaço. Ganha valor."** Três golpes crescentes e precisos. Em cada um, novas camadas surgem, o relevo sobe um degrau, a câmera dá um pequeno avanço e entra um acorde curto.
- **"…aparece no balanço."** Vista de perfil e a linha do balanço. A palavra BALANÇO aparece pequena, como eco, só depois de ouvida.
- **"Mas quanto… protegido?"** A música sai no "Mas". As linhas se apagam enquanto a pergunta avança. *protegido?* só surge quando a frase termina e fica em silêncio real, com um grave quase inaudível.
- **"Olhe de novo."** Corte seco na primeira sílaba: nova composição, impacto, mudança de ré menor para ré maior. A leitura das camadas começa e os rótulos entram logo depois de cada palavra.
- **"Não são apenas documentos. São ativos."** O ar sobe até *ativos*, com impacto e sinos. Todas as camadas acendem como ativos, e a palavra *ativos.* aparece na pausa que segue, como eco.
- **"A Velmont olha…"** O acorde da marca entra no nome. A câmera assume o ponto de vista de cima, e a folha do mapa, com VELMONT, se desenha enquanto o nome é dito. Um pulso lento acompanha a clareza.
- **"…outros olhares…"** O mapa se abre. Bwise em *estruturar*, Boop em *crescer*.
- **"Porque aquilo que você está construindo hoje…"** Começa a resolução: a câmera mergulha até o horizonte. Em *hoje*, o cume volta a ser o ponto inicial, em imagem e em som. Em *patrimônio*, a montanha surge com o acorde completo.
- **"Velmont. Protegendo ideias. Estruturando negócios."** Logo exatamente em *Velmont*, e as duas frases entram logo após serem ditas. Depois, o ponto e a frase escrita final.

### Texto em tela

A narração nunca é legendada na imagem. O texto em tela é eco, e sempre depois da fala: *BALANÇO*, *protegido?*, os rótulos da leitura (que acrescentam o que a voz não diz, como titularidade e anterioridade), *ativos.*, os verbos e nomes do ecossistema, a assinatura e a frase final. As legendas completas existem apenas como recurso de acessibilidade, desligadas por padrão.

## Sound design e mixagem

Todo o som além da voz é sintetizado no navegador (`sound.ts`) e agendado pela mesma tabela de palavras.

A mixagem é cinematográfica, não de podcast. Voz, trilha e efeitos dividem o mesmo espaço (a voz recebe um pouco da mesma reverberação). A trilha só se afasta cerca de 2 dB durante a fala, e impactos, golpes e acordes ficam, em vários momentos, acima da voz.

Medições da mixagem final:
- **Loudness:** cerca de −15,6 LUFS integrados. Voz sozinha em −16,2 e trilha e efeitos em −20,4.
- **Faixa da fala (300 Hz–4 kHz):** a voz fica 3 a 10 dB acima da trilha, o que a mantém inteligível enquanto graves, impactos e ambiência dão corpo.
- **Proteção:** um compressor leve de "cola" e um limitador de picos.

Camadas:
- **Silêncio com textura:** room tone sempre presente, que recua na pergunta.
- **Gestos físicos:** grafite no papel, cliques de identificação, respirações antes da primeira fala e antes da virada.
- **Construção:** uma nota por camada, acordes que sobem em ré menor, pulso rítmico e três golpes.
- **Revelação e clareza:** ré maior, sinos posicionados no estéreo conforme o rótulo em tela, o acorde da marca e um pulso lento.
- **Resolução:** pedal grave, *swell* até *patrimônio*, acorde pleno, sino na assinatura e o som do ponto inicial no fim.

## Direção de arte

- Paleta do site: fundo tinta e vinho, linhas em marfim e identificação em champanhe (acento, não dourado). Manrope para rótulos, Instrument Serif para as palavras em destaque.
- Composições próprias do filme: não reproduz seções, cards nem rolagem do site. A montanha e o logo aparecem só no desfecho, como matéria da marca.
- Evitados de propósito: cadeados, escudos, balança, martelo, gráficos crescendo, partículas decorativas, glow e hologramas. A ideia de proteção é conceitual: identificar, delimitar, ler o terreno.
- Grão fílmico leve e vinheta. Formato 16:9, desenhado em tempo real, nítido em qualquer resolução.

## Parceiros

Os logos oficiais enviados pela Velmont estão em `public/film/partners/` (`bwise.png`, `boop.png`), sem nenhuma alteração. Na cena das parcerias, os três aparecem na mesma linha óptica, sob cada verbo:

- **Velmont** (centro): o logo original, em champanhe. Continua sendo a marca protagonista.
- **Bwise** e **Boop**: em versão de uma cor, em marfim, calculada no momento da exibição a partir dos arquivos originais. Assim ficam na paleta do filme sem que o verde e o azul pesem mais que a própria Velmont. A Bwise usa a silhueta do logo. A Boop usa dois tons chapados, para os olhos continuarem legíveis: letras e olhos em marfim cheio, corpos a meia intensidade, pupilas vazadas.

Nada é redesenhado. Para usar as cores originais ou outro arquivo, basta alterar `partnerLogos` em `narration.ts` (`src`, `tone`, `height`). Com `null`, o parceiro volta a ser nomeado em texto.

## Acessibilidade

- O filme nunca começa sozinho: o som exige um gesto do visitante.
- Legendas sob demanda (`C`) e narração completa em texto na página.
- Controles por teclado: espaço/`K` reproduz e pausa, setas avançam e voltam 5 s, `M` silencia, `F` abre tela cheia, `Home` volta ao início.
- `prefers-reduced-motion`: os movimentos de câmera viram cortes com uma breve passagem pelo preto; nada gira nem voa.
- Sem JavaScript, a página mantém o texto da narração.

## Exportar em vídeo

`pnpm build && FFMPEG=/caminho/ffmpeg pnpm film:render relevo.mp4 --downscale 1920` exporta o filme quadro a quadro, com imagem idêntica à do site e som mixado offline (inclui a voz quando houver):

- **Master em 4K** (3840×2160, H.264 High, CRF 16). Como o filme é desenhado por código, cada quadro é gerado de fato em 4K, e não ampliado.
- **Cópia Full HD** (`relevo-1920.mp4`), reduzida do 4K com filtro Lanczos. A redução funciona como supersampling: linhas finas e tipografia saem mais nítidas do que em uma renderização direta em 1080p.

Opções: `--width`, `--fps`, `--crf`, `--quality` (JPEG intermediário), `--captions` (legendas gravadas na imagem) e `--audio-only mix.wav`. O único limite de nitidez é a fotografia da montanha, que tem 1536 px de largura.

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
| `scripts/film-align.mjs` | Mede frases e silêncios de uma faixa de voz (pontos de corte) |
| `scripts/film-render.mjs` | Exporta MP4/WAV |
