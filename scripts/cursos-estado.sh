#!/bin/sh
# ¿La cola de cursos está viva y avanzando? Una foto rápida.
#
#   sh scripts/cursos-estado.sh
#
# Existe porque la cola corre como TAREA PROGRAMADA de Windows (para que sobreviva al
# cierre de la sesión de Claude), y eso la vuelve INVISIBLE: no hay ventana ni terminal que
# mirar. La primera vez que quedó corriendo, la pregunta obvia fue «¿realmente está
# haciendo algo?» y no había forma de contestarla sin hurgar en el Administrador de tareas.
#
# ⚠️ DOS TRAMPAS QUE YA HICIERON DAR UN DIAGNÓSTICO FALSO:
#
#  1. `du -sk C:/cursos` tarda MINUTOS (el árbol es enorme) y cuelga el script. Acá se
#     miran solo los video/ de los tres cursos, un nivel, con scandir.
#
#  2. Medir bytes en una ventana corta MIENTE. Las descargas van a ráfagas: yt-dlp baja
#     el stream de video, para, arranca el de audio, une. Una ventana de 40s que cae en
#     ese hueco reporta «3 KB/s, prácticamente frenado» sobre una descarga que estaba
#     perfecta. La señal de vida buena es el MTIME del archivo más reciente: si algo se
#     tocó hace menos de dos minutos, está trabajando. Los bytes van como dato de color,
#     nunca como veredicto.

CURSOS="monetizatube automatizatube automatizacion-y-monetizacion-de-youtobe"

echo ""
echo "  ── la tarea ──────────────────────────────────────────────────────"
EST=$(schtasks //query //tn "cursos-cola" //fo list 2>/dev/null | grep -i "^status" | sed 's/.*: *//' | tr -d '\r')
echo "     tarea programada: ${EST:-(no registrada)}"
VIVOS=$(powershell -NoProfile -Command "@(Get-Process yt-dlp,ffmpeg -ErrorAction SilentlyContinue).Count" 2>/dev/null | tr -d '\r')
echo "     bajando/convirtiendo ahora: ${VIVOS:-0} proceso(s)"

echo ""
echo "  ── los cursos ────────────────────────────────────────────────────"
python -c "
import os,glob,json,io,time
tot=baj=txt=0
for d in '''$CURSOS'''.split():
    b='C:/cursos/'+d
    try: n=len(json.load(io.open(b+'/plan.json',encoding='utf-8'))['clases'])
    except Exception: n=0
    try: k=len([l for l in io.open(b+'/bajados.txt',encoding='utf-8') if l.strip()])
    except Exception: k=0
    t=len(glob.glob(b+'/texto/*'))
    tot+=n; baj+=k; txt+=t
    barra='#'*int(20.0*k/n) if n else ''
    print('     %-42s %3d/%-3d bajadas %3d txt  %s' % (d[:42],k,n,t,barra))
print('     %-42s %3d/%-3d          %3d' % ('TOTAL',baj,tot,txt))
print('')
print('  -- que esta tocando ahora --------------------------------------')
recientes=[]
for d in '''$CURSOS'''.split():
    for sub in ('video','audio','texto'):
        p='C:/cursos/'+d+'/'+sub
        try: recientes += [(e.stat().st_mtime, e.stat().st_size, sub, e.name) for e in os.scandir(p)]
        except OSError: pass
recientes.sort(reverse=True)
ahora=time.time()
for m,s,sub,name in recientes[:3]:
    print('     %8.1f MB  hace %5.0fs  [%s] %s' % (s/2**20, ahora-m, sub, name[:44]))
if recientes:
    edad=ahora-recientes[0][0]
    print('')
    if edad < 120:
        print('     OK SI, esta trabajando: algo se toco hace %.0f segundos.' % edad)
    else:
        print('     ATENCION: nada se toca hace %.0f minutos.' % (edad/60))
        print('        Si ademas no hay proceso vivo arriba, la cola murio. Retoma sola:')
        print('          schtasks /run /tn \"cursos-cola\"')
" 2>/dev/null

echo ""
echo "  ── últimas líneas del log ────────────────────────────────────────"
grep -aE "^  ── |^  ✖|^  ⛔|^════|^  --" C:/cursos/cola.log 2>/dev/null | tail -5 | sed 's/^/   /'
echo ""
echo "     disco: $(df -h /c | tail -1 | awk '{print $4}') libres"
echo "     log:   C:/cursos/cola.log"
echo ""
