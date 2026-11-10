# Suma al log local las entradas nuevas que devolvió la página (sin duplicar).
#   python -I agregar_log.py '<json de entradas>'
import json, sys
G = "C:/cursos/programa-meta-ads-the-net-lab/grabar"
log = json.load(open(f"{G}/log.json", encoding="utf-8"))
vistos = {(x["n"], x["j"], x.get("marcaIni")) for x in log}
def expandir(x):   # formato compacto de la página: [n, j, marcaIni, inicio, marcaFin, dur, ok, reinicio]
    if isinstance(x, dict): return x
    e = {"n": x[0], "j": x[1], "marcaIni": x[2], "inicio": x[3], "marcaFin": x[4], "fin": x[4], "dur": x[5], "ok": bool(x[6])}
    if len(x) > 7 and x[7]: e["reinicio"] = x[7]
    return e
nuevas = [e for e in map(expandir, json.loads(sys.argv[1])) if (e["n"], e["j"], e.get("marcaIni")) not in vistos]
log += nuevas
json.dump(log, open(f"{G}/log.json", "w", encoding="utf-8"))
print("nuevas", len(nuevas), "total", len(log))
