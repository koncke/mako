# Baja y desarma reels de referentes, de a uno: video, transcripción con tiempos, cortes y una hoja de cuadros.
#   python -I tools/procesar.py <cuenta> <archivo-con-urls> [--modelo small]
# Deja en C:/dev/referentes-videos/<cuenta>/<id>/: video.mp4, info (yt-dlp), meta.json y hoja.jpg.
# Una línea por reel en <cuenta>/progreso.log. Si el meta.json ya existe, lo saltea (se puede relanzar).
import sys, json, subprocess, re, time, pathlib, os

BASE = pathlib.Path('C:/dev/referentes-videos')
cuenta, lista = sys.argv[1], sys.argv[2]
modelo_nombre = sys.argv[sys.argv.index('--modelo') + 1] if '--modelo' in sys.argv else 'small'
dir_cuenta = BASE / cuenta
dir_cuenta.mkdir(parents=True, exist_ok=True)
log = open(dir_cuenta / 'progreso.log', 'a', encoding='utf-8')

def anotar(s):
    linea = time.strftime('%H:%M:%S') + ' ' + s
    print(linea, flush=True)
    log.write(linea + '\n'); log.flush()

def id_de(url):
    m = re.search(r'/(?:reel|reels|p|shorts)/([A-Za-z0-9_-]+)', url) or re.search(r'v=([A-Za-z0-9_-]+)', url)
    return m.group(1) if m else re.sub(r'\W+', '_', url)[-20:]

def correr(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', **kw)

modelo = None
def transcribir(wav):
    global modelo
    if modelo is None:
        # ctranslate2 busca cublas64_12.dll y cudnn en el PATH; están dentro de torch/lib
        import importlib.util
        lib = pathlib.Path(importlib.util.find_spec('torch').origin).parent / 'lib'
        if lib.exists():
            os.add_dll_directory(str(lib))
            os.environ['PATH'] = str(lib) + os.pathsep + os.environ['PATH']
        from faster_whisper import WhisperModel
        try:
            modelo = WhisperModel(modelo_nombre, device='cuda', compute_type='float16')
        except Exception as e:
            anotar(f'sin GPU ({e}); voy por CPU')
            modelo = WhisperModel(modelo_nombre, device='cpu', compute_type='int8')
    # faster-whisper abre el archivo con PyAV y la versión instalada rompe (metadata_errors): se le pasa el audio ya leído
    import wave, numpy as np
    with wave.open(str(wav), 'rb') as w:
        audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    segs, info = modelo.transcribe(audio, beam_size=5, word_timestamps=True, vad_filter=False)
    out = []
    for s in segs:
        out.append({'ini': round(s.start, 2), 'fin': round(s.end, 2), 'texto': s.text.strip(),
                    'palabras': [[round(w.start, 2), round(w.end, 2), w.word] for w in (s.words or [])]})
    return out, info.language

W, H = 180, 320

def cortes_y_cuadros(video, d):
    # UNA pasada: cuadros a 2 por segundo (chicos) y los cortes de escena. Antes eran 24 búsquedas y tardaba 5 min por video.
    cdir = d / '_cuadros'
    cdir.mkdir(exist_ok=True)
    # Los cortes se miden SIN las franjas negras: con el video horizontal metido en 180×320, las franjas diluían el puntaje de
    # escena y daban 0 a 1,4 cortes por minuto donde había 4 a 26 (lo encontró el lector de Ramiro, 19/11).
    fc = (f"[0:v]split=2[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,fps=2[f];"
          "[b]scale=320:-2,select='gt(scene,0.30)',showinfo[s]")
    r = correr(['ffmpeg', '-hide_banner', '-y', '-i', str(video), '-filter_complex', fc,
                '-map', '[f]', '-q:v', '5', str(cdir / 'f_%04d.jpg'), '-map', '[s]', '-f', 'null', '-'])
    cs = [round(float(t), 2) for t in re.findall(r'pts_time:([0-9.]+)', r.stderr)]
    return cs, cdir

def hoja(cdir, dur, destino):
    from PIL import Image, ImageDraw, ImageFont
    gancho = [t for t in [0, 0.5, 1, 1.5, 2.5, 3.5, 5, 7, 9, 11, 13, 15, 18] if t < dur - 0.3]
    resto_n = 11
    resto = [round(20 + (dur - 21) * i / (resto_n - 1), 1) for i in range(resto_n)] if dur > 26 else []
    tiempos = gancho + resto
    cols = 12
    filas = (len(tiempos) + cols - 1) // cols
    img = Image.new('RGB', (cols * W, filas * (H + 22)), 'black')
    fuente = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 16)
    archivos = sorted(cdir.glob('f_*.jpg'))
    for i, t in enumerate(tiempos):
        x, y = (i % cols) * W, (i // cols) * (H + 22)
        k = min(int(round(t * 2)), len(archivos) - 1)
        if archivos:
            img.paste(Image.open(archivos[k]).convert('RGB'), (x, y + 22))
        ImageDraw.Draw(img).text((x + 4, y + 2), f'{t:.1f}s', fill='yellow', font=fuente)
    img.save(destino, quality=80)
    for f in archivos:
        f.unlink()
    cdir.rmdir()
    return tiempos

urls = [u.strip() for u in open(lista, encoding='utf-8') if u.strip() and not u.startswith('#')]
anotar(f'{cuenta}: {len(urls)} links, modelo {modelo_nombre}')
for n, url in enumerate(urls, 1):
    vid = id_de(url)
    d = dir_cuenta / vid
    if (d / 'meta.json').exists():
        continue
    d.mkdir(exist_ok=True)
    t0 = time.time()
    r = correr(['yt-dlp', '--no-update', '-f', 'bv*[height<=1280]+ba/b[height<=1280]/bv*+ba/b', '--merge-output-format', 'mp4',
                '-o', str(d / 'video.%(ext)s'), '--write-info-json', '--no-write-playlist-metafiles', '--no-playlist', url])
    video = d / 'video.mp4'
    if not video.exists():
        anotar(f'[{n}/{len(urls)}] {vid} NO BAJÓ: {r.stderr.strip()[-300:]}')
        continue
    info = json.load(open(d / 'video.info.json', encoding='utf-8'))
    pr = json.loads(correr(['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', str(video)]).stdout)
    dur = float(pr['format']['duration'])
    vs = next((s for s in pr['streams'] if s['codec_type'] == 'video'), {})
    t1 = time.time()
    wav = d / 'audio.wav'
    correr(['ffmpeg', '-hide_banner', '-y', '-i', str(video), '-ac', '1', '-ar', '16000', str(wav)])
    segs, idioma = transcribir(wav) if wav.exists() else ([], None)
    wav.unlink(missing_ok=True)
    t2 = time.time()
    cs, cdir = cortes_y_cuadros(video, d)
    tiempos = hoja(cdir, dur, d / 'hoja.jpg')
    t3 = time.time()
    palabras = [p for s in segs for p in s['palabras']]
    texto = ' '.join(s['texto'] for s in segs)
    meta = {
        'cuenta': cuenta, 'id': vid, 'url': url,
        'fecha': info.get('upload_date'), 'titulo': info.get('title'), 'caption': info.get('description'),
        'vistas': info.get('view_count'), 'likes': info.get('like_count'), 'comentarios': info.get('comment_count'),
        'miniatura': info.get('thumbnail'),
        'duracion_s': round(dur, 2), 'ancho': vs.get('width'), 'alto': vs.get('height'), 'fps': vs.get('r_frame_rate'),
        'idioma': idioma, 'primera_palabra_s': palabras[0][0] if palabras else None,
        'palabras': len(palabras), 'palabras_por_seg': round(len(palabras) / dur, 2) if dur else None,
        'cortes_s': cs, 'cortes_por_min': round(len(cs) / dur * 60, 1) if dur else None,
        'hoja_tiempos_s': tiempos,
        'transcripcion': texto, 'segmentos': [{k: s[k] for k in ('ini', 'fin', 'texto')} for s in segs],
        # El tiempo de cada palabra: sin esto, el segundo exacto en que termina el gancho o empieza el CTA queda a ±3 s.
        'palabras_t': palabras,
        'tiempos_proceso_s': {'bajar': round(t1 - t0, 1), 'transcribir': round(t2 - t1, 1), 'cuadros': round(t3 - t2, 1)},
    }
    json.dump(meta, open(d / 'meta.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    anotar(f'[{n}/{len(urls)}] {vid} {dur:.0f}s, {len(palabras)} palabras, {len(cs)} cortes · bajar {t1-t0:.0f}s, transcribir {t2-t1:.0f}s, cuadros {t3-t2:.0f}s')
anotar('fin')
