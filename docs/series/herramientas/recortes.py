# Vuelve a medir los cortes de escena SIN las franjas negras (la primera versión de procesar.py los medía sobre el video ya
# achicado a 180×320 con franjas, y en los horizontales daba casi cero). Reescribe cortes_s y cortes_por_min en meta.json.
#   python -I tools/recortes.py <cuenta>
import sys, json, pathlib, subprocess, re
sys.stdout.reconfigure(encoding='utf-8')  # python -I ignora PYTHONIOENCODING y la consola es cp1252
BASE = pathlib.Path('C:/dev/referentes-videos')
for d in sorted((BASE / sys.argv[1]).iterdir()):
    mp, v = d / 'meta.json', d / 'video.mp4'
    if not mp.exists() or not v.exists():
        continue
    m = json.load(open(mp, encoding='utf-8'))
    if m.get('cortes_sin_franjas'):
        continue
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(v), '-vf', "scale=320:-2,select='gt(scene,0.30)',showinfo", '-an', '-f', 'null', '-'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    cs = [round(float(t), 2) for t in re.findall(r'pts_time:([0-9.]+)', r.stderr)]
    antes = len(m.get('cortes_s') or [])
    m['cortes_s'], m['cortes_sin_franjas'] = cs, True
    m['cortes_por_min'] = round(len(cs) / m['duracion_s'] * 60, 1) if m.get('duracion_s') else None
    json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if len(cs) != antes:
        print(d.name, antes, '→', len(cs))
