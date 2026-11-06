#!/bin/bash
# =============================================================================
# Ignored Build Step de Vercel (vercel.json → ignoreCommand)
# =============================================================================
# Exit 0 = NO construir. Exit 1 = construir. Ante cualquier duda se construye: un build de más cuesta unos
# centavos, y un cambio que no llega a producción se lee como «no lo hiciste».
#
# Cada build de mako cuesta unos US$0,32 (30 núcleos × 3 minutos). El 4/11/2026, un tercio de los de main sólo
# cambiaba documentos o tests: docs/hallazgos-infra.md, «El gasto de Vercel».
#
# ⚠️ Lo que entra en la lista tiene que NO salir en la app. /admin/docs lee docs/**/*.md y AGENTS.md del deploy: ahí
# un documento nuevo aparece con el próximo build de código, y eso se acepta. Los dos de abajo son pantallas de
# producto y construyen siempre (next.config.ts, outputFileTracingIncludes).
base="${VERCEL_GIT_PREVIOUS_SHA:-}"

# Sin el último deploy bueno, no hay contra qué comparar.
[ -n "$base" ] || exit 1
# Vercel clona con poca historia: si ese commit no llegó, no se puede saber qué cambió.
git cat-file -e "${base}^{commit}" 2>/dev/null || exit 1
cambios="$(git diff --name-only "$base" HEAD 2>/dev/null)" || exit 1
# Sin cambios es un redeploy pedido a propósito.
[ -n "$cambios" ] || exit 1

while IFS= read -r archivo; do
  case "$archivo" in
    docs/estrategia-financiera-mako.md|docs/offer-marco.md) exit 1 ;;
    docs/*|tests/*|.github/*|.claude/*|AGENTS.md|CLAUDE.md|README.md) ;;
    *) exit 1 ;;
  esac
done <<< "$cambios"

echo "Sólo cambian documentos o tests: no se construye."
exit 0
