#!/usr/bin/env bash
# Prueba varias configuraciones de corte y MIDE EL RESULTADO, no el plan.
# Las dos cosas que hay que mirar juntas:
#   - cuanto silencio QUEDA (con umbral relativo, no fijo)
#   - si el texto sobrevivio (si corto voz, la transcripcion pierde palabras)
set -euo pipefail
SCR="C:/Users/marti/AppData/Local/Temp/claude/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/47b54f41-1d58-4f69-8d09-75c73493b6b9/scratchpad"
T="$1"; ETIQ="$2"; shift 2
ENVF="C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local"
K=$(grep "^GROQ_API_KEY=" "$ENVF" | cut -d= -f2- | tr -d '\r')
O="$SCR/barrido/$ETIQ"; mkdir -p "$O"

node "$(dirname "$0")/plan-cortes-anuncio.mjs" "$T" 7 10.005 "$@" > "$O/plan.json" 2> "$O/plan.log"
TRAMOS=$(python -c "import json;print(len(json.load(open(r'$O/plan.json'))['segs']))")
TOTAL=$(python -c "import json;print(json.load(open(r'$O/plan.json'))['total'])")
node "$(dirname "$0")/gen-filtros-anuncio.mjs" "$O/plan.json" "$O" 7 > /dev/null

IN=(); for i in 1 2 3 4 5 6 7; do IN+=(-i "$T/sts-$i.mp3"); done
ffmpeg -y -v error "${IN[@]}" -/filter_complex "$O/filtro-audio.txt" -map "[a]" -ar 48000 -ac 1 -c:a pcm_s16le "$O/voz.wav"

# silencio remanente, con umbral derivado del nivel real de esta voz
RMS=$(ffmpeg -hide_banner -i "$O/voz.wav" -af astats -f null - 2>&1 | grep -m1 "RMS level dB" | sed 's/.*: //')
U=$(awk -v r="$RMS" 'BEGIN{u=r-13; if(u<-45)u=-45; if(u>-26)u=-26; printf "%.1f", u}')
SIL=$(ffmpeg -hide_banner -i "$O/voz.wav" -af "silencedetect=n=${U}dB:d=0.12" -f null - 2>&1 | grep -o "silence_duration: [0-9.]*" | awk '{s+=$2} END{printf "%.2f", s+0}')
NH=$(ffmpeg -hide_banner -i "$O/voz.wav" -af "silencedetect=n=${U}dB:d=0.12" -f null - 2>&1 | grep -c silence_start || true)

ffmpeg -y -v error -i "$O/voz.wav" -ac 1 -ar 16000 -b:a 48k "$O/v16.mp3"
curl -s https://api.groq.com/openai/v1/audio/transcriptions -H "Authorization: Bearer $K" \
  -F file=@"$O/v16.mp3" -F model=whisper-large-v3 -F language=es -F response_format=text > "$O/texto.txt"
PAL=$(tr ' ' '\n' < "$O/texto.txt" | grep -c . || true)

printf "%-12s | %5s tramos | %6.2f s | silencio %5s s (%2s huecos, umbral %s dB) | %3s palabras\n" \
  "$ETIQ" "$TRAMOS" "$TOTAL" "$SIL" "$NH" "$U" "$PAL"
