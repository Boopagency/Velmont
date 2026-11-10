"""Gera as texturas e os recortes da série Papel Passado.

Uso: python3 tools/build_assets.py [tex] [topo] [bg] [cut] [brand]
Sem argumentos, gera tudo. Tudo sai em public/, pronto para o Remotion.

- tex:   papéis (creme, kraft, vinho...) e a tinta falhada do carimbo
- topo:  linhas topográficas (curvas de nível) com fundo transparente
- bg:    fundos de cena, papel + curvas de nível numa imagem só
- cut:   recortes em halftone com borda branca de adesivo (rembg + retícula)
- brand: logo original da Velmont, copiado do site sem alteração de forma
"""
from __future__ import annotations

import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public')
SRC = os.path.join(ROOT, 'assets-src')

PAPERS = {
    'cream': '#f4efe6',
    'white': '#fbf8f1',
    'kraft': '#ddc5a1',
    'kraftdeep': '#c9ab80',
    'apoio': '#c1b1b1',
    'wine': '#3d101e',
    'winemid': '#32151e',
    'winedeep': '#210b12',
    'night': '#160b0f',
}
INK = (30, 14, 20)  # preto puxado para o vinho


def hex_rgb(h: str) -> np.ndarray:
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def fbm(w: int, h: int, rng: np.random.Generator, octaves=(3, 6, 12, 24, 48, 96, 192)) -> np.ndarray:
    """Ruído suave em várias escalas, entre -1 e 1."""
    acc = np.zeros((h, w), dtype=np.float32)
    amp, total = 1.0, 0.0
    for g in octaves:
        gh = max(2, int(g * h / w))
        small = rng.random((gh, g), dtype=np.float32)
        img = Image.fromarray(small, 'F').resize((w, h), Image.BICUBIC)
        acc += amp * (np.asarray(img, dtype=np.float32) - 0.5) * 2
        total += amp
        amp *= 0.55
    return acc / total


def paper(name: str, color: str, seed: int, w=1320, h=2340) -> Image.Image:
    rng = np.random.default_rng(seed)
    base = hex_rgb(color)
    lum = float(base.mean())
    dark = lum < 110
    mottle = fbm(w, h, rng)
    fine = rng.normal(0, 1, (h, w)).astype(np.float32)
    fine = np.asarray(Image.fromarray(np.clip(fine * 40 + 128, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float32) / 128.0 - 1.0

    # fibras: riscos curtos e curvos
    fib = Image.new('L', (w, h), 128)
    d = ImageDraw.Draw(fib)
    for _ in range(int(w * h / 900)):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        ang = rng.uniform(0, np.pi)
        ln = rng.uniform(6, 34)
        bend = rng.uniform(-0.6, 0.6)
        pts = []
        for t in np.linspace(0, 1, 5):
            a = ang + bend * t
            pts.append((x + np.cos(a) * ln * t, y + np.sin(a) * ln * t))
        tone = 128 + int(rng.choice([-1, 1]) * rng.uniform(18, 60))
        d.line(pts, fill=tone, width=1)
    fib = np.asarray(fib.filter(ImageFilter.GaussianBlur(0.5)), dtype=np.float32) / 128.0 - 1.0

    # pintas
    spk = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(spk)
    for _ in range(int(w * h / 5200)):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(0.5, 1.8)
        d.ellipse((x - r, y - r, x + r, y + r), fill=int(rng.uniform(60, 200)))
    spk = np.asarray(spk.filter(ImageFilter.GaussianBlur(0.4)), dtype=np.float32) / 255.0

    k = 1.0 if not dark else 2.4
    shade = 1.0 + k * (0.055 * mottle + 0.036 * fine + 0.085 * fib)
    out = base[None, None, :] * shade[:, :, None]
    if dark:
        out += spk[:, :, None] * 26
    else:
        out -= spk[:, :, None] * 34
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


def build_tex() -> None:
    out = os.path.join(PUB, 'tex')
    os.makedirs(out, exist_ok=True)
    for i, (name, color) in enumerate(PAPERS.items()):
        paper(name, color, seed=100 + i * 7).save(os.path.join(out, f'{name}.jpg'), quality=88)
        print('tex', name)
    # tinta falhada do carimbo
    rng = np.random.default_rng(321)
    m = fbm(520, 520, rng, octaves=(6, 12, 24, 48, 96))
    fine = rng.random((520, 520), dtype=np.float32)
    a = np.clip(0.86 + m * 1.5, 0.3, 1.0)
    a = np.where(fine > 0.965, a * 0.25, a)
    mask = Image.new('RGBA', (520, 520), (0, 0, 0, 0))
    mask.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
    mask.save(os.path.join(out, 'ink-mask.png'))
    print('tex ink-mask')


def build_topo() -> None:
    """Curvas de nível: linhas onde o relevo cruza cada cota."""
    out = os.path.join(PUB, 'tex')
    os.makedirs(out, exist_ok=True)
    w, h = 1320, 2340
    for i in range(2):
        rng = np.random.default_rng(40 + i)
        ss = 2
        f = fbm(w * ss, h * ss, rng, octaves=(2, 3, 5, 8, 13))
        g = f * 30.0
        gy, gx = np.gradient(g)
        grad = np.maximum(np.sqrt(gx * gx + gy * gy), 0.006)  # evita borrão em platôs
        dist = np.abs(g - np.round(g)) / grad  # distância em pixels até a cota mais próxima
        line = np.clip(1.7 - dist, 0, 1)
        a = Image.fromarray((line * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
        rgba = Image.new('RGBA', (w, h), (255, 255, 255, 0))
        rgba.putalpha(a)
        rgba.save(os.path.join(out, f'topo-{i}.png'))
        print('topo', i)


def build_bg() -> None:
    """Papel de fundo + curvas de nível numa imagem só, por cor."""
    out = os.path.join(PUB, 'tex')
    for name, color in PAPERS.items():
        base = Image.open(os.path.join(out, f'{name}.jpg')).convert('RGB')
        dark = float(hex_rgb(color).mean()) < 110
        ink = hex_rgb(PAPERS['kraft'] if dark else PAPERS['wine'])
        k = 0.2 if dark else 0.16
        for i in range(2):
            a = np.asarray(Image.open(os.path.join(out, f'topo-{i}.png')).getchannel('A'), dtype=np.float32)[..., None] / 255.0 * k
            arr = np.asarray(base, dtype=np.float32) * (1 - a) + ink[None, None, :] * a
            Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(out, f'bg-{name}-{i}.jpg'), quality=88)
        print('bg', name)


def halftone(gray: np.ndarray, cell: float, angle_deg: float, gamma=1.0) -> np.ndarray:
    """Retícula de pontos. gray: 0 (preto) a 1 (branco). Devolve cobertura de tinta 0..1."""
    h, w = gray.shape
    ss = 3
    ys, xs = np.mgrid[0:h * ss, 0:w * ss].astype(np.float32)
    xs /= ss
    ys /= ss
    a = np.deg2rad(angle_deg)
    u = xs * np.cos(a) + ys * np.sin(a)
    v = -xs * np.sin(a) + ys * np.cos(a)
    cu = (np.floor(u / cell) + 0.5) * cell
    cv = (np.floor(v / cell) + 0.5) * cell
    cx = np.clip(cu * np.cos(a) - cv * np.sin(a), 0, w - 1).astype(np.int32)
    cy = np.clip(cu * np.sin(a) + cv * np.cos(a), 0, h - 1).astype(np.int32)
    dark = (1.0 - gray[cy, cx]) ** gamma
    r = np.sqrt(dark) * cell * 0.74
    dist = np.sqrt((u - cu) ** 2 + (v - cv) ** 2)
    ink = (dist < r).astype(np.float32)
    ink = ink.reshape(h, ss, w, ss).mean(axis=(1, 3))
    return ink


def cut_alpha(img: Image.Image, mode: str, cache: str | None = None) -> Image.Image:
    # a máscara do recorte fica guardada em assets-src/masks: refazer é rápido e não exige o modelo
    if cache and os.path.exists(cache):
        return Image.open(cache).convert('L')
    alpha = _cut_alpha(img, mode)
    if cache:
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        alpha.convert('L').save(cache)
    return alpha


def _cut_alpha(img: Image.Image, mode: str) -> Image.Image:
    if mode == 'alpha':
        return img.getchannel('A')
    if mode == 'white':
        # gravura sobre papel claro: tudo que não é fundo ligado às bordas
        g = img.convert('L').filter(ImageFilter.GaussianBlur(1.2))
        m = g.point(lambda v: 255 if v < 236 else 0)
        m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(5))
        inv = ImageOps.invert(m)
        ImageDraw.floodfill(inv, (0, 0), 128)
        ImageDraw.floodfill(inv, (inv.width - 1, inv.height - 1), 128)
        return inv.point(lambda v: 0 if v == 128 else 255)
    from rembg import remove  # recorte por rede neural, só quando o fundo é complexo
    return remove(img.convert('RGB'), only_mask=True, post_process_mask=True)


SHADOW_PAD = 26


def with_shadow(img: Image.Image, dy=9, blur=7, strength=0.4) -> Image.Image:
    """Sombra de papel sobre papel, embutida no arquivo (filtro em tempo de render é caro)."""
    W, H = img.width + SHADOW_PAD * 2, img.height + SHADOW_PAD * 2
    a = Image.new('L', (W, H), 0)
    a.paste(img.getchannel('A'), (SHADOW_PAD, SHADOW_PAD + dy))
    a = a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * strength))
    out = Image.new('RGBA', (W, H), (10, 2, 6, 0))
    out.putalpha(a)
    top = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    top.paste(img, (SHADOW_PAD, SHADOW_PAD))
    return Image.alpha_composite(out, top)


def sticker(src: str, name: str, *, mode='rembg', width=1100, cell=5.2, angle=38, contrast=1.35, border=14,
            keep_line=0.45, crop=None, flip=False, tint: str | None = None, lift=0.0) -> None:
    img = Image.open(os.path.join(SRC, src))
    img = img.convert('RGBA') if mode == 'alpha' else img.convert('RGB')
    if crop:
        img = img.crop(crop)
    if flip:
        img = ImageOps.mirror(img)
    key = os.path.splitext(src)[0] + ('-' + '-'.join(map(str, crop)) if crop else '') + ('-flip' if flip else '')
    alpha = cut_alpha(img, mode, os.path.join(SRC, 'masks', f'{key}.png')).convert('L')
    bbox = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    img, alpha = img.crop(bbox), alpha.crop(bbox)
    scale = width / img.width
    size = (width, int(img.height * scale))
    img = img.resize(size, Image.LANCZOS)
    alpha = alpha.resize(size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.0)).point(lambda v: 255 if v > 120 else 0).filter(ImageFilter.GaussianBlur(0.8))

    gray = np.asarray(ImageOps.autocontrast(img.convert('L'), cutoff=1), dtype=np.float32) / 255.0
    gray = np.clip((gray - 0.5) * contrast + 0.5 + lift, 0, 1)
    soft = np.asarray(Image.fromarray((gray * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), dtype=np.float32) / 255.0
    ink = halftone(soft, cell, angle)
    line = np.clip((0.52 - gray) / 0.3, 0, 1)  # traço fino da gravura, preservado
    cover = np.clip(ink * (1 - keep_line) + np.maximum(ink, line) * keep_line, 0, 1)

    paper_c = hex_rgb('#fbf8f1') if not tint else hex_rgb(tint)
    ink_c = np.array(INK, dtype=np.float32) if not tint else hex_rgb('#f4efe6')
    if tint:  # versão "pintada": papel vinho, tinta clara nas luzes
        cover = 1.0 - cover
        cover = np.clip(cover * 0.9, 0, 1)
    rgb = paper_c[None, None, :] * (1 - cover[..., None]) + ink_c[None, None, :] * cover[..., None]

    pad = border + 6
    W, H = size[0] + pad * 2, size[1] + pad * 2
    a_pad = Image.new('L', (W, H), 0)
    a_pad.paste(alpha, (pad, pad))
    edge = a_pad.filter(ImageFilter.MaxFilter(border * 2 + 1)).filter(ImageFilter.GaussianBlur(1.6)).point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.GaussianBlur(0.9))
    out = Image.new('RGBA', (W, H), (251, 248, 241, 0))
    white = Image.new('RGBA', (W, H), (251, 248, 241, 255))
    out.paste(white, (0, 0), edge)
    art = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    art.paste(Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB'), (pad, pad))
    out.paste(art, (0, 0), a_pad)
    out = with_shadow(out)
    os.makedirs(os.path.join(PUB, 'cut'), exist_ok=True)
    out.save(os.path.join(PUB, 'cut', f'{name}.png'))
    print('cut', name, out.size)


def build_cut() -> None:
    sticker('cow-side.jpg', 'cow', mode='rembg', width=1100, cell=5.4)
    sticker('cow-side.jpg', 'cow-wine', mode='rembg', width=1100, cell=5.4, tint='#3d101e')
    sticker('stopwatch.jpg', 'stopwatch', mode='rembg', width=700, cell=4.4, contrast=1.5)


def build_brand() -> None:
    out = os.path.join(PUB, 'brand')
    os.makedirs(out, exist_ok=True)
    site = os.path.join(os.path.dirname(ROOT), 'public', 'images', 'velmont-logo.webp')
    logo = Image.open(site).convert('RGBA')
    logo.save(os.path.join(out, 'velmont-logo.png'))
    # só a montanha + VELMONT como máscara, para a moldura fixa (mesma forma, sem redesenho)
    a = logo.getchannel('A')
    bbox = a.getbbox()
    trim = logo.crop(bbox)
    trim.save(os.path.join(out, 'velmont-logo-trim.png'))
    for name in ('kraft', 'wine', 'cream'):
        c = tuple(int(v) for v in hex_rgb(PAPERS[name]))
        tinted = Image.new('RGBA', trim.size, c + (0,))
        tinted.putalpha(trim.getchannel('A'))
        tinted.save(os.path.join(out, f'logo-{name}.png'))
    print('brand', logo.size, bbox)


if __name__ == '__main__':
    what = sys.argv[1:] or ['tex', 'topo', 'bg', 'cut', 'brand']
    for step in what:
        {'tex': build_tex, 'topo': build_topo, 'bg': build_bg, 'cut': build_cut, 'brand': build_brand}[step]()
