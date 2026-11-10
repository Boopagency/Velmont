"""Junta quadros do storyboard numa folha de contato. Uso: python3 tools/sheet.py out/sheet.jpg cols frames..."""
import sys
from PIL import Image, ImageDraw

out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 8) + 8, rows * (h + 30) + 8), (22, 11, 15))
d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = 8 + (i % cols) * (w + 8), 8 + (i // cols) * (h + 30)
    sheet.paste(im, (x, y))
    d.text((x + 4, y + h + 6), f.split('/')[-1].rsplit('.', 1)[0], fill=(221, 197, 161))
sheet.save(out, quality=88)
print(out, sheet.size)
