#!/bin/sh
# =============================================================================
# ¿La mezcla que acaba de hacer la corrida arma una versión NUEVA de un workflow? Entonces GitHub no la va a dejar subir.
# =============================================================================
# Uso: sh scripts/ci-workflow-nuevo.sh <HEAD de antes de mezclar>     (lo llama punta.yml después de cada `git merge`)
#
# Medido el 4/11/2026 (punta/sobre-main, corrida 98): tests y tipos en verde, y los 5 intentos de «Llevar a main»
# rebotaron con «refusing to allow a GitHub App to create or update workflow `.github/workflows/punta.yml` without
# `workflows` permission». El token de Actions puede subir un workflow que ya existe en el repo (el de un padre), pero
# no CREAR uno: y eso es lo que hace la mezcla cuando la punta y main cambiaron el MISMO workflow. Comparado con las
# mezclas que sí entraron ese día (9b155e3f0, 65ac4c4fc): cambiaban workflows respecto de un padre, pero cada archivo
# quedaba igual al del otro. Ésa es la regla que se mira acá, archivo por archivo.
#
# Sin esto, el rojo llegaba al final, después de ~15 min de tests. Con esto, a los ~20 s y diciendo qué hacer: mezclar
# main en la punta en la máquina (con el token de una persona) y volver a subir.
#
# Sale 0 si no hubo mezcla nueva (ya estaba al día, o avanzó rápido) o si ningún workflow queda en una versión nueva.
# =============================================================================
set -e
antes="$1"
[ -n "$antes" ] || { echo "uso: sh scripts/ci-workflow-nuevo.sh <HEAD de antes de mezclar>" >&2; exit 2; }
# ¿La creó ESTA mezcla? Un commit de mezcla nuevo tiene como primer padre el HEAD de antes. Si la punta ya estaba al día
# (su punta puede ser una mezcla hecha a mano, que ya está en el repo) o avanzó rápido, no hay nada que mirar.
git rev-parse -q --verify HEAD^2 >/dev/null || exit 0
[ "$(git rev-parse HEAD^1)" = "$(git rev-parse "$antes")" ] || exit 0

blob() { git rev-parse -q --verify "$1:$2" 2>/dev/null || echo ausente; }
nuevos=""
for f in $(git diff --name-only HEAD^1 HEAD -- .github/workflows); do
  b=$(blob HEAD "$f")
  if [ "$b" != "$(blob HEAD^1 "$f")" ] && [ "$b" != "$(blob HEAD^2 "$f")" ]; then nuevos="$nuevos $f"; fi
done
if [ -n "$nuevos" ]; then
  echo "::error::La punta y main cambiaron el mismo workflow (${nuevos# }): la mezcla arma una versión nueva y GitHub no deja que el token de Actions la suba. Mezcla origin/main en la punta en tu máquina (git fetch origin main && git merge origin/main), súbela y la corrida sigue sola."
  exit 1
fi
exit 0
