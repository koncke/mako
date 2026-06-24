'use client';

// =============================================================================
// Transcodificación de audio en el cliente → MP3 (audio/mpeg).
// En este Chatwoot/WABA el ÚNICO formato de audio que Meta ENTREGA es audio/mpeg
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
