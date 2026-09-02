#!/bin/sh
# Carga en MaKo los cursos que YA ESTAN EN DRIVE y nunca pasaron por una plataforma.
#
#   sh scripts/cursos-desde-drive.sh "ADS - Felipe Vergara" "Otro curso - Autor"
#   sh scripts/cursos-desde-drive.sh --lista C:/cursos/_desde-drive.txt
#
# Que hace por cada uno, y por que en este orden:
#
#   1. plan-desde-drive   arma el plan y resuelve el id de Drive de cada clase
#   2. audio-desde-drive  saca el audio del montaje (ffmpeg lee G: como un disco)
#   3. portada-desde-video  la tapa, que estos cursos no tienen en ningun lado
#   4. pipeline --drive   transcribe y publica la ficha
#   5. al-catalogo        la importa, o el portal no la muestra
#   6. categoria-portada  engancha la tapa y le pone categoria
#
# NO hay paso de descarga: el video ya esta en Drive y el portal lo reproduce desde ahi.
#
# ⚠️ UN ARCHIVO DE LOG, UN ESCRITOR. Este script es el unico que escribe en su log; si
#    algun dia se le suma un proceso en paralelo, va a otro archivo. Con dos escritores se
#    pierde ~10% de las lineas y las que se pierden son justo las de la concurrencia.
set -u

cd "$(dirname "$0")/.." || exit 1
LOG="C:/cursos/desde-drive.log"
di() { echo "$@" | tee -a "$LOG"; }

if [ "${1:-}" = "--lista" ]; then
  # ⚠️ LA RUTA SE GUARDA ANTES DE TOCAR LOS ARGUMENTOS. La primera version hacia `set --`
  #    para vaciarlos y despues leia `$2`, que para entonces ya no existia: «unbound
  #    variable» y a la calle. Un `set --` reescribe justo lo que estas leyendo.
  LISTA="${2:-}"
  [ -f "$LISTA" ] || { echo "  no existe $LISTA"; exit 1; }
  # ⚠️ El \r se saca EN EL QUE LEE: el archivo se edita en Windows y vuelve con CRLF, y
  #    «<carpeta>\r» no existe — el bucle saltearia todo en un segundo y saldria con exito.
  CURSOS=$(tr -d '\r' < "$LISTA" | grep -v '^[[:space:]]*$')
  IFS='
'
  set -- $CURSOS
  unset IFS
fi

[ "$#" -gt 0 ] || { echo "  uso: sh scripts/cursos-desde-drive.sh \"<Carpeta en Drive>\" …"; exit 1; }

di ""
di "════════ desde Drive · $# curso(s) · $(date) ════════"

OK=0
FALLO=0
for CARPETA in "$@"; do
  CARPETA=$(printf %s "$CARPETA" | tr -d '\r')
  di ""
  di "──── $CARPETA · $(date +%H:%M:%S)"

  if ! node scripts/curso-plan-desde-drive.mjs --carpeta "$CARPETA" >> "$LOG" 2>&1; then
    di "  ✖ no pude armar el plan — lo salto (mirá el log)"
    FALLO=$((FALLO + 1))
    continue
  fi

  # El slug lo decide el armador; se lo pregunto al plan recien escrito en vez de
  # recalcularlo acá — dos derivaciones del mismo nombre es como se termina escribiendo en
  # dos carpetas distintas.
  SLUG=$(node -e "
    const fs=require('fs'), path=require('path');
    const raiz='C:/cursos';
    const dirs=fs.readdirSync(raiz).filter(d=>{try{const p=JSON.parse(fs.readFileSync(path.join(raiz,d,'plan.json'),'utf8').replace(/^\uFEFF/,''));return p.carpetaDrive===process.argv[1];}catch{return false}});
    process.stdout.write(dirs[0]||'');
  " "$CARPETA" 2>/dev/null | tr -d '\r')

  if [ -z "$SLUG" ]; then
    di "  ✖ el plan se escribió y no encuentro su carpeta — lo salto"
    FALLO=$((FALLO + 1))
    continue
  fi
  PLAN="C:/cursos/$SLUG/plan.json"
  di "  slug: $SLUG"

  node scripts/curso-audio-desde-drive.mjs --plan "$PLAN" >> "$LOG" 2>&1
  di "  -- audio desde Drive salió con $? · $(date +%H:%M:%S)"

  node scripts/curso-portada-desde-video.mjs --plan "$PLAN" >> "$LOG" 2>&1
  di "  -- portada salió con $?"

  node scripts/curso-pipeline.mjs --plan "$PLAN" --drive --tope-horas 6 >> "$LOG" 2>&1
  di "  -- pipeline salió con $? · $(date +%H:%M:%S)"

  # Los dos globales, idempotentes: si no hay nada que agregar no tocan un archivo.
  node scripts/curso-al-catalogo.mjs >> "$LOG" 2>&1
  node scripts/curso-categoria-portada.mjs >> "$LOG" 2>&1

  HECHAS=$(node -e "
    const fs=require('fs');
    const p=JSON.parse(fs.readFileSync('$PLAN','utf8').replace(/^\uFEFF/,''));
    let t=0; try{t=fs.readdirSync('C:/cursos/$SLUG/texto').filter(f=>f.endsWith('.md')&&!f.startsWith('_')).length}catch{}
    process.stdout.write(t+'/'+p.clases.length);
  " 2>/dev/null | tr -d '\r')
  di "  ✓ $SLUG: $HECHAS clases transcriptas"
  OK=$((OK + 1))
done

di ""
di "════════ terminado · $OK cargado(s) · $FALLO con problemas · $(date) ════════"
di "  Falta publicar a git:  sh scripts/cursos-publicar.sh"
