# -*- coding: utf-8 -*-
"""Dibuja la portada de un curso: tipografia + (si hay) una foto del autor sacada del video.

    python scripts/curso-portada-disenar.py --slug metolodogia-jads \
        --titulo "Metolodogia JADS" --autor "Juan Osorio" \
        --foto C:/cursos/_candidatas/metolodogia-jads/07.jpg

    python scripts/curso-portada-disenar.py --slug higher-levels-ae-mastery \
        --titulo "AE Mastery" --autor "Higher Levels"        # sin --foto: solo tipografia

── Por que existe, y por que es .py ──────────────────────────────────────────────────────
El resto de `scripts/` es .mjs, y esto rompe la convencion a proposito: node no tiene con
que dibujar. La alternativa era el `drawtext` de ffmpeg, que ya costo cuatro intentos para
un mosaico de doce cuadrados —no tiene medicion de texto, ni ajuste de linea, ni mascaras—
y aca hace falta medir para que un titulo de 40 caracteres entre en el mismo alto que uno
de 12. PIL ya esta instalado y resuelve las tres cosas.

── El pedido ─────────────────────────────────────────────────────────────────────────────
Martin, 03/09/2026: «las portadas estan feas. Tienes que buscar una foto del autor si hay
tipo portada, y sino, disenarla».

⚠️ NO son dos caminos excluyentes, y tratarlos asi era el error. Las portadas BUENAS del
   portal —las 30 que vienen de la plataforma de origen— son TODAS lo mismo: fondo oscuro,
   titulo grande, el autor recortado a un lado y un color de acento. O sea que la foto del
   autor no reemplaza al diseno: es una PIEZA del diseno. Con un solo molde, el curso que
   tiene un buen plano del autor lo usa de mitad derecha y el que no lo tiene queda
   tipografico — y los dos se leen como del mismo portal, que es lo que una grilla de 132
   tarjetas necesita.

⚠️ Y el acento es UNO para los trece, no uno por curso. Trece portadas generadas con trece
   paletas distintas no se leen como un sistema: se leen como trece cosas sueltas al lado
   de las de la plataforma. Va el dorado de la marca (--mako, #F2B01E de app/globals.css).
"""
import argparse, os, sys, unicodedata
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1280, 720
FONDO      = (23, 26, 33)
FONDO_2    = (16, 18, 24)
TINTA      = (255, 255, 255)
ACENTO     = (242, 176, 30)      # --mako
TINTA_SUAVE= (168, 176, 190)

NEGRA  = 'C:/Windows/Fonts/ariblk.ttf'          # Arial Black
SEMI   = 'C:/Windows/Fonts/seguisb.ttf'         # Segoe UI Semibold
REG    = 'C:/Windows/Fonts/segoeui.ttf'

ap = argparse.ArgumentParser()
ap.add_argument('--slug', required=True)
ap.add_argument('--titulo', required=True)
ap.add_argument('--autor', default='')
ap.add_argument('--foto', default='')
ap.add_argument('--cejilla', default='')
ap.add_argument('--salida', default='public/cono-portadas')
a = ap.parse_args()


def fuente(ruta, px):
    try:
        return ImageFont.truetype(ruta, px)
    except Exception:
        return ImageFont.load_default()


def ancho(dib, txt, f):
    x0, _, x1, _ = dib.textbbox((0, 0), txt, font=f)
    return x1 - x0


def envolver(dib, txt, f, tope):
    """Parte en lineas que entren en `tope`. Una palabra sola mas ancha que el tope se deja:
    cortarla a la mitad es peor que pasarse, y el ajuste de cuerpo de abajo la va a achicar."""
    palabras, lineas, act = txt.split(), [], ''
    for p in palabras:
        prueba = (act + ' ' + p).strip()
        if act and ancho(dib, prueba, f) > tope:
            lineas.append(act); act = p
        else:
            act = prueba
    if act:
        lineas.append(act)
    return lineas


# ── El lienzo: oscuro, con un resplandor del acento abajo a la izquierda ──────────────────
img = Image.new('RGB', (W, H), FONDO)
dib = ImageDraw.Draw(img)
for y in range(H):                       # degrade vertical sutil, para que no sea un plano
    k = y / H
    dib.line([(0, y), (W, y)], fill=tuple(int(FONDO[i] + (FONDO_2[i] - FONDO[i]) * k) for i in range(3)))

# El resplandor del acento, abajo a la izquierda: una mascara difuminada que decide CUANTO
# acento se mezcla en cada pixel. La version anterior encadenaba dos `blend` con alpha 0.0
# —o sea, no pintaba nada— y el fondo quedaba plano.
masc_glow = Image.new('L', (W, H), 0)
ImageDraw.Draw(masc_glow).ellipse([-420, H - 170, 560, H + 320], fill=34)
masc_glow = masc_glow.filter(ImageFilter.GaussianBlur(170))
img = Image.composite(Image.new('RGB', (W, H), ACENTO), img, masc_glow)
dib = ImageDraw.Draw(img)

# ── La foto del autor, si la hay: mitad derecha, difuminada hacia la izquierda ────────────
HAY_FOTO = bool(a.foto) and os.path.exists(a.foto)
# ⚠️ Las DOS variantes reservan la derecha: con foto para la foto, sin foto para el
#    monograma. Darle el 78% al texto cuando no hay foto lo hacia chocar contra las
#    iniciales — y un titulo cruzado por una letra gigante es peor que el vacio que
#    el monograma venia a llenar.
ANCHO_TEXTO = int(W * 0.52) if HAY_FOTO else int(W * 0.60)

if HAY_FOTO:
    foto = Image.open(a.foto).convert('RGB')
    cw, ch = int(W * 0.56), H
    # recorte "cover": se llena la caja y se centra, sin deformar
    escala = max(cw / foto.width, ch / foto.height)
    foto = foto.resize((max(1, int(foto.width * escala)), max(1, int(foto.height * escala))), Image.LANCZOS)
    ix, iy = (foto.width - cw) // 2, max(0, int(foto.height * 0.06))
    foto = foto.crop((ix, iy, ix + cw, min(foto.height, iy + ch)))
    if foto.height < ch:
        foto = foto.resize((cw, ch), Image.LANCZOS)

    # ⚠️ La mascara NO es un degrade lineal de punta a punta: la foto se desvanece solo en
    #    su TERCIO izquierdo. Con un degrade completo la cara —que esta al medio— queda
    #    semitransparente y la portada se ve lavada, que es justo el defecto que se venia
    #    a arreglar.
    masc = Image.new('L', (cw, ch), 255)
    md = ImageDraw.Draw(masc)
    corte = int(cw * 0.34)
    for x in range(corte):
        md.line([(x, 0), (x, ch)], fill=int(255 * (x / corte) ** 1.5))
    img.paste(foto, (W - cw, 0), masc)
    dib = ImageDraw.Draw(img)

# ── Sin foto: un monograma gigante en el lugar que ocuparia la foto ──────────────────────
# ⚠️ Una portada tipografica con el titulo centrado y el resto vacio NO se lee como una
#    decision de diseno: se lee como una portada a la que le falto la imagen. La mitad
#    derecha necesita ocuparse con ALGO, y lo unico que se puede derivar del curso sin
#    inventar nada son sus propias iniciales.
if not HAY_FOTO:
    iniciales = ''.join(p[0] for p in a.titulo.split() if p[:1].isalnum())[:3].upper() or '?'
    ZONA = int(W * 0.40)                     # la franja derecha, la misma que ocuparia la foto
    # El cuerpo se ajusta a la ZONA: con 3 iniciales a cuerpo fijo el monograma se sale del
    # lienzo y queda cortado por el borde, que se ve como un error de render.
    mpx = 460
    while mpx > 120:
        fm = fuente(NEGRA, mpx)
        bb = ImageDraw.Draw(Image.new('L', (1, 1))).textbbox((0, 0), iniciales, font=fm)
        if (bb[2] - bb[0]) <= ZONA - 40:
            break
        mpx -= 10
    fm = fuente(NEGRA, mpx)
    tmp = ImageDraw.Draw(Image.new('L', (1, 1)))
    x0, y0, x1, y1 = tmp.textbbox((0, 0), iniciales, font=fm)
    mx = W - (x1 - x0) - 44 - x0
    my = (H - (y1 - y0)) // 2 - y0
    capa = Image.new('RGB', (W, H), ACENTO)
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).text((mx, my), iniciales, font=fm, fill=46)
    img = Image.composite(capa, img, m)
    dib = ImageDraw.Draw(img)

# ── El texto ─────────────────────────────────────────────────────────────────────────────
X = 68
tope = ANCHO_TEXTO - 40

cejilla = (a.cejilla or '').upper()
y = 96
if cejilla:
    fc = fuente(SEMI, 24)
    dib.text((X, y), cejilla, font=fc, fill=ACENTO)
    y += 44

# ⚠️ El cuerpo se AJUSTA al contenido: «AE Mastery» y «Formula Ventas Ilimitadas 2024» no
#    pueden salir al mismo tamano o el segundo se va de la caja. Se baja de 92 a 46 hasta
#    que entre en 3 lineas, que es el maximo legible en una tarjeta de grilla.
titulo = a.titulo.strip()
px, lineas = 92, []
while px >= 46:
    ft = fuente(NEGRA, px)
    lineas = envolver(dib, titulo.upper(), ft, tope)
    if len(lineas) <= 3 and max((ancho(dib, l, ft) for l in lineas), default=0) <= tope:
        break
    px -= 4
ft = fuente(NEGRA, px)
alto_linea = int(px * 1.06)

# El bloque se centra vertical en el area util, para que un titulo de 1 linea no quede
# flotando arriba con un vacio abajo.
alto_total = len(lineas) * alto_linea + (int(px * 0.30) + 26 + 38 if a.autor else 0)
y = max(y, (H - alto_total) // 2)
for l in lineas:
    dib.text((X, y), l, font=ft, fill=TINTA)
    y += alto_linea

if a.autor:
    # ⚠️ El aire va en PROPORCION AL CUERPO, no en pixeles fijos. Con 18 px fijos la barra
    #    dorada pisaba el titulo cuando el cuerpo era grande: `alto_linea` deja el cursor
    #    justo debajo de la caja de linea, y a 92 px los trazos de Arial Black llegan mas
    #    abajo que a 46. Es la misma familia que medir una baseline con una caja de linea.
    y += int(px * 0.30)
    dib.rectangle([X, y, X + 72, y + 5], fill=ACENTO)
    y += 26
    fa = fuente(SEMI, 30)
    dib.text((X, y), a.autor, font=fa, fill=ACENTO)

os.makedirs(a.salida, exist_ok=True)
destino = os.path.join(a.salida, a.slug + '.jpg')
img.save(destino, 'JPEG', quality=90, optimize=True)
print('  -> ' + destino + ('  (con foto)' if HAY_FOTO else '  (solo tipografia)'))
