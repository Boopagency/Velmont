# QA da entrega

Validação no navegador integrado, com o build estático servido em localhost. Inspeção real além da compilação.

## Resoluções

| Largura | Altura usada | Resultado |
|---|---:|---|
| 1440 | 900 e 1000 | Hero, serviços, fundadoras e insight inspecionados |
| 1280 | 800 | Hero e overflow conferidos |
| 1024 | 768 | Hero e overflow conferidos |
| 768 | 1024 | Hero, menu de tablet e serviço de marcas conferidos |
| 430 | 932 | Hero mobile e overflow conferidos |
| 390 | 844 | Hero, menu, formulário e FAQ testados |
| 360 | 800 | Hero e overflow conferidos |

Não foi observado excesso horizontal nas sete larguras. Os testes usam viewport CSS no Chromium integrado; não equivalem a testes físicos em todos os aparelhos ou em Safari.

## Interações verificadas

- Links da navegação levam às seções.
- Menu mobile abre e fecha; seleção de link fecha o menu.
- Seletor de interesse abre e permite escolher Software.
- Formulário com dados sintéticos prepara o link do WhatsApp oficial, incluindo nome, projeto e interesse corretamente codificados.
- O teste não abriu nem enviou a mensagem ao WhatsApp.
- FAQ abre a resposta e atualiza `aria-expanded`.
- Insight de software abre com título, corpo, referências e canonical próprios.
- Uma única H1 por rota e nenhuma imagem carregada quebrada nas inspeções.
- Motion ativo confirmado no navegador; parallax e progressão da narrativa respondem à rolagem. A regra de redução de movimento e a remoção dos listeners foram verificadas no código; não foi alterada a preferência global do sistema.

## Refinamentos realizados

1. Pico da montanha reposicionado no mobile para interceptar a primeira linha do título.
2. Menu compacto antecipado no tablet para evitar navegação quebrada em linhas.
3. Textos de leitura mobile ampliados.
4. Enquadramento de Danielle ajustado para preservar melhor a cabeça no retrato.
5. Seleção de parceiros refinada para uma faixa visual mais consistente, usando apenas logos reais extraídos do PDF.
6. CSS limitado aos componentes efetivamente usados: aproximadamente 204 KB → 49 KB sem compressão.
7. Definições de ambiente do bundle corrigidas; o erro inicial `process is not defined` não ocorre no bundle final.
8. Fallback sem JavaScript para o contato, sem submissão involuntária do formulário.

## Verificações automatizadas

- TypeScript sem erros.
- Lint da aplicação e dos dois controles de catálogo utilizados sem erros. O catálogo original de componentes não usados não faz parte desse escopo de lint.
- Build estático de 7 páginas concluído.
- Verificação de 87 links e recursos locais, metadata, uma H1 por página, JSON-LD válido, prioridade da hero e regra de reduced motion.
- JavaScript gzip: cerca de 120 KB; CSS gzip: cerca de 11 KB. Os valores exatos são impressos por `node scripts/verify.mjs` em cada build.
- Hero mobile WebP: aproximadamente 116 KB; desktop: aproximadamente 465 KB. Demais imagens usam lazy loading e dimensões explícitas.

Não foi executada uma auditoria Lighthouse de laboratório nem teste em aparelho físico. Nenhuma nota Lighthouse ou medição de Core Web Vitals é alegada.

## Operação

O artefato validado é `dist/`, sem backend. O caminho de build Workers do scaffold não foi validado, pois este host bloqueia subprocessos. O build estático executa localmente e é a opção configurada para entrega e deploy.

Para lançamento no domínio definitivo, definir `NEXT_PUBLIC_SITE_URL` no ambiente de build e conectar o domínio na plataforma escolhida. O preview privado permite revisão antes da abertura pública.
