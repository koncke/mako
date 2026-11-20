# ¿Hay música o efectos debajo de la voz? Se mide el nivel en los HUECOS sin voz (entre los segmentos de la transcripción)
# contra el nivel mientras habla. Sin música, los huecos caen a ruido de sala (-50 dB o menos); con música de fondo quedan
# arriba de -40 dB. Se usa el PISO del clip entero (percentil 5). Es una señal, no una certeza: un efecto suelto también sube un hueco.
#   python -I tools/audio.py <cuenta>      → escribe <cuenta>/<id>/audio.json en los reels que no lo tengan
import sys, json, pathlib, subprocess
sys.stdout.reconfigure(encoding='utf-8')  # python -I ignora PYTHONIOENCODING y la consola es cp1252
import numpy as np
BASE = pathlib.Path('C:/dev/referentes-videos')
cuenta = sys.argv[1]
for d in sorted((BASE / cuenta).iterdir()):
    meta_p, out_p = d / 'meta.json', d / 'audio.json'
    if not meta_p.exists() or out_p.exists() or not (d / 'video.mp4').exists():
        continue
    m = json.load(open(meta_p, encoding='utf-8'))
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(d / 'video.mp4'), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
                       capture_output=True)
    a = np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0
    if a.size == 0:
        continue
    win = 800  # 50 ms
    n = a.size // win
    rms = np.sqrt(np.mean(a[:n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    t = np.arange(n) * 0.05
    habla = np.zeros(n, bool)
    for s in m.get('segmentos', []):
        habla |= (t >= s['ini']) & (t < s['fin'])
    hueco = ~habla
    def mediana(mask):
        return round(float(np.median(db[mask])), 1) if mask.sum() >= 6 else None
    primera = m.get('primera_palabra_s') or 0
    intro = (t < primera) if primera >= 0.6 else np.zeros(n, bool)
    nh, nv = mediana(hueco), mediana(habla)
    nivel_intro = mediana(intro)
    # El piso (percentil 5 de los tramos de 50 ms) es la señal más firme: con los segmentos de whisper los «huecos» incluyen
    # colas de palabras. Medido 19/11 en Ramiro: piso -30 a -38 dB en casi todos (fondo constante), -50 en uno (silencio real).
    piso = round(float(np.percentile(db, 5)), 1)
    if piso <= -45:
        veredicto = 'sin fondo: entre frases hay silencio (no hay música debajo)'
    elif piso > -40:
        veredicto = f'fondo constante (música o ambiente) a {piso} dB, {round(nv - piso) if nv else "?"} dB debajo de la voz'
    else:
        veredicto = f'dudoso: piso a {piso} dB'
    json.dump({'piso_db': piso, 'voz_db': nv, 'huecos_db': nh, 'segundos_de_hueco': round(float(hueco.sum()) * 0.05, 1),
               'antes_de_la_primera_palabra_db': nivel_intro, 'veredicto': veredicto},
              open(out_p, 'w', encoding='utf-8'), ensure_ascii=False)
    print(d.name, nv, nh, nivel_intro, veredicto)
