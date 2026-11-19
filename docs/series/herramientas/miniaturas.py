# Miniaturas propias para el artefacto (la portada del CDN de Instagram vence a las horas).
#   python -I tools/miniaturas.py <salida-dir> <cuenta>:<id>[@segundo] ...
# Saca un cuadro de 216×384 del video ya bajado (por defecto, el segundo 1: el gancho) y lo guarda como <salida>/<id>.jpg.
import sys, pathlib, subprocess
sys.stdout.reconfigure(encoding='utf-8')  # python -I ignora PYTHONIOENCODING y la consola es cp1252
BASE = pathlib.Path('C:/dev/referentes-videos')
salida = pathlib.Path(sys.argv[1]); salida.mkdir(parents=True, exist_ok=True)
for arg in sys.argv[2:]:
    cuenta, resto = arg.split(':', 1)
    vid, _, seg = resto.partition('@')
    destino = salida / f'{vid}.jpg'
    if destino.exists():
        continue
    v = BASE / cuenta / vid / 'video.mp4'
    if not v.exists():
        print('sin video', arg); continue
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', seg or '1', '-i', str(v), '-frames:v', '1',
                    '-vf', 'scale=216:384:force_original_aspect_ratio=increase,crop=216:384', '-q:v', '6', str(destino)])
    print(destino.name, destino.stat().st_size if destino.exists() else 'FALLÓ')
