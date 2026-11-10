# Velmont Reels

Reels em motion design de colagem para o Instagram da Velmont (@velmontmarcas), em [Remotion](https://www.remotion.dev). Projeto separado do site: dependências próprias (npm) e fora do `tsc` da raiz.

## Comandos

```bash
npm install
npm run dev          # Remotion Studio
npm run storyboard   # out/storyboard/*.png, um quadro por cena
npm run render       # out/velmont-m1-paulinho.mp4
npm run cover        # out/velmont-m1-capa.png
```

Os efeitos (`paper()`, `noise()`, `contourLines()`) rodam em WebGL2 por software (`swangle`, em `remotion.config.ts`), então o render funciona em máquina sem GPU. Para usar um Chrome já instalado, aponte `REMOTION_CHROME` para o executável.

## Recortes de foto

```bash
pip install "rembg[cpu]" pillow numpy scipy
python3 tools/cutout.py assets-src/microphone.jpg public/cutouts/microphone --crop 40,60,820,1720 --height 1100 --cell 9 --gamma 0.6 --contrast 1.4
python3 tools/cutout.py assets-src/alarm-clock.jpg public/cutouts/clock --height 760 --cell 8 --gamma 0.55 --contrast 1.6
```

Tira o fundo (rembg), aplica retícula halftone em preto e branco e borda branca de adesivo, em 3 variações de borda para o boil. Fonte e licença de cada foto em `CREDITS.md`.

## Linguagem de colagem (`src/collage/`)

| Componente | O que faz |
|---|---|
| `Paper.tsx` | `PaperBackground` (papel de fundo vivo, grão on twos), `TornPaper` (folha com borda rasgada ou cortada, fibra clara no rasgo, sombra curta, boil) |
| `Rip.tsx` | Rasga a folha na horizontal e a parte de baixo cai, revelando o que está embaixo |
| `Cutout.tsx` | Foto halftone recortada, com boil entre as 3 bordas |
| `Stamp.tsx` | Carimbo que bate (1,4 → 1 com tremida): texto ou selo ® |
| `Tape.tsx` | Fita adesiva que cola com um tapa, aceita texto |
| `TopoLines.tsx` | Curvas de nível finas, com deriva lenta |
| `Scribble.tsx` | Seta, rabisco de impacto e círculo à mão, desenhados traço a traço |
| `SlideIn.tsx`, `Camera.tsx` | Entrada com overshoot curto e deriva de câmera por cena |
| `motion.ts` | `onTwos` (pose a cada 2 frames), `boil` (3 poses a cada 3 frames), carimbo, deriva |

Área segura do Reels: nada importante nos 250 px de cima, nos 420 px de baixo e nos 140 px da direita.
