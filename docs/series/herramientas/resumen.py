# Resumen compacto de los reels ya procesados de una cuenta, para que lo lea un agente.
#   python -I tools/resumen.py <cuenta> [--desde N] [--hasta M]
# Por reel: link, reproducciones (las de la grilla de Instagram o las de YouTube), fecha, duración, texto de la publicación,
# primera palabra, palabras por segundo, cortes de escena y la transcripción con su segundo. La hoja de cuadros está en
# C:/dev/referentes-videos/<cuenta>/<id>/hoja.jpg (fila 1: el gancho, 0 a 18 s; fila 2: el resto del video, parejo).
import sys, json, pathlib
sys.stdout.reconfigure(encoding='utf-8')
BASE = pathlib.Path('C:/dev/referentes-videos')
cuenta = sys.argv[1]
desde = int(sys.argv[sys.argv.index('--desde') + 1]) if '--desde' in sys.argv else 1
hasta = int(sys.argv[sys.argv.index('--hasta') + 1]) if '--hasta' in sys.argv else 999
d = BASE / cuenta
vistas = {}
if (d / 'lista-ig.json').exists():
    for h, v in json.load(open(d / 'lista-ig.json', encoding='utf-8')):
        vistas[h.rstrip('/').split('/')[-1]] = v
if (d / 'lista-yt.txt').exists():
    for l in open(d / 'lista-yt.txt', encoding='utf-8'):
        p = l.strip().split('|')
        if len(p) >= 2:
            vistas[p[0]] = p[1]
urls = [u.strip() for u in open(d / 'urls.txt', encoding='utf-8') if u.strip()]
ids = [u.rstrip('/').split('/')[-1] for u in urls]
hechos = [i for i in ids if (d / i / 'meta.json').exists()]
print(f'# {cuenta}: {len(hechos)} reels procesados de {len(ids)} links (orden: del más nuevo al más viejo)')
faltan = [i for i in ids if i not in hechos]
if faltan:
    print(f'# SIN PROCESAR ({len(faltan)}): {", ".join(faltan)}')
for n, i in enumerate(hechos, 1):
    if n < desde or n > hasta:
        continue
    m = json.load(open(d / i / 'meta.json', encoding='utf-8'))
    cortes = m.get('cortes_s') or []
    print(f"\n## {n}. {i}  {m['url']}")
    print(f"reproducciones: {vistas.get(i, m.get('vistas'))} · likes: {m.get('likes')} · comentarios: {m.get('comentarios')} · fecha: {m.get('fecha')}")
    print(f"duración: {m['duracion_s']} s · {m.get('ancho')}x{m.get('alto')} · idioma: {m.get('idioma')} · primera palabra: {m.get('primera_palabra_s')} s · {m.get('palabras_por_seg')} palabras/s")
    print(f"cortes de escena: {len(cortes)} ({m.get('cortes_por_min')}/min) en: {', '.join(str(c) for c in cortes[:40])}{' …' if len(cortes) > 40 else ''}")
    cap = (m.get('caption') or '').replace('\n', ' ⏎ ')
    print(f"texto de la publicación: {cap[:600]}{' …' if len(cap) > 600 else ''}")
    if (d / i / 'audio.json').exists():
        au = json.load(open(d / i / 'audio.json', encoding='utf-8'))
        print(f"audio (medido, tools/audio.py): {au['veredicto']} · voz {au['voz_db']} dB · antes de la primera palabra {au['antes_de_la_primera_palabra_db']} dB")
    print(f"hoja de cuadros: {d / i / 'hoja.jpg'} (segundos: {', '.join(str(t) for t in m.get('hoja_tiempos_s', []))})")
    print('transcripción:')
    for s in m.get('segmentos', []):
        print(f"  [{s['ini']:.1f}] {s['texto']}")
