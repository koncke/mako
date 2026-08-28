#!/bin/sh
# Sondea y enumera TODAS las categorías del catálogo, y deja la cola lista.
#
#   sh scripts/cursos-todo.sh                 # todas
#   sh scripts/cursos-todo.sh IA Ecommerce    # sólo esas
#
# Requiere el Chrome dedicado abierto y logueado (scripts/curso-perfil.ps1).
# NO baja nada: sólo produce los plan.json y reescribe C:/cursos/_cola.txt.
# Bajar es de la cola:  schtasks /run /tn "cursos-cola"
#
# ⚠️ El orden importa y no es cosmético: SONDEAR antes que ENUMERAR. Un curso que la
# cuenta no tiene rebota al catálogo desde el navegador y por HTTP contesta 200 igual;
# sin el sondeo, el enumerador gasta una pestaña y ~15 s por cada uno para descubrirlo
# con un mensaje que apunta a otro lado.

REPO="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing"
LOG="C:/cursos/todo.log"
CAT_JSON="C:/cursos/catalogo-plataforma-full.json"

cd "$REPO" || exit 1
di() { echo "$1" >> "$LOG"; }

if [ $# -gt 0 ]; then
  CATS="$*"
else
  # Las categorías salen del propio catálogo: si mañana aparece una nueva, entra sola.
  CATS=$(python -c "
import json,io,collections
d=json.load(io.open(r'$CAT_JSON',encoding='utf-8'))
c=collections.Counter((x.get('category') or '').strip() for x in d)
# de mayor a menor: las categorias grandes primero rinden mas por corrida
for k,_ in c.most_common():
    if k: print(k)
" | tr '\n' '|')
fi

di ""
di "════════ barrido arrancado $(date) ════════"

OLD_IFS=$IFS
IFS='|'
for cat in $CATS; do
  IFS=$OLD_IFS
  [ -z "$cat" ] && continue
  di ""
  di "════ categoría: $cat · $(date) ════"

  node scripts/cursos-sondear.mjs --categoria "$cat" >> "$LOG" 2>&1
  di "  -- sondeo salió con $? --"

  node scripts/cursos-planes-ia.mjs --categoria "$cat" >> "$LOG" 2>&1
  di "  -- enumerador salió con $? --"
  IFS='|'
done
IFS=$OLD_IFS

di ""
di "── reescribiendo la cola ──"
node scripts/cursos-cola-armar.mjs >> "$LOG" 2>&1
di "  -- armar cola salió con $? --"

di ""
di "════════ barrido terminado $(date) ════════"
