#!/usr/bin/env bash
# Montaje v2: igual que montar-anuncio-vertical.sh pero SIN aire muerto.
# Se queda solo con los tramos donde hay voz y corta todo lo demas (cabeza, cola y
# huecos internos). Es un anuncio: el silencio mata la retencion.
#
# uso: montar3.sh "<prefijo>" "<carpeta destino>" "<nombre mp4>" "<workdir con sts-N.mp3>"
set -euo pipefail

PREFIJO="$1"; DEST="$2"; SALIDA="$3"; T="$4"
NTOMAS=7; DURVID=10.005
MUSICA="C:/Users/marti/OneDrive/Escritorio/Mauricio/CUARTO VIDEO DE IA/RECURSOS/AUDIOS/leberch-corporate-509707.mp3"
DL="C:/Users/marti/Downloads"
SCR="C:/Users/marti/AppData/Local/Temp/claude/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/47b54f41-1d58-4f69-8d09-75c73493b6b9/scratchpad"
mkdir -p "$DEST/RECURSOS/AUDIOS"

echo "== 1/6 plan de cortes =="
node "$(dirname "$0")/plan-cortes-anuncio.mjs" "$T" $NTOMAS $DURVID ${CORTE:-0.05 0.14 0.25 0.10 13} > "$T/plan.json"
TOTAL=$(python -c "import json;print(json.load(open(r'$T/plan.json'))['total'])")
node "$(dirname "$0")/gen-filtros-anuncio.mjs" "$T/plan.json" "$T" $NTOMAS

echo "== 2/6 voz: cortar los tramos y pegarlos =="
IN_A=(); for i in $(seq 1 $NTOMAS); do IN_A+=(-i "$T/sts-$i.mp3"); done
ffmpeg -y -v error "${IN_A[@]}" -/filter_complex "$T/filtro-audio.txt" -map "[a]" -ar 48000 -ac 1 -c:a pcm_s16le "$T/voz-cruda.wav"
echo "   voz cortada: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$T/voz-cruda.wav") s (plan: $TOTAL)"

echo "== 3/6 voz: cadena tonal + limitador (level=disabled) =="
ffmpeg -y -v error -i "$T/voz-cruda.wav" -af "highpass=f=80:poles=2,deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-18dB:ratio=3:attack=5:release=180:makeup=2,alimiter=limit=0.7:level=disabled" -ar 48000 -ac 1 -c:a pcm_s16le "$T/voz-proc.wav"

echo "== 4/6 musica + mezcla + loudnorm sobre la MEZCLA =="
MI=$(ffmpeg -hide_banner -t $TOTAL -i "$MUSICA" -af "loudnorm=print_format=json" -f null - 2>&1 | python -c "import sys,json;t=sys.stdin.read();print(json.loads(t[t.rindex('{'):t.rindex('}')+1])['input_i'])")
GAN=$(awk "BEGIN{printf \"%.2f\", -33 - ($MI)}")
FOUT=$(awk "BEGIN{printf \"%.2f\", $TOTAL-2.5}")
ffmpeg -y -v error -t $TOTAL -i "$MUSICA" -af "volume=${GAN}dB,afade=t=in:st=0:d=0.8,afade=t=out:st=$FOUT:d=2.5" -ar 48000 -ac 2 -c:a pcm_s16le "$T/musica.wav"
ffmpeg -y -v error -i "$T/voz-proc.wav" -i "$T/musica.wav" -filter_complex "[0:a]aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0:duration=longest[m]" -map "[m]" -ar 48000 -c:a pcm_s16le "$T/mezcla.wav"
J=$(ffmpeg -hide_banner -i "$T/mezcla.wav" -af "loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | python -c "import sys,json;t=sys.stdin.read();d=json.loads(t[t.rindex('{'):t.rindex('}')+1]);print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'])")
set -- $J
echo "   PLR $(awk "BEGIN{printf \"%.2f\", $2-($1)}") dB (techo 13)"
ffmpeg -y -hide_banner -i "$T/mezcla.wav" -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$1:measured_TP=$2:measured_LRA=$3:measured_thresh=$4:linear=true:print_format=json,alimiter=limit=0.891:level=disabled" -ar 48000 -ac 2 -c:a pcm_s16le "$T/audio.wav" 2>&1 | grep -o '"normalization_type" : "[a-z]*"' | sed 's/^/   /'

echo "== 5/6 subtitulos sobre la voz final =="
ffmpeg -y -v error -i "$T/voz-proc.wav" -ac 1 -ar 16000 -b:a 64k "$T/voz16k.mp3"
node "$(dirname "$0")/subs-anuncio.mjs" "$T/voz16k.mp3" "$T/subs.ass" | sed 's/^/   /'

echo "== 6/6 render: trims de video + concat + subtitulos, en UNA pasada =="
cd "$T"
IN_V=(); for i in $(seq 1 $NTOMAS); do IN_V+=(-i "$DL/$PREFIJO - toma $i.mp4"); done
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
