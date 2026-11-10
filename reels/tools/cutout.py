"""Photo -> paper cutout: rembg removes the background, then a halftone
screen and a white sticker border, exported in 3 border variants for the boil.

    python3 tools/cutout.py assets-src/alarm-clock.jpg public/cutouts/clock --height 900
    python3 tools/cutout.py assets-src/microphone.jpg public/cutouts/microphone --crop 60,80,800,1720

Writes <out>-0.png, <out>-1.png, <out>-2.png (same size, same placement).
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove
from scipy.ndimage import binary_fill_holes

INK = (24, 18, 20)  # near-black, like the printed hands in the carousels
PAPER = (251, 248, 242)


def halftone(gray: Image.Image, cell: int, angle: float = 45) -> Image.Image:
    """Grayscale -> black dots on white. Dot area follows darkness."""
    big = gray.rotate(angle, expand=True, fillcolor=255, resample=Image.BICUBIC)
    w, h = big.size
    a = np.asarray(big, dtype=np.float32) / 255
    gh, gw = h // cell, w // cell
    means = a[: gh * cell, : gw * cell].reshape(gh, cell, gw, cell).mean(axis=(1, 3))
    radius = np.sqrt(1 - means) * cell * 0.72  # 0.72 lets the darkest dots merge
    yy, xx = np.mgrid[0:cell, 0:cell] + 0.5 - cell / 2
    dist = np.sqrt(xx**2 + yy**2)
    dots = dist[None, :, None, :] < radius[:, None, :, None]
    out = np.full((h, w), 255, np.uint8)
    out[: gh * cell, : gw * cell] = np.where(dots.reshape(gh * cell, gw * cell), 0, 255)
    back = Image.fromarray(out).rotate(-angle, expand=True, fillcolor=255, resample=Image.BICUBIC)
    left, top = (back.width - gray.width) // 2, (back.height - gray.height) // 2
    return back.crop((left, top, left + gray.width, top + gray.height))


def sticker_mask(alpha: Image.Image, border: int, seed: int) -> Image.Image:
    """Dilate the subject, then wobble the edge a little like a scissor cut."""
    grown = alpha.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MaxFilter(border * 2 + 1))
    rng = np.random.default_rng(seed)
    w, h = alpha.size
    noise = rng.random((h // 24 + 2, w // 24 + 2)).astype(np.float32)
    noise = np.asarray(Image.fromarray((noise * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32)
    soft = np.asarray(grown.filter(ImageFilter.GaussianBlur(border * 0.45)), np.float32)
    edge = soft + (noise - 128) * 0.55
    # scissors don't cut tiny inner holes: fill them with plain paper
    cut = binary_fill_holes(edge > 128)
    return Image.fromarray(np.where(cut, 255, 0).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("out", help="output prefix, e.g. public/cutouts/clock")
    p.add_argument("--crop", help="x0,y0,x1,y1 in source pixels, before rembg")
    p.add_argument("--height", type=int, default=1000, help="subject height in output px")
    p.add_argument("--cell", type=int, default=9, help="halftone cell in output px")
    p.add_argument("--border", type=int, default=18, help="white sticker border in px")
    p.add_argument("--contrast", type=float, default=1.35)
    p.add_argument("--gamma", type=float, default=0.8, help="<1 lifts midtones so dark objects keep detail")
    p.add_argument("--mask", help="optional 8-bit mask (white = keep) to clean rembg output")
    args = p.parse_args()

    src = Image.open(args.src).convert("RGB")
    if args.crop:
        src = src.crop(tuple(int(v) for v in args.crop.split(",")))
    cut = remove(src, session=new_session("isnet-general-use"))
    alpha = cut.getchannel("A")
    if args.mask:
        alpha = Image.fromarray(np.minimum(np.asarray(alpha), np.asarray(Image.open(args.mask).convert("L").resize(alpha.size))))
    box = alpha.point(lambda v: 255 if v > 128 else 0).getbbox()
    cut, alpha = cut.crop(box), alpha.crop(box)

    scale = args.height / cut.height
    size = (round(cut.width * scale), args.height)
    gray = ImageOps.autocontrast(ImageOps.grayscale(cut.resize(size, Image.LANCZOS)), cutoff=1)
    g = (np.asarray(gray, np.float32) / 255) ** args.gamma * 255
    gray = Image.fromarray(np.clip((g - 128) * args.contrast + 128, 0, 255).astype(np.uint8))
    alpha = alpha.resize(size, Image.LANCZOS)
    dots = halftone(gray, args.cell)

    pad = args.border * 2
    canvas = (size[0] + pad * 2, size[1] + pad * 2)
    subject = Image.new("L", canvas, 0)
    subject.paste(alpha, (pad, pad))
    ink = Image.new("L", canvas, 255)
    ink.paste(dots, (pad, pad))

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    for i in range(3):
        sticker = sticker_mask(subject, args.border, seed=11 + i)
        # inside the subject: dots; between subject and cut line: plain white paper
        inked = np.where(np.asarray(subject) > 128, np.asarray(ink), 255)[..., None] / 255
        rgb = np.asarray(PAPER, np.float32) * inked + np.asarray(INK, np.float32) * (1 - inked)
        rgba = np.dstack([rgb.astype(np.uint8), np.asarray(sticker)])
        Image.fromarray(rgba, "RGBA").save(f"{args.out}-{i}.png", optimize=True)
    print(f"{args.out}-[0-2].png", canvas)


if __name__ == "__main__":
    main()
