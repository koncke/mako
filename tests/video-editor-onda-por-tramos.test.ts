// =============================================================================
// La forma de onda de a trozos: el mismo dibujo sin leer el archivo entero (11/11/2026)
// =============================================================================
// Medido el 11/11/2026 (docs/editor-video/memoria-del-editor.md §1, banco scripts/banco-memoria-editor/): la forma de onda
// leía el archivo ENTERO, lo copiaba y decodificaba todo el audio, en cada carga del proyecto. Un video de 76 MB pedía
// +275 MB de golpe. Leído de a trozos (media/onda-por-tramos.ts): +61 MB, con los MISMOS picos balde por balde (banco
// `onda-igual-30s`: 11.250 baldes, diferencia máxima 0). Fija media/picos-por-tramos.ts y que el caché de la onda lea
// un archivo de a trozos antes de caer al camino de antes.
//
// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · `Math.floor(pos / bs)` → `Math.round`: rojo el de los trozos y el del hueco;
//   · sin sumar al total (`this.total = pos + 1`): rojos el de los trozos, el del relleno y el del hueco;
//   · `if (pico > this.picos[balde])` → siempre pisar: rojo el de los trozos y el de los que se pisan;
//   (sacar el `Math.max(0, -inicio)` NO da rojo, y está bien: lo de antes de la muestra 0 cae en baldes negativos que
//   nunca se leen; es sólo para no recorrerlo);
//   · en waveform-cache/service.ts, sin el `ondaPorTramos` antes del `arrayBuffer()`: rojo el del cableado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PicosPorTramos } from '../app/video-editor/_opencut/media/picos-por-tramos';

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const OC = 'app/video-editor/_opencut';
const BS = 128;

// Una señal estéreo que no se repite: dos senos con ruido determinista.
function senal(n: number): [Float32Array, Float32Array] {
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  let x = 12345;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const ruido = (x / 2147483648 - 0.5) * 0.1;
    a[i] = Math.sin(i / 37) * 0.6 + ruido;
    b[i] = Math.cos(i / 91) * 0.4 - ruido;
  }
  return [a, b];
}

// Lo que hacía buildSourceWaveformSummary con el audio entero (media/waveform-summary.ts, computePeakBuckets).
function referencia(canales: Float32Array[], bs: number): Float32Array {
  const largo = canales[0].length;
  const baldes = Math.max(1, Math.ceil(largo / bs));
  const out = new Float32Array(baldes);
  for (let k = 0; k < baldes; k++) {
    let pico = 0;
    for (const c of canales) for (let j = k * bs; j < Math.min(largo, (k + 1) * bs); j++) pico = Math.max(pico, Math.abs(c[j]));
    out[k] = pico;
  }
  return out;
}

test('de a trozos de cualquier largo da los MISMOS picos que el audio entero', () => {
  const [a, b] = senal(48_000 * 3 + 77);
  const p = new PicosPorTramos(BS);
  let i = 0;
  for (const largo of [1024, 37, 500, 1, 4096, 2048, 333]) {
    while (i < a.length) {
      const fin = Math.min(a.length, i + largo);
      p.agregar([a.subarray(i, fin), b.subarray(i, fin)], i);
      i = fin;
      if (largo !== 333) break;
    }
  }
  const r = p.resumen({ sourceKey: 'media:x', sampleRate: 48_000 });
  assert.equal(r.totalSamples, a.length);
  assert.equal(r.bucketSize, BS);
  assert.equal(r.sampleRate, 48_000);
  assert.deepEqual(Array.from(r.amplitudes), Array.from(referencia([a, b], BS)));
});

test('el relleno del códec, antes de la muestra 0, no cuenta', () => {
  const p = new PicosPorTramos(BS);
  const trozo = new Float32Array(200).fill(0.2);
  trozo.fill(0.9, 0, 50); // las 50 de relleno, más fuertes
  p.agregar([trozo], -50);
  const r = p.resumen({ sourceKey: 'k', sampleRate: 44_100 });
  assert.equal(r.totalSamples, 150);
  assert.deepEqual(Array.from(r.amplitudes).map((v) => Math.round(v * 10) / 10), [0.2, 0.2]);
});

test('un hueco entre trozos queda en 0 y los trozos que se pisan se quedan con el pico mayor', () => {
  const p = new PicosPorTramos(BS);
  p.agregar([new Float32Array(BS).fill(0.5)], 0);
  p.agregar([new Float32Array(BS).fill(0.3)], 3 * BS); // hueco: baldes 1 y 2
  p.agregar([new Float32Array(BS).fill(0.1)], 0); // pisa el balde 0 con menos
  const r = p.resumen({ sourceKey: 'k', sampleRate: 48_000 });
  assert.equal(r.totalSamples, 4 * BS);
  assert.deepEqual(Array.from(r.amplitudes).map((v) => Math.round(v * 10) / 10), [0.5, 0, 0, 0.3]);
});

test('sin audio, el resumen tiene un balde vacío (como el de antes con un buffer vacío)', () => {
  const r = new PicosPorTramos(BS).resumen({ sourceKey: 'k', sampleRate: 48_000 });
  assert.equal(r.totalSamples, 0);
  assert.equal(r.amplitudes.length, 1);
});

test('el cableado: un archivo va de a trozos y sólo lo que mediabunny no lee cae al archivo entero', () => {
  const svc = leer(`${OC}/services/waveform-cache/service.ts`);
  const trozos = svc.indexOf('await ondaPorTramos({ sourceKey, file: sourceFile })');
  const entero = svc.indexOf('arrayBuffer = await sourceFile.arrayBuffer()');
  assert.ok(trozos > 0, 'el caché de la onda no lee de a trozos');
  assert.ok(entero > trozos, 'el archivo entero se lee ANTES de probar de a trozos');
  assert.match(svc, /if \(porTramos\.estado === "listo"\) return porTramos\.resumen;/);
  assert.match(svc, /if \(porTramos\.estado === "sin-audio"\) \{\s*throw/);
  const onda = leer(`${OC}/media/onda-por-tramos.ts`);
  assert.match(onda, /new AudioBufferSink\(pista\)/);
  assert.match(onda, /finally \{\s*input\.dispose\(\);/);
  assert.doesNotMatch(onda, /arrayBuffer\(\)/, 'la onda de a trozos no puede leer el archivo entero');
});
