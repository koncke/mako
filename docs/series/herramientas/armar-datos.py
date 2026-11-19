# Arma artefacto/datos.js (lo que lee la página) desde las propuestas y el relevo juntado, y saca las miniaturas.
#   python -I tools/armar-datos.py
# Entradas: artefacto/propuestas.json (los temas para Martín) y artefacto-datos.json (lo que escribió el que junta).
# El costo sale de la duración de IA del formato: Omni 1.2 Flash por ApiMart a US$0,024 por segundo (24 MT), más dos imágenes
# de partida a US$0,012 cada una. «Con un reintento» = un segundo intento del video.
import json, pathlib, subprocess, sys
import sys; sys.stdout.reconfigure(encoding='utf-8')  # python -I ignora PYTHONIOENCODING y la consola es cp1252
BASE = pathlib.Path('C:/dev/referentes-videos')
A = BASE / 'artefacto'
USD_S, USD_IMG = 0.024, 0.012
prop = json.load(open(A / 'propuestas.json', encoding='utf-8'))
rel = json.load(open(BASE / 'artefacto-datos.json', encoding='utf-8')) if (BASE / 'artefacto-datos.json').exists() else {'referentes': []}

def repro(cuenta, vid):
    p = BASE / cuenta / 'lista-ig.json'
    if p.exists():
        for h, v in json.load(open(p, encoding='utf-8')):
            if h.rstrip('/').endswith(vid):
                v = v.replace(',', '')
                return int(float(v[:-1]) * 1000) if v.endswith('K') else int(float(v[:-1]) * 1e6) if v.endswith('M') else int(v)
    return None

miniaturas = set()
salida = []
for n, p in enumerate(prop['propuestas'], 1):
    f = prop['formatos'][p['formato']]
    s = f['seg_ia']
    usd = round(s * USD_S + (2 * USD_IMG if s else 0), 2)
    refs = []
    for cuenta, vid, nota in p.get('refs', []):
        refs.append({'cuenta': cuenta, 'id': vid, 'url': f'https://www.instagram.com/reel/{vid}/', 'reproducciones': repro(cuenta, vid), 'nota': nota})
        miniaturas.add(f'{cuenta}:{vid}')
    salida.append({
        'id': p['id'], 'n': f'{n:02d}', 'grupo': p['grupo'], 'tema': p['tema'], 'porque': p['porque'], 'ganchos': p['ganchos'],
        'inspirado': p.get('inspirado', []),
        'formato': {'nombre': f['nombre'], 'gancho_que': p['gancho_que'], 'persona': f['persona'], 'cta': p['cta']},
        'estructura': p.get('estructura') or f['estructura'],
        'costo': {'seg_ia': s, 'usd': usd, 'mt': round(usd * 1000), 'usd_con_reintento': round(usd + s * USD_S, 2)},
        'referentes': refs,
    })

for r in rel.get('referentes', []):
    for m in r.get('mejores', []):
        miniaturas.add(f"{r['cuenta']}:{m['id']}")

formatos = [{'id': k, 'nombre': f['nombre'], 'seg_ia': f['seg_ia'], 'rinde': f.get('rinde', ''),
             'usd': round(f['seg_ia'] * USD_S + (2 * USD_IMG if f['seg_ia'] else 0), 2)} for k, f in prop['formatos'].items()]
for f in formatos:
    f['mt'] = round(f['usd'] * 1000); f['usd_con_reintento'] = round(f['usd'] + f['seg_ia'] * USD_S, 2)
datos = {'actualizado': '19/11/2026', 'formatos': formatos, 'contra_el_pedido': rel.get('contra_el_pedido', ''), 'costo': {'usd_por_s': USD_S, 'mt_por_s': 24, 'imagen_usd': USD_IMG},
         'propuestas': salida, 'referentes': rel.get('referentes', []),
         'receta_comun': rel.get('receta_comun', []), 'diferencias': rel.get('diferencias', [])}
(A / 'datos.js').write_text('window.DATOS = ' + json.dumps(datos, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
print('propuestas', len(salida), '· referentes', len(datos['referentes']), '· miniaturas', len(miniaturas))
if miniaturas:
    subprocess.run([sys.executable, '-I', str(BASE / 'tools/miniaturas.py'), str(A / 'img'), *sorted(miniaturas)])
