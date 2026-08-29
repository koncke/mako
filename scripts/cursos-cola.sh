#!/bin/sh
# LA COLA de cursos: bajar → transcribir → subir a Drive → publicar, UN CURSO A LA VEZ.
#
#   Qué hace:  los cursos listados en C:/cursos/_cola.txt, uno por línea, en ese orden.
#   Lanzar:    schtasks /run   /tn "cursos-cola"
#   Mirar:     sh scripts/cursos-estado.sh
#   Frenar:    schtasks /end   /tn "cursos-cola"
#   Registrar la tarea (una sola vez): scripts/cursos-cola-instalar.cmd
#
# ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ LA LISTA VIVE EN UN ARCHIVO, NO ACÁ ADENTRO
#
# `_cola.txt` se escribe a mano (o con un script) y se revisa antes de lanzar. La
# alternativa —que la cola DEDUZCA sola qué falta— ya falló dos veces el 27/08/2026, las
# dos por lo mismo: **el nombre de la carpeta local no es el slug del portal**. La carpeta
# «100M money Models - Alex Hormozi» se publica como `100m-money-models`, así que cruzar
# por nombre de carpeta daba 27 cursos pendientes cuando eran 15, y metía en la cola 1.000
# clases ya publicadas. Una cola que se equivoca de más baja decenas de GB al pedo.
#
# Si hace falta regenerar la lista, el cruce va por el `slug` del plan.json (y por la URL
# de `pagina`), NUNCA por el nombre de la carpeta.
#
# ⚠️ POR QUÉ ES UNA TAREA PROGRAMADA Y NO UNA TAREA DE FONDO DE CLAUDE
#
# El 27/08/2026 la cola murió a mitad de un curso —22 de 49 clases, 0 transcriptas— sin un
# solo error en el log: colgaba de una tarea de fondo del harness, y el harness mata el
# grupo de procesos cuando la sesión termina. Un trabajo de 10+ horas no puede colgar de la
# sesión. La tarea programada corre bajo el servicio de Windows, fuera del árbol.
#
# ⚠️ EL PISO DE DISCO, Y POR QUÉ NO ES EL TAMAÑO DE LA CLASE
#
# yt-dlp baja video y audio por separado y los MERGEA a un `.temp.mp4` SIN borrar las
# fuentes hasta terminar: cerrar una clase necesita el DOBLE de lo que va a pesar. Una de
# 13 GB pide 28 GB libres. Y las clases grandes no se anuncian, así que el piso se mide
# antes de CADA curso.
#
# ⚠️ EL CHROME DEDICADO PUEDE QUEDAR ABIERTO. El bajador solo toca sus cookies si se le
# pasa `--cookies`, y acá no se le pasa. (El error «Could not copy Chrome cookie database»
# aparece únicamente con ese flag.)
# ─────────────────────────────────────────────────────────────────────────────────────

REPO="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing"
LOG="C:/cursos/cola.log"
# ⚠️ EL BAJADOR ESCRIBE EN SU PROPIO ARCHIVO, Y NO ES PROLIJIDAD: DOS ESCRITORES
#    CONCURRENTES SE COMEN LÍNEAS.
#
#    Desde que el bajador corre con `&`, él y el pipeline escribían al MISMO `cola.log` a la
#    vez. Medido el 29/08/2026 reproduciéndolo: con escrituras grandes —que es lo que hace
#    `node`, no `echo`— **se perdieron 315 de 3000 líneas, un 10,5%**. En el log real
#    quedaron 1.471 líneas con UTF-8 roto (escrituras cortadas a mitad de carácter) y
#    líneas de dos procesos fundidas en una sola.
#
#    El daño no es cosmético: `-- pipeline (1a pasada) salió` aparecía **5 veces sobre 23
#    rondas**, y es justo la única línea que se escribe MIENTRAS el bajador escribe. Con
#    eso, cualquier medición sobre este log mide el ruido. Se quemaron cuatro métodos de
#    medición antes de encontrarlo, y el síntoma parecía un bug de la cola.
#
#    ⚠️ La primera prueba que hice NO lo reprodujo: dos `echo` de sh escribiendo líneas
#       cortas dan 8000 de 8000. Hace falta que uno de los dos escriba en chunks grandes.
#       Una prueba de concurrencia que no imita el TAMAÑO de escritura no prueba nada.
LOG_BAJA="C:/cursos/bajador.log"
LISTA="C:/cursos/_cola.txt"
PISO=14          # GB para arrancar un curso
TOPE_BAJADOR=4h  # ningún curso puede quedarse con la cola (ver el porqué más abajo)

cd "$REPO" || exit 1
libres() { df -k /c | tail -1 | awk '{printf "%d", $4/1048576}'; }
di() { echo "$1" >> "$LOG"; }

# ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ UNA SOLA COLA A LA VEZ. NO ES PRUDENCIA: EL 28/08/2026 HUBO DOS.
#
# El perro revivía con `schtasks /end` + `/run`, y `/end` mata el proceso que la tarea
# registró pero NO a sus nietos — Git Bash re-ejecuta el script en un hijo. Cada
# resurrección dejaba una cola huérfana corriendo. Medido: dos árboles vivos y DOS
# `curso-pipeline` sobre la MISMA carpeta de curso.
#
# Y lo que más costó no fue el trabajo duplicado: fue que el log tenía dos escritores.
# La señal de vida del perro es la fecha del log, así que con dos colas escribiendo una
# cola colgada parece viva para siempre. **El vigilante deja de vigilar y nada avisa.**
# Se descubrió de rebote, por una medición que no cerraba: el log mezclaba el formato de
# línea viejo con el nuevo, que es imposible con un solo proceso.
#
# El lock es la guarda que NO depende de que el perro mate bien: aunque quede un huérfano,
# el segundo se niega a arrancar. Se chequea con `kill -0` y no con PowerShell porque el
# `$$` de Git Bash es el pid de MSYS y NO existe para Windows — preguntarle a Windows por
# ese número contesta «no existe» sobre un proceso vivo, y el lock se creería huérfano
# siempre. Entre dos Git Bash, en cambio, los pid son del mismo espacio.
# ─────────────────────────────────────────────────────────────────────────────────────
LOCK="C:/cursos/_cola.lock"
if [ -f "$LOCK" ]; then
  OTRA=$(tr -d "\r" < "$LOCK")
  if [ -n "$OTRA" ] && kill -0 "$OTRA" 2>/dev/null; then
    di ""
    di "⛔ ya hay una cola viva (pid $OTRA) — NO arranco. $(date)"
    exit 0
  fi
  di ""
  di "   (lock de la pid $OTRA, que ya no existe: lo tomo) $(date)"
fi
echo $$ > "$LOCK"

if [ ! -f "$LISTA" ]; then
  rm -f "$LOCK"
  di ""
  di "⛔ No existe $LISTA — la cola no tiene qué hacer."
  exit 1
fi

di ""
di "════════ cola arrancada $(date) · $(libres) GB libres · $(grep -c . "$LISTA") curso(s) ════════"

# ⚠️ El `tr -d` no es cosmético: `_cola.txt` se edita en Windows y vuelve con CRLF.
# El \r se pega al nombre de la carpeta, `C:/cursos/<curso>\r/plan.json` no existe, y la
# cola saltea los 12 cursos en un segundo. Pasó el 27/08/2026 en el primer lanzamiento.
# Se encontró rápido sólo porque el skip AVISA en el log en vez de callarse: una cola que
# no encuentra nada y termina 0 tiene que decir por qué, no salir con éxito.
while IFS= read -r d; do
  d=$(printf %s "$d" | tr -d "\r")
  [ -z "$d" ] && continue
  case "$d" in \#*) continue ;; esac

  PLAN="C:/cursos/$d/plan.json"
  if [ ! -f "$PLAN" ]; then
    di ""
    di "  ⚠ $d: no tiene plan.json — lo salto."
    continue
  fi

  L=$(libres)
  di ""
  di "════ $d · $(date) · $L GB libres ════"
  if [ "$L" -lt "$PISO" ]; then
    di "  ⛔ PARO: quedan $L GB y el piso es $PISO. Los planes de los que faltan quedan intactos."
    di "     Lo que libera espacio NO es publicar, es:"
    di "       node scripts/curso-a-drive.mjs --plan C:/cursos/<slug>/plan.json --liberar"
    di "     Borra solo lo YA confirmado en Drive y con el audio ya extraído (cinco condiciones)."
    break
  fi

  # ⚠️ TOPE DE RELOJ. Con 78 cursos en fila, UN curso que se cuelga se queda con la
  #    cola entera. El 28/08/2026 pasó exactamente eso: las URLs firmadas de los
  #    segmentos vencieron a mitad de un video de 62 min, todos los fragmentos siguientes
  #    dieron 410, y yt-dlp los reintentó y salteó uno por uno durante SIETE HORAS con
  #    los otros 77 cursos esperando. El `--abort-on-unavailable-fragment` de
  #    curso-bajar.mjs ataca la causa; esto es la red por si aparece otra forma de
  #    colgarse. Lo que quede a medias se retoma solo: el --download-archive no repite.
  # ⚠️ BAJAR Y TRANSCRIBIR VAN A LA VEZ, no uno atrás del otro.
  #
  #    Medido sobre «megadata» (7 clases): 5m44 bajando y 6m46 transcribiendo+subiendo,
  #    o sea casi mitad y mitad — y mientras transcribía NO se bajaba nada, y mientras
  #    bajaba no se transcribía. Son recursos distintos: uno es la red de bajada, el otro
  #    CPU (ffmpeg), APIs de transcripción y la red de SUBIDA.
  #
  #    El pipeline YA estaba escrito para esto: su `descargaViva` mira si `bajados.txt`
  #    crece o si hay un `.part` FRESCO, y no publica mientras el bajador trabaje. Esa
  #    lógica existía y nunca se había usado, porque la cola los corría en serie.
  di "  ▶ bajando y transcribiendo A LA VEZ · $(date +%H:%M:%S)  (la bajada, en $LOG_BAJA)"
  echo "" >> "$LOG_BAJA"
  echo "════ $d · $(date) ════" >> "$LOG_BAJA"
  timeout "$TOPE_BAJADOR" node scripts/curso-bajar.mjs --plan "$PLAN" >> "$LOG_BAJA" 2>&1 &
  PID_BAJADOR=$!

  node scripts/curso-pipeline.mjs --plan "$PLAN" --drive --tope-horas 12 >> "$LOG" 2>&1
  di "  -- pipeline (1a pasada) salió con $? · $(date +%H:%M:%S) · $(libres) GB libres --"

  wait "$PID_BAJADOR"
  COD=$?
  [ "$COD" = "124" ] && di "  ⏰ el bajador pasó el tope de $TOPE_BAJADOR y lo corté — sigo con lo bajado."
  di "  -- bajador salió con $COD · $(date +%H:%M:%S) · $(libres) GB libres --"

  # ⚠️ SEGUNDA PASADA, y no es opcional. Si el pipeline terminó antes que el bajador,
  #    publicó con lo que había hasta ese momento. Esta pasada recoge las clases que
  #    llegaron al final y republica completo. Es barata: si no hay nada nuevo dice
  #    «nada nuevo para transcribir» y solo vuelve a emitir la ficha.
  node scripts/curso-pipeline.mjs --plan "$PLAN" --drive --tope-horas 12 >> "$LOG" 2>&1
  di "  -- pipeline (2a pasada) salió con $? · $(date +%H:%M:%S) · $(libres) GB libres --"

  # Liberar apenas se publica: si no, el curso siguiente arranca contra un disco lleno.
  # El script decide solo (solo borra bajo --min-libre-gb y con las cinco condiciones).
  node scripts/curso-a-drive.mjs --plan "$PLAN" --liberar >> "$LOG" 2>&1
  di "  -- liberar salió con $? · $(libres) GB libres --"
done < "$LISTA"

# Se suelta acá y no en un `trap`: en sh un `trap … EXIT` también corre al salir de una
# SUBSHELL, y esta cola lanza el bajador con `&` y usa `$(…)` por todos lados. El lock lo
# habría borrado el primer subproceso que terminara, o sea al minuto de arrancar.
# Si la cola muere de golpe el lock queda, y para eso está el chequeo de `kill -0`.
rm -f "$LOCK"

di ""
di "════════ cola terminada $(date) · $(libres) GB libres ════════"
