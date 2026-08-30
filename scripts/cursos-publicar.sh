#!/bin/sh
# PUBLICA de verdad: commitea y pushea los cursos que la cola dejó en disco.
#
#   A mano:    sh scripts/cursos-publicar.sh
#   Registrar: scripts/cursos-publicar-instalar.cmd   (una sola vez)
#   Mirar:     C:/cursos/publicar.log
#
# ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ POR QUE EXISTE: EL CICLO SE CORTABA JUSTO ANTES DEL FINAL.
#
# La cola baja, transcribe, sube a Drive, escribe la ficha y la importa al catálogo — y
# ahí se detiene. Nadie commitea. El curso queda perfecto EN EL DISCO y el portal sigue
# mostrando lo de antes.
#
# Martín lo reportó el 29/08/2026: «en MaKo siguen siendo 73, no entiendo por qué no
# hacés el ciclo completo». Medido en ese momento: 81 fichas en disco, 77 en git. Cuatro
# cursos procesados enteros —con sus videos en Drive y sus transcripciones— que no
# existían para nadie.
#
# Es la misma familia de todo lo que fallo hoy: «publicar no es que se vea». Cada paso
# manual al final de una cadena automática es un paso que no se ejecuta.
#
# ⚠️ COMMITEA POR RUTA EXPLICITA Y NUNCA `git add -A`. Hay DOS sesiones de Claude sobre
#    este clon: un `add -A` se lleva el trabajo a medio hacer de la otra adentro de este
#    commit y nadie se entera hasta que rompe. Sólo se tocan las salidas del pipeline.
#
# ⚠️ Y NO pushea si el arbol de conocimientos tiene algo que no reconoce. Un script que
#    commitea solo tiene que ser cobarde: ante la duda, avisa y se va.
# ─────────────────────────────────────────────────────────────────────────────────────

REPO="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing"
LOG="C:/cursos/publicar.log"

cd "$REPO" || exit 1
di() { echo "$1" >> "$LOG"; }

di ""
di "════ publicar $(date) ════"

# ¿Hay algo del pipeline sin commitear?
PEND=$(git status --porcelain app/conocimientos/ public/cono-portadas/ | wc -l)
if [ "$PEND" -eq 0 ]; then
  di "  nada nuevo que publicar."
  exit 0
fi
di "  $PEND archivo(s) del pipeline sin commitear"

# ⚠️ `catalogo.ts` es el UNICO archivo compartido: lo escribe el pipeline y también lo
#    edita una persona. Se commitea sólo si su diff toca exclusivamente líneas de cursos
#    (imports, constantes, categorías, tapas). Si hay algo más, es trabajo de alguien y no
#    se lo lleva puesto este script.
AJENO=$(git diff -U0 -- app/conocimientos/catalogo.ts \
  | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' \
  | grep -vE "curso-|CURSO_|': '|cono-portadas|^[+-]\s*//|^[+-]\s*$" | wc -l)
if [ "$AJENO" -gt 0 ]; then
  di "  ⚠️ catalogo.ts tiene $AJENO linea(s) que NO son del pipeline: NO lo commiteo."
  di "     Alguien lo está editando. Reviso solo las fichas y las tapas."
  git add app/conocimientos/curso-*.ts public/cono-portadas/ 2>/dev/null
else
  git add app/conocimientos/curso-*.ts app/conocimientos/catalogo.ts public/cono-portadas/ 2>/dev/null
fi

if git diff --cached --quiet; then
  di "  no quedó nada en el índice — nada que hacer."
  exit 0
fi

# La red antes de escribir: si el catálogo importa algo que no está en el commit, el build
# de Vercel muere con «Module not found» y el push sale con 0. Ya pasó: 46 minutos de
# producción en la versión vieja sin que nada avisara.
if ! node scripts/curso-catalogo-verificar.mjs >> "$LOG" 2>&1; then
  di "  ✖ el catálogo importa fichas que no están en el commit. NO pusheo."
  exit 1
fi
if ! npm run --silent typecheck >> "$LOG" 2>&1; then
  di "  ✖ el typecheck falla. NO pusheo."
  exit 1
fi

NUEVOS=$(git diff --cached --name-only --diff-filter=A -- 'app/conocimientos/curso-*.ts' \
  | sed 's|.*/curso-||;s|\.ts$||' | tr '\n' ' ')
[ -z "$NUEVOS" ] && NUEVOS="(sin cursos nuevos: sólo actualizaciones)"

git commit -q -m "conocimientos: cursos publicados por la cola" \
  -m "Cursos nuevos: $NUEVOS" \
  -m "Commit automatico de scripts/cursos-publicar.sh: la cola escribe la ficha y la
importa al catalogo, pero hasta que esto no corre el curso existe solo en el disco.
Ver el porque en ese archivo." \
  -m "Claude-Cuenta: claude2" >> "$LOG" 2>&1

di "  commiteado: $NUEVOS"

git pull --rebase -q >> "$LOG" 2>&1
if git push -q >> "$LOG" 2>&1; then
  di "  ✓ pusheado. El deploy tarda ~1 min."
else
  di "  ✖ el push falló — mirá el log. El commit quedó hecho."
  exit 1
fi
