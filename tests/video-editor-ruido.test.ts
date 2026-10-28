// =============================================================================
// Video Editor: «Reducir el ruido» con RNNoise (audio/dsp/ruido.ts, audio/dsp/rnnoise.ts)
// =============================================================================
// Pedido de Leila (clienta Pro, 27/10/2026): «no funciona tan eficientemente como en
// CapCut». Medido antes del cambio (la compuerta espectral propia, origin/main
// 506877517) y después, con la misma cuenta que estos tests sobre una voz del sistema (la de
// Windows, en el scratchpad: no se versiona); acá corre una voz sintética con metas fijas:
//
//                                         antes      después
//   pausas, voz + ruido rosa              −16,3 dB   −40,4 dB
//   pausas, voz + ventilador              −18,9      −42,3
//   pausas, ruido que cambia              −1,5       −39,9
//   estéreo, ruido rosa sólo en L         −7,0       −40,1   (R limpio: SNR 20,5 → ∞)
//   voz LIMPIA, SNR salida/entrada        ∞          ∞       (con el piso de un micrófono)
//   bordes (salto en los primeros 20 ms)  0,49–0,85  0,01    (contra el de la entrada)
//   principio de una pieza de «Borrar     13,8 dB    3,3–3,9 (de diferencia, en promedio,
//   silencios» contra el clip de corrido                      con procesarlo de corrido)
//
// La voz es SINTÉTICA (nada de audio de nadie): pulso glótico con tono que baja, tres
// formantes que se mueven entre vocales y una fricativa al principio de algunas sílabas.
// RNNoise la trata como voz: su probabilidad de voz da 0,97 en las sílabas y 0,06 en
// las pausas. Un seno (el test 5 viejo de video-editor-audio) no prueba nada de esto.
//
// Correr: node --import tsx --test tests/video-editor-ruido.test.ts
//
// ── Roturas ── al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { a48k, reducirRuido } from '../app/video-editor/_opencut/audio/dsp/ruido';
import {
  CUADRO_RNNOISE,
  RETARDO_RNNOISE,
  URL_WASM_RNNOISE,
  instanciarRnnoise,
  type MotorRnnoise,
} from '../app/video-editor/_opencut/audio/dsp/rnnoise';
import { MedidorVentanas, rangosDeSilencio, tramosQueQuedan } from '../app/video-editor/_opencut/audio/dsp/silencios';

const RAIZ = process.cwd();
const WASM = path.join(RAIZ, 'public', URL_WASM_RNNOISE);
/** sha256 del binario que trae embebido @jitsi/rnnoise-wasm@0.2.1 (dist/rnnoise-sync.js; tarball sha1 55b1991e…). */
const SHA256_RNNOISE = '4f513a50613de74378331237886138eab52fa2650e8b1a41eb587d932d9b8850';

let motorCargado: Promise<MotorRnnoise> | null = null;
const motor = () => (motorCargado ??= instanciarRnnoise(fs.readFileSync(WASM)));

// ─────────────────────────────────────────────────────────────────────────────
// Las señales
// ─────────────────────────────────────────────────────────────────────────────

function azar(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
}
function gauss(semilla: number) {
  const r = azar(semilla);
  return () => Math.sqrt(-2 * Math.log((r() + 1) / 2 || 1e-12)) * Math.cos(Math.PI * (r() + 1));
}
function normalizar(y: Float32Array, db = 0): Float32Array {
  let s = 0;
  for (const v of y) s += v * v;
  const k = 10 ** (db / 20) / Math.sqrt(s / y.length || 1);
  for (let i = 0; i < y.length; i++) y[i] *= k;
  return y;
}
/** Ruido rosa (Paul Kellet). */
function rosa(n: number, semilla: number): Float32Array {
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
function ventilador(n: number, sr: number, semilla: number): Float32Array {
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
function cambiante(n: number, sr: number, semilla: number): Float32Array {
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

const VOCALES = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [570, 840, 2410]];
function resonar(x: Float32Array, sr: number, f: Float64Array, ancho: number): Float32Array {
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
function voz(sr: number, tramos: Array<[number, number]>, semilla = 5): Float32Array {
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

const TRAMOS: Array<[number, number]> = [[0.6, 2.4], [3.2, 4.8], [5.6, 7.2]];
/** Ruido `debajoDb` por debajo de la voz (que está a −20 dBFS). */
const mezclar = (v: Float32Array, ruido: Float32Array, debajoDb: number) => {
  const k = 10 ** ((-20 - debajoDb) / 20);
  return v.map((s, i) => s + k * ruido[i]);
};

// ─────────────────────────────────────────────────────────────────────────────
// Las cuentas
// ─────────────────────────────────────────────────────────────────────────────

/** Por ventana de 20 ms: con voz (la limpia sobre −50 dBFS) y pausa (a 60 ms o más de cualquier voz). */
function ventanas(limpia: Float32Array, sr: number) {
  const v = Math.round(sr * 0.02);
  const nv = Math.floor(limpia.length / v);
  const conVoz = Array.from({ length: nv }, (_, k) => db(limpia, k * v, (k + 1) * v) > -50);
  const pausa = conVoz.map((_, k) => !conVoz.slice(Math.max(0, k - 3), k + 4).some(Boolean));
  return { v, nv, conVoz, pausa };
}
function db(x: Float32Array, desde = 0, hasta = x.length): number {
  let s = 0;
  for (let i = desde; i < hasta; i++) s += x[i] * x[i];
  return 10 * Math.log10(s / Math.max(1, hasta - desde) + 1e-30);
}
/** Energía de salida contra entrada en las ventanas elegidas (dB). */
function cambio(entrada: Float32Array, salida: Float32Array, cuales: boolean[], v: number): number {
  let ei = 0, eo = 0;
  cuales.forEach((si, k) => {
    if (!si) return;
    for (let i = k * v; i < (k + 1) * v; i++) { ei += entrada[i] ** 2; eo += salida[i] ** 2; }
  });
  return 10 * Math.log10(eo / ei);
}
/** SNR de `y` contra la referencia (dB), en las ventanas elegidas o en todo. */
function snr(ref: Float32Array, y: Float32Array, cuales?: boolean[], v = 1): number {
  let s = 0, e = 0;
  for (let i = 0; i < ref.length; i++) {
    if (cuales && !cuales[Math.floor(i / v)]) continue;
    s += ref[i] ** 2; e += (y[i] - ref[i]) ** 2;
  }
  return 10 * Math.log10(s / (e || 1e-30));
}
/** El salto muestra a muestra más grande en los primeros y los últimos 20 ms, contra el de la entrada. */
function bordes(entrada: Float32Array, salida: Float32Array, sr: number): [number, number] {
  const w = Math.round(sr * 0.02);
  const salto = (x: Float32Array, a: number, b: number) => {
    let m = 0;
    for (let i = Math.max(1, a); i < b; i++) m = Math.max(m, Math.abs(x[i] - x[i - 1]));
    return m;
  };
  const n = salida.length;
  return [salto(salida, 0, w) / salto(entrada, 0, w), salto(salida, n - w, n) / salto(entrada, n - w, n)];
}

/** Las metas del pedido para una voz con ruido: pausas ≥ 25 dB más bajas, la voz sin daño, sin chasquidos. */
async function conRuido(nombre: string, sr: number, ruido: (n: number) => Float32Array) {
  const limpia = voz(sr, TRAMOS);
  const sucia = mezclar(limpia, ruido(limpia.length), 15);
  const [y] = await reducirRuido({ canales: [sucia], sampleRate: sr, motor: await motor() });
  const { v, conVoz, pausa } = ventanas(limpia, sr);
  const pausas = cambio(sucia, y, pausa, v);
  const nivelVoz = cambio(sucia, y, conVoz, v);
  const antes = snr(limpia, sucia, conVoz, v);
  const despues = snr(limpia, y, conVoz, v);
  assert.ok(pausas <= -25, `${nombre}: las pausas bajaron ${pausas.toFixed(1)} dB (la meta: 25 o más)`);
  assert.ok(Math.abs(nivelVoz) <= 0.5, `${nombre}: la voz cambió ${nivelVoz.toFixed(2)} dB`);
  assert.ok(despues >= antes - 0.5, `${nombre}: la SNR de la voz cayó de ${antes.toFixed(1)} a ${despues.toFixed(1)} dB`);
  const [ini, fin] = bordes(sucia, y, sr);
  assert.ok(ini <= 1 && fin <= 1, `${nombre}: un chasquido en los bordes (${ini.toFixed(2)} / ${fin.toFixed(2)} del salto de la entrada)`);
}

// ─────────────────────────────────────────────────────────────────────────────

test('1: el binario de public/ve/wasm/ es RNNoise 0.2 de @jitsi/rnnoise-wasm@0.2.1, con su licencia y sin CDN', () => {
  assert.ok(fs.existsSync(WASM), `falta ${path.relative(RAIZ, WASM)}`);
  const bytes = fs.readFileSync(WASM);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), SHA256_RNNOISE, 'no es el binario de RNNoise 0.2 que se midió');
  // Los nombres minimizados que usa el pegamento propio (dsp/rnnoise.ts → NOMBRES).
  const modulo = new WebAssembly.Module(bytes);
  assert.deepEqual(WebAssembly.Module.imports(modulo).map((i) => `${i.module}.${i.name}:${i.kind}`).sort(), ['a.a:function', 'a.b:function']);
  const exportados = Object.fromEntries(WebAssembly.Module.exports(modulo).map((e) => [e.name, e.kind]));
  assert.equal(exportados.c, 'memory');
  for (const f of ['d', 'e', 'h', 'i', 'j']) assert.equal(exportados[f], 'function', `falta la función «${f}»`);
  const licencia = fs.readFileSync(path.join(RAIZ, 'public/ve/wasm/rnnoise-LICENSE.txt'), 'utf8');
  assert.match(licencia, /Redistributions in binary form must reproduce/);
  assert.match(licencia, /rnnoise-0\.2-jitsi-0\.2\.1\.wasm/);
  // Nada lo pide a otro dominio: se sirve desde la app.
  const fuente = fs.readFileSync(path.join(RAIZ, 'app/video-editor/_opencut/audio/dsp/rnnoise.ts'), 'utf8');
  assert.doesNotMatch(fuente, /https?:\/\//, 'el cargador nombra una URL de afuera');
  assert.match(fuente, /fetch\(URL_WASM_RNNOISE\)/);
});

test('2: el retardo de la red es el medido (RETARDO_RNNOISE)', async () => {
  const sr = 48000;
  const x = voz(sr, TRAMOS);
  const estado = (await motor()).crear();
  const y = new Float32Array(x.length);
  const cuadro = new Float32Array(CUADRO_RNNOISE);
  for (let ini = 0; ini + CUADRO_RNNOISE <= x.length; ini += CUADRO_RNNOISE) {
    for (let i = 0; i < CUADRO_RNNOISE; i++) cuadro[i] = x[ini + i] * 32768;
    estado.procesar(cuadro);
    for (let i = 0; i < CUADRO_RNNOISE; i++) y[ini + i] = cuadro[i] / 32768;
  }
  estado.liberar();
  let mejor = -Infinity, retardo = -1;
  for (let d = 0; d <= 2000; d++) {
    let s = 0;
    for (let i = sr; i < 3 * sr; i++) s += x[i] * y[i + d];
    if (s > mejor) { mejor = s; retardo = d; }
  }
  assert.ok(Math.abs(retardo - RETARDO_RNNOISE) <= 2, `la correlación da ${retardo} muestras y el código corre ${RETARDO_RNNOISE}`);
});

test('3: voz + ruido rosa', () => conRuido('rosa', 48000, (n) => rosa(n, 11)));
test('4: voz + ventilador', () => conRuido('ventilador', 48000, (n) => ventilador(n, 48000, 12)));
test('5: voz + un ruido que cambia (la compuerta vieja: −1,5 dB)', () => conRuido('cambiante', 48000, (n) => cambiante(n, 48000, 13)));
test('6: a 44,1 kHz, la tasa del export', () => conRuido('rosa a 44,1 kHz', 44100, (n) => rosa(n, 14)));

test('7: estéreo con el ruido en UN canal: ese baja y el limpio queda, aunque el limpio tenga eco de sala', async () => {
  const sr = 48000;
  const limpia = voz(sr, TRAMOS);
  const L = mezclar(limpia, rosa(limpia.length, 21), 15);
  // R, el micrófono de la sala: limpio, con eco (cada 50 ms, 8 dB menos) y el piso de un micrófono bueno.
  // Su eco suena en las pausas de L: con la ganancia enlazada por máximo solo, L no bajaba (−13,8 dB).
  const D = Math.round(0.05 * sr);
  const eco = new Float32Array(limpia.length);
  for (let i = 0; i < eco.length; i++) eco[i] = limpia[i] + (i >= D ? 0.4 * eco[i - D] : 0);
  const R = mezclar(eco, rosa(limpia.length, 23), 70);
  const [yl, yr] = await reducirRuido({ canales: [L, R], sampleRate: sr, motor: await motor() });
  const { v, pausa } = ventanas(limpia, sr);
  const pausas = cambio(L, yl, pausa, v);
  assert.ok(pausas <= -25, `L: las pausas bajaron ${pausas.toFixed(1)} dB`);
  const r = snr(R, yr);
  assert.ok(r >= 30, `R (limpio): SNR ${r.toFixed(1)} dB`);
});

test('7b: estéreo con la misma voz y un ruido distinto en cada lado: bajan los dos y la imagen no se mueve', async () => {
  const sr = 48000;
  const limpia = voz(sr, TRAMOS);
  const L = mezclar(limpia, rosa(limpia.length, 51), 15);
  const R = mezclar(limpia.map((s) => 0.5 * s), ventilador(limpia.length, sr, 52), 15);
  const [yl, yr] = await reducirRuido({ canales: [L, R], sampleRate: sr, motor: await motor() });
  const { v, conVoz, pausa } = ventanas(limpia, sr);
  for (const [lado, x, y] of [['L', L, yl], ['R', R, yr]] as const) {
    const pausas = cambio(x, y, pausa, v);
    assert.ok(pausas <= -25, `${lado}: las pausas bajaron ${pausas.toFixed(1)} dB`);
  }
  // La voz está 6 dB más baja en R: después, también (la ganancia enlazada no corre la imagen).
  const imagen = (a: Float32Array, b: Float32Array) => cambio(a, b, conVoz, v);
  const corrida = imagen(yl, yr) - imagen(L, R);
  assert.ok(Math.abs(corrida) <= 0.5, `la imagen se corrió ${corrida.toFixed(2)} dB`);
  // Un estéreo con los dos lados iguales sale igual en los dos.
  const igual = mezclar(limpia, ventilador(limpia.length, sr, 22), 15);
  const [a, b] = await reducirRuido({ canales: [igual, igual.slice()], sampleRate: sr, motor: await motor() });
  assert.deepEqual(a, b, 'los dos lados de un estéreo igual salen distintos');
});

test('8: una voz LIMPIA queda intacta', async () => {
  const sr = 48000;
  // Una voz limpia grabada: con el piso de un micrófono bueno (−90 dBFS) en las pausas.
  const limpia = voz(sr, TRAMOS);
  const grabada = mezclar(limpia, rosa(limpia.length, 31), 70);
  const [y] = await reducirRuido({ canales: [grabada], sampleRate: sr, motor: await motor() });
  const r = snr(grabada, y);
  assert.ok(r >= 60, `una voz limpia salió con una SNR de ${r.toFixed(1)} dB contra la entrada`);
});

test('9: las piezas de «Borrar silencios»: cada principio baja como una pausa y no salta contra el clip de corrido', async () => {
  const sr = 48000;
  const limpia = voz(sr, TRAMOS);
  // Un ruido 25 dB bajo la voz: queda bajo el umbral de silencio y «Borrar silencios» lo corta.
  const sucia = mezclar(limpia, ventilador(limpia.length, sr, 41), 25);
  const medidor = new MedidorVentanas();
  medidor.agregar({ canales: [sucia], sampleRate: sr, inicio: 0 });
  const quedan = tramosQueQuedan({ desde: 0, hasta: sucia.length / sr, silencios: rangosDeSilencio(medidor.resultado()) });
  assert.equal(quedan.length, TRAMOS.length, 'el corte no dejó una pieza por tramo de voz');
  const piezas = quedan.map(([a, b]) => sucia.slice(Math.round(a * sr), Math.round(b * sr)));
  const m = await motor();
  const procesadas = await Promise.all(piezas.map(async (p) => (await reducirRuido({ canales: [p], sampleRate: sr, motor: m }))[0]));
  // Lo que suena después del corte, de corrido, para comparar.
  const unida = new Float32Array(piezas.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of piezas) { unida.set(p, o); o += p.length; }
  const [corrido] = await reducirRuido({ canales: [unida], sampleRate: sr, motor: m });
  // El principio de cada pieza (10–60 ms: el margen de 80 ms que deja el corte, antes de la voz).
  // Un salto es una ráfaga de ruido en el corte: más que en el mismo lugar procesado de corrido.
  const a = Math.round(0.01 * sr), b = Math.round(0.06 * sr);
  o = 0;
  piezas.forEach((p, i) => {
    const baja = db(procesadas[i], a, b) - db(p, a, b);
    const contra = db(procesadas[i], a, b) - db(corrido, o + a, o + b);
    assert.ok(baja <= -25, `pieza ${i + 1}: el principio bajó ${baja.toFixed(1)} dB`);
    assert.ok(contra <= 12, `pieza ${i + 1}: el principio quedó ${contra.toFixed(1)} dB más ruidoso que de corrido`);
    o += p.length;
  });
});

test('10: lo que se remuestrea es sólo para la red: a 48 kHz no se toca, y 44,1 → 48 conserva un tono', () => {
  const x = new Float32Array(4410).map((_, i) => Math.sin((2 * Math.PI * 1000 * i) / 44100));
  assert.equal(a48k(x, 48000), x);
  const y = a48k(x, 44100);
  assert.equal(y.length, 4800);
  let e = 0;
  for (let i = 100; i < 4700; i++) e = Math.max(e, Math.abs(y[i] - Math.sin((2 * Math.PI * 1000 * i) / 48000)));
  // Lanczos-4 con 512 fases: −54 dB, de sobra para que la red escuche (lo que suena no pasa por acá).
  assert.ok(e < 5e-3, `el tono remuestreado se aparta ${e.toExponential(1)}`);
});

// ── Roturas (28/10/2026, base 11/0): cada una sola, con un script que rompe, corre y restaura ──
//   R1 RETARDO_RNNOISE = 480 (el del modelo 0.1)            → 10/1 (el 2: la correlación da 959)
//   R2 sin rodilla (RODILLA = 1)                            → 7/4 (3, 4, 5 y 6: la voz baja 0,6 dB)
//   R3 el voto entre canales en −30 dB                      → 10/1 (el 7: −24,0 dB)
//   R4 sin la guarda del piso de ruido                      → 9/2 (7 y 8: SNR 24,4 y 25,1 dB)
//   R5 sin espejo                                           → 10/1 (el 9: el principio de una pieza baja −19,8 dB)
//   R7 enlazado por máximo, sin la coherencia               → 10/1 (el 7: −13,8 dB)
//   NO las ve la voz sintética: el espejo de 1 s en vez de 3 (la voz del sistema sí: 18 contra 10 dB), y sacar el enlace
//   del todo (≤ 0,4 dB de diferencia en la imagen: la rodilla ya deja la voz igual en los dos lados).
