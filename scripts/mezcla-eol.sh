#!/bin/sh
# Re-mezcla archivos en conflicto normalizando los finales de línea (CRLF → LF) en las tres versiones, con git merge-file.
# Si queda limpio, lo escribe con el final de línea que tenía HEAD. Si no, deja los marcadores para resolver a mano.
# Uso (con un merge en curso): sh mezcla-eol.sh <archivo>...
B=$(git merge-base HEAD MERGE_HEAD)
T=$(mktemp -d)
for f in "$@"; do
  git show "HEAD:$f" > "$T/o" && git show "$B:$f" > "$T/b" && git show "MERGE_HEAD:$f" > "$T/t" || { echo "$f: falta en alguna versión"; continue; }
  crlf=$(grep -c $'\r$' "$T/o")
  for x in o b t; do sed -i 's/\r$//' "$T/$x"; done
  git merge-file -p "$T/o" "$T/b" "$T/t" > "$T/m"; n=$?
  if [ "$crlf" -gt 0 ]; then sed 's/$/\r/' "$T/m" > "$f"; else cp "$T/m" "$f"; fi
  echo "$f: conflictos=$n (CRLF en HEAD: $crlf líneas)"
done
rm -rf "$T"
