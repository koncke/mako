# Hoja de contacto 16:9 de una carpeta de capturas (ordenadas por segundo). Uso: python -I hoja.py <dir> <salida.jpg> [columnas=3] [ancho=640]
import sys, os, re
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3; w = int(sys.argv[4]) if len(sys.argv) > 4 else 640
h = w * 9 // 16
fs = sorted([f for f in os.listdir(d) if f.endswith('.jpg')], key=lambda f: float(re.findall(r'-([\d.]+)\.jpg$', f)[0]))
rows = (len(fs) + cols - 1) // cols
im = Image.new('RGB', (cols * w, rows * h), 'white'); dr = ImageDraw.Draw(im)
for i, f in enumerate(fs):
    t = Image.open(os.path.join(d, f)).resize((w, h)); x, y = (i % cols) * w, (i // cols) * h; im.paste(t, (x, y))
    dr.rectangle([x, y, x + 120, y + 22], fill='black'); dr.text((x + 5, y + 5), f.replace('.jpg', ''), fill='yellow')
im.save(out, quality=82); print(out, len(fs), 'cuadros')
