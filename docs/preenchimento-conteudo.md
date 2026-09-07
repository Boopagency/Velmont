# Edição de conteúdo

## Depoimentos
`content/testimonials.ts` contém os três relatos exatos fornecidos pelo usuário: Fernanda Reis, Rodrigo Cuduh e Boop, todos com cinco estrelas. `googleReviewsUrl` mantém o endereço enviado no pedido.

Campos: `id`, `quote`, `name`, `rating`, `portrait`, `role`, `company`. Dados não confirmados permanecem vazios; sem fotografia autorizada são exibidas iniciais. Use somente avaliações reais e autorizadas. Ao inserir novos relatos, confira o card em 375 px e desktop. Não existe painel: alterações exigem build e publicação.

## Fundadoras
As fotos individuais vieram de `Fotos Novos Fundadoras.zip`, com versões WebP de 640 e 1024 px. Enquadramento: `app/final-review.css`; referências e textos alternativos: `components/velmont/home.tsx`.

Para a apresentação conjunta, edite `content/founder-media.ts`: `photo` para fotografia real ou `video`, `poster` e `captions` para MP4 com legendas WebVTT. Sem esse material, permanece o espaço identificado. Não foi fabricada foto conjunta a partir dos retratos.

## Blog
Artigos em `content/insights.ts`. `articleVisuals` relaciona categoria, imagem, alt e serviço. Autor editorial: Velmont. Preencha `datePublished` e `dateModified` em ISO 8601 somente com datas reais confirmadas; o componente e o schema já tratam os campos. Nenhuma data foi inventada.
