#!/bin/sh
# LA COLA de cursos: bajar → transcribir → subir a Drive → publicar, UN CURSO A LA VEZ.
#
#   Qué hace:  los cursos listados en C:/cursos/_cola.txt, uno por línea, en ese orden.
#   Lanzar:    schtasks /run   /tn "cursos-cola"
#   Mirar:     sh scripts/cursos-estado.sh
#   Frenar:    schtasks /end   /tn "cursos-cola"
#   Registrar la tarea (una sola vez): scripts/cursos-cola-instalar.cmd
#
# ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ LA LISTA VIVE EN UN ARCHIVO, NO ACÁ ADENTRO
#
# `_cola.txt` se escribe a mano (o con un script) y se revisa antes de lanzar. La
# alternativa —que la cola DEDUZCA sola qué falta— ya falló dos veces el 27/08/2026, las
# dos por lo mismo: **el nombre de la carpeta local no es el slug del portal**. La carpeta
# «100M money Models - Alex Hormozi» se publica como `100m-money-models`, así que cruzar
# por nombre de carpeta daba 27 cursos pendientes cuando eran 15, y metía en la cola 1.000
# clases ya publicadas. Una cola que se equivoca de más baja decenas de GB al pedo.
#
# Si hace falta regenerar la lista, el cruce va por el `slug` del plan.json (y por la URL
# de `pagina`), NUNCA por el nombre de la carpeta.
#
# ⚠️ POR QUÉ ES UNA TAREA PROGRAMADA Y NO UNA TAREA DE FONDO DE CLAUDE
#
# El 27/08/2026 la cola murió a mitad de un curso —22 de 49 clases, 0 transcriptas— sin un
# solo error en el log: colgaba de una tarea de fondo del harness, y el harness mata el
# grupo de procesos cuando la sesión termina. Un trabajo de 10+ horas no puede colgar de la
# sesión. La tarea programada corre bajo el servicio de Windows, fuera del árbol.
#
# ⚠️ EL PISO DE DISCO, Y POR QUÉ NO ES EL TAMAÑO DE LA CLASE
#
# yt-dlp baja video y audio por separado y los MERGEA a un `.temp.mp4` SIN borrar las
# fuentes hasta terminar: cerrar una clase necesita el DOBLE de lo que va a pesar. Una de
# 13 GB pide 28 GB libres. Y las clases grandes no se anuncian, así que el piso se mide
# antes de CADA curso.
#
# ⚠️ EL CHROME DEDICADO PUEDE QUEDAR ABIERTO. El bajador solo toca sus cookies si se le
# pasa `--cookies`, y acá no se le pasa. (El error «Could not copy Chrome cookie database»
# aparece únicamente con ese flag.)
# ─────────────────────────────────────────────────────────────────────────────────────

REPO="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing"
LOG="C:/cursos/cola.log"
LISTA="C:/cursos/_cola.txt"
PISO=14          # GB para arrancar un curso

cd "$REPO" || exit 1
libres() { df -k /c | tail -1 | awk '{printf "%d", $4/1048576}'; }
di() { echo "$1" >> "$LOG"; }

if [ ! -f "$LISTA" ]; then
  di ""
  di "⛔ No existe $LISTA — la cola no tiene qué hacer."
  exit 1
fi

di ""
di "════════ cola arrancada $(date) · $(libres) GB libres · $(grep -c . "$LISTA") curso(s) ════════"

while IFS= read -r d; do
  [ -z "$d" ] && continue
  case "$d" in \#*) continue ;; esac

  PLAN="C:/cursos/$d/plan.json"
  if [ ! -f "$PLAN" ]; then
    di ""
    di "  ⚠ $d: no tiene plan.json — lo salto."
    continue
  fi

  L=$(libres)
  di ""
  di "════ $d · $(date) · $L GB libres ════"
  if [ "$L" -lt "$PISO" ]; then
    di "  ⛔ PARO: quedan $L GB y el piso es $PISO. Los planes de los que faltan quedan intactos."
    di "     Lo que libera espacio NO es publicar, es:"
    di "       node scripts/curso-a-drive.mjs --plan C:/cursos/<slug>/plan.json --liberar"
    di "     Borra solo lo YA confirmado en Drive y con el audio ya extraído (cinco condiciones)."
    break
  fi

  node scripts/curso-bajar.mjs --plan "$PLAN" >> "$LOG" 2>&1
  di "  -- bajador salió con $? · $(libres) GB libres --"

  node scripts/curso-pipeline.mjs --plan "$PLAN" --drive --tope-horas 12 >> "$LOG" 2>&1
  di "  -- pipeline salió con $? · $(libres) GB libres --"

  # Liberar apenas se publica: si no, el curso siguiente arranca contra un disco lleno.
  # El script decide solo (solo borra bajo --min-libre-gb y con las cinco condiciones).
  node scripts/curso-a-drive.mjs --plan "$PLAN" --liberar >> "$LOG" 2>&1
  di "  -- liberar salió con $? · $(libres) GB libres --"
done < "$LISTA"

di ""
di "════════ cola terminada $(date) · $(libres) GB libres ════════"
