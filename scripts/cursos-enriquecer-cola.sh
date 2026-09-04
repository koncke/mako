#!/bin/sh
# Transcribe y republica las clases que `curso-enriquecer-desde-drive.mjs` sumo a cursos
# YA PUBLICADOS. Un curso a la vez, con lock, pensado para correr como tarea programada.
#
#   sh scripts/cursos-enriquecer-cola.sh --lista C:/cursos/_enriquecer-cola.txt
#   sh scripts/cursos-enriquecer-cola.sh "masteryhaus" "bigseo-academy"
#
# Que hace por curso, y por que NO sirve `cursos-cola.sh`:
#
#   1. audio-desde-drive   saca el audio del montaje (ffmpeg lee G: como un disco)
#   2. pipeline --drive    transcribe lo que falte
#   3. a-portal            regenera la ficha y escribe public/cono-tx/<videoId>.json
#
# La cola normal arranca por `curso-bajar.mjs`, que baja de la PLATAFORMA de origen. Acá el
# video ya esta en Drive y no hay nada que bajar: `bajados.txt` ya trae las nuevas marcadas.
#
# ⚠️ UN ARCHIVO DE LOG, UN ESCRITOR. Este script escribe solo en el suyo. Con dos procesos
#    sobre el mismo log se pierde ~10% de las lineas —medido— y las que se pierden son justo
#    las de la concurrencia, o sea lo unico que uno queria ver.
#
# ⚠️ EL LOCK NO DEPENDE DE QUE EL VIGILANTE MATE BIEN. `schtasks /end` mata el proceso que
#    la tarea registro y deja vivos a los nietos (Git Bash re-ejecuta el script en un hijo),
#    asi que puede quedar un huerfano. Con el lock, el segundo se niega a arrancar igual.
#    Y se chequea con `kill -0`, NO preguntandole a Windows: el `$$` de Git Bash es el pid
#    de MSYS y para Windows no existe, con lo cual el lock se creeria huerfano siempre.
#
# ⚠️ Y SE SUELTA AL FINAL, NUNCA CON `trap … EXIT`: en sh ese trap tambien corre al salir de
#    una subshell, y cualquier `$(…)` lo borraria al minuto de arrancar.
set -u

cd "$(dirname "$0")/.." || exit 1
LOG="C:/cursos/enriquecer.log"
LOCK="C:/cursos/_enriquecer.lock"
di() { echo "$@" | tee -a "$LOG"; }

# ── El lock ────────────────────────────────────────────────────────────────────────────
if [ -f "$LOCK" ]; then
  VIEJO=$(cat "$LOCK" 2>/dev/null | tr -d '\r')
  if [ -n "$VIEJO" ] && kill -0 "$VIEJO" 2>/dev/null; then
    di "[$(date '+%F %T')] ya hay una corrida viva (pid $VIEJO) — salgo"
    exit 0
  fi
  di "[$(date '+%F %T')] lock huerfano (pid $VIEJO) — lo piso"
fi
echo $$ > "$LOCK"

# ── La lista ───────────────────────────────────────────────────────────────────────────
# ⚠️ La ruta se guarda ANTES de tocar los argumentos: un `set --` reescribe justo lo que
#    estas leyendo, y leer `$2` despues da «unbound variable».
LISTA=""
if [ "${1:-}" = "--lista" ]; then LISTA="${2:-}"; fi

CURSOS=""
if [ -n "$LISTA" ]; then
  if [ ! -f "$LISTA" ]; then di "  no existe $LISTA"; rm -f "$LOCK"; exit 1; fi
  # ⚠️ El `\r` se limpia EN EL QUE LEE. Un `C:/cursos/<slug>\r/plan.json` no existe, y el
  #    bucle saltea todo en un segundo saliendo con exito — ya paso tres veces en un dia.
  CURSOS=$(tr -d '\r' < "$LISTA" | sed '/^[[:space:]]*$/d;/^#/d')
else
  CURSOS=$(printf '%s\n' "$@")
fi

if [ -z "$CURSOS" ]; then di "  la lista esta vacia — nada que hacer"; rm -f "$LOCK"; exit 0; fi

di ""
di "[$(date '+%F %T')] ARRANCA (pid $$) · $(printf '%s\n' "$CURSOS" | wc -l) curso(s)"

printf '%s\n' "$CURSOS" | while IFS= read -r SLUG; do
  [ -z "$SLUG" ] && continue
  PLAN="C:/cursos/$SLUG/plan.json"
  if [ ! -f "$PLAN" ]; then
    # Un proceso que no encuentra nada tiene que decir POR QUE: sin esta linea, «no habia
    # nada que hacer» y «no supe leer la entrada» son el mismo log.
    di "[$(date '+%F %T')]   $SLUG: no tiene plan.json — lo salto"
    continue
  fi

  di "[$(date '+%F %T')] ── $SLUG"
  di "[$(date '+%F %T')]    audio…"
  node scripts/curso-audio-desde-drive.mjs --plan "$PLAN" >> "$LOG" 2>&1
  di "[$(date '+%F %T')]    transcribiendo…"
  node scripts/curso-pipeline.mjs --plan "$PLAN" --drive --tope-horas 6 >> "$LOG" 2>&1
  di "[$(date '+%F %T')]    ficha…"
  node scripts/curso-a-portal.mjs --plan "$PLAN" >> "$LOG" 2>&1
  di "[$(date '+%F %T')]    $SLUG listo"
done

di "[$(date '+%F %T')] TERMINO"
rm -f "$LOCK"
