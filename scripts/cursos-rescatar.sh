#!/bin/sh
# Reintenta las clases que quedaron sin bajar en cursos YA PUBLICADOS.
#
# POR QUÉ EXISTE: el pipeline se rinde después de N rondas sin progreso y publica con lo
# que tiene. Eso está bien —esperar para siempre por una clase bloquea el curso entero—,
# pero deja el curso en producción incompleto y la cola no vuelve a pasar por él hasta que
# rebobine la lista entera, que son días.
#
# Medido el 31/08/2026 sobre 7 cursos publicados (464 clases): 14 sin transcribir, y NO
# son todas lo mismo —tratarlas igual es o reintentar para siempre lo que no existe, o
# resignar contenido que sí está—:
#
#     6  HTTP 404 en Vimeo          el video no está en el origen. 5 de esos 6 traen la
#                                   `duracion` VACÍA en el plan, o sea que el propio origen
#                                   tampoco la conocía. No se recuperan reintentando.
#     3  timeout / HTTP 503         la red falló, el video está. Se recuperan.
#     5  sin error en ningún log    2 tienen el video bajado y sólo les faltó transcribir.
#
# ⚠️ La `duracion` vacía es un PREDICTOR, no una prueba: 62,5% de fallo contra 2,0% de las
#    que la traen (31x). Sirve para avisar antes de bajar; no para descartar sin intentar.
#
# ⚠️ Y NO ES «TODAS LAS QUE FALLARON SON DE VIMEO». Lo son, y no significa nada: esos
#    cursos son 100% Vimeo, que anda 107/109. Una propiedad que comparten los que fallan Y
#    los que andan no explica nada — la tasa base primero, siempre.
#
#   sh scripts/cursos-rescatar.sh <slug> [slug…]
#
# Es idempotente y barato: yt-dlp saltea lo que ya está por su registro, y el pipeline
# publica de nuevo sólo si hay algo nuevo.
set -u

cd "$(dirname "$0")/.." || exit 1
LOG="C:/cursos/rescate.log"
LOG_BAJA="C:/cursos/rescate-bajador.log"   # ⚠️ un archivo, un escritor: si comparten, se
                                           #    pierde ~10% de las líneas y se funden entre sí.

di() { echo "$@" >> "$LOG"; }

di ""
di "════════ rescate arrancado $(date) ════════"

for d in "$@"; do
  d=$(printf %s "$d" | tr -d '\r')
  PLAN="C:/cursos/$d/plan.json"
  [ -f "$PLAN" ] || { di "  ⚠ $d: no tiene plan.json — lo salto"; continue; }

  # Cuántas le faltan ANTES, para poder decir al final si el rescate sirvió. Sin este
  # número, «terminó» y «no recuperó nada» se leen igual.
  ANTES=$(node -e "
    const fs=require('fs');
    const p=JSON.parse(fs.readFileSync('$PLAN','utf8').replace(/^\uFEFF/,''));
    const d='C:/cursos/$d/texto';
    const t=new Set(fs.existsSync(d)?fs.readdirSync(d).map(f=>f.replace(/\.md$/i,'')):[]);
    console.log(p.clases.filter(c=>!t.has(c.archivo)).length);
  " 2>/dev/null | tr -d '\r')

  di ""
  di "──── $d · le faltan ${ANTES:-?} · $(date +%H:%M:%S)"

  echo "" >> "$LOG_BAJA"
  echo "════ $d · $(date) ════" >> "$LOG_BAJA"
  timeout 3600 node scripts/curso-bajar.mjs --plan "$PLAN" >> "$LOG_BAJA" 2>&1
  di "  -- bajador salió con $? --"

  # `--rondas-secas 3` en vez de 8: acá se sabe que lo que falta es poco y que buena parte
  # no va a venir nunca. Con 8 son 12 minutos de espera por curso para nada.
  node scripts/curso-pipeline.mjs --plan "$PLAN" --drive --tope-horas 2 --rondas-secas 3 >> "$LOG" 2>&1
  di "  -- pipeline salió con $? --"

  DESPUES=$(node -e "
    const fs=require('fs');
    const p=JSON.parse(fs.readFileSync('$PLAN','utf8').replace(/^\uFEFF/,''));
    const d='C:/cursos/$d/texto';
    const t=new Set(fs.existsSync(d)?fs.readdirSync(d).map(f=>f.replace(/\.md$/i,'')):[]);
    console.log(p.clases.filter(c=>!t.has(c.archivo)).length);
  " 2>/dev/null | tr -d '\r')
  di "  ✓ $d: faltaban ${ANTES:-?} · ahora ${DESPUES:-?}"
done

# Globales y idempotentes: importan al catálogo y ponen categoría y tapa a lo que haya
# cambiado. Si no hay nada nuevo no tocan un archivo.
node scripts/curso-al-catalogo.mjs >> "$LOG" 2>&1
di "  -- catalogo salió con $? --"
node scripts/curso-categoria-portada.mjs >> "$LOG" 2>&1
di "  -- categoria+tapa salió con $? --"

di ""
di "════════ rescate terminado $(date) ════════"
