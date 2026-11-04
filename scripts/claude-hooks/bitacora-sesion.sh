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

# --- el session_id y el origen llegan por stdin en el JSON del hook ---
entrada=$(timeout 2 cat 2>/dev/null)
sid=$(printf '%s' "$entrada" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -z "$sid" ] && sid="?"
origen=$(printf '%s' "$entrada" | grep -o '"source": *"[^"]*"' | head -1 | cut -d'"' -f4)

# --- al abrir, la app corrige el marcador (4/11/2026) ---
# Martín: «Te lo tengo que pedir cada que entro en una cuenta y eso debería ser automático». La app le pone a cada chat
# CLAUDE_CODE_ACCOUNT_UUID, y runner-salud.mjs lo traduce con operaciones/config.json. Va ANTES de leer el marcador. Devuelve
# una línea si a esta cuenta le falta el Runner o su guardia. Le importa el origen: SessionStart también corre al compactar,
# con el uuid del día que arrancó ese chat, y eso devolvería el marcador a la cuenta anterior. Sólo vale `startup`.
salud=""
if [ "$accion" = "inicio" ] && [ -f "$HOME/.claude/operaciones/runner-salud.mjs" ]; then
  salud=$(timeout 8 node "$HOME/.claude/operaciones/runner-salud.mjs" al-abrir "$origen" </dev/null 2>/dev/null | tr -d '\r\n"\\')
fi

# --- la cuenta sale del marcador, y el marcador de la app ---
cuenta=$(head -1 "$MARCADOR" 2>/dev/null | tr -d '\r\n')
[ -z "$cuenta" ] && cuenta="desconocida"
# El titular sale de una TABLA, no de un `case`: sumar una cuenta tiene que ser UNA LÍNEA
# en ~/.claude/cuentas.tsv («<cuenta>\t<Nombre <email>>»), no editar este script. Si el
# archivo no está o la cuenta no figura, lo dice en vez de inventar un titular.
CUENTAS="${CUENTAS_CLAUDE:-$HOME/.claude/cuentas.tsv}"
titular=$(awk -F'\t' -v c="$cuenta" '$1==c{sub(/\r$/,"",$2); print $2; exit}' "$CUENTAS" 2>/dev/null)
[ -z "$titular" ] && titular="SIN IDENTIFICAR (agregala a ~/.claude/cuentas.tsv)"
anotada=$(date -r "$MARCADOR" "+%d/%m %H:%M" 2>/dev/null || echo "?")

# --- Umbrales de la ventana SEMANAL (hook UserPromptSubmit: corre en CADA mensaje) ---
# Un script no puede leer el % semanal: no queda en ningún archivo local (el log de la
# app sólo lo anota cuando el límite YA se pasó). Lo lee el MODELO, con la herramienta
# get_usage. Así que el modelo mide y deja el número en USO, y este hook lo lee en cada
# mensaje de cada chat y dispara los umbrales. La ventana semanal es de la CUENTA:
# cualquier chat que mida le avisa a todos los chats DE ESA CUENTA.
#
# ⚠️ LAS DOS CUENTAS COMPARTEN ~/.claude, Y POR ESO EL NÚMERO LLEVA SU CUENTA (4º campo).
# Hasta el 09/10/2026 el archivo guardaba «98 <reset> <hora>» sin decir de quién era: la
# cuenta 1 midió 98% a las 15:45, Martín pasó a la cuenta 2 (que estaba en 17%) y el primer
# mensaje de la 2 recibió «CIERRE: no arranques nada más». Un número de otra cuenta es un
# número SIN MEDIR para ésta: no dispara umbrales y pide medir de nuevo. Una línea vieja de
# tres campos (sin cuenta) cuenta igual: no se sabe de quién es.
#
# Lo que NO hace, a propósito: pushear código a medias. Pushear a main es desplegar a
# clientes, y para no perderlo no hace falta — las dos cuentas usan el MISMO clon en la
# misma máquina. Lo que se pierde al cambiar de cuenta es el contexto, no el árbol.
if [ "$accion" = "turno" ]; then
  USO="${USO_SEMANAL:-$HOME/.claude/uso-semanal.txt}"
  ESTADO="${UMBRALES_ESTADO:-$HOME/.claude/umbrales-avisados.tsv}"
  REPO="${RELEVO_REPO:-$HOME/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing}"
  emitir() { printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$1"; exit 0; }

  pct=""; resets=""; medido=""; de_cuenta=""
  [ -s "$USO" ] && read -r pct resets medido de_cuenta < "$USO"
  # Medido por OTRA cuenta (o sin cuenta): para ésta no hay número.
  if [ "$de_cuenta" != "$cuenta" ]; then pct=""; resets=""; medido=""; fi
  viejo=1                                  # nunca medido, o hace más de 30 minutos
  if [ -n "$medido" ]; then
    t_med=$(date -d "$medido" +%s 2>/dev/null || echo 0)
    [ $(( $(date +%s) - t_med )) -lt 1800 ] && viejo=0
  fi

  pct_int=${pct%%.*}; case "$pct_int" in ''|*[!0-9]*) pct_int=0 ;; esac
  umbral=0
  # 2/11/2026, Martín, textual: «te había dado un prompt para que arranques… y me decís mil millones
  # de veces que no vas a arrancar nada nuevo cuando explícitamente te pido que arranques y que si
  # estás llegando al final —98, 99— guardes contexto y yo lo sigo con la próxima cuenta».
  # El 95% decía «no arranques nada más» y por eso un chat le contestaba eso en vez de trabajar.
  # El cierre pasa al 98%: hasta ahí se TRABAJA, con el relevo al día después de cada paso.
  for u in 98 95 90 85; do [ "$pct_int" -ge "$u" ] && { umbral=$u; break; }; done

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
        85) extra="Antes de seguir: (1) escribi o actualiza tu docs/relevo/<tu-area>.md con TODO lo de esta cuenta (lo pedido, lo hecho con su commit y rama, lo que esta a medias con su archivo, lo que espera a Martin) y commitealo por ruta; (2) lo TERMINADO y verificado, commit y push como siempre; (3) lo que este A MEDIAS no se pushea, porque pushear es desplegar a clientes. Al 97% de la semanal o de las 5 horas el chat corta (guardia/corte-97.mjs): que el relevo ya este al dia cuando llegue." ;;
        90) extra="Lo del 85% si no lo hiciste, y ademas: trabaja en pasos chicos y commiteables, y actualiza el relevo despues de cada uno. SEGUI con lo que Martin pidio: no postergues ni le anuncies que no vas a arrancar." ;;
        95) extra="Lo del 85% y el 90% si no lo hiciste. SEGUI TRABAJANDO en lo que Martin pidio, en pasos chicos y commiteables, con el relevo al dia despues de cada uno. NO anuncies que no arrancas nada: el cierre es al 98%, no acá." ;;
        98) extra="AHORA SI, CIERRE: escribi el relevo final de tu area con TODO lo de esta cuenta, commitealo y pushea lo terminado. Lo que quede a medias va en el relevo con su archivo; un workflow que corre, con su runId y su journal.jsonl. Decile a Martin que guardaste el contexto y que siga con la proxima cuenta." ;;
      esac
      # 18/10/2026, Martín: sin restricciones. Con guardia/sin-corte, el umbral sólo informa: nadie frena ni posterga.
      [ -f "$HOME/.claude/guardia/sin-corte" ] && extra="Martin saco el corte (18/10/2026): segui con lo que te pidieron, sin frenar ni postergar. Commitea seguido: al 100% la cuenta frena de golpe."
      emitir "USO SEMANAL EN ${pct}% (medido $medido): cruzaste el umbral del ${umbral}%. ${extra}${snap} Avisale a Martin en una linea que pasaste el ${umbral}%."
    fi
  fi

  if [ "$viejo" = 1 ]; then
    emitir "USO SEMANAL SIN MEDIR (o con mas de 30 min, o medido por la OTRA cuenta): antes de contestar, llama a la herramienta get_usage y pasale sus ventanas al cartero, que las anota para este hook, para el corte del 97% y para el Uso del Ops Center: node ~/.claude/operaciones/cartero.mjs medir <5h %> <5h resetsAt> <semana %> <semana resetsAt>, con los valores de '5-hour limit' y 'Weekly - all models'. Si medir se niega, la huella de la semana no cierra con el marcador: nunca uses --renovada sin que lo diga Martin; decile en una linea, y deja la semanal para este hook con: echo <percentUsed> <resetsAt> \$(date -u +%FT%TZ) \$(head -1 ~/.claude/cuenta-activa.txt) > ~/.claude/uso-semanal.txt. No hace falta comentarselo al usuario."
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

msg="CUENTA DE CLAUDE ACTIVA: $cuenta = $titular (marcador del $anotada en ~/.claude/cuenta-activa.txt; al abrir lo corrige el uuid de la cuenta que la app le pone al chat). Cada cuenta tiene SIEMPRE el mismo titular y la tabla esta en ~/.claude/cuentas.tsv; si dice SIN IDENTIFICAR, hay que sumarle una linea ahi. Quien te habla es MARTIN KONCKE (martinkoncke@gmail.com), duenio de las CINCO cuentas (16/10: las 1, 2 y 4 solo usan otro gmail para la suscripcion; son suyas. La 5, Ananda, entro el 24/10). El userEmail de tu contexto sale de ~/.claude.json, va con retraso y NO sirve para saber la cuenta. OJO: esto es una FOTO del arranque y no se actualiza solo; antes de firmar un commit releelo con 'head -1 ~/.claude/cuenta-activa.txt', porque Martin puede haber cambiado de cuenta con la sesion abierta (paso el 27/09: dos commits salieron firmados claude1 con el marcador ya en claude2). Firma cada commit con el trailer Claude-Cuenta: $cuenta, PEGADO a Co-Authored-By y sin linea en blanco en el medio: git solo parsea el ultimo bloque contiguo, y una linea vacia deja el trailer afuera sin dar error.$previa$aviso Si Martin dice que la cuenta es otra, gana Martin: reescribi el marcador en el acto. CONTINUA (regla de Martin, 28/10): al 97% de la cuota cada chat guarda TODO lo de su cuenta y corta, y Martin pasa a otra cuenta y escribe Continua. Si te lo escribe al abrir: lee el .tsv mas nuevo de ~/.claude/relevos-cuenta/ (que chats cortaron, en que carpeta, rama y transcript), el docs/relevo/cerebro.md de C:/dev/wt-push-q (git -C C:/dev/wt-push-q log -5 primero) y el relevo de cada chat en su carpeta (git -C <carpeta> show HEAD:docs/relevo/<chat>.md), y segui desde ahi sin preguntar. Un workflow que quedo corriendo dejo lo suyo en el journal.jsonl que nombra el relevo.${salud:+ $salud}"

# JSON a mano: el mensaje se construyo sin comillas ni saltos, asi que es seguro
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg"
