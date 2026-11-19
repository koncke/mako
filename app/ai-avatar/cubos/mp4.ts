// =============================================================================
// El MP4 del personaje en cubos, armado EN EL NAVEGADOR de la persona (19/11/2026)
// =============================================================================
// El render no puede trabar el servidor (docs/editor-video/ai-avatar-por-codigo.md): la plantilla ya está dibujando el video
// en un iframe, y acá se fotografía cuadro por cuadro (public/avatar-cubos/kit/rasterizar.js) y se codifica con mediabunny,
// con la voz. El molde es el del Video Editor (app/video-editor/_opencut/services/renderer/scene-exporter.ts): CanvasSource,
// un cuadro clave cada 2 s y AAC con Opus de respaldo.
//
// Sin 'use client' a propósito: no es un componente. Lo importa la pantalla (EstudioCubos.tsx) y el banco de prueba de la
// réplica (scripts/avatar-cubos/), que lo empaqueta con esbuild. mediabunny se carga recién al exportar.
// =============================================================================

import { wavDeCanales } from '@/app/video-editor/_opencut/audio/wav';
import { cortar, nivelar } from '@/lib/ai-avatar/cubos-audio';
import type { Corte } from '@/lib/ai-avatar/cubos-tiempos';

export const ANCHO = 1080, ALTO = 1920, FPS = 30;

/** Lo que expone una plantilla de public/avatar-cubos (kit/rasterizar.js y kit/kit.js). */
type VentanaPlantilla = Window & {
  __ready?: boolean;
  __dur?: number;
  RASTER?: {
    preparar: () => Promise<number>;
    capas: (t: number) => { abajo: string; lienzo: HTMLCanvasElement | null; caja: { x: number; y: number; w: number; h: number } | null; arriba: string | null };
  };
};

const svgComoImagen = async (svg: string): Promise<HTMLImageElement> => {
  // data: y no blob: (con blob: Chrome marca el lienzo como «tainted» y no deja codificarlo)
  const im = new Image();
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await im.decode();
  return im;
};

/** Pinta en `ctx` el segundo `t` de la plantilla: lo de abajo, el personaje y lo de arriba. */
export async function pintarCuadro(ctx: CanvasRenderingContext2D, ventana: VentanaPlantilla, t: number): Promise<void> {
  const R = ventana.RASTER;
  if (!R) throw new Error('La plantilla no tiene el fotografiador.');
  const c = R.capas(t);
  const abajo = await svgComoImagen(c.abajo);
  const arriba = c.arriba ? await svgComoImagen(c.arriba) : null;
  ctx.clearRect(0, 0, ANCHO, ALTO);
  ctx.drawImage(abajo, 0, 0, ANCHO, ALTO);
  if (c.lienzo && c.caja) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(c.lienzo, c.caja.x, c.caja.y, c.caja.w, c.caja.h);
  }
  if (arriba) ctx.drawImage(arriba, 0, 0, ANCHO, ALTO);
}

/** Espera a que la plantilla del iframe esté lista para sacar cuadros (`window.__ready` del kit, en modo `?cap`). */
export async function esperarPlantilla(iframe: HTMLIFrameElement, msMax = 60_000): Promise<VentanaPlantilla> {
  const t0 = Date.now();
  for (;;) {
    const w = iframe.contentWindow as VentanaPlantilla | null;
    if (w && w.__ready === true && w.RASTER) return w;
    if (Date.now() - t0 > msMax) throw new Error('La plantilla no terminó de cargar.');
    await new Promise((r) => setTimeout(r, 120));
  }
}

/** La voz lista: sin los silencios largos y a -14 LUFS, como la galería. Devuelve el AudioBuffer y un WAV para el iframe. */
export async function prepararVoz(url: string, cortes: readonly Corte[]): Promise<{ buffer: AudioBuffer; wav: Blob }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('No pude bajar la voz.');
  const crudo = await r.arrayBuffer();
  const ac = new OfflineAudioContext(1, 1, 44_100);
  const dec = await ac.decodeAudioData(crudo);
  const canales = Array.from({ length: dec.numberOfChannels }, (_, i) => dec.getChannelData(i));
  const listos = nivelar(cortar(canales, dec.sampleRate, cortes), dec.sampleRate);
  const buffer = new AudioBuffer({ length: listos[0].length, numberOfChannels: listos.length, sampleRate: dec.sampleRate });
  listos.forEach((c, i) => buffer.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  return { buffer, wav: wavDeCanales(listos, dec.sampleRate) };
}

export type Avance = (hechos: number, total: number) => void;

/**
 * El MP4 entero: cada cuadro de la plantilla (a 30 cuadros por segundo) con la voz. `cancelado()` se pregunta entre cuadros.
 * Devuelve null si se canceló.
 */
export async function armarMp4(o: { ventana: VentanaPlantilla; dur: number; voz: AudioBuffer | null; alAvanzar?: Avance; cancelado?: () => boolean }): Promise<Blob | null> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality } = await import('mediabunny');
  await o.ventana.RASTER!.preparar();
  const lienzo = document.createElement('canvas'); lienzo.width = ANCHO; lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d')!;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const video = new CanvasSource(lienzo, { codec: 'avc', quality: new Quality({ bitrate: 8_000_000, bitrateMode: 'variable' }), keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: FPS });
  let audio: InstanceType<typeof AudioBufferSource> | null = null;
  if (o.voz) {
    let codec: 'aac' | 'opus' = 'aac';
    if (typeof AudioEncoder !== 'undefined') {
      const { supported } = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: o.voz.sampleRate, numberOfChannels: o.voz.numberOfChannels, bitrate: 192_000 });
      if (!supported) codec = 'opus';
    }
    audio = new AudioBufferSource({ codec, quality: new Quality({ bitrate: 192_000 }) });
    output.addAudioTrack(audio);
  }
  await output.start();
  if (audio && o.voz) { await audio.add(o.voz); audio.close(); }
  const n = Math.round(o.dur * FPS);
  for (let i = 0; i < n; i++) {
    if (o.cancelado?.()) { await output.cancel(); return null; }
    await pintarCuadro(ctx, o.ventana, i / FPS);
    await video.add(i / FPS, 1 / FPS);
    o.alAvanzar?.(i + 1, n);
  }
  video.close();
  await output.finalize();
  const buf = output.target.buffer;
  if (!buf) throw new Error('No se pudo armar el MP4.');
  return new Blob([buf], { type: 'video/mp4' });
}
