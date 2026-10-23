# Edição de conteúdo

## Depoimentos
`content/testimonials.ts` contém os três relatos exatos fornecidos pelo usuário: Fernanda Reis, Rodrigo Cuduh e Boop, todos com cinco estrelas. `googleReviewsUrl` mantém o endereço enviado no pedido.

Campos: `id`, `quote`, `name`, `rating`, `portrait`, `role`, `company`. Dados não confirmados permanecem vazios; sem fotografia autorizada são exibidas iniciais. Use somente avaliações reais e autorizadas. Ao inserir novos relatos, confira o card em 375 px e desktop. Não existe painel: alterações exigem build e publicação.

## Logos de clientes
`content/partners.ts` lista as logomarcas de "Parceiros da nossa história", exibidas em um carrossel de duas faixas que andam em sentidos opostos (a primeira metade da lista na faixa de cima, a segunda na de baixo). Cada logo ocupa um card 16:9 em superfície vinho, com a marca em marfim. A duração acompanha o número de logos (7,5 s por logo), mantendo o mesmo ritmo. O botão "Pausar movimento" continua disponível, e o carrossel também para sob o cursor e fora da tela. Abaixo das faixas, "Ver todos" mostra todas as logos numa grade única de seis colunas no desktop, quatro no tablet e duas no mobile; para fechar, há "Recolher" no fim da grade e no lugar do controle de movimento, no topo. Ao recolher de baixo, a página volta ao topo da seção. Com movimento reduzido, as faixas ficam paradas e "Ver todos" funciona igual.

Para incluir uma nova logo:

1. Salve o arquivo real enviado pela Velmont, sem edição, em `assets/client-logos/` com um nome curto (`nome-da-marca.jpg`, `.png` ou `.webp`).
2. Rode `pnpm logos`. O script gera `public/images/clients/nome-da-marca.webp`: a mesma marca em uma cor (marfim), centralizada num quadro 16:9 com tamanho óptico equivalente ao das outras. Funciona com fundo branco, escuro ou colorido, porque cada pixel vira opacidade conforme o contraste com o fundo do próprio arquivo; nenhuma forma é redesenhada.
3. Adicione `{ name, src: '/images/clients/nome-da-marca.webp' }` a `content/partners.ts`, alternando marcas largas e compactas para manter o ritmo das faixas.

Arquivos de baixa resolução ou fotografados (como Quimitec e Arte em Foto, extraídos do PDF) podem precisar de ajuste em `tune`, no topo de `scripts/client-logos.mjs`. Use somente logos reais e autorizados; não recrie nem gere marcas. Confira o carrossel em desktop e 360 px após incluir novos arquivos. `partner-wallol.webp` continua em `public/images/`, fora da seleção.

## Fundadoras
As fotos individuais vieram de `Fotos Novos Fundadoras.zip`, com versões WebP de 640 e 1024 px. Enquadramento: `app/final-review.css`; referências e textos alternativos: `components/velmont/home.tsx`.

Para a apresentação conjunta, edite `content/founder-media.ts`: `photo` para fotografia real ou `video`, `poster` e `captions` para MP4 com legendas WebVTT. Sem esse material, permanece o espaço identificado. Não foi fabricada foto conjunta a partir dos retratos.

## Blog
Artigos em `content/insights.ts`. `articleVisuals` relaciona categoria, imagem, alt e serviço. Autor editorial: Velmont. Preencha `datePublished` e `dateModified` em ISO 8601 somente com datas reais confirmadas; o componente e o schema já tratam os campos. Nenhuma data foi inventada.
