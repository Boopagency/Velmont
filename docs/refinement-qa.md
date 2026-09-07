# Refinamento aprovado — 6 de setembro de 2026

## Escopo preservado

Hero, montanha, headline, identidade, paleta, direção tipográfica, estratégia de CTA e arquitetura da homepage preservadas. A hero foi reinspecionada no navegador após as alterações.

## Mudanças

- Três imagens autorais novas: produto com identidade dentro de um perímetro de propriedade; mecanismo industrial em vista explodida; aplicação digital organizada em camadas. As imagens são representações conceituais, não produtos ou casos de clientes. Nenhuma pessoa ou marca de cliente foi gerada.
- Derivados WebP em 640 e 1000 px, com dimensões declaradas e carregamento sob demanda. Os seis arquivos somam 222.940 bytes. A hero mantém seus arquivos originais.
- Parceiros reais em duas sequências idênticas; translação de exatamente 50% da faixa total, incluindo o espaço final de cada grupo. Ciclo linear de 58 segundos, com pausa manual, por hover, por foco, fora da área visível e quando a página fica oculta. Duplicação ignorada por leitores de tela.
- Logos ampliados, sem deformação, com normalização por CSS. O recorte da Quimitec remove a borda quadriculada presente no asset institucional; Arte em Foto recebe uma máscara suave para integrar o fundo decorativo.
- Cards editoriais compartilhados entre homepage e /insights, com imagem, categoria, título, resumo, tempo de leitura e CTA. Três colunas no desktop, destaque horizontal + dois cards no tablet, uma coluna no mobile. Conteúdo original desta implementação preservado; sem datas de publicação inventadas.
- FAQ: removida a herança do espaçamento negativo dos títulos nos botões; removidas animações concorrentes do catálogo; altura medida aplicada somente ao painel. Botões semânticos, IDs estáveis, aria-expanded, aria-controls, aria-labelledby, foco visível e um item aberto por vez.

## QA visual

Inspeção real no Chromium do navegador integrado. Foram usadas as larguras 1440, 1280, 1024, 768, 430, 390 e 360 px, com alturas entre 800 e 1024 px.

| Largura | Resultado |
|---|---|
| 1440 | Hero preservada; parceiros ampliados; grid e FAQ conferidos |
| 1280 | Patentes, cards e relação com o FAQ conferidos |
| 1024 | Software completo, três cards e dimensões dos serviços conferidos |
| 768 | Composição editorial com destaque e dois cards conferida |
| 430 | Marcas, parceiros e seis perguntas do FAQ conferidos |
| 390 | Cards, imagem e três frentes de software conferidos |
| 360 | Patentes, hub editorial, FAQ por teclado e logos sem movimento conferidos |

Em todas as larguras: nenhuma imagem carregada quebrada e nenhum excesso horizontal. Larguras dos grupos de logos idênticas em cada resolução; cards e imagens permanecem dentro da composição.

## QA funcional

- As seis perguntas foram abertas individualmente. Abrir outra fecha a anterior.
- Enter abre; Espaço fecha. Foco de teclado visível.
- Respostas longas verificadas: altura do painel igual à altura do conteúdo (160 px em 430; 214 px em 360), sem corte.
- Pausa e retomada manual do marquee testadas; estado de animação em execução observado fora do foco do controle.
- Três cards navegados até seus artigos, com H1 e corpo corretos; link para o hub editorial testado.
- CTA principal leva ao contato; dados sintéticos preparam o link correto do WhatsApp. Nenhuma mensagem enviada.
- Nenhum erro ou aviso de console nas verificações da aba final, incluindo hidratação.
- Estado de movimento reduzido testado em um servidor de QA isolado: condições CSS e matchMedia de redução simuladas, sem alterar a preferência global do sistema. Faixa vira grade estática, duplicatas e controle de animação somem, reveals ficam visíveis e o FAQ funciona sem transição. Esse harness não integra o build nem o repositório.

## Verificação automática e performance

TypeScript, lint e build estático passaram. O verificador cobre sete páginas, 107 links/recursos locais incluindo srcset, âncoras internas, metadata, H1, JSON-LD e orçamentos comprimidos.

JavaScript gzip: aproximadamente 120 KB; CSS gzip: aproximadamente 12 KB. Nenhuma dependência de carrossel adicionada. Movimento dos logos usa somente transformação CSS; observadores controlam pausa fora da tela.

Não foram executados Lighthouse, testes em aparelhos físicos ou Safari. A simulação de movimento reduzido valida os estados de CSS/React, não substitui uma mudança real de preferência do sistema operacional.

As medições desta revisão complementam e atualizam a inspeção inicial descrita em qa.md.
