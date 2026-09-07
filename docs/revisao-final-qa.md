# Revisão final — 6 de setembro de 2026

## Correções
- Hero: tamanhos baseados apenas na largura colidiam com posições dependentes da altura. Variáveis compartilhadas agora relacionam as duas linhas à largura e à altura. Entrada tipográfica sem deslocamento; montanha, fontes, paleta e composição preservadas.
- Compromisso: removido clip-path do fundo e observação da seção inteira; geometria estável com entrada discreta somente no conteúdo.
- Ícones: setas, estrelas e controles em SVG, sem fonte de emoji. MIME de SVG corrigido no preview.
- Fotos: retratos reais novos, WebP em duas larguras, enquadramento individual sem distorção.
- Depoimentos: três relatos exatos do usuário, estrelas vetoriais, iniciais e link seguro para o Google.
- Semântica: H2 da narrativa conserva estilo anterior; páginas internas ganham skip link e breadcrumbs.

## QA visual
Chromium do navegador integrado: hero inspecionada em 375×812, 390×844, 430×932, 768×1024, 1024×768, 1280×720, 1440×900 e 1920×890. Sem overflow horizontal da página ou colisão visual das linhas. Em notebooks a hero pode ultrapassar a dobra para preservar CTA e legibilidade.

Narrativa, serviços, compromisso, depoimentos, fundadoras e seção editorial também inspecionados em desktop/mobile, além de artigos e 404. A seção de compromisso em viewport 430 px manteve altura 810,10 px e largura 415,20 px nos pontos de scroll 5872 e 6407,20; clip-path e transform permaneceram none.

Menu abre/fecha; Escape fecha e devolve foco. FAQ abre e atualiza aria-expanded. Paginação chega ao card Boop e atualiza indicador. Formulário prepara a URL correta do WhatsApp; nenhum contato foi enviado no QA.

Movimento reduzido simulado em servidor local isolado, ativando a preferência na lógica JS e no CSS: nenhum conteúdo de entrada oculto e hero sem animação. Isso não equivale a testar a preferência nativa do sistema operacional.

Safari/iOS, Firefox, Edge e Android físicos não estavam disponíveis. SVG elimina a dependência da fonte de emoji; svh e movimento reduzido foram tratados. Recomenda-se rodada nesses motores e dispositivos antes do lançamento público.

## Verificações técnicas e performance
Build com sete páginas; verificador de 160 links/recursos, H1 único, IDs, âncoras, JSON-LD, sitemap de seis URLs e limites de bundle. TypeScript e lint sem erros.

HTTP local: páginas, sitemap, robots e SVG retornam 200; rota inexistente retorna 404/noindex. Sem erros ou avisos de console no artigo inspecionado. Canonical consolida variantes; convenção de URLs em `seo-geo.md`.

As mesmas fontes passaram de 235.432 bytes TTF para 53.216 bytes WOFF2 Latin: redução de 77,4%. JavaScript comprimido aproximadamente 127 KB, CSS 16 KB, abaixo dos limites locais de 160 e 25 KiB. Quatro versões das fotos novas somam cerca de 227 KB; navegador seleciona a largura adequada. Hero prioritária, fontes locais, dimensões de imagem, lazy loading abaixo da dobra e ausência de scripts publicitários preservados.

Não foi atribuída nota Lighthouse nem alegado resultado de Core Web Vitals em campo. Essas métricas exigem medição na hospedagem pública e em dispositivos reais.

## Arquivos principais
`app/final-review.css`, `app/globals.css`, `app/polish.css`, `components/velmont/home.tsx`, `icons.tsx`, `testimonials.tsx`, `article-view.tsx`, `breadcrumbs.tsx`, `content/testimonials.ts`, `content/faqs.ts`, `content/insights.ts`, `lib/seo.ts`, `lib/site.ts`, `scripts/build-static.mjs`, `scripts/verify.mjs`, fontes e retratos em `public/`.

## Pendências externas
Vídeo/foto conjunta permanece reservado: o ZIP contém somente retratos individuais. Datas editoriais precisam de confirmação. Domínio público, Search Console, Business Profile e medições reais estão em `seo-geo.md`.

O remoto GitHub continua sendo Boopagency/Velmont. O envio depende de acesso da integração (403 na rodada anterior). Sites utiliza seu próprio repositório e fluxo de publicação.
