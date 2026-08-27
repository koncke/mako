#!/bin/sh
# LA COLA de cursos: bajar → transcribir → subir a Drive → publicar, UN CURSO A LA VEZ.
#
#   Lanzar:   schtasks /run /tn "cursos-cola"
#   Mirar:    tail -f C:/cursos/cola.log     (o los hitos: grep -aE "^(══|  --|  ⛔)" …)
#   Frenar:   schtasks /end /tn "cursos-cola"
#   Registrar la tarea (una sola vez): scripts/cursos-cola-instalar.cmd
#
# ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ POR QUE ES UNA TAREA PROGRAMADA Y NO UNA TAREA DE FONDO DE CLAUDE
#
# El 27/08/2026 la cola murio a mitad de monetizatube —22 de 49 clases bajadas, 0
# transcriptas— sin un solo error en el log. La causa no estaba en el codigo: la cola
# colgaba de una tarea de fondo del harness, y el harness mata el grupo de procesos
# cuando la sesion termina. La sesion anterior cerro 10:31 y se llevo la cola puesta.
#
# Una cola de 10+ horas NO puede vivir dentro de una sesion de Claude. La tarea programada
# corre bajo el servicio de Windows, fuera del arbol de procesos: sobrevive a que se cierre
# Claude, a que se cierre la terminal y a un cambio de sesion. Mismo criterio que el
# monitor de la GPU, por la misma razon.
#
# ⚠️ EL PISO DE DISCO, Y POR QUE NO ES EL TAMANO DE LA CLASE
#
# El 26/08 la maquina llego a 0 GB libres. No fue el volumen de los cursos: fue que yt-dlp
# baja video y audio por separado y los MERGEA a un `.temp.mp4` SIN borrar las fuentes
# hasta terminar. O sea que cerrar una clase necesita el DOBLE de lo que la clase va a
# pesar: una de 13 GB pide 28 GB libres. El pico de disco no es lo que ocupa el archivo,
# es lo que ocupa DURANTE. Y las clases grandes no se anuncian —en Cardona 15 de 17 pesaban
# menos de 2 GB y una pesaba 13—, asi que el piso se mide antes de CADA curso.
# ─────────────────────────────────────────────────────────────────────────────────────

REPO="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing"
LOG="C:/cursos/cola.log"
PISO=14          # GB para arrancar un curso de clases cortas

CURSOS="monetizatube automatizatube automatizacion-y-monetizacion-de-youtobe"

cd "$REPO" || exit 1
libres() { df -k /c | tail -1 | awk '{printf "%d", $4/1048576}'; }
di() { echo "$1" >> "$LOG"; }

di ""
di "════════ cola arrancada $(date) · $(libres) GB libres ════════"

for d in $CURSOS; do
  L=$(libres)
  di ""
  di "════ $d · $(date) · $L GB libres ════"
  if [ "$L" -lt "$PISO" ]; then
    di "  ⛔ PARO: quedan $L GB y el piso es $PISO. Los planes de los que faltan quedan intactos."
    di "     Lo que libera espacio NO es publicar, es:"
    di "       node scripts/curso-a-drive.mjs --plan C:/cursos/<slug>/plan.json --liberar"
    di "     Borra solo lo YA confirmado en Drive y con el audio ya extraido (cinco condiciones)."
    break
  fi

  node scripts/curso-bajar.mjs --plan "C:/cursos/$d/plan.json" >> "$LOG" 2>&1
  di "  -- bajador salio con $? · $(libres) GB libres --"

  node scripts/curso-pipeline.mjs --plan "C:/cursos/$d/plan.json" --drive --tope-horas 12 >> "$LOG" 2>&1
  di "  -- pipeline salio con $? · $(libres) GB libres --"
done

di ""
di "════════ cola terminada $(date) · $(libres) GB libres ════════"
