'use client';

// =============================================================================
// Transcodificación de audio en el cliente: webm/opus (Chrome/Edge) → MP3.
// WhatsApp Cloud NO acepta webm; sí acepta audio/mpeg (mp3). Decodificamos con
// Web Audio y re-encodeamos con lamejs (JS puro, sin WASM). Se importa de forma
// perezosa (solo al mandar una nota de voz que haya que convertir).
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
  await ctx.close().catch(() => {});

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

  const enc = new Mp3Encoder(1, sampleRate, 128);
  const out: Uint8Array[] = [];
  const BLOCK = 1152;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const buf = enc.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (buf.length) out.push(buf);
  }
  const end = enc.flush();
  if (end.length) out.push(end);

  return new Blob(out as BlobPart[], { type: 'audio/mpeg' });
}
