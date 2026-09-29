# Motion e narrativa

## Hero

A montanha desloca-se no máximo 100 px no desktop. A tipografia de fundo e de primeiro plano usa velocidades diferentes. As informações e o CTA permanecem estáveis. O movimento só é atualizado enquanto a hero está próxima da área visível. Não há bloqueio ou captura da rolagem.

## Da ideia ao patrimônio

A rolagem atualiza uma progressão curta: ideia, estratégia e patrimônio. A linha de progresso e a mudança de cor reforçam a sequência. Todo o conteúdo continua existindo no HTML, inclusive sem JavaScript.

## Ritmo editorial

Títulos, conteúdo de serviços, etapas, depoimentos e retratos entram com translação curta de 24 px e opacidade. Cada elemento é observado uma vez. O processo mantém seu contexto visível em uma coluna sticky no desktop; não há seções presas por muitos segundos.

## Acessibilidade e desempenho

- `prefers-reduced-motion: reduce` remove translações, animações de entrada e scroll suave.
- A mudança da preferência é observada durante a sessão e os listeners são removidos.
- Sem JavaScript, não se aplica o atributo que esconde elementos antes da entrada.
- Scroll listener passivo, agrupamento em `requestAnimationFrame` e `IntersectionObserver`.
- Mobile elimina parallax e sticky da narrativa.
- Nenhum vídeo, canvas ou sequência de centenas de imagens é necessário.

## Filme Relevo

O filme em `/filme` é desenhado em canvas e só roda quando o visitante aperta o play. Não afeta a home. Com `prefers-reduced-motion`, os movimentos de câmera viram cortes. Ver `docs/brand-film.md`.

## Filme na home (logo após o hero)

`components/velmont/film-reel.tsx` e `app/film-reel.css`. Página: hero, filme, "A essência Velmont" e o restante. O link "Explore a Velmont" do hero chega ao filme já centralizado.

- **Entrada:** a seção fica sob o hero e o card sobe de baixo. O scroll alimenta duas variáveis CSS: `--reel-in` vai de 0 a 1 enquanto o topo da seção percorre a viewport (com easing cúbico) e controla translação de 20svh até 0, escala de 0,91 até 1, um `rotateX` de no máximo 4° e opacidade de 0,3 até 1.
- **Permanência:** o palco é `sticky`, com 58svh extras de scroll no desktop e 34svh no tablet. O card fica centralizado e o visitante pode parar para assistir. Nada o prende: continuar rolando libera a próxima seção.
- **Saída:** `--reel-out` reduz levemente a escala e a presença enquanto "A essência" entra por baixo.
- **Tempo do filme:** o scroll nunca controla o tempo do filme. O vídeo toca no tempo dele.
- **Reprodução:** autoplay sem som, com legendas, quando metade do card está visível. Pausa quando quase todo o card saiu (menos de 15% visível) e retoma de onde parou na volta. Se o visitante pausou, a pausa é respeitada.
- **Clique ou toque no filme:** a imagem inteira é uma área de play/pausa (`.reel-surface`), com um sinal breve no centro (≈0,7 s, fade e escala sutil). Os controles ficam em camadas acima dela, então clicar neles nunca aciona play/pausa. No fim, clicar na imagem recomeça o filme.
- **Controles:** play/pausa, legendas (CC, com `aria-pressed`), som, tela cheia e uma linha de progresso. A linha aceita clique, arraste e setas do teclado (1 s por seta). Durante a reprodução os controles ficam discretos e ganham presença com mouse, toque, foco, pausa ou fim. Atalhos com o foco no player: K (play/pausa), M (som), C (legendas) e F (tela cheia).
- **Som e legendas:** a primeira ativação do som recomeça do início (a narração só faz sentido desde a primeira frase) e desliga as legendas. Depois disso, som e legendas são escolhas independentes do visitante: nada recomeça e uma nunca muda a outra. "Assistir de novo" mantém essas escolhas.
- **Tela cheia:** o próprio card entra em tela cheia pela Fullscreen API, com os mesmos controles e legendas, sem reiniciar e sem perder tempo, som ou legenda. Em celulares há uma tentativa de travar em paisagem, sem erro se o navegador não permitir. No iPhone, onde só o `<video>` pode ir para tela cheia, entra o player nativo com o mesmo arquivo, o mesmo tempo e as mesmas legendas (a trilha VTT aparece se as legendas estiverem ligadas). Ao sair, o estado de som e reprodução é relido do vídeo.
- **Fim:** "Assistir de novo" e "Vamos conversar" (WhatsApp).
- **Carregamento:** nada de vídeo antes do evento `load`. Depois, a fonte é anexada quando a seção se aproxima (`preload=metadata`) e o buffer começa quando o card entra na tela. São 1080p no desktop e 720p (6,8 MB) em telas de até 900 px ou com economia de dados. O poster é um WebP de 46 KB, com `loading=lazy`, e se dissolve na abertura do filme. O card tem `aspect-ratio` fixo, então não há layout shift.
- **Mobile:** sem sticky. Só uma entrada curta (7svh, escala de 0,95 a 1), card com 12 px de margem e controles compactos, com área de toque de 44 px.
- **`prefers-reduced-motion`:** sem pinagem, translação, escala ou autoplay. O card fica parado, com o botão "Assistir ao filme", que toca com som e sem legenda. O player e a tela cheia continuam iguais.
- **Legendas editoriais:** `components/velmont/film/captions.ts`. São 25 ecos da narração, não uma transcrição. Cada um só aparece depois de a última palavra dele ter sido dita, e o que o próprio filme já escreve na tela (*protegido?*, rótulos, *ativos.*, parceiros, assinatura) fica com o filme. O player desenha as legendas na tipografia do site. `pnpm film:captions` gera `public/film/relevo-pt.vtt` (a mesma versão editorial, para a tela cheia nativa do iPhone) e `relevo-pt-integral.vtt` (transcrição completa, para YouTube ou LinkedIn). A narração completa está disponível para leitores de tela.
- **Servidor local:** `scripts/preview.mjs` responde a requisições `Range`, como a hospedagem. O Safari precisa delas para tocar vídeo, e todo navegador precisa delas para buscar uma posição.
