#!/usr/bin/env bash
# Espera hasta que la ventana de la grabación vuelva a mostrar «MaKo grabando clases», el audio calle >= 90 s, o la hora límite.
LIM=$1; PS=C:/Users/marti/AppData/Local/Temp/claude/fb1d94a1aca5ced3/b3b8cf58-7caf-44f2-a3ff-d9102b1f9d04/scratchpad/ventana.ps1
while :; do
  t=$(powershell -NoProfile -ExecutionPolicy Bypass -File "$PS" ver '*' | grep -c 'MaKo grabando clases')
  if [ "$t" -ge 1 ]; then echo "VOLVIÓ la pestaña ($(date +%H:%M:%S))"; exit 0; fi
  s=$(python -c "import json;e=json.load(open('C:/cursos/programa-meta-ads-the-net-lab/audio/crudo/estado.json'));print(int(e.get('sin_sonido') or 0))" 2>/dev/null || echo 0)
  if [ "$s" -ge 90 ]; then echo "silencio $s s ($(date +%H:%M:%S))"; exit 0; fi
  if [ $(date +%s) -ge $LIM ]; then echo "hora ($(date +%H:%M:%S))"; exit 0; fi
  sleep 15
done
