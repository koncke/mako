# Arma la referencia del abanico de polaroids con las caricaturas reales del corcho, sobre blanco.
import sys
from PIL import Image, ImageDraw, ImageFilter
G = 'C:/dev/wt-push-q/public/asesores/grandes/'
caras = ['ramiro-cubria', 'francisco-doglio', 'victor-heras', 'hormozi', 'marcos-razzetti']
W, H = 900, 1125  # 4:5 vertical
lienzo = Image.new('RGB', (W, H), (250, 250, 250))
pw, ph = 260, 320       # polaroid
foto = 224
n = len(caras)
for i, c in enumerate(caras):
    p = Image.new('RGBA', (pw, ph), (252, 252, 248, 255))
    im = Image.open(G + c + '.png').convert('RGB')
    s = min(im.size); im = im.crop(((im.width - s)//2, 0, (im.width - s)//2 + s, s)).resize((foto, foto))
    p.paste(im, (20, 20))
    ImageDraw.Draw(p).rectangle([0, 0, pw-1, ph-1], outline=(215, 215, 210), width=2)
    ang = -56 + i * (112 / (n - 1))
    r = p.rotate(-ang, expand=True, resample=Image.BICUBIC)
    # pivote abajo al centro, como cartas en la mano
    import math
    cx, cy = W//2, int(H*0.86)
    dist = 400
    x = cx + int(dist * math.sin(math.radians(ang))) - r.width//2
    y = cy - int(dist * math.cos(math.radians(ang))) - r.height//2
    sombra = Image.new('RGBA', r.size, (0, 0, 0, 0)); sombra.paste((0, 0, 0, 60), mask=r.split()[3])
    lienzo.paste(sombra.filter(ImageFilter.GaussianBlur(6)), (x+6, y+8), sombra.filter(ImageFilter.GaussianBlur(6)))
    lienzo.paste(r, (x, y), r)
lienzo.save(sys.argv[1], quality=92)
print('ok', W, H)
