"""Compara los cuadros de la réplica: cada ref-T.png (la galería) con fo-T.png (la app).
Imprime la diferencia media por píxel (0-255) y el % de píxeles que cambian más de 24/255, y arma lado-T.jpg y hoja.jpg para MIRAR.
python -I comparar.py <carpeta>
"""
import sys, os, glob
from PIL import Image, ImageChops

c = sys.argv[1]
filas = []
for ref in sorted(glob.glob(os.path.join(c, 'ref-*.png')), key=lambda p: float(p.split('ref-')[1][:-4])):
    t = ref.split('ref-')[1][:-4]; fo = os.path.join(c, f'fo-{t}.png')
    if not os.path.exists(fo): continue
    A = Image.open(ref).convert('RGB'); B = Image.open(fo).convert('RGB').resize(A.size)
    d = ImageChops.difference(A, B).convert('L'); h = d.histogram(); n = sum(h)
    media = sum(i * k for i, k in enumerate(h)) / n; mucho = sum(h[25:]) / n * 100
    print(f't={t}: media {media:.2f} | {mucho:.2f} % de pixeles distintos')
    lado = Image.new('RGB', (A.width * 2 + 20, A.height), 'white'); lado.paste(A, (0, 0)); lado.paste(B, (A.width + 20, 0))
    lado = lado.resize((lado.width // 4, lado.height // 4)); lado.save(os.path.join(c, f'lado-{t}.jpg'), quality=85); filas.append(lado)
if filas:
    por = 3; w, h = filas[0].size; hoja = Image.new('RGB', (w * por + 10 * (por - 1), (h + 10) * ((len(filas) + por - 1) // por)), 'white')
    for i, f in enumerate(filas): hoja.paste(f, ((w + 10) * (i % por), (h + 10) * (i // por)))
    hoja.save(os.path.join(c, 'hoja.jpg'), quality=82)
