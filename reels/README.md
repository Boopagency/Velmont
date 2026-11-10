# Papel Passado

Série de Reels em motion de colagem da Velmont | Marcas e Patentes. 1080x1920, 30 fps.

- Roteiros, narração e legendas: [ROTEIROS.md](ROTEIROS.md)
- Imagens, fontes e licenças: [CREDITS.md](CREDITS.md)

Este projeto é separado do site: tem o próprio `package.json` e não entra no build nem no deploy.

## Rodar

```bash
cd reels
npm install
npm run setup
```

`npm run setup` gera as texturas, os recortes e os sons em `public/` (Python 3 com Pillow e numpy). Esses arquivos não ficam no Git porque saem iguais a cada execução.

```bash
node tools/render.mjs EP01 --capa 70
```

Sai em `out/velmont-pp01-vaca-roxa.mp4` (H.264, yuv420p, 30 fps) e a capa em PNG.

| Comando | Para quê |
|---|---|
| `node tools/render.mjs EP01 --preview` | Prévia em meia resolução |
| `node tools/render.mjs all` | Todos os episódios |
| `node tools/render.mjs EP01 --no-bed` | Sem a base rítmica, só efeitos (para usar música do Instagram) |
| `node tools/storyboard.mjs EP01 70,262,372` | Quadros parados para storyboard |
| `npx remotion studio` | Abrir no editor do Remotion |

Em outra máquina, defina `REMOTION_CHROME` com o caminho do Chrome se o Remotion não achar um sozinho.

## Como é feito

- **Remotion** monta as cenas em React. **FFmpeg** finaliza: grão de papel "em dois" (muda a cada 2 quadros), volume em -16 LUFS e compressão.
- `src/kit/` é a linguagem de colagem, em peças separadas:

| Peça | O que faz |
|---|---|
| `Piece` | Posição, entrada (desliza, carimba, cai, salta), saída e o "boil" de cada recorte |
| `Paper`, `Tape` | Papel com textura, lados rasgados ou cortados, fibra clara no rasgo; fita adesiva |
| `Cutout` | Foto em halftone com borda de adesivo |
| `Ransom` | Título em letras recortadas, coladas uma a uma |
| `Stamp` | Carimbo com tinta falhada |
| `Scribble`, `Mark` | Setas, círculos, riscos e sublinhados à mão |
| `T`, `Em`, `Hl`, `Reveal`, `Typed` | Texto: Manrope, ênfase em Instrument Serif itálico, caixa de destaque |
| `Scene`, `Brand` | Fundo com curvas de nível, deriva de câmera e a moldura fixa da marca |
| `Sfx`, `Episode` | Som por quadro e a montagem em corte seco |

- Movimento: posições mudam a cada 2 quadros (`onTwos`), cada recorte alterna entre 3 poses (`boil`), carimbos batem de 1,45 para 1 com tremida. Tudo em `src/lib/motion.ts`.
- Área segura do Reels em `src/theme.ts` (`SAFE`): 250 px em cima, 420 px embaixo, 140 px à direita.

## Novo episódio

1. Escreva as cenas em `src/episodes/epNN.tsx`, exportando uma lista `{ id, dur, el }`.
2. Registre em `src/episodes/index.ts`.
3. Confira com `node tools/storyboard.mjs EPNN every:45`.

## Decisões que fogem do pedido original

- **Textura de papel:** o `paper()` do `@remotion/effects` precisa de WebGL2, que o ambiente de nuvem onde isto foi produzido não tem. As texturas são geradas por `tools/build_assets.py` e entram como imagem. O render também fica mais rápido assim.
- **Fontes:** as mesmas Manrope e Instrument Serif, carregadas de arquivos locais em vez do `@remotion/google-fonts`, que depende de rede na hora do render.
- **Sombras:** duas cópias deslocadas do contorno em vez de `drop-shadow`, que triplicava o tempo de render.
