# Edição de conteúdo

## Depoimentos
`content/testimonials.ts` contém os três relatos exatos fornecidos pelo usuário: Fernanda Reis, Rodrigo Cuduh e Boop, todos com cinco estrelas. `googleReviewsUrl` mantém o endereço enviado no pedido.

Campos: `id`, `quote`, `name`, `rating`, `portrait`, `role`, `company`. Dados não confirmados permanecem vazios; sem fotografia autorizada são exibidas iniciais. Use somente avaliações reais e autorizadas. Ao inserir novos relatos, confira o card em 375 px e desktop. Não existe painel: alterações exigem build e publicação.

## Logos de clientes
`content/partners.ts` lista as logomarcas de "Parceiros da nossa história". Para incluir uma nova, salve o arquivo real enviado pela Velmont em `public/images/` e adicione `{ name, src }` à lista. A faixa aceita qualquer quantidade: a duração do movimento acompanha o número de logos (58 s a cada seis), mantendo o mesmo ritmo; com movimento reduzido, os logos formam uma grade de três colunas no desktop e duas no mobile.

O tratamento visual (tons de cinza, inversão e mesclagem com o fundo vinho) pressupõe marca sobre fundo branco ou transparente, como os arquivos atuais. Logos sobre fundo escuro ou colorido aparecem como uma caixa clara: peça outra versão do arquivo ou crie um ajuste individual em `app/refinements.css`, como os de Quimitec e Arte em Foto. `partner-ergotex`, `partner-nexpoint` e `partner-wallol` já estão em `public/images/`, fora da seleção atual, e têm fundo escuro ou colorido. Use somente logos reais e autorizados; não recrie nem gere marcas. Confira a faixa em desktop e 360 px após incluir novos arquivos.

## Fundadoras
As fotos individuais vieram de `Fotos Novos Fundadoras.zip`, com versões WebP de 640 e 1024 px. Enquadramento: `app/final-review.css`; referências e textos alternativos: `components/velmont/home.tsx`.

Para a apresentação conjunta, edite `content/founder-media.ts`: `photo` para fotografia real ou `video`, `poster` e `captions` para MP4 com legendas WebVTT. Sem esse material, permanece o espaço identificado. Não foi fabricada foto conjunta a partir dos retratos.

## Blog
Artigos em `content/insights.ts`. `articleVisuals` relaciona categoria, imagem, alt e serviço. Autor editorial: Velmont. Preencha `datePublished` e `dateModified` em ISO 8601 somente com datas reais confirmadas; o componente e o schema já tratam os campos. Nenhuma data foi inventada.
