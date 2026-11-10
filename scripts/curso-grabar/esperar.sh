#!/usr/bin/env bash
# Espera hasta que el grabador oiga >= N s de silencio (terminó una clase o algo se trabó) o hasta una hora límite.
#   bash esperar.sh <epoch_limite> [segundos_de_silencio=6]
E=C:/cursos/programa-meta-ads-the-net-lab/audio/crudo/estado.json
LIM=$1; SIL=${2:-6}
while :; do
  now=$(date +%s)
  s=$(python -c "import json;e=json.load(open('$E'));print(int(e.get('sin_sonido') or 0))" 2>/dev/null || echo 0)
  if [ "$s" -ge "$SIL" ]; then echo "silencio $s s ($(date +%H:%M:%S))"; exit 0; fi
  if [ "$now" -ge "$LIM" ]; then echo "hora ($(date +%H:%M:%S))"; exit 0; fi
  sleep 3
done
