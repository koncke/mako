// =============================================================================
// «Borrar silencios»: la detección decide bien, y nunca borra el clip entero
// =============================================================================
// Pedido de Martín (858545195 @94:33). Acá se prueba la parte pura: ventanas de RMS
// → tramos de silencio → tramos que quedan. Lo del motor (dividir, borrar y correr lo
// que sigue) lo cuida el comando con el patrón de `SplitElementsCommand`.
//
// Probado rompiéndolo (14/10/2026), base 15 de 15 en verde, cada rotura restaurada:
// · p95 medido con el aire digital adentro → 1 fallo («todo silencio»: 0 tramos).
// · margen de 80 ms también en los bordes del clip → 1 fallo («todo silencio»).
// · sin estirar al borde → 1 fallo (las astillas).
// · cortar también en el borde del clip → 2 fallos.
// · recolocar corriendo también lo de ANTES → 1 fallo.
// · el runner sin la guarda de «todo silencio» → 1 fallo (el cableado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MedidorVentanas, rangosDeSilencio, tramosQueQuedan, umbralEfectivo, segundosQuitados,
} from '../app/video-editor/_opencut/audio/dsp/silencios';

const SR = 48000;

/** Un trozo mono de `segundos` con un tono (0 dBFS·amp) o silencio. */
function trozo(inicio: number, segundos: number, amp: number) {
  const n = Math.round(segundos * SR);
  const canal = new Float32Array(n);
  for (let i = 0; i < n; i++) canal[i] = amp * Math.sin((2 * Math.PI * 440 * i) / SR);
  return { canales: [canal], sampleRate: SR, inicio };
}

/** Voz (−12 dB) · pausa larga · voz · pausa corta · voz · cola de silencio. */
function clipDePrueba() {
  const m = new MedidorVentanas();
  m.agregar(trozo(0, 1.0, 0.25));
  m.agregar(trozo(1.0, 1.0, 0.0));   // 1 s de silencio: se quita
  m.agregar(trozo(2.0, 1.0, 0.25));
  m.agregar(trozo(3.0, 0.2, 0.0));   // 200 ms: una pausa natural, se deja
  m.agregar(trozo(3.2, 0.8, 0.25));
  m.agregar(trozo(4.0, 0.6, 0.0));   // cola: se quita
  return m.resultado();
}

test('EL CASO TÍPICO: quita la pausa larga y la cola, deja la pausa corta', () => {
  const v = clipDePrueba();
  const s = rangosDeSilencio(v);
  assert.equal(s.length, 2, `encontró ${s.length} silencios: ${JSON.stringify(s)}`);
  // Con 80 ms de margen a cada lado.
  assert.ok(Math.abs(s[0][0] - 1.08) < 0.03 && Math.abs(s[0][1] - 1.92) < 0.03, `primer silencio ${JSON.stringify(s[0])}`);
  assert.ok(Math.abs(s[1][0] - 4.08) < 0.03 && Math.abs(s[1][1] - 4.6) < 0.03, `cola ${JSON.stringify(s[1])}`);
  const quedan = tramosQueQuedan({ desde: 0, hasta: 4.6, silencios: s });
  assert.equal(quedan.length, 2);
  assert.ok(Math.abs(quedan[0][0] - 0) < 1e-9 && Math.abs(quedan[0][1] - 1.08) < 0.03);
  assert.ok(Math.abs(quedan[1][0] - 1.92) < 0.03 && Math.abs(quedan[1][1] - 4.08) < 0.03);
  assert.ok(Math.abs(segundosQuitados(s) - (0.84 + 0.52)) < 0.06);
});

test('una grabación BAJITA no es «toda silencio»: el umbral se adapta al clip', () => {
  // Voz a −46 dBFS (un teléfono lejos) con una pausa real adentro. Con el umbral
  // absoluto de −40 se borraría entero: el relativo lo salva.
  const m = new MedidorVentanas();
  m.agregar(trozo(0, 1.0, 0.005));
  m.agregar(trozo(1.0, 1.0, 0.0));
  m.agregar(trozo(2.0, 1.0, 0.005));
  const v = m.resultado();
  assert.ok(umbralEfectivo(v) < -60, `umbral ${umbralEfectivo(v)}`);
  const s = rangosDeSilencio(v);
  assert.equal(s.length, 1, `silencios: ${JSON.stringify(s)}`);
  const quedan = tramosQueQuedan({ desde: 0, hasta: 3, silencios: s });
  assert.equal(quedan.length, 2, 'borró la voz bajita como si fuera silencio');
});

test('todo silencio → no queda nada, y quien llama NO toca el clip', () => {
  const m = new MedidorVentanas();
  m.agregar(trozo(0, 2.0, 0.0));
  const s = rangosDeSilencio(m.resultado());
  // En los bordes del clip no hay margen que proteger: el silencio va de punta a punta.
  assert.deepEqual(s, [[0, 2]]);
  assert.equal(segundosQuitados(s), 2);
  assert.deepEqual(tramosQueQuedan({ desde: 0, hasta: 2, silencios: s }), [], 'quedó algo de un clip que es todo silencio');
});

test('sin silencios no se devuelve ningún tramo para cortar', () => {
  const m = new MedidorVentanas();
  m.agregar(trozo(0, 3.0, 0.3));
  assert.deepEqual(rangosDeSilencio(m.resultado()), []);
  assert.deepEqual(tramosQueQuedan({ desde: 0, hasta: 3, silencios: [] }), [[0, 3]]);
});

test('los silencios se recortan al tramo que suena y se ordenan', () => {
  // El clip empieza en el segundo 10 de la fuente y dura 5: un silencio que empieza
  // antes del recorte se clampea, y los que llegan desordenados igual salen bien.
  const quedan = tramosQueQuedan({ desde: 10, hasta: 15, silencios: [[13, 13.5], [9, 10.4], [16, 17]] });
  assert.deepEqual(quedan.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]), [[10.4, 13], [13.5, 15]]);
});

test('el medidor junta trozos seguidos sin inventar ventanas', () => {
  const m = new MedidorVentanas(0.02);
  m.agregar(trozo(0, 0.5, 0.2));
  m.agregar(trozo(0.5, 0.5, 0.2));
  const v = m.resultado();
  assert.equal(v.length, 50);
  assert.ok(v.every((x) => x.db > -20 && x.db < -10), 'un tono a 0,2 de amplitud ronda los −17 dBFS');
  assert.ok(Math.abs(v[25].t - 0.5) < 1e-9);
});

// ── De la fuente a la línea (audio/silencios-plan.ts) ─────────────────────────
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  silenciosEnLaLinea, cortesDelClip, esPiezaDeSilencio, recolocar, quedaAlgo, quedaAlgoEnLaLinea,
} from '../app/video-editor/_opencut/audio/silencios-plan';

const casi = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

test('los silencios de la FUENTE caen en la LÍNEA con el recorte y la velocidad del clip', () => {
  // El clip empieza en el segundo 10 de la línea, saltea 4 s de la fuente y va a 2×:
  // el silencio de la fuente [6, 8] es [1, 2] del clip, o sea [11, 12] de la línea.
  const clip = { inicio: 10, duracion: 5, trimStart: 4, retime: { rate: 2 } };
  const s = silenciosEnLaLinea(clip, [[6, 8]]);
  assert.equal(s.length, 1);
  assert.ok(casi(s[0][0], 11) && casi(s[0][1], 12), JSON.stringify(s));
  // Lo que cae fuera del clip se recorta y lo que no lo toca desaparece.
  assert.deepEqual(silenciosEnLaLinea(clip, [[0, 2], [30, 40]]), []);
});

test('un silencio pegado a un borde se estira hasta el borde: no deja astillas de aire', () => {
  const clip = { inicio: 0, duracion: 10, trimStart: 0 };
  const s = silenciosEnLaLinea(clip, [[0.03, 2], [8, 9.97]]);
  assert.deepEqual(s, [[0, 2], [8, 10]]);
  assert.deepEqual(cortesDelClip(clip, s), [2, 8], 'cortó en un borde del clip');
});

test('se divide sólo ADENTRO del clip y sin repetir cortes', () => {
  const clip = { inicio: 0, duracion: 10, trimStart: 0 };
  assert.deepEqual(cortesDelClip(clip, [[0, 2], [2, 3], [5, 6], [9, 10]]), [2, 3, 5, 6, 9]);
});

test('una pieza es silencio si su punto medio cae en un silencio', () => {
  const s: [number, number][] = [[2, 4]];
  assert.equal(esPiezaDeSilencio({ inicio: 2, fin: 4 }, s), true);
  assert.equal(esPiezaDeSilencio({ inicio: 0, fin: 2 }, s), false);
  assert.equal(esPiezaDeSilencio({ inicio: 4, fin: 7 }, s), false);
});

test('al recolocar, lo de ANTES queda quieto, las piezas se pegan y lo de DESPUÉS se corre', () => {
  // Pista: A [0,10) · el clip [10,20) partido en tres piezas que quedan · B [20,30).
  const lugares = recolocar({
    piezas: [{ id: 'p1', duracion: 2 }, { id: 'p2', duracion: 3 }, { id: 'p3', duracion: 1 }],
    otros: [{ id: 'A', inicioAntes: 0 }, { id: 'B', inicioAntes: 20 }],
    inicioOriginal: 10, finOriginal: 20, quitado: 4,
  });
  assert.deepEqual(Object.fromEntries(lugares), { p1: 10, p2: 12, p3: 15, A: 0, B: 16 });
});

test('el plan entero: lo que queda suma la duración menos lo quitado, sin huecos', () => {
  // Un clip de 12 s con silencios de 1 s en el 3 y en el 8 y una cola de 1,5 s.
  const clip = { inicio: 0, duracion: 12, trimStart: 0 };
  const s = silenciosEnLaLinea(clip, [[3, 4], [8, 9], [10.5, 12]]);
  const bordes = [clip.inicio, ...cortesDelClip(clip, s), clip.inicio + clip.duracion];
  const piezas = bordes.slice(1).map((fin, i) => ({ id: 'p' + i, inicio: bordes[i], fin }));
  const quedan = piezas.filter((p) => !esPiezaDeSilencio(p, s));
  const quitado = piezas.filter((p) => esPiezaDeSilencio(p, s)).reduce((t, p) => t + p.fin - p.inicio, 0);
  assert.ok(casi(quitado, 3.5), `quitó ${quitado}`);
  const lugares = recolocar({
    piezas: quedan.map((p) => ({ id: p.id, duracion: p.fin - p.inicio })),
    otros: [], inicioOriginal: 0, finOriginal: 12, quitado,
  });
  let cursor = 0;
  for (const p of quedan) {
    assert.ok(casi(lugares.get(p.id)!, cursor), `${p.id} quedó en ${lugares.get(p.id)} y no en ${cursor}`);
    cursor += p.fin - p.inicio;
  }
  assert.ok(casi(cursor, 12 - 3.5));
});

test('si casi no queda nada que oír, no se toca el clip', () => {
  assert.equal(quedaAlgo([[0, 0.04], [5.96, 6]]), false);
  assert.equal(quedaAlgo([[0, 0.5]]), true);
  const clip = { inicio: 0, duracion: 6, trimStart: 0 };
  assert.equal(quedaAlgoEnLaLinea(clip, [[0, 5.95]]), false);
  assert.equal(quedaAlgoEnLaLinea(clip, [[0, 4]]), true);
});

// ── El cableado: el botón llega al comando ────────────────────────────────────
const raiz = resolve(import.meta.dirname, '..', 'app', 'video-editor', '_opencut');
const fuente = (...p: string[]) => readFileSync(resolve(raiz, ...p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la acción existe, tiene handler y el botón de la barra la invoca', () => {
  assert.match(fuente('actions', 'definitions.ts'), /"borrar-silencios": \{\s*description: "Borrar silencios"/);
  assert.match(fuente('actions', 'use-editor-actions.ts'), /useActionHandler\(\s*"borrar-silencios",\s*\(\) => \{\s*void borrarSilencios\(editor\);/);
  const barra = fuente('timeline', 'components', 'herramientas-ce.tsx');
  const item = barra.slice(barra.indexOf('id: "linea-borrar-silencios"'), barra.indexOf('}', barra.indexOf('id: "linea-borrar-silencios"')));
  assert.ok(item.length > 20, 'no está el botón «Borrar silencios» en la barra');
  assert.match(item, /ejecutar: ejecutar\("borrar-silencios"\)/);
  assert.match(item, /habilitada: hayClipConAudio/);
});

test('el comando usa Dividir y Eliminar de la casa, y es UN solo comando (un Deshacer)', () => {
  const cmd = fuente('commands', 'timeline', 'element', 'borrar-silencios.ts');
  assert.match(cmd, /new SplitElementsCommand\(/);
  assert.match(cmd, /new DeleteElementsCommand\(/);
  assert.match(cmd, /if \(silencios\.length === 0 \|\| !quedaAlgoEnLaLinea\(clip, silencios\)\) return;/);
  const runner = fuente('audio', 'borrar-silencios.ts');
  assert.match(runner, /editor\.command\.execute\(\{ command \}\)/);
  assert.equal((runner.match(/editor\.command\.execute\(/g) || []).length, 1, 'más de un comando: serían varios Deshacer');
  assert.match(runner, /if \(!quedaAlgo\(tramosQueQuedan\(\{ desde, hasta, silencios \}\)\)\) \{/);
});
