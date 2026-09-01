#!/usr/bin/env bash
# Montaje de un anuncio vertical de Mauricio a partir de N tomas de Flow.
# Voz: ElevenLabs speech-to-speech con la voz clonada de Mauricio.
# Musica: Pixabay "Corporate" de leberch (id 509707).
# Subtitulos: Groq whisper-large-v3 sobre la voz FINAL, quemados con libass.
#
# uso: montar2.sh "<prefijo en Downloads>" "<carpeta destino>" "<nombre del mp4>"
set -euo pipefail

PREFIJO="$1"; DEST="$2"; SALIDA="$3"
NTOMAS=7
DURTOMA=10.005
VOZ_ID="dKQBE4K2Lu9KFMvS8sgP"        # Mauricio Bustos (anuncios 22-08)
MUSICA="C:/Users/marti/OneDrive/Escritorio/Mauricio/CUARTO VIDEO DE IA/RECURSOS/AUDIOS/leberch-corporate-509707.mp3"
DL="C:/Users/marti/Downloads"
ENV="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local"
SCR="C:/Users/marti/AppData/Local/Temp/claude/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/47b54f41-1d58-4f69-8d09-75c73493b6b9/scratchpad"

EK=$(grep "^ELEVENLABS_API_KEY=" "$ENV" | cut -d= -f2- | tr -d '\r')
T="$SCR/wk/$(echo "$PREFIJO" | tr -cd '[:alnum:]')"
mkdir -p "$T" "$DEST/RECURSOS/AUDIOS"

TOTAL=$(awk "BEGIN{printf \"%.3f\", $NTOMAS*$DURTOMA}")
echo "### $PREFIJO  ->  $TOTAL s"

echo "-- 1/7 video: concatenar $NTOMAS tomas sin recomprimir"
: > "$T/lista.txt"
for i in $(seq 1 $NTOMAS); do
  cp -n "$DL/$PREFIJO - toma $i.mp4" "$DEST/RECURSOS/$i.mp4" 2>/dev/null || true
  echo "file '$DL/$PREFIJO - toma $i.mp4'" >> "$T/lista.txt"
done
ffmpeg -y -v error -f concat -safe 0 -i "$T/lista.txt" -an -c:v copy "$T/video.mp4"

echo "-- 2/7 voz: speech-to-speech por toma (ElevenLabs)"
: > "$T/lista-voz.txt"
for i in $(seq 1 $NTOMAS); do
  ffmpeg -y -v error -i "$DL/$PREFIJO - toma $i.mp4" -vn -ac 1 -ar 48000 -c:a pcm_s16le "$T/in-$i.wav"
  code=$(curl -s -X POST "https://api.elevenlabs.io/v1/speech-to-speech/$VOZ_ID?output_format=mp3_44100_192" \
    -H "xi-api-key: $EK" -F audio=@"$T/in-$i.wav" \
    -F model_id=eleven_multilingual_sts_v2 \
    -F 'voice_settings={"stability":0.45,"similarity_boost":0.85}' \
    -o "$T/sts-$i.mp3" -w "%{http_code}")
  sz=$(stat -c%s "$T/sts-$i.mp3")
  if [ "$code" != "200" ] || [ "$sz" -lt 20000 ]; then
    echo "   FALLO toma $i: HTTP $code, $sz bytes"; head -c 300 "$T/sts-$i.mp3"; exit 1
  fi
  # anclar a la ventana exacta de su clip (la cola del mp3 es padding del encoder)
  ffmpeg -y -v error -i "$T/sts-$i.mp3" -af apad -t $DURTOMA -ac 1 -ar 48000 -c:a pcm_s16le "$T/voz-$i.wav"
  cp "$T/sts-$i.mp3" "$DEST/RECURSOS/AUDIOS/voz-toma-$i.mp3"
  printf "   toma %s ok (%s KB)\n" "$i" "$((sz/1024))"
  echo "file '$T/voz-$i.wav'" >> "$T/lista-voz.txt"
done
ffmpeg -y -v error -f concat -safe 0 -i "$T/lista-voz.txt" -c:a pcm_s16le "$T/voz-cruda.wav"

echo "-- 3/7 voz: cadena tonal + limitador (level=disabled, si no no limita nada)"
ffmpeg -y -v error -i "$T/voz-cruda.wav" -af "highpass=f=80:poles=2,deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-18dB:ratio=3:attack=5:release=180:makeup=2,alimiter=limit=0.7:level=disabled" -ar 48000 -ac 1 -c:a pcm_s16le "$T/voz-proc.wav"

echo "-- 4/7 musica: medir y calcular la ganancia exacta para -33 LUFS"
MI=$(ffmpeg -hide_banner -t $TOTAL -i "$MUSICA" -af "loudnorm=print_format=json" -f null - 2>&1 | python -c "import sys,json,re; t=sys.stdin.read(); print(json.loads(t[t.rindex('{'):t.rindex('}')+1])['input_i'])")
GAN=$(awk "BEGIN{printf \"%.2f\", -33 - ($MI)}")
FOUT=$(awk "BEGIN{printf \"%.2f\", $TOTAL-2.5}")
echo "   musica $MI LUFS -> ganancia $GAN dB"
ffmpeg -y -v error -t $TOTAL -i "$MUSICA" -af "volume=${GAN}dB,afade=t=in:st=0:d=0.8,afade=t=out:st=$FOUT:d=2.5" -ar 48000 -ac 2 -c:a pcm_s16le "$T/musica.wav"

echo "-- 5/7 mezcla + loudnorm de dos pasadas sobre LA MEZCLA"
ffmpeg -y -v error -i "$T/voz-proc.wav" -i "$T/musica.wav" -filter_complex "[0:a]aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0:duration=longest[m]" -map "[m]" -ar 48000 -c:a pcm_s16le "$T/mezcla.wav"
J=$(ffmpeg -hide_banner -i "$T/mezcla.wav" -af "loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | python -c "import sys,json; t=sys.stdin.read(); d=json.loads(t[t.rindex('{'):t.rindex('}')+1]); print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'])")
set -- $J
echo "   pasada 1: I=$1 TP=$2 LRA=$3 | PLR=$(awk "BEGIN{printf \"%.2f\", $2-($1)}") dB (techo 13)"
ffmpeg -y -hide_banner -i "$T/mezcla.wav" -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$1:measured_TP=$2:measured_LRA=$3:measured_thresh=$4:linear=true:print_format=json,alimiter=limit=0.891:level=disabled" -ar 48000 -ac 2 -c:a pcm_s16le "$T/audio.wav" 2>&1 | grep -o '"normalization_type" : "[a-z]*"' | sed 's/^/   pasada 2: /'

echo "-- 6/7 subtitulos: Groq sobre la voz final (no sobre la mezcla)"
ffmpeg -y -v error -i "$T/voz-proc.wav" -ac 1 -ar 16000 -b:a 64k "$T/voz16k.mp3"
node "$(dirname "$0")/subs-anuncio.mjs" "$T/voz16k.mp3" "$T/subs.ass" | sed 's/^/   /'

echo "-- 7/7 render"
cd "$T"
ffmpeg -y -v error -i video.mp4 -i audio.wav -vf "ass=subs.ass:original_size=720x1280" \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.0 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "$T/final.mp4"
cp "$T/final.mp4" "$DEST/$SALIDA"
cp "$T/subs.ass" "$DEST/RECURSOS/subtitulos.ass"
cp "$T/audio.wav" "$DEST/RECURSOS/AUDIOS/audio-final-mezcla.wav"

echo "-- verificacion final"
ffmpeg -hide_banner -i "$DEST/$SALIDA" -af "loudnorm=print_format=json" -f null - 2>&1 | grep -E '"input_(i|tp)"' | sed 's/^/   /'
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$DEST/$SALIDA" | sed 's/^/   /'
echo "   -> $DEST/$SALIDA"
