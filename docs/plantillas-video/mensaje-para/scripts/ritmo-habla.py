# Compara el ritmo del habla de Josep con el de nuestros clips: duración de cada tramo hablado,
# palabras/s, huecos entre palabras, pausas entre frases, silencio antes de la 1.ª palabra y después de la última.
import json, sys, statistics as st
sys.stdout.reconfigure(encoding='utf-8')
J = json.load(open('josep/palabras-josep.json', encoding='utf-8'))['palabras']
cortes = [0, 2.90, 3.50, 4.53, 5.13, 8.60, 9.60, 12.57, 13.20, 16.40, 17.03, 20.63]
habladas = [(0, 2.90), (3.50, 4.53), (5.13, 8.60), (9.60, 12.57), (13.20, 16.40), (17.03, 20.63)]
def stats(nombre, ini, fin, ws):
    if not ws: return None
    huecos = [ws[k+1]['a'] - ws[k]['b'] for k in range(len(ws)-1)]
    habla = ws[-1]['b'] - ws[0]['a']
    r = dict(tramo=nombre, dura=round(fin-ini, 2), palabras=len(ws), habla_s=round(habla, 2),
             pal_por_s=round(len(ws)/habla, 2), pal_por_s_tramo=round(len(ws)/(fin-ini), 2),
             hueco_mediana_ms=round(st.median(huecos)*1000) if huecos else 0,
             hueco_max_ms=round(max(huecos)*1000) if huecos else 0,
             antes_ms=round((ws[0]['a']-ini)*1000), despues_ms=round((fin-ws[-1]['b'])*1000))
    return r
filas = []
for k, (a, b) in enumerate(habladas):
    ws = [w for w in J if w['a'] >= a - 0.05 and w['a'] < b]
    filas.append(stats(f'Josep {k+1}', a, b, ws))
# Nuestros: los tramos tal como están en el montaje v1 (a, b dentro de cada clip)
nuestros = [(1, 0.45, 3.75), (2, 0.12, 1.25), (2, 1.80, 6.10), (3, 0.55, 6.40), (4, 0.30, 6.45), (5, 0.35, 6.10), (5, 7.15, 11.90)]
for n, a, b in nuestros:
    P = json.load(open(f'montaje/palabras-{n}.json', encoding='utf-8'))['palabras']
    ws = [w for w in P if w['a'] >= a and w['a'] < b]
    filas.append(stats(f'Martín clip {n} [{a}-{b}]', a, b, ws))
cols = ['tramo','dura','palabras','habla_s','pal_por_s','pal_por_s_tramo','hueco_mediana_ms','hueco_max_ms','antes_ms','despues_ms']
print(' | '.join(cols))
for f in filas: print(' | '.join(str(f[c]) for c in cols))
jo = [f for f in filas if f['tramo'].startswith('Josep')]; ma = [f for f in filas if f['tramo'].startswith('Mart')]
tot = lambda fs, k: sum(f[k] for f in fs)
print(f"\nJosep: {tot(jo,'palabras')} palabras en {tot(jo,'dura'):.2f} s de tramos = {tot(jo,'palabras')/tot(jo,'dura'):.2f} pal/s · habla pura {tot(jo,'palabras')/tot(jo,'habla_s'):.2f} pal/s · tramo medio {tot(jo,'dura')/len(jo):.2f} s")
print(f"Martín: {tot(ma,'palabras')} palabras en {tot(ma,'dura'):.2f} s de tramos = {tot(ma,'palabras')/tot(ma,'dura'):.2f} pal/s · habla pura {tot(ma,'palabras')/tot(ma,'habla_s'):.2f} pal/s · tramo medio {tot(ma,'dura')/len(ma):.2f} s")
json.dump(filas, open('josep/ritmo-habla.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
