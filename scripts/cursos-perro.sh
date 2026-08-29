#!/bin/sh
# EL PERRO DE LA COLA: mira cada 15 minutos que la cola siga viva, y si murió la levanta.
#
#   Instalar (una sola vez):  scripts/cursos-perro-instalar.cmd
#   Ver qué hizo:             tail -30 C:/cursos/perro.log
#   Apagarlo:                 schtasks /end /tn "cursos-perro"  &&  schtasks /delete /tn "cursos-perro" /f
#
# ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ POR QUÉ EXISTE, Y POR QUÉ NO ALCANZABA CON LA TAREA PROGRAMADA
#
# La cola ya corre como tarea programada, que la hace sobrevivir al cierre de la sesión de
# Claude. Pero eso la protege de UNA sola causa de muerte. El 28/08/2026 se murió igual —
# el bajador salió con 0, el pipeline arrancó y no escribió nunca su línea de salida— y
# nadie se enteró durante **7 horas y media**. Antes había pasado lo mismo con otra causa.
#
# El patrón: cada vez que se murió fue por un motivo distinto, y las tres veces el costo no
# fue la muerte sino el TIEMPO HASTA QUE ALGUIEN MIRÓ. Arreglar causas de a una no cierra
# eso; lo que lo cierra es que algo mire solo.
#
# ⚠️ LA SEÑAL DE VIDA ES EL LOG, no los procesos. Ya se falló al revés dos veces: el panel
#    de estado contaba `yt-dlp` y dio «0 procesos» sobre una cola sana que estaba justo
#    entre dos clases. El log, en cambio, se escribe en TODAS las fases —bajando,
#    transcribiendo, subiendo, dando rondas—. 20 minutos de silencio son mucho más que
#    cualquier hueco normal (las rondas del pipeline escriben cada ~2 min).
#
# ⚠️ Y NO REVIVE LO QUE TERMINÓ BIEN. Si el log cierra con «cola terminada» no hay nada que
#    hacer; y si cerró con «⛔ PARO» es por DISCO, y levantarla otra vez sólo repetiría el
#    mismo paro cada 15 minutos. En los dos casos se anota y se sale.
# ─────────────────────────────────────────────────────────────────────────────────────

REPO="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing"
LOG="C:/cursos/cola.log"
LOG_BAJA="C:/cursos/bajador.log"   # el otro escritor; ver por qué, abajo en MIN
MIO="C:/cursos/perro.log"
SILENCIO=20          # minutos sin escribir = sospechosa (si además no hay procesos, muerta)
COLGADA=45           # minutos sin escribir = colgada, aunque haya procesos vivos

cd "$REPO" || exit 1
di() { echo "$(date '+%Y-%m-%d %H:%M') $1" >> "$MIO"; }

[ -f "$LOG" ] || { di "no hay cola.log todavia — no hago nada"; exit 0; }

# ─────────────────────────────────────────────────────────────────────────────────────
# ⚠️ EL DISCO, QUE ES LO QUE NADIE MIRABA.
#
# El 29/08/2026 llego a 815 MB de 455 GB y nos enteramos porque Martin no podia trabajar.
# Este perro miraba si la cola escribia, y la cola escribia perfecto: bajaba, transcribia
# y publicaba mientras el disco se terminaba. Una cola sana llenando el disco se ve
# exactamente igual que una cola sana.
#
# Por eso el aviso va ACA y no en la cola: el que vigila tiene que mirar tambien lo que el
# vigilado consume, no solo si respira.
#
# Avisa, NO borra: el barrido (`cursos-liberar.sh`) es el que libera, y corre solo. Si el
# disco sigue bajando con el barrido puesto, es que hay algo que el barrido no puede tocar
# —cursos sin publicar, o algo fuera de C:/cursos— y eso lo tiene que ver una persona.
# ─────────────────────────────────────────────────────────────────────────────────────
GB=$(df -k /c | tail -1 | awk '{printf "%d", $4/1048576}')
AVISO_GB=30
if [ "${GB:-999}" -lt "$AVISO_GB" ]; then
  di "⚠️ DISCO BAJO: quedan ${GB} GB (aviso bajo ${AVISO_GB})."
  di "   El barrido corre cada 6 h. A mano: sh scripts/cursos-liberar.sh"
  di "   Que hay para liberar: node scripts/curso-liberables.mjs --ver"
fi

# ⚠️ LA VIDA SE MIDE POR EL MÁS RECIENTE DE LOS **DOS** LOGS, y esto no es un detalle:
#    desde el 29/08/2026 el bajador escribe en su propio archivo (dos escritores sobre el
#    mismo se comían el 10% de las líneas). Mirando solo `cola.log`, una descarga larga
#    —que puede tardar una hora sin que la cola escriba una sola línea— se vería como una
#    cola muerta, y este perro MATARÍA una cola perfectamente sana cada 45 minutos.
#    Separar los logs arregló un problema y creaba otro peor en el vigilante.
MIN=$(python -c "
import os,time
archivos = [r'$LOG', r'$LOG_BAJA']
ultimo = max((os.path.getmtime(f) for f in archivos if os.path.exists(f)), default=0)
print(int((time.time()-ultimo)/60))
" 2>/dev/null | tr -d '\r')
[ -z "$MIN" ] && { di "no pude leer la fecha de los logs"; exit 0; }

if [ "$MIN" -lt "$SILENCIO" ]; then
  exit 0                      # viva: ni una línea, para que el log del perro sea legible
fi

# Silenciosa. ¿Termino bien, o la cortaron?
COLA=$(grep -aE "cola terminada|⛔ PARO" "$LOG" | tail -1)
case "$COLA" in
  *"⛔ PARO"*)
    di "silencio de ${MIN}min, pero la cola PARO por disco. No la levanto: hay que liberar."
    di "   node scripts/curso-a-drive.mjs --plan C:/cursos/<slug>/plan.json --liberar"
    exit 0 ;;
esac

ULTIMA=$(tail -1 "$LOG")
case "$ULTIMA" in
  *"cola terminada"*)
    exit 0 ;;                 # termino sola y no hay nada pendiente
esac

# ⚠️ SOLO los `node.exe` del pipeline. Sin el filtro por nombre, la consulta se cuenta A
#    SÍ MISMA: la línea de comandos del shell que la ejecuta contiene el patrón que busca,
#    así que el perro veía «1 proceso vivo» sobre una cola muerta hacía 7 horas y le daba
#    más tiempo, para siempre. Pasó en la primera corrida, con el perro recién instalado.
VIVOS=$(powershell -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'curso-bajar|curso-pipeline|curso-a-drive' }).Count" 2>/dev/null | tr -d '\r')
# ⚠️ UN PROCESO VIVO NO ES PROGRESO. Se le da UNA gracia —puede estar subiendo a Drive o
#    esperando a un proveedor— pero no infinita: pasados los $COLGADA minutos sin escribir
#    una sola línea, está colgado y se lo mata. Es la misma trampa que el 410 del CDN, que
#    tuvo a yt-dlp «trabajando» SIETE HORAS sobre fragmentos muertos.
if [ "${VIVOS:-0}" -gt 0 ] && [ "$MIN" -lt "$COLGADA" ]; then
  di "silencio de ${MIN}min con ${VIVOS} proceso(s) vivo(s) — le doy hasta los ${COLGADA}min."
  exit 0
fi

if [ "${VIVOS:-0}" -gt 0 ]; then
  di "COLGADA: ${MIN}min sin escribir con ${VIVOS} proceso(s) vivo(s). Los mato."
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' OR Name='yt-dlp.exe' OR Name='ffmpeg.exe'\" | Where-Object { \$_.CommandLine -match 'curso-bajar|curso-pipeline|curso-a-drive|cursos' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
fi

di "LA LEVANTO: ${MIN}min sin escribir."
di "   ultima linea: $(echo "$ULTIMA" | cut -c1-90)"

# ⚠️ `schtasks /end` MATA EL PROCESO QUE LA TAREA REGISTRÓ Y DEJA VIVOS A SUS NIETOS.
#    Git Bash re-ejecuta el script en un hijo, así que cada resurrección dejaba una cola
#    HUÉRFANA corriendo. Medido el 28/08/2026: dos árboles vivos a la vez y dos
#    `curso-pipeline` sobre la misma carpeta de curso.
#
#    Lo caro no es el trabajo duplicado: es que con dos colas escribiendo el mismo log,
#    la señal de vida de este perro deja de significar nada. Una cola colgada parece viva
#    para siempre porque la otra escribe. **El vigilante se vuelve decorativo y nadie se
#    entera** — que es exactamente el bug que ya tuvo este script en su primera corrida,
#    cuando se contaba a sí mismo como proceso vivo.
#
#    `taskkill /T` mata el árbol. Se filtra por NOMBRE de binario además de por línea de
#    comandos, por la misma razón de siempre: sin eso, la propia consulta entra en la
#    lista de lo que hay que matar.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='bash.exe' OR Name='sh.exe'\" | Where-Object { \$_.CommandLine -match 'cursos-cola' } | ForEach-Object { taskkill /PID \$_.ProcessId /T /F }" >/dev/null 2>&1
schtasks //end //tn "cursos-cola" >/dev/null 2>&1

# El lock lo suelta la cola al terminar bien; si la matamos recién, queda huérfano. No se
# borra a ciegas —eso sería anular la guarda—: se borra SOLO si su pid ya no existe.
LOCK="C:/cursos/_cola.lock"
if [ -f "$LOCK" ]; then
  P=$(tr -d "\r" < "$LOCK")
  if [ -n "$P" ] && kill -0 "$P" 2>/dev/null; then
    di "   OJO: el lock (pid $P) sigue vivo despues de matar. No lo toco."
  else
    rm -f "$LOCK"
    di "   lock huerfano (pid $P) liberado."
  fi
fi

schtasks //run //tn "cursos-cola" >/dev/null 2>&1
di "   lanzada. Lo bajado no se repite (--download-archive)."
