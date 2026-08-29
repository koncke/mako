#!/bin/sh
# LIBERA el video local de los cursos YA PUBLICADOS. Corre solo, cada 6 horas.
#
#   A mano:    sh scripts/cursos-liberar.sh
#   Registrar: scripts/cursos-liberar-instalar.cmd   (una sola vez)
#   Mirar:     C:/cursos/liberar.log
#
# ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ POR QUE EXISTE: EL 29/08/2026 EL DISCO LLEGO A 815 MB DE 455 GB.
#
# Liberar corria SOLO al terminar cada curso, dentro de la cola. Los cursos que se
# cortaban a mitad —un 410 del CDN, una clase que no bajaba, la cola reiniciada— nunca
# llegaban a ese paso y se quedaban con su copia local PARA SIEMPRE. No fue un curso
# gigante: fueron 74 cursos dejando cada uno su resto, 120 GB en total.
#
# La forma en que falla es la de siempre: nada da error. El curso se publica, se ve
# perfecto en el portal, y el disco baja un poco. Se descubre cuando ya no entra nada.
#
# Por eso esto NO cuelga de que un curso termine bien: barre TODOS los publicados, cada
# vez. Un paso de limpieza que depende del camino feliz es un paso que no se ejecuta.
#
# ⚠️ NO BORRA POR SU CUENTA. Llama a `curso-a-drive.mjs --liberar`, que antes de tocar un
# archivo comprueba —del lado del SERVIDOR de Drive, no del montaje local— que llegó. Si
# no puede confirmar, no borra. Esa garantía no se ablanda desde acá.
#
# ⚠️ Y NO toca los cursos SIN PUBLICAR: su video todavía no está arriba. Se decide por el
# `slug` de la ficha, probando las cuatro formas del nombre — la carpeta `curso-us30-2-0`
# se publica como `us30-2-0`, y cruzar por nombre a secas cuenta como pendiente algo que
# ya está hecho.
# ─────────────────────────────────────────────────────────────────────────────────────

REPO="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing"
LOG="C:/cursos/liberar.log"
LISTA="C:/cursos/_liberar.txt"
PISO_GB=60          # por debajo de esto vale la pena barrer; por encima no molesta al disco

cd "$REPO" || exit 1
libres() { df -k /c | tail -1 | awk '{printf "%d", $4/1048576}'; }
di() { echo "$1" >> "$LOG"; }

L=$(libres)
di ""
di "════ barrido $(date) · $L GB libres ════"

# Con espacio de sobra no se hace nada: cada corrida son ~70 llamadas a Drive.
if [ "$L" -gt "$PISO_GB" ]; then
  di "  hay $L GB (piso $PISO_GB): no hace falta barrer."
  exit 0
fi

# La lista se REGENERA en cada corrida: los cursos publicados cambian solos.
node scripts/curso-liberables.mjs > "$LISTA" 2>> "$LOG" || { di "  ✖ no pude armar la lista"; exit 1; }
di "  $(grep -c . "$LISTA") curso(s) publicados con video local"

n=0
while IFS= read -r d; do
  # ⚠️ El `tr -d` no es cosmético: en Windows todo texto que cruza de una herramienta a
  #    otra trae \r, y `C:/cursos/<curso>\r/plan.json` no existe. Ya costó una cola entera
  #    saltándose 12 cursos en un segundo y saliendo con éxito.
  d=$(printf %s "$d" | tr -d "\r")
  [ -z "$d" ] && continue
  PLAN="C:/cursos/$d/plan.json"
  [ -f "$PLAN" ] || continue
  n=$((n + 1))
  node scripts/curso-a-drive.mjs --plan "$PLAN" --liberar --min-libre-gb 99999 --minutos 2 >> "$LOG" 2>&1
  di "  [$n] $d · salió $? · $(libres) GB libres"
done < "$LISTA"

di "════ fin $(date) · $(libres) GB libres (arrancó con $L) ════"
