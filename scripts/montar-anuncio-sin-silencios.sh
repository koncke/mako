#!/usr/bin/env bash
# Montaje v2: igual que montar-anuncio-vertical.sh pero SIN aire muerto.
# Se queda solo con los tramos donde hay voz y corta todo lo demas (cabeza, cola y
# huecos internos). Es un anuncio: el silencio mata la retencion.
#
# uso: montar3.sh "<prefijo>" "<carpeta destino>" "<nombre mp4>" "<workdir con sts-N.mp3>"
set -euo pipefail

PREFIJO="$1"; DEST="$2"; SALIDA="$3"; T="$4"

# ─────────────────────────────────────────────────────────────────────────────
# TODO LO QUE ERA DE LA MAQUINA DE MARTIN, AHORA ENTRA POR ENTORNO
#
# Este script produjo los videos entregados con cinco rutas absolutas adentro y
# tres llamadas a `python`. Eso anda en su PC y NO anda en el contenedor del
# worker, que lleva node y ffmpeg y nada mas.
#
# Los defaults son los valores con los que se midio el resultado conocido
# (70,04 s -> 38,65 s, -14,0 LUFS, cero huecos): un worker que no configure nada
# reproduce esa corrida.
# ─────────────────────────────────────────────────────────────────────────────

# Cuantas tomas y cuanto dura cada clip de Flow. NO se autodetectan todavia.
NTOMAS="${NTOMAS:-7}"
DURVID="${DURVID:-10.005}"

# De donde salen los clips. Se esperan como "$CLIPS/$PREFIJO - toma N.mp4".
CLIPS="${CLIPS:-$HOME/Downloads}"

# ⚠️ LA MUSICA ES OPCIONAL, Y ESE ES EL PUNTO.
#
# La pista que se uso para los entregables es de Pixabay, cuya licencia enumera
# «use, copy, modify» y NO concede `distribute` ni `sub-license`: sirve para
# darle el archivo a un cliente y no sirve para un SaaS que se lo entrega a los
# suyos. El camino elegido es Epidemic Sound Connect, que es un tramite
# comercial y no una linea de codigo.
#
# Mientras tanto el pipeline entrega voz + subtitulos y NO se traba: sin
# `MUSICA`, el paso 4 mezcla nada y hace loudnorm sobre la voz sola. Un pipeline
# que se cae porque falta la musica bloquea todo lo demas por una decision que
# esta afuera.
MUSICA="${MUSICA:-}"

# La fuente de los subtitulos. Ver `worker/fuentes/` — en Linux no existe
# ninguna Segoe y libass NO falla: cae a otra y sigue.
export SUBS_FUENTE="${SUBS_FUENTE:-Anton}"
export SUBS_FONTSDIR="${SUBS_FONTSDIR:-$(cd "$(dirname "$0")/../worker/fuentes" 2>/dev/null && pwd)}"

mkdir -p "$DEST/RECURSOS/AUDIOS"

if [ ! -d "$CLIPS" ]; then
  echo "ERROR: no existe la carpeta de clips: $CLIPS" >&2
  echo "       se esperan archivos '<prefijo> - toma N.mp4'. Pasala en CLIPS=." >&2
  exit 1
fi

echo "== 1/6 plan de cortes =="
CLAMP=${CLAMP:-0.45} node "$(dirname "$0")/plan-cortes-anuncio.mjs" "$T" $NTOMAS $DURVID > "$T/plan.json"
TOTAL=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).total))" "$T/plan.json")
node "$(dirname "$0")/gen-filtros-anuncio.mjs" "$T/plan.json" "$T" $NTOMAS

echo "== 2/6 voz: cortar los tramos y pegarlos =="
IN_A=(); for i in $(seq 1 $NTOMAS); do IN_A+=(-i "$T/sts-$i.mp3"); done
ffmpeg -y -v error "${IN_A[@]}" -/filter_complex "$T/filtro-audio.txt" -map "[a]" -ar 48000 -ac 1 -c:a pcm_s16le "$T/voz-cruda.wav"
echo "   voz cortada: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$T/voz-cruda.wav") s (plan: $TOTAL)"

echo "== 3/6 voz: cadena tonal + limitador (level=disabled) =="
ffmpeg -y -v error -i "$T/voz-cruda.wav" -af "highpass=f=80:poles=2,deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-18dB:ratio=3:attack=5:release=180:makeup=2,alimiter=limit=0.7:level=disabled" -ar 48000 -ac 1 -c:a pcm_s16le "$T/voz-proc.wav"

if [ -n "$MUSICA" ]; then
  echo "== 4/6 musica + mezcla + loudnorm sobre la MEZCLA =="
  MI=$(ffmpeg -hide_banner -t $TOTAL -i "$MUSICA" -af "loudnorm=print_format=json" -f null - 2>&1 | node "$(dirname "$0")/loudnorm-json.mjs" input_i)
  GAN=$(awk "BEGIN{printf \"%.2f\", -33 - ($MI)}")
  FOUT=$(awk "BEGIN{printf \"%.2f\", $TOTAL-2.5}")
  ffmpeg -y -v error -t $TOTAL -i "$MUSICA" -af "volume=${GAN}dB,afade=t=in:st=0:d=0.8,afade=t=out:st=$FOUT:d=2.5" -ar 48000 -ac 2 -c:a pcm_s16le "$T/musica.wav"
  ffmpeg -y -v error -i "$T/voz-proc.wav" -i "$T/musica.wav" -filter_complex "[0:a]aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0:duration=longest[m]" -map "[m]" -ar 48000 -c:a pcm_s16le "$T/mezcla.wav"
else
  # ⚠️ SIN MUSICA NO SE SALTEA EL PASO: se saltea la MEZCLA.
  #
  # El loudnorm de dos pasadas y el limitador siguen corriendo, sobre la voz
  # sola. Saltear el paso entero dejaria el entregable sin normalizar —o sea a
  # un volumen distinto del de los anuncios con musica— y eso no se ve en
  # ningun log: se escucha recien cuando alguien pone dos anuncios seguidos.
  #
  # Se pasa a estereo igual, porque el render final espera dos canales.
  echo "== 4/6 sin musica: loudnorm sobre la VOZ (Epidemic Connect pendiente) =="
  ffmpeg -y -v error -i "$T/voz-proc.wav" -af "aformat=channel_layouts=stereo" -ar 48000 -ac 2 -c:a pcm_s16le "$T/mezcla.wav"
fi
J=$(ffmpeg -hide_banner -i "$T/mezcla.wav" -af "loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | node "$(dirname "$0")/loudnorm-json.mjs" input_i input_tp input_lra input_thresh)
set -- $J
echo "   PLR $(awk "BEGIN{printf \"%.2f\", $2-($1)}") dB (techo 13)"
ffmpeg -y -hide_banner -i "$T/mezcla.wav" -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$1:measured_TP=$2:measured_LRA=$3:measured_thresh=$4:linear=true:print_format=json,alimiter=limit=0.891:level=disabled" -ar 48000 -ac 2 -c:a pcm_s16le "$T/audio.wav" 2>&1 | grep -o '"normalization_type" : "[a-z]*"' | sed 's/^/   /'

echo "== 5/6 subtitulos sobre la voz final =="
ffmpeg -y -v error -i "$T/voz-proc.wav" -ac 1 -ar 16000 -b:a 64k "$T/voz16k.mp3"
node "$(dirname "$0")/subs-anuncio.mjs" "$T/voz16k.mp3" "$T/subs.ass" | sed 's/^/   /'

echo "== 6/6 render: trims de video + concat + subtitulos, en UNA pasada =="
cd "$T"

# ⚠️ LA FUENTE VIAJA CON EL TRABAJO, no se busca en el sistema.
#
# El filtro dice `fontsdir=fuentes`, relativo a este directorio: se copia aca
# porque un `filter_complex` separa opciones con `:` y una ruta absoluta de
# Windows («C:/...») lo parte al medio.
#
# Y se COMPRUEBA que haya llegado. libass no falla cuando no encuentra la
# fuente: cae a otra y sigue, asi que el unico momento en que esto se puede
# detectar es antes de renderizar. Despues son subtitulos con otra tipografia y
# ningun error en ningun log.
mkdir -p "$T/fuentes"
if [ -n "$SUBS_FONTSDIR" ] && [ -d "$SUBS_FONTSDIR" ]; then
  cp "$SUBS_FONTSDIR"/*.ttf "$T/fuentes/" 2>/dev/null || true
fi
if ! ls "$T/fuentes"/*.ttf >/dev/null 2>&1; then
  echo "ERROR: no hay ninguna .ttf en $T/fuentes (SUBS_FONTSDIR=$SUBS_FONTSDIR)." >&2
  echo "       libass caeria a otra fuente SIN avisar y los subtitulos saldrian mal." >&2
  exit 1
fi
IN_V=(); for i in $(seq 1 $NTOMAS); do IN_V+=(-i "$CLIPS/$PREFIJO - toma $i.mp4"); done
ffmpeg -y -v error "${IN_V[@]}" -i "$T/audio.wav" \
  -/filter_complex "$T/filtro-video.txt" \
  -map "[v]" -map "${NTOMAS}:a" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.0 -r 24 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "$T/final.mp4"
cp "$T/final.mp4" "$DEST/$SALIDA"
cp "$T/subs.ass" "$DEST/RECURSOS/subtitulos.ass"
cp "$T/audio.wav" "$DEST/RECURSOS/AUDIOS/audio-final-mezcla.wav"

echo "== verificacion =="
ffmpeg -hide_banner -i "$DEST/$SALIDA" -af "loudnorm=print_format=json" -f null - 2>&1 | grep -E '"input_(i|tp)"' | sed 's/^/   /'
ffprobe -v error -show_entries format=duration,size -show_entries stream=nb_frames -of default=noprint_wrappers=1 "$DEST/$SALIDA" | sed 's/^/   /'
echo "   -> $DEST/$SALIDA"
