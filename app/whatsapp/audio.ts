'use client';

// =============================================================================
// Transcodificación de audio en el cliente → MP3 (audio/mpeg).
// En el WhatsApp oficial (Chatwoot/WABA, borrado el 09/10/2026) el ÚNICO formato de audio que Meta ENTREGABA era audio/mpeg
// (verificado en producción: ogg/opus y m4a dan 131053 "Media upload error", el
// MP3 se entrega). Decodificamos el webm/opus de MediaRecorder con Web Audio y
// re-encodeamos con lamejs (JS puro, sin WASM). Import perezoso (solo al enviar).
// =============================================================================

import { Mp3Encoder } from '@breezystack/lamejs';

export async function blobToMp3(blob: Blob): Promise<Blob> {
  const arrayBuf = await blob.arrayBuffer();
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  let audioBuf: AudioBuffer;
  try {
    audioBuf = await ctx.decodeAudioData(arrayBuf);
  } catch (e) {
    await ctx.close().catch(() => {});
    throw e;
  }
  await ctx.close().catch(() => {}); // cerrar SIEMPRE (no acumular AudioContexts)

  if (!audioBuf.length) throw new Error('audio vacío');

  // MP3 sólo soporta ciertas tasas; si el navegador dio una exótica, resampleamos
  // a 44100 (un header con tasa inválida puede dar 131053 en Meta).
  const TASAS_MP3 = new Set([8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000]);
  if (!TASAS_MP3.has(audioBuf.sampleRate)) {
    const off = new OfflineAudioContext(1, Math.ceil(audioBuf.duration * 44100), 44100);
    const src = off.createBufferSource();
    src.buffer = audioBuf;
    src.connect(off.destination);
    src.start();
    audioBuf = await off.startRendering();
  }

  const sampleRate = audioBuf.sampleRate;
  const ch0 = audioBuf.getChannelData(0);
  const ch1 = audioBuf.numberOfChannels > 1 ? audioBuf.getChannelData(1) : null;
  const len = ch0.length;

  // Float32 [-1,1] → Int16 PCM (mono; si es estéreo, promediamos canales).
  const pcm = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    let s = ch1 ? (ch0[i] + ch1[i]) / 2 : ch0[i];
    s = Math.max(-1, Math.min(1, s));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const enc = new Mp3Encoder(1, sampleRate, 96);
  const out: Uint8Array[] = [];
  const BLOCK = 1152;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const buf = enc.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (buf.length) out.push(buf);
  }
  const end = enc.flush();
  if (end.length) out.push(end);

  const mp3 = new Blob(out as BlobPart[], { type: 'audio/mpeg' });
  if (!mp3.size) throw new Error('mp3 vacío');
  return mp3;
}
