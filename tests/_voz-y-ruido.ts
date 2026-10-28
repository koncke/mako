// =============================================================================
// Voz y ruidos SINTÉTICOS para los tests de audio del Video Editor (nada de audio de nadie)
// =============================================================================
// La voz: pulso glótico con tono que baja, tres formantes que se mueven entre vocales y una fricativa al
// principio de algunas sílabas; RNNoise la trata como voz (0,97 de probabilidad en las sílabas, 0,06 en las
// pausas). Los ruidos: rosa, ventilador y uno que cambia. Y las cuentas: ventanas de voz y de pausa, SNR,
// cambio de nivel y el salto de los bordes. Lo usan tests/video-editor-ruido.test.ts y
// tests/video-editor-silencios.test.ts.
// =============================================================================

export function azar(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
}
export function gauss(semilla: number) {
  const r = azar(semilla);
  return () => Math.sqrt(-2 * Math.log((r() + 1) / 2 || 1e-12)) * Math.cos(Math.PI * (r() + 1));
}
export function normalizar(y: Float32Array, db = 0): Float32Array {
  let s = 0;
  for (const v of y) s += v * v;
  const k = 10 ** (db / 20) / Math.sqrt(s / y.length || 1);
  for (let i = 0; i < y.length; i++) y[i] *= k;
  return y;
}
/** Ruido rosa (Paul Kellet). */
export function rosa(n: number, semilla: number): Float32Array {
  const g = gauss(semilla);
  const y = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = g();
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    y[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
  }
  return normalizar(y);
}
/** Ventilador: zumbido de 120 Hz con armónicos y un soplido grave que respira. */
export function ventilador(n: number, sr: number, semilla: number): Float32Array {
  const g = gauss(semilla);
  const y = new Float32Array(n);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const w = g();
    lp += 0.08 * (w - lp);
    lp2 += 0.02 * (lp - lp2);
    y[i] = (lp * 2.5 + lp2 * 4) * (1 + 0.15 * Math.sin(2 * Math.PI * 0.4 * t)) + 0.25 * Math.sin(2 * Math.PI * 120 * t) + 0.12 * Math.sin(2 * Math.PI * 240 * t + 1) + 0.05 * w;
  }
  return normalizar(y);
}
/** Un ruido que CAMBIA: rosa que sube y baja ±6 dB y, a la mitad, un soplido agudo. */
export function cambiante(n: number, sr: number, semilla: number): Float32Array {
  const a = rosa(n, semilla);
  const g = gauss(semilla + 1);
  const y = new Float32Array(n);
  let previo = 0;
  for (let i = 0; i < n; i++) {
    const w = g();
    y[i] = (i < n / 2 ? a[i] : 0.7 * (w - previo)) * 10 ** ((6 * Math.sin(2 * Math.PI * 0.15 * (i / sr))) / 20);
    previo = w;
  }
  return normalizar(y);
}

export const VOCALES = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [570, 840, 2410]];
export function resonar(x: Float32Array, sr: number, f: Float64Array, ancho: number): Float32Array {
  const y = new Float32Array(x.length);
  const r = Math.exp((-Math.PI * ancho) / sr);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (1 - r) * x[i] + 2 * r * Math.cos((2 * Math.PI * f[i]) / sr) * y1 - r * r * y2;
    y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
/** Sílabas de 180–320 ms dentro de cada tramo [a, b) (s); −20 dBFS en lo que suena; las pausas en cero. */
export function voz(sr: number, tramos: Array<[number, number]>, semilla = 5): Float32Array {
  const n = Math.round((Math.max(...tramos.map(([, b]) => b)) + 1) * sr);
  const fuente = new Float32Array(n), fric = new Float32Array(n), env = new Float32Array(n);
  const f1 = new Float64Array(n).fill(500), f2 = new Float64Array(n).fill(1500), f3 = new Float64Array(n).fill(2500);
  const r = azar(semilla);
  const g = gauss(semilla + 7);
  let fase = 0, vocal = 0;
  for (const [a, b] of tramos) {
    for (let t = a; t < b - 0.12; ) {
      const dur = Math.min(b - t, 0.18 + 0.07 * (r() + 1));
      const v0 = VOCALES[vocal % 5], v1 = VOCALES[(vocal + 2) % 5];
      vocal++;
      const conFric = r() > 0;
      const i0 = Math.round(t * sr), i1 = Math.round((t + dur) * sr);
      for (let i = i0; i < i1; i++) {
        const u = (i - i0) / (i1 - i0);
        fase += ((180 - 60 * ((i / sr - a) / (b - a))) * (1 + 0.01 * g())) / sr;
        if (fase >= 1) { fase -= 1; fuente[i] = 1; }
        env[i] = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.6;
        f1[i] = v0[0] + (v1[0] - v0[0]) * u; f2[i] = v0[1] + (v1[1] - v0[1]) * u; f3[i] = v0[2] + (v1[2] - v0[2]) * u;
        if (conFric && u < 0.18) fric[i] = g() * (1 - u / 0.18);
      }
      t += dur;
    }
  }
  let lp = 0;
  for (let i = 0; i < n; i++) { lp += 0.25 * (fuente[i] - lp); fuente[i] = lp; }
  const a1 = resonar(fuente, sr, f1, 90), a2 = resonar(fuente, sr, f2, 120), a3 = resonar(fuente, sr, f3, 180);
  const y = new Float32Array(n);
  let hp = 0, previo = 0, s = 0, c = 0;
  for (let i = 0; i < n; i++) {
    hp = 0.6 * (hp + fric[i] - previo); previo = fric[i];
    y[i] = (a1[i] + 0.6 * a2[i] + 0.3 * a3[i]) * env[i] + 0.02 * hp;
    if (env[i] > 0.1) { s += y[i] * y[i]; c++; }
  }
  const k = 0.1 / Math.sqrt(s / c);
  for (let i = 0; i < n; i++) y[i] *= k;
  return y;
}

export const TRAMOS: Array<[number, number]> = [[0.6, 2.4], [3.2, 4.8], [5.6, 7.2]];
/** Ruido `debajoDb` por debajo de la voz (que está a −20 dBFS). */
export const mezclar = (v: Float32Array, ruido: Float32Array, debajoDb: number) => {
  const k = 10 ** ((-20 - debajoDb) / 20);
  return v.map((s, i) => s + k * ruido[i]);
};

// ─────────────────────────────────────────────────────────────────────────────
// Las cuentas
// ─────────────────────────────────────────────────────────────────────────────

/** Por ventana de 20 ms: con voz (la limpia sobre −50 dBFS) y pausa (a 60 ms o más de cualquier voz). */
export function ventanas(limpia: Float32Array, sr: number) {
  const v = Math.round(sr * 0.02);
  const nv = Math.floor(limpia.length / v);
  const conVoz = Array.from({ length: nv }, (_, k) => db(limpia, k * v, (k + 1) * v) > -50);
  const pausa = conVoz.map((_, k) => !conVoz.slice(Math.max(0, k - 3), k + 4).some(Boolean));
  return { v, nv, conVoz, pausa };
}
export function db(x: Float32Array, desde = 0, hasta = x.length): number {
  let s = 0;
  for (let i = desde; i < hasta; i++) s += x[i] * x[i];
  return 10 * Math.log10(s / Math.max(1, hasta - desde) + 1e-30);
}
/** Energía de salida contra entrada en las ventanas elegidas (dB). */
export function cambio(entrada: Float32Array, salida: Float32Array, cuales: boolean[], v: number): number {
  let ei = 0, eo = 0;
  cuales.forEach((si, k) => {
    if (!si) return;
    for (let i = k * v; i < (k + 1) * v; i++) { ei += entrada[i] ** 2; eo += salida[i] ** 2; }
  });
  return 10 * Math.log10(eo / ei);
}
/** SNR de `y` contra la referencia (dB), en las ventanas elegidas o en todo. */
export function snr(ref: Float32Array, y: Float32Array, cuales?: boolean[], v = 1): number {
  let s = 0, e = 0;
  for (let i = 0; i < ref.length; i++) {
    if (cuales && !cuales[Math.floor(i / v)]) continue;
    s += ref[i] ** 2; e += (y[i] - ref[i]) ** 2;
  }
  return 10 * Math.log10(s / (e || 1e-30));
}
/** El salto muestra a muestra más grande en los primeros y los últimos 20 ms, contra el de la entrada. */
export function bordes(entrada: Float32Array, salida: Float32Array, sr: number): [number, number] {
  const w = Math.round(sr * 0.02);
  const salto = (x: Float32Array, a: number, b: number) => {
    let m = 0;
    for (let i = Math.max(1, a); i < b; i++) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
    return m;
  };
  const n = salida.length;
  return [salto(salida, 0, w) / salto(entrada, 0, w), salto(salida, n - w, n) / salto(entrada, n - w, n)];
}

