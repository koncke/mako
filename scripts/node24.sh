#!/bin/sh
# =============================================================================
# node24.sh — deja un Node 24 (el de GitHub Actions) y escribe la carpeta de su `bin`
# =============================================================================
# Uso, en una sesión de la nube:   export PATH="$(sh scripts/node24.sh):$PATH"
#
# Por qué (4/11/2026): el `node` de la nube es el 22 y Actions corre el 24. Con el 22, ~40 archivos de test dan rojo de mentira
# (docs/relevo/nube-whatsapp.md), los grupos compartidos de tests-afectados salen «NO CORRIÓ» y el tsc acotado sale «código
# undefined» sin chequear nada (docs/hallazgos-infra.md). Un veredicto de la nube (scripts/veredicto.mjs) exige el 24, y un
# `/opt/node24` que instaló otra sesión no está en la de al lado: el contenedor de cada sesión es nuevo.
#
# Qué hace: si el `node` del PATH ya es el 24, escribe su carpeta. Si no, usa el que dejó una corrida anterior en la caché
# (`$MAKO_NODE_CACHE`, o `~/.cache/mako-node`), y si no hay, baja el último 24 de nodejs.org, COMPRUEBA su sha256 contra
# SHASUMS256.txt y lo desarma ahí. Sólo Linux y macOS (x64 y arm64): en la PC de Martín el Node ya es el 24.
# Lo que escribe en la salida es SÓLO la carpeta; los avisos van a stderr, para que `$(…)` quede limpio.
# =============================================================================
set -eu
MAYOR=24

actual=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$actual" = "$MAYOR" ]; then
  dirname "$(command -v node)"
  exit 0
fi

case "$(uname -s)" in Linux) so=linux ;; Darwin) so=darwin ;; *) echo "node24.sh: sólo Linux y macOS (acá: $(uname -s))." >&2; exit 2 ;; esac
case "$(uname -m)" in x86_64|amd64) arq=x64 ;; aarch64|arm64) arq=arm64 ;; *) echo "node24.sh: arquitectura $(uname -m) sin Node oficial." >&2; exit 2 ;; esac

cache="${MAKO_NODE_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/mako-node}"
mkdir -p "$cache"

# Uno que ya esté desarmado de una vez anterior (el más nuevo).
listo=$(ls -d "$cache"/node-v$MAYOR.*-$so-$arq 2>/dev/null | sort -V | tail -1 || true)
if [ -n "$listo" ] && [ -x "$listo/bin/node" ]; then
  echo "$listo/bin"
  exit 0
fi

base="https://nodejs.org/dist/latest-v$MAYOR.x"
tmp=$(mktemp -d "$cache/bajando.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --retry 3 "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
linea=$(grep " node-v$MAYOR\.[0-9.]*-$so-$arq\.tar\.xz\$" "$tmp/SHASUMS256.txt" | head -1)
[ -n "$linea" ] || { echo "node24.sh: SHASUMS256.txt no nombra un tar.xz para $so-$arq." >&2; exit 2; }
esperado=$(echo "$linea" | awk '{print $1}')
archivo=$(echo "$linea" | awk '{print $2}')
echo "node24.sh: bajo $archivo (una vez; queda en $cache)." >&2
curl -fsSL --retry 3 "$base/$archivo" -o "$tmp/$archivo"
if command -v sha256sum >/dev/null 2>&1; then obtenido=$(sha256sum "$tmp/$archivo" | awk '{print $1}'); else obtenido=$(shasum -a 256 "$tmp/$archivo" | awk '{print $1}'); fi
if [ "$obtenido" != "$esperado" ]; then
  echo "node24.sh: el sha256 de $archivo no es el de SHASUMS256.txt: no lo uso." >&2
  exit 2
fi
tar -xJf "$tmp/$archivo" -C "$tmp"
dir="${archivo%.tar.xz}"
# Con dos sesiones a la vez, gana la primera que termina: `mv` sobre una carpeta que ya existe falla y se usa la que está.
mv "$tmp/$dir" "$cache/$dir" 2>/dev/null || true
[ -x "$cache/$dir/bin/node" ] || { echo "node24.sh: no quedó $cache/$dir/bin/node." >&2; exit 2; }
echo "$cache/$dir/bin"
