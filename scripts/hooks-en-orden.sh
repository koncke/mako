#!/bin/sh
# =============================================================================
# hooks-en-orden — que ningun hook de React quede detras de un `return`
# =============================================================================
#
# ⚠️ QUE ROMPE ESTO. El «Minified React error #300» —`didRenderTooFewHooks`— no
# es un componente que se ve mal: es la PANTALLA ENTERA en blanco, con un error
# que no dice ni el archivo ni la linea. El 03/09/2026 llego a produccion por un
# `useExtensionVieja()` que habia quedado despues de un `return` temprano, o sea
# que en unos renders se llamaba y en otros no.
#
# No lo caza nadie mas: llamar un hook es una llamada a funcion perfectamente
# tipada, asi que el typecheck lo deja pasar, y el pre-push no corre los tests.
#
# ⚠️ Y NO ES `npm run lint`, que tarda 3 min 19 s. Un chequeo que cuesta eso o se
# saltea o se saca. Este corre UNA regla sobre los archivos que CAMBIAN, y son
# segundos.
#
# ── Lo que NO mira, y por que ────────────────────────────────────────────────
#
# Un archivo con cambios sin commitear se SALTEA. Hay dos sesiones sobre este
# clon, asi que el archivo de al lado puede estar a medio escribir por el vecino
# — y frenar un push por trabajo ajeno es exactamente el candado sin llave que la
# regla de la casa prohibe: el que empuja no lo puede arreglar. Los que se saltean
# se listan, para que saltearlos no sea invisible.
set -u

REMOTO="${1:-origin}"
BASE="$(git rev-parse --verify --quiet "$REMOTO/main" 2>/dev/null || echo '')"
[ -z "$BASE" ] && exit 0

# Los que cambian en lo que se esta por publicar. `--diff-filter=d` saca los
# borrados: un archivo que ya no existe no se puede lintear.
CAMBIADOS="$(git diff --name-only --diff-filter=d "$BASE"...HEAD -- '*.tsx' '*.jsx' 2>/dev/null)"
[ -z "$CAMBIADOS" ] && exit 0

MIRAR=''
SALTEADOS=''
for f in $CAMBIADOS; do
  # `git status --porcelain` de UN archivo: vacio = igual que HEAD.
  if [ -n "$(git status --porcelain -- "$f" 2>/dev/null)" ]; then
    SALTEADOS="$SALTEADOS $f"
  else
    MIRAR="$MIRAR $f"
  fi
done

[ -n "$SALTEADOS" ] && echo "  · con cambios sin commitear, no se miran:$SALTEADOS"
[ -z "$MIRAR" ] && exit 0

# shellcheck disable=SC2086
npx eslint --config scripts/eslint-hooks.config.mjs $MIRAR
