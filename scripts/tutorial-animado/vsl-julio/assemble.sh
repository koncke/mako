#!/usr/bin/env bash
# Ensamble final del VSL de Funnel (v2)
set -e
SP="C:/Users/marti/AppData/Local/Temp/claude/C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main/4d6acb52-f0ee-45ad-ae76-8d22f1d69d8c/scratchpad"
FF="$SP/tools/ff/ffmpeg-8.1.2-essentials_build/bin"
OUTDIR="C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/funnel/video"
MUS="C:/Users/marti/Downloads/_Viral_High_Energy_Phonk_Trap_Music_for_Content_.mp3"
VOZ="C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/funnel/audio/mako-funnel-vsl-FINAL.mp3"

MAU_IN=62.859      # entra el video de Mauricio (tiempo de video)
MAU_OUT=72.719

# ── 1. visual: intro + narración, con Mauricio (borde + esquinas redondeadas) ──
"$FF/ffmpeg" -v error -y \
  -i "$SP/anim/vid/intro.mp4" \
  -framerate 24 -i "$SP/anim/frames_v4/f%04d.png" \
  -i "$SP/anim/vid/mau-borde.mov" \
  -filter_complex "\
[0:v]setsar=1,format=yuv420p[a];\
[1:v]setsar=1,format=yuv420p[b];\
[a][b]concat=n=2:v=1:a=0[base];\
[2:v]setpts=PTS-STARTPTS+${MAU_IN}/TB[mau];\
[base][mau]overlay=1361:184:enable='between(t,${MAU_IN},${MAU_OUT})'[v]" \
  -map "[v]" -an -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -r 24 \
  "$SP/anim/vid/full-visual-v3.mp4"
echo "visual OK"

# ── 2. audio: voz + música domada (techo real) + efectos ──
# La música del INTRO queda intacta (punch), y a partir de que entra el locutor
# pasa por: corte de graves (85Hz -5dB) + hueco para la voz (2.6kHz -3dB)
# + compresor (nivela el estribillo) + limitador = techo duro.
"$FF/ffmpeg" -v error -y \
  -i "$SP/anim/vid/full-visual-v3.mp4" \
  -i "$VOZ" \
  -i "$MUS" \
  -i "$SP/vsl-research/audio/sfxbed2.mp3" \
  -i "$SP/vsl-research/audio/sfxbed3.mp3" \
  -filter_complex "\
[1:a]adelay=5600:all=1,asplit=2[voice][vkey];\
[2:a]asplit=2[m1][m2];\
[m1]atrim=0:5.9,asetpts=PTS-STARTPTS,volume=0.9[mi];\
[m2]atrim=5.4:101.6,asetpts=PTS-STARTPTS,\
equalizer=f=85:width_type=q:w=0.9:g=-5,\
equalizer=f=2600:width_type=q:w=1.2:g=-3,\
acompressor=threshold=0.05:ratio=8:attack=5:release=250:makeup=1.8,\
volume=0.97,alimiter=limit=0.30:level=disabled[mc];\
[mc][vkey]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=300:level_sc=1.2[mr];\
[mi][mr]acrossfade=d=0.5[mus];\
[3:a]volume=1.0[sfx];\
[4:a]volume=1.0[sfx2];\
[voice][mus][sfx][sfx2]amix=inputs=4:normalize=0:duration=longest,alimiter=limit=0.89[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest \
  "$OUTDIR/MaKo-funnel-VSL-COMPLETO.mp4"
echo "final OK"
"$FF/ffprobe" -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height -of default=nw=1 "$OUTDIR/MaKo-funnel-VSL-COMPLETO.mp4"
