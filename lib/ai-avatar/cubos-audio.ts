// =============================================================================
// cubos-audio — la voz del video del personaje en cubos, lista como la de la galería (módulo PURO, sin DOM)
// =============================================================================
// La galería pasa cada voz por dos cosas (C:/dev/artefactos-animaciones/tools/voz_formato.sh), y la app hace las mismas en el
// navegador de la persona, sin servidor ni ffmpeg:
//   1. `cortar`: saca los silencios largos (los cortes los decide `apretar`, lib/ai-avatar/cubos-tiempos.ts);
//   2. `nivelar`: lleva la voz a -14 LUFS con el pico por debajo de -1 dB (LA-CONFIG: ElevenLabs sale «bajito»).
// Trabaja sobre los canales como Float32Array: el navegador los saca de un AudioBuffer (app/ai-avatar/cubos/mp4.ts) y el test,
// de un arreglo cualquiera.
// =============================================================================

import type { Corte } from './cubos-tiempos';

/** El volumen de la galería (loudnorm=I=-14:TP=-1). */
export const LUFS_OBJETIVO = -14;
export const PICO_MAX_DB = -1;

/** Los canales sin los tramos de `cortes` ([desde, hasta) en segundos). */
export function cortar(canales: readonly Float32Array[], sr: number, cortes: readonly Corte[]): Float32Array[] {
  if (!cortes.length) return canales.map((c) => c.slice());
  const largo = canales[0]?.length ?? 0;
  const tramos: [number, number][] = [];
  let desde = 0;
  for (const [c0, c1] of cortes) {
    const a = Math.max(desde, Math.min(largo, Math.round(c0 * sr))), b = Math.max(a, Math.min(largo, Math.round(c1 * sr)));
    tramos.push([desde, a]); desde = b;
  }
  tramos.push([desde, largo]);
  const total = tramos.reduce((s, [a, b]) => s + (b - a), 0);
  return canales.map((c) => {
    const out = new Float32Array(total); let k = 0;
    for (const [a, b] of tramos) { out.set(c.subarray(a, b), k); k += b - a; }
    return out;
  });
}

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** El filtro K de ITU-R BS.1770 (el que usa loudnorm) para esa frecuencia de muestreo. */
function filtrosK(sr: number): [Biquad, Biquad] {
  // etapa 1: estante alto (+4 dB arriba de ~1,7 kHz)
  let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / sr);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const s: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0, b1: (2 * (K * K - Vh)) / a0, b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0,
  };
  // etapa 2: pasa altos (~38 Hz)
  f0 = 38.13547087602444; Q = 0.5003270373238773; K = Math.tan((Math.PI * f0) / sr);
  a0 = 1 + K / Q + K * K;
  const h: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [s, h];
}

function filtrar(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = f.b0 * x[i] + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** La sonoridad integrada en LUFS (BS.1770-4: bloques de 400 ms cada 100 ms, compuertas de -70 LUFS y -10 LU). */
export function lufs(canales: readonly Float32Array[], sr: number): number {
  const [s, h] = filtrosK(sr);
  const kf = canales.map((c) => filtrar(filtrar(c, s), h));
  const n = kf[0]?.length ?? 0, bloque = Math.round(0.4 * sr), paso = Math.round(0.1 * sr);
  const z: number[] = [];
  for (let ini = 0; ini + bloque <= n; ini += paso) {
    let suma = 0;
    for (const c of kf) { let e = 0; for (let i = ini; i < ini + bloque; i++) e += c[i] * c[i]; suma += e / bloque; }
    z.push(suma);
  }
  if (!z.length) return -Infinity;
  const L = (v: number) => -0.691 + 10 * Math.log10(v);
  const abs = z.filter((v) => L(v) > -70);
  if (!abs.length) return -Infinity;
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const ok = abs.filter((v) => L(v) > rel);
  return L(ok.reduce((a, b) => a + b, 0) / ok.length);
}

/** La ganancia (lineal) que lleva la voz a `objetivo` LUFS sin pasar el pico de `picoMaxDb`. */
export function gananciaPara(canales: readonly Float32Array[], sr: number, objetivo = LUFS_OBJETIVO, picoMaxDb = PICO_MAX_DB): number {
  const l = lufs(canales, sr);
  if (!Number.isFinite(l)) return 1;
  let pico = 0; for (const c of canales) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > pico) pico = a; }
  const g = Math.pow(10, (objetivo - l) / 20);
  const techo = pico > 0 ? Math.pow(10, picoMaxDb / 20) / pico : g;
  return Math.min(g, techo);
}

/**
 * Los canales como un WAV de 16 bits (lo que la plantilla toca con su `<audio>`). Propio y no el del Video Editor
 * (app/video-editor/_opencut/audio/wav.ts): el motor del editor sólo entra por su puerta 'use client'
 * (tests/video-editor-integracion.test.ts, prueba 4).
 */
export function wavDe(canales: readonly Float32Array[], sr: number): Blob {
  const n = Math.max(1, Math.min(2, canales.length)), muestras = canales[0]?.length ?? 0, bytes = muestras * n * 2;
  const v = new DataView(new ArrayBuffer(44 + bytes));
  const txt = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, n, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * n * 2, true); v.setUint16(32, n * 2, true); v.setUint16(34, 16, true); txt(36, 'data'); v.setUint32(40, bytes, true);
  let o = 44;
  for (let i = 0; i < muestras; i++) for (let c = 0; c < n; c++) {
    const x = Math.max(-1, Math.min(1, canales[c][i])); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  return new Blob([v.buffer], { type: 'audio/wav' });
}

/** Los canales llevados a -14 LUFS (con el pico cuidado). */
export function nivelar(canales: readonly Float32Array[], sr: number): Float32Array[] {
  const g = gananciaPara(canales, sr);
  return canales.map((c) => { const o = new Float32Array(c.length); for (let i = 0; i < c.length; i++) o[i] = c[i] * g; return o; });
}
