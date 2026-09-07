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
