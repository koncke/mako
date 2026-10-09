#!/usr/bin/env bash
# Bitácora de sesiones de Claude sobre el clon de MaKo.
#
# Por qué existe: el 25/08/2026 no se pudo contestar "¿desde qué fecha a qué fecha
# estuve en la cuenta 2?". El único dato era el trailer Claude-Cuenta de los commits,
# que se firmaba ADIVINANDO la cuenta — y la firma alternaba cada 2-4 minutos sobre
# trabajo continuo. El trailer registraba la adivinanza, no la cuenta.
#
# Ahora la cuenta se DECLARA en ~/.claude/cuenta-activa.txt y acá se registra cada
# apertura y cierre, con fecha real. La bitácora vive fuera del repo a propósito: no
# ensucia el árbol de trabajo ni se pisa entre sesiones paralelas.
#
# Uso:  bitacora-sesion.sh inicio   (hook SessionStart, imprime contexto)
#       bitacora-sesion.sh turno    (hook UserPromptSubmit, umbrales del % semanal)
#       bitacora-sesion.sh fin      (hook SessionEnd, registra y commitea el relevo)
#
# Copia versionada y cómo instalarlo: scripts/claude-hooks/ y docs/guardado-automatico.md
# en el repo de MaKo. Si editás uno, copiá al otro.

set -u
accion="${1:-inicio}"

BITACORA="${BITACORA_SESIONES:-$HOME/.claude/bitacora-sesiones.tsv}"
MARCADOR="$HOME/.claude/cuenta-activa.txt"
PROY="$HOME/.claude/projects/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main"

# --- la cuenta sale del marcador, nunca de una deducción ---
cuenta=$(head -1 "$MARCADOR" 2>/dev/null | tr -d '\r\n')
[ -z "$cuenta" ] && cuenta="desconocida"
case "$cuenta" in
  claude1) titular="Mauricio Bustos <mbustos@elevate.com.mx>" ;;
  claude2) titular="Leandro Tejado <tejadomartin@gmail.com>" ;;
  *)       titular="sin identificar" ;;
esac
anotada=$(date -r "$MARCADOR" "+%d/%m %H:%M" 2>/dev/null || echo "?")

# --- el session_id llega por stdin en el JSON del hook ---
sid=$(timeout 2 cat 2>/dev/null | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -z "$sid" ] && sid="?"

# --- Umbrales de la ventana SEMANAL (hook UserPromptSubmit: corre en CADA mensaje) ---
# Un script no puede leer el % semanal: no queda en ningún archivo local (el log de la
# app sólo lo anota cuando el límite YA se pasó). Lo lee el MODELO, con la herramienta
# get_usage. Así que el modelo mide y deja el número en USO, y este hook lo lee en cada
# mensaje de cada chat y dispara los umbrales. La ventana semanal es de la CUENTA:
# cualquier chat que mida le avisa a todos.
#
# Lo que NO hace, a propósito: pushear código a medias. Pushear a main es desplegar a
# clientes, y para no perderlo no hace falta — las dos cuentas usan el MISMO clon en la
# misma máquina. Lo que se pierde al cambiar de cuenta es el contexto, no el árbol.
if [ "$accion" = "turno" ]; then
  USO="${USO_SEMANAL:-$HOME/.claude/uso-semanal.txt}"
  ESTADO="${UMBRALES_ESTADO:-$HOME/.claude/umbrales-avisados.tsv}"
  REPO="${RELEVO_REPO:-$HOME/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing}"
  emitir() { printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$1"; exit 0; }

  pct=""; resets=""; medido=""
  [ -s "$USO" ] && read -r pct resets medido < "$USO"
  viejo=1                                   # nunca medido, o hace más de 30 minutos
  if [ -n "$medido" ]; then
    t_med=$(date -d "$medido" +%s 2>/dev/null || echo 0)
    [ $(( $(date +%s) - t_med )) -lt 1800 ] && viejo=0
  fi

  pct_int=${pct%%.*}; case "$pct_int" in ''|*[!0-9]*) pct_int=0 ;; esac
  umbral=0
  for u in 95 90 85; do [ "$pct_int" -ge "$u" ] && { umbral=$u; break; }; done

  if [ "$umbral" -gt 0 ]; then
    clave="$resets|$sid|$umbral"            # una vez por chat, por umbral y por semana
    if ! grep -qxF "$clave" "$ESTADO" 2>/dev/null; then
      echo "$clave" >> "$ESTADO"
      # Foto de lo que esté a medias: UNA por umbral y por semana, del árbol entero. Va a
      # un índice temporal (no toca el índice compartido, donde otras sesiones stagean)
      # y a una ref local: no mueve la rama, no se pushea, no despliega.
      ref="refs/wip/semanal-u$umbral-${resets%%T*}"
      snap=""
      if [ -e "$REPO/.git" ] && ! git -C "$REPO" rev-parse -q --verify "$ref" >/dev/null 2>&1; then
        tmpidx="$(mktemp)"
        ( cd "$REPO" && cp "$(git rev-parse --git-path index)" "$tmpidx" \
          && export GIT_INDEX_FILE="$tmpidx" \
          && git add -A -- . ':!public/cono-tx' >/dev/null 2>&1 \
          && tree=$(git write-tree) \
          && c=$(git commit-tree "$tree" -p HEAD -m "wip: foto automatica al $umbral% semanal") \
          && git update-ref "$ref" "$c" ) >/dev/null 2>&1 \
          && snap=" Ya quedo una FOTO local de todo lo sin commitear en $ref: no se pusheo y no despliega; se recupera con git checkout $ref -- <ruta>."
        rm -f "$tmpidx"
      fi
      case "$umbral" in
        85) extra="Antes de seguir: (1) escribi o actualiza tu docs/relevo/<tu-area>.md y commitealo por ruta; (2) lo TERMINADO y verificado, commit y push como siempre; (3) lo que este A MEDIAS no se pushea, porque pushear es desplegar a clientes." ;;
        90) extra="Lo del 85% si no lo hiciste, y ademas: no arranques trabajo grande nuevo; cerra lo abierto en pasos chicos y commiteables." ;;
        95) extra="CIERRE: escribi el relevo final de tu area ahora, commitealo, pushea lo terminado y no arranques nada mas. Lo que quede a medias va en el relevo con su archivo." ;;
      esac
      emitir "USO SEMANAL EN ${pct}% (medido $medido): cruzaste el umbral del ${umbral}%. ${extra}${snap} Avisale a Martin en una linea que pasaste el ${umbral}%."
    fi
  fi

  if [ "$viejo" = 1 ]; then
    emitir "USO SEMANAL SIN MEDIR o con mas de 30 min: antes de contestar, llama a la herramienta get_usage y guarda la ventana 'Weekly - all models' con este comando, reemplazando los dos valores: echo <percentUsed> <resetsAt> \$(date -u +%FT%TZ) > ~/.claude/uso-semanal.txt  -- con eso este hook le avisa los umbrales del 85, 90 y 95% a TODOS los chats. No hace falta comentarselo al usuario."
  fi
  exit 0
fi

ahora=$(date "+%Y-%m-%d %H:%M:%S")
printf '%s\t%s\t%s\t%s\n' "$ahora" "$accion" "$cuenta" "$sid" >> "$BITACORA"

# --- Red de seguridad: el relevo escrito y SIN commitear ---
# El 06/10/2026 la cuenta 1 escribió seis briefings (16:30-16:53) y se quedó sin
# tokens antes del commit: quedaron `??`, a un `git clean` de perderse. Pero ESTE
# hook sí corrió — la bitácora tiene sus `fin` a las 17:37 —, o sea que el cierre de
# sesión dispara aunque no quede cuota. Así el último commit no depende del modelo.
#
# Acotado a propósito: sólo docs/relevo/ y docs/relevo.md, y por RUTA
# (`git commit -- <rutas>` ignora el resto del índice, donde otra sesión puede tener
# cosas stageadas). NO pushea: la otra cuenta trabaja sobre este mismo clon, y un
# push publicaría los commits locales de todas las sesiones y dispararía un build.
if [ "$accion" = "fin" ]; then
  REPO="${RELEVO_REPO:-$HOME/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing}"
  if [ -e "$REPO/.git" ]; then
    (
      cd "$REPO" || exit 0
      pendientes() { git status --porcelain -uall -- docs/relevo docs/relevo.md 2>/dev/null | cut -c4-; }
      [ -z "$(pendientes)" ] && exit 0
      # Varias sesiones cierran a la vez (el 06/10, cuatro en el mismo segundo): un
      # lock por mkdir, que es atómico, y si quedó huérfano de hace 2 min se descarta.
      lock="$HOME/.claude/relevo-commit.lock"
      find "$lock" -maxdepth 0 -mmin +2 -exec rmdir {} \; 2>/dev/null
      i=0; until mkdir "$lock" 2>/dev/null; do i=$((i+1)); [ "$i" -ge 15 ] && exit 0; sleep 1; done
      trap 'rmdir "$lock" 2>/dev/null' EXIT
      pend="$(pendientes)"            # re-leer: la sesión que tenía el lock pudo commitearlo
      [ -z "$pend" ] && exit 0
      git status --porcelain -uall -- docs/relevo docs/relevo.md | grep '^??' | cut -c4- \
        | while IFS= read -r f; do git add -N -- "$f"; done
      msg="$HOME/.claude/relevo-commit-msg.$$"
      { printf 'relevo: commit automatico al cerrar la sesion %s\n\n' "${sid:0:8}"
        printf 'Lo hizo el hook SessionEnd (~/.claude/bitacora-sesion.sh), no el modelo:\n'
        printf 'la sesion cerro con su relevo escrito y sin commitear. Solo docs/relevo/.\n\n'
        printf 'Claude-Cuenta: %s\n' "$cuenta"; } > "$msg"
      printf '%s\n' "$pend" | xargs -d '\n' git commit -q -F "$msg" -- >/dev/null 2>&1
      rm -f "$msg"
    ) || true
  fi
  exit 0
fi

# --- ¿hay otra sesión viva? ---
# El mtime del .jsonl NO alcanza: se ensucia solo (un reindexado tocó 9 archivos a la
# vez el 25/08 y el conteo dio 3 donde había 1). Lo que no miente es el ÚLTIMO
# timestamp ESCRITO ADENTRO. Se lee la cola —4 KB alcanzan— y se compara como texto,
# que en ISO-8601 UTC equivale a comparar fechas.
corte=$(date -u -d '20 minutes ago' "+%Y-%m-%dT%H:%M" 2>/dev/null)
otras=0
if [ -d "$PROY" ] && [ -n "$corte" ]; then
  # El mtime se usa como PREFILTRO barato (sobra-reporta, pero descarta rápido las
  # decenas de sesiones viejas); el timestamp interno confirma. Leer la cola de todos
  # los .jsonl tardaba 4,9 s en el arranque, que es tiempo que Martín espera mirando.
  for f in $(find "$PROY" -maxdepth 1 -name '*.jsonl' -mmin -25 2>/dev/null); do
    [ -e "$f" ] || continue
    case "$f" in *"$sid"*) continue ;; esac
    ult=$(tail -c 4000 "$f" 2>/dev/null | grep -o '"timestamp":"[0-9T:.Z-]*"' \
          | tail -1 | cut -d'"' -f4)
    [ -n "$ult" ] && [ "$ult" \> "$corte" ] && otras=$((otras+1))
  done
fi

aviso=""
if [ "$otras" -gt 0 ]; then
  aviso=" ATENCION: hay $otras sesion(es) mas con actividad en los ultimos 20 minutos, sobre este MISMO clon. Antes de commitear: git status, y commitea por RUTA EXPLICITA, nunca git add -A. Antes de pushear: git pull --rebase, porque main pudo moverse."
fi

# --- última sesión anterior, para saber de dónde se viene ---
previa=$(grep -v "	$sid$" "$BITACORA" 2>/dev/null | tail -1 \
         | awk -F'\t' '{print $1" ("$2", "$3")"}')
[ -n "$previa" ] && previa=" Sesion anterior registrada: $previa."

msg="CUENTA DE CLAUDE ACTIVA: $cuenta = $titular (declarada el $anotada en ~/.claude/cuenta-activa.txt). La cuenta 1 es SIEMPRE de Mauricio y la 2 SIEMPRE de Leandro; es fijo. Quien te habla es MARTIN KONCKE (martinkoncke@gmail.com), que no es titular de ninguna de las dos. El userEmail de tu contexto sale de ~/.claude.json, va con retraso y NO sirve para saber la cuenta. OJO: esto es una FOTO del arranque y no se actualiza solo; antes de firmar un commit releelo con 'head -1 ~/.claude/cuenta-activa.txt', porque Martin puede haber cambiado de cuenta con la sesion abierta (paso el 27/09: dos commits salieron firmados claude1 con el marcador ya en claude2). Firma cada commit con el trailer Claude-Cuenta: $cuenta, PEGADO a Co-Authored-By y sin linea en blanco en el medio: git solo parsea el ultimo bloque contiguo, y una linea vacia deja el trailer afuera sin dar error.$previa$aviso Si Martin dice que la cuenta es otra, gana Martin: reescribi el marcador en el acto."

# JSON a mano: el mensaje se construyo sin comillas ni saltos, asi que es seguro
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"
