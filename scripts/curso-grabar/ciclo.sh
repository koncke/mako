#!/usr/bin/env bash
# Espera el fin de una clase (silencio >= 6 s) o una hora límite, y resume la salud del audio y del video.
#   bash ciclo.sh <segundos_maximos>
B=C:/cursos/programa-meta-ads-the-net-lab
r=$(bash $B/grabar/esperar.sh $(( $(date +%s) + ${1:-540} )) 6)
python - "$r" <<'PYEOF'
import json, sys, os
B = "C:/cursos/programa-meta-ads-the-net-lab"
a = json.load(open(f"{B}/audio/crudo/estado.json"))
v = json.load(open(f"{B}/video/crudo/estado.json"))
sup = open(f"{B}/video/crudo/supervisor.log", encoding="utf-8").read().strip().splitlines()[-1]
h = json.load(open(f"{B}/grabar/hecho.json", encoding="utf-8")) if os.path.exists(f"{B}/grabar/hecho.json") else {}
est = {}
for k, x in h.items(): est[x["estado"]] = est.get(x["estado"], 0) + 1
import time
print(sys.argv[1], "| audio", a["db"], "dB, mudo", a.get("sin_sonido"), "s | video", v["sesion"], "cuadros", v["frame"], "dup", v["dup"],
      "hace", round(time.time() - v["reloj"]), "s |", sup[20:], "| hecho", est)
PYEOF
