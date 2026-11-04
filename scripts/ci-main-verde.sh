#!/bin/sh
# =============================================================================
# ci-main-verde.sh — main volvió a verde: se borra la marca `ci-rojo/main` y se RELANZAN las puntas que esperaban
# =============================================================================
# Pedido del 4/11/2026 (docs/hallazgos-infra.md → «Por qué tardaba horas»): «una barredora roja en main pone rojas a todas las
# puntas». Mientras `ci-rojo/main` existe, cada punta que da rojo deja además `espera-main/<punta>` (punta.yml). Cuando main
# vuelve a verde —lo dice `sobre-main.yml`, o una punta que llega a main con su mezcla probada—, esto relanza cada una con
# `workflow_dispatch`, UNA vez: la marca se borra al relanzar, así que una punta roja por lo suyo cuesta una corrida más y no
# un bucle.
#
# Sólo se relanza la punta si su rama sigue en el MISMO commit que dio rojo: si alguien ya subió otro, ese push tiene su corrida.
#
# Uso (en Actions, con GH_TOKEN y GH_REPO): sh scripts/ci-main-verde.sh [remoto]
# Nunca sale con error: relanzar es un favor, y un fallo acá no puede poner rojo el verde que lo llamó.
# =============================================================================
REMOTO="${1:-origin}"

if git ls-remote --exit-code "$REMOTO" refs/heads/ci-rojo/main >/dev/null 2>&1; then
  if git push --quiet "$REMOTO" --delete refs/heads/ci-rojo/main; then
    echo "main volvió a verde: borré la marca ci-rojo/main."
  else
    echo "::warning::No pude borrar ci-rojo/main: la próxima punta lo vuelve a intentar."
  fi
fi

git ls-remote "$REMOTO" 'refs/heads/espera-main/*' | while read -r sha ref; do
  [ -n "$ref" ] || continue
  punta="${ref#refs/heads/espera-main/}"
  actual="$(git ls-remote "$REMOTO" "refs/heads/punta/$punta" | cut -f1)"
  if [ -n "$actual" ] && [ "$actual" = "$sha" ]; then
    if gh workflow run punta.yml --ref "punta/$punta"; then
      echo "relancé punta/$punta (había dado rojo con main rojo)."
    else
      echo "::warning::No pude relanzar punta/$punta: subila de nuevo o relanzala a mano."
    fi
  else
    echo "punta/$punta ya no está en ${sha}: su push nuevo tiene su propia corrida."
  fi
  git push --quiet "$REMOTO" --delete "$ref" || echo "::warning::No pude borrar $ref."
done
exit 0
