# SEO, GEO e lançamento

`lib/seo.ts` centraliza títulos, descrições, canonical, imagens sociais e schema. Todas as páginas estáticas entregam conteúdo e metadata no HTML, sem depender de JavaScript para indexação.

## Implementação
O grafo relaciona Organization/ProfessionalService, WebSite, WebPage/CollectionPage, Person para as fundadoras, Service e FAQPage correspondente ao FAQ visível. Artigos recebem BlogPosting e BreadcrumbList. A 404 é noindex; o sitemap automático reúne seis URLs válidas.

Avaliações reais permanecem visíveis, sem Review ou aggregateRating autorreferente. Referência: [política de avaliações do Google](https://developers.google.com/search/blog/2019/09/making-review-rich-results-more-helpful).

Há um H1 por página, informações institucionais factuais, contato consistente e links entre serviços, artigos e análise estratégica. Essa organização facilita a compreensão por mecanismos generativos, sem promessa de citações. Referência: [recursos de IA e sites](https://developers.google.com/search/docs/appearance/ai-features).

Datas editoriais são opcionais até confirmação. Autoria institucional, imagem, breadcrumb e fontes estão presentes. Referência: [orientações para artigos](https://developers.google.com/search/docs/appearance/structured-data/article). FAQPage não garante resultado enriquecido.

## URLs e acesso
Defina `NEXT_PUBLIC_SITE_URL` com a origem HTTPS definitiva antes do build. Canonical, sitemap e schema usam essa origem. Home termina em `/`; URLs internas não têm barra final. Vercel declara `cleanUrls: true` e `trailingSlash: false`. A hidratação tolera `/index.html` caso outro provedor exponha esse caminho. O preview local aceita variantes com barra, todas com o mesmo canonical.

A prévia Sites permanece privada. Robots permissivo não torna uma página privada indexável. Referência: [rastreamento e controle de acesso](https://developers.google.com/search/docs/crawling-indexing/robots/intro).

## Etapas externas
1. Confirmar domínio, acesso público e HTTPS; testar redirects e status no provedor definitivo.
2. Verificar propriedade no Search Console, enviar `/sitemap.xml` e inspecionar home/artigos.
3. Validar páginas públicas no Rich Results Test e Schema Markup Validator. Schema não garante exibição especial.
4. Conferir nome, telefone, endereço, categoria e URL no Google Business Profile; informar horários apenas após confirmação.
5. Confirmar datas dos artigos e manter revisão editorial especializada.
6. Medir LCP, CLS e INP em produção, com rede móvel e dispositivos reais. Limites de bundle não substituem dados de campo.

Não foram inventados domínio comercial, horários, coordenadas, resultados jurídicos ou promessas de aprovação.
