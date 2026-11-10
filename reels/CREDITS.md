# Créditos e licenças

## Imagens de terceiros

| Arquivo | O que é | Fonte | Licença |
|---|---|---|---|
| `assets-src/cow-side.jpg` | Gravura de uma vaca de perfil, de livro antigo (imagem 1017063) | Biblioteca Rector Machado y Nuñez, no Flickr: https://www.flickr.com/photos/37667416@N04/4305556739 | Marca de Domínio Público 1.0 |
| `assets-src/magnifier.jpg` | Lupa ("Magnifying glass png sticker, object") | rawpixel: https://www.rawpixel.com/image/6479680/png-sticker-public-domain | CC0 1.0 |

As duas foram encontradas pelo Openverse com o filtro de licença CC0 e domínio público, em 10/11/2026. O tratamento (recorte, halftone, borda de adesivo e sombra) é feito por `tools/build_assets.py`. As máscaras de recorte ficam em `assets-src/masks/`.

Antes de publicar, vale abrir os dois links e conferir se a licença continua a mesma na página de origem.

## Marca

- Logo da Velmont: arquivo original do site (`public/images/velmont-logo.webp` deste repositório), sem redesenho. O script só recorta a área útil e aplica as cores da paleta.

## Fontes

- Manrope (The Manrope Project Authors) e Instrument Serif (The Instrument Serif Project Authors), licença SIL Open Font 1.1. Arquivos em `public/fonts/`, com o texto da licença ao lado.

## Feito por código, sem material de terceiros

- Texturas de papel, curvas de nível e tinta de carimbo: `tools/build_assets.py`.
- Todos os efeitos sonoros e a base rítmica: `tools/build_sfx.py` (ruído e senoides moldados em numpy; nenhuma gravação).
- Objetos de papel (lata de tinta, brinco, cupom, senha, placa, fichas): SVG e CSS em `src/kit` e `src/episodes`.

## Referência citada

- Episódio 01 cita o conceito de "A Vaca Roxa", de Seth Godin, com crédito na tela. Nenhum trecho do livro é reproduzido.

## Software

- Remotion 4.0.542. A licença gratuita vale para pessoas físicas e empresas com fins lucrativos de até 3 funcionários (`node_modules/remotion/LICENSE.md`). A Boop, com 3 pessoas, se enquadra. Se a equipe crescer, é preciso a licença de empresa.
- FFmpeg (finalização), Pillow, numpy e rembg (preparo das imagens).
