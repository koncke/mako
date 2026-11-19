# Carruseles y posts de imagen: cada lámina con su texto. Para lo que NO es reel (los reels van por procesar.py).
#   python -I tools/publicaciones.py <cuenta> <archivo-con-urls>
# Deja en C:/dev/referentes-videos/<cuenta>/pub/<id>/: lamina_NN.jpg, meta.json (tipo, fecha, likes, comentarios, texto de la
# publicación y el texto de cada lámina leído con RapidOCR) y hoja.jpg (todas las láminas numeradas, para mirarlas de una).
# yt-dlp da cada lámina como una entrada: las de imagen traen sólo la URL de la imagen (thumbnail); las de video, formatos
# (de esas se guarda el primer cuadro). Pausa de 4 a 7 s entre publicaciones: ritmo de persona, sin ráfagas.
import sys, json, subprocess, pathlib, time, random, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
BASE = pathlib.Path('C:/dev/referentes-videos')
cuenta, lista = sys.argv[1], sys.argv[2]
salida = BASE / cuenta / 'pub'
salida.mkdir(parents=True, exist_ok=True)
ocr = None
SIN_OCR = '--sin-ocr' in sys.argv  # 19/11: RapidOCR en CPU tardaba 41 s por lámina con la PC cargada; el texto lo lee el agente en la hoja

def leer_texto(img):
    global ocr
    if SIN_OCR:
        return None
    if ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        ocr = RapidOCR()
    res, _ = ocr(str(img))
    if not res:
        return ''
    # de arriba abajo y de izquierda a derecha, por renglones
    filas = sorted(res, key=lambda r: (round(r[0][0][1] / 25), r[0][0][0]))
    return ' '.join(r[1] for r in filas if r[2] > 0.5)

def bajar(url, destino):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        destino.write_bytes(r.read())

def hoja(imgs, destino):
    from PIL import Image, ImageDraw, ImageFont
    W = 480  # grande: el texto de cada lámina se tiene que poder leer en la hoja
    cols = min(3, len(imgs))
    ims = [Image.open(i).convert('RGB') for i in imgs]
    H = max(int(W * im.height / im.width) for im in ims)
    filas = (len(ims) + cols - 1) // cols
    lienzo = Image.new('RGB', (cols * W, filas * (H + 24)), 'black')
    f = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 22)
    for k, im in enumerate(ims):
        x, y = (k % cols) * W, (k // cols) * (H + 24)
        lienzo.paste(im.resize((W, int(W * im.height / im.width))), (x, y + 24))
        ImageDraw.Draw(lienzo).text((x + 6, y + 2), f'lámina {k + 1}', fill='yellow', font=f)
    lienzo.save(destino, quality=82)

if '--rehacer-hojas' in sys.argv:  # vuelve a armar las hojas de lo ya bajado, sin red
    for d in sorted(salida.iterdir()):
        imgs = sorted(d.glob('lamina_*.jpg'))
        if imgs:
            hoja(imgs, d / 'hoja.jpg')
    sys.exit(0)
urls = [u.strip() for u in open(lista, encoding='utf-8') if u.strip() and not u.startswith('#')]
for n, url in enumerate(urls, 1):
    pid = url.rstrip('/').split('/')[-1]
    d = salida / pid
    if (d / 'meta.json').exists():
        continue
    d.mkdir(exist_ok=True)
    r = subprocess.run(['yt-dlp', '--no-update', '--ignore-no-formats-error', '--dump-single-json', url],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    try:
        info = json.loads(r.stdout)
    except Exception:
        info = None
    if not isinstance(info, dict):  # yt-dlp a veces imprime «null» (publicación restringida o borrada)
        print(f'[{n}/{len(urls)}] {pid} NO SE LEYÓ: {r.stderr.strip()[-200:]}', flush=True)
        time.sleep(random.uniform(4, 7))
        continue
    entradas = info.get('entries') or [info]
    laminas, imgs = [], []
    for k, e in enumerate(entradas, 1):
        th = e.get('thumbnails') or []
        mejor = max(th, key=lambda t: (t.get('width') or 0) * (t.get('height') or 0) or t.get('preference') or 0) if th else {}
        src = mejor.get('url') or e.get('thumbnail')
        img = d / f'lamina_{k:02d}.jpg'
        if src:
            try:
                bajar(src, img)
            except Exception as ex:
                print('  no bajó la lámina', k, ex)
        es_video = bool(e.get('formats'))
        texto = leer_texto(img) if img.exists() else ''
        laminas.append({'n': k, 'tipo': 'video' if es_video else 'imagen', 'duracion_s': e.get('duration'), 'texto_ocr': texto})
        if img.exists():
            imgs.append(img)
    tipo = 'carrusel' if info.get('_type') == 'playlist' else ('video' if info.get('formats') else 'imagen')
    if imgs:
        hoja(imgs, d / 'hoja.jpg')
    meta = {'cuenta': cuenta, 'id': pid, 'url': url, 'tipo': tipo, 'fecha': info.get('upload_date'),
            'likes': info.get('like_count'), 'comentarios': info.get('comment_count'),
            'caption': info.get('description'), 'n_laminas': len(laminas), 'laminas': laminas,
            'autor': info.get('channel') or info.get('uploader_id')}
    json.dump(meta, open(d / 'meta.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'[{n}/{len(urls)}] {pid} {tipo}, {len(laminas)} láminas, {info.get("upload_date")}', flush=True)
    time.sleep(random.uniform(4, 7))
print('fin', flush=True)
