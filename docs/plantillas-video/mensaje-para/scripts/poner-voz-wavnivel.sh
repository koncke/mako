#!/usr/bin/env bash
# La voz EXACTA de CLIP-wavnivel.mp4 (9/11 05:42Z, sts2voces.mjs), la que Martín aprobó: «salió muy bien».
#   bash poner-voz-wavnivel.sh <clip de Omni.mp4> <salida.mp4>
# origen = el audio del propio clip de Omni, a mp3 192k SIN filtros · speech-to-speech con el clon NORMAL
# «Martin Koncke (wav nivelado)» 1crLVxcTqcz5I2mDmBlO · eleven_multilingual_sts_v2 · stability 0 · similarity 1 ·
# style 1 · speaker_boost false · mp3_44100_192 · después loudnorm -14 · montaje con -c:v copy.
# ⚠️ El 9/11 a la tarde se usó el clon PROFESIONAL (LA-CONFIG.json) y Martín: «No es mi voz». Gana éste.
set -euo pipefail
CLIP="$1"; SAL="$2"; T="$(mktemp -d)"
ffmpeg -v error -y -i "$CLIP" -vn -c:a libmp3lame -b:a 192k "$T/origen.mp3"
node - "$T" <<'EOF'
const { readFileSync, writeFileSync } = require('node:fs');
const T = process.argv[2];
const env = readFileSync('C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local', 'utf8');
const KEY = (env.match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1].trim().replace(/^["']|["']$/g, '');
(async () => {
  const fd = new FormData();
  fd.append('audio', new Blob([readFileSync(`${T}/origen.mp3`)], { type: 'audio/mpeg' }), 'origen.mp3');
  fd.append('model_id', 'eleven_multilingual_sts_v2');
  fd.append('voice_settings', JSON.stringify({ stability: 0, similarity_boost: 1, style: 1, use_speaker_boost: false }));
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-speech/1crLVxcTqcz5I2mDmBlO?output_format=mp3_44100_192', { method: 'POST', headers: { 'xi-api-key': KEY }, body: fd });
  if (!r.ok) { console.log('FALLO', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length < 60000) { console.log('⚠️ voz CORTA', b.length, 'bytes — no se usa'); process.exit(1); }
  writeFileSync(`${T}/voz.mp3`, b);
  console.log('voz', b.length, 'bytes');
})();
EOF
ffmpeg -v error -y -i "$T/voz.mp3" -af "loudnorm=I=-14:TP=-1:LRA=11" -c:a libmp3lame -b:a 192k "$T/voz-nv.mp3"
ffmpeg -v error -y -i "$CLIP" -i "$T/voz-nv.mp3" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k "$SAL"
echo "clip $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$CLIP")s · final $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SAL")s → $SAL"
rm -rf "$T"
