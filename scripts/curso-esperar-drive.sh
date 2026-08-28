#!/bin/sh
# Espera a que Drive le asigne id a los 6 PDF nuevos y republica MasteryHaus.
# Con techo: 20 intentos de 45 s (15 min). Si no llegan, lo dice y no republica a medias.
REPO="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing"
PLAN="C:/cursos/masteryhaus/plan.json"
cd "$REPO" || exit 1

i=0
while [ "$i" -lt 20 ]; do
  i=$((i + 1))
  sleep 45
  N=$(node scripts/curso-a-drive.mjs --plan "$PLAN" --solo-ids 2>&1 | grep -aoE "[0-9]+/[0-9]+ con id" | head -1)
  echo "intento $i: $N"
  case "$N" in
    38/38*)
      echo "== los 38 tienen id: republico =="
      node scripts/curso-recursos-titulos.mjs --plan "$PLAN" 2>&1 | head -2
      node scripts/curso-a-portal.mjs --plan "$PLAN" >/dev/null 2>&1
      echo "== republicado =="
      exit 0 ;;
  esac
done
echo "== TECHO: Drive no termino de asignar ids en 15 min. NO republico a medias. =="
exit 1
