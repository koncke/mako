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
//
// CON RUIDO DE FONDO (28/10/2026, decisión del Cerebro): las pausas se buscan en el audio SIN RUIDO
// (dsp/silencios-sin-ruido.ts, la cadena RNNoise de «Reducir el ruido») con el MISMO umbral, y se corta el
// original. Medido con la voz del sistema (29 s, 12 pausas, en el scratchpad): con ruido rosa a 20, 15 y
// 10 dB de la voz, hoy 0 pausas → las 12, con los bordes a ≤ 20 ms; con ventilador a 15 y 10 dB, 11 de 12
// (la que falta dura 0,42 s, al límite del mínimo de 0,4: el error es dejar una pausa, nunca cortar voz);
// la voz limpia que queda adentro de un corte, ≤ −57 dBFS, igual que sin ruido; voz limpia: idéntico a hoy.
// Las roturas, al final del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MedidorVentanas, PAUSA_MIN_S, rangosDeSilencio, tramosQueQuedan, umbralEfectivo, segundosQuitados,
} from '../app/video-editor/_opencut/audio/dsp/silencios';
import { JuntadorDeTrozos, silenciosSinRuido } from '../app/video-editor/_opencut/audio/dsp/silencios-sin-ruido';
import { clipsConSonido } from '../app/video-editor/_opencut/audio/silencios-aviso';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';
import { instanciarRnnoise, URL_WASM_RNNOISE, type MotorRnnoise } from '../app/video-editor/_opencut/audio/dsp/rnnoise';
import { reductorEnEsteHilo } from '../app/video-editor/_opencut/audio/ruido-hilo/cliente';
import { TRAMOS, db, mezclar, rosa, ventilador, voz } from './_voz-y-ruido';

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

// ── Con ruido de fondo: las pausas se buscan en el audio SIN RUIDO (28/10/2026) ──────────────────

const motorCargado: { m: Promise<MotorRnnoise> | null } = { m: null };
const motor = () => (motorCargado.m ??= instanciarRnnoise(readFileSync(resolve(import.meta.dirname, '..', 'public', URL_WASM_RNNOISE.slice(1)))));
const hoy = (x: Float32Array) => {
  const m = new MedidorVentanas();
  m.agregar({ canales: [x], sampleRate: SR, inicio: 0 });
  return rangosDeSilencio(m.resultado());
};
// La cuenta en este hilo: el worker del navegador (audio/ruido-hilo/) da lo mismo byte a byte (tests/video-editor-ruido-hilo.test.ts).
const sinRuido = async (x: Float32Array) => silenciosSinRuido({ audio: { canales: [x], sampleRate: SR, inicio: 0 }, reducir: reductorEnEsteHilo(motor) });
/** El nivel más alto de la voz LIMPIA (ventanas de 20 ms) adentro de lo que se corta. */
const vozCortada = (limpia: Float32Array, cortes: [number, number][]) => {
  const w = Math.round(0.02 * SR);
  let max = -300;
  for (const [a, b] of cortes) for (let i = Math.round(a * SR); i + w <= Math.round(b * SR); i += w / 2) max = Math.max(max, db(limpia, i, i + w));
  return max;
};

test('CON RUIDO DE FONDO: hoy no encuentra ninguna pausa; en el audio sin ruido, las mismas que en el limpio (±50 ms)', async () => {
  const limpia = voz(SR, TRAMOS);
  const ref = hoy(limpia);
  assert.equal(ref.length, TRAMOS.length + 1, 'la voz sintética tiene sus pausas: antes, entre los tramos y al final');
  // Ruido rosa a 20, 15 y 10 dB de la voz: las MISMAS pausas, con los bordes a ±50 ms.
  for (const debajo of [20, 15, 10]) {
    const sucia = mezclar(limpia, rosa(limpia.length, 61), debajo);
    assert.equal(hoy(sucia).length, 0, `rosa a ${debajo} dB: el problema medido, sobre el original no hay pausas`);
    const n = await sinRuido(sucia);
    assert.equal(n.length, ref.length, `rosa a ${debajo} dB: ${n.length} pausas de ${ref.length}`);
    ref.forEach(([a, b], i) => {
      const [x, y] = n[i];
      assert.ok(Math.abs(x - a) <= 0.05 && Math.abs(y - b) <= 0.05, `rosa a ${debajo} dB, pausa ${i + 1}: ${x.toFixed(2)}–${y.toFixed(2)} contra ${a.toFixed(2)}–${b.toFixed(2)}`);
    });
    assert.ok(vozCortada(limpia, n) <= -60, `rosa a ${debajo} dB: se corta voz a ${vozCortada(limpia, n).toFixed(1)} dBFS`);
  }
  // Un ventilador fuerte (zumbido + soplido) puede ACHICAR una pausa (con 10 dB, una arranca 180 ms tarde): el error
  // tiene que ser siempre ése. Ningún corte fuera de una pausa del limpio, como mucho una que falte, y nada de voz.
  for (const debajo of [20, 15, 10]) {
    const n = await sinRuido(mezclar(limpia, ventilador(limpia.length, SR, 62), debajo));
    assert.ok(n.length >= ref.length - 1, `ventilador a ${debajo} dB: ${n.length} pausas de ${ref.length}`);
    for (const [x, y] of n) {
      assert.ok(ref.some(([a, b]) => x >= a - 0.05 && y <= b + 0.05), `ventilador a ${debajo} dB: el corte ${x.toFixed(2)}–${y.toFixed(2)} sale de las pausas del limpio`);
    }
    assert.ok(vozCortada(limpia, n) <= -60, `ventilador a ${debajo} dB: se corta voz a ${vozCortada(limpia, n).toFixed(1)} dBFS`);
  }
});

test('CON VOZ LIMPIA: lo mismo que hoy, con las pausas en cero digital y con el piso de un micrófono', async () => {
  const limpia = voz(SR, TRAMOS);
  assert.deepEqual(await sinRuido(limpia), hoy(limpia));
  const grabada = mezclar(limpia, rosa(limpia.length, 63), 70);
  assert.deepEqual(await sinRuido(grabada), hoy(grabada));
});

test('el juntador pone cada trozo en su lugar de la fuente: un hueco queda en silencio y un solape no se duplica', () => {
  const j = new JuntadorDeTrozos();
  const uno = (n: number, v: number) => new Float32Array(n).fill(v);
  j.agregar({ canales: [uno(480, 0.1)], sampleRate: SR, inicio: 2 });
  j.agregar({ canales: [uno(480, 0.2)], sampleRate: SR, inicio: 2 + 960 / SR }); // un hueco de 480
  j.agregar({ canales: [uno(240, 0.3), uno(240, 0.4)], sampleRate: SR, inicio: 2 + 1200 / SR }); // pisa la mitad del anterior
  const r = j.resultado()!;
  assert.equal(r.inicio, 2);
  assert.equal(r.canales.length, 2, 'los canales del trozo que más tiene');
  assert.equal(r.canales[0].length, 1440);
  assert.deepEqual([r.canales[0][0], r.canales[0][600], r.canales[0][1000], r.canales[0][1300]].map((x) => Math.round(x * 10) / 10), [0.1, 0, 0.2, 0.3]);
  assert.equal(Math.round(r.canales[1][0] * 10) / 10, 0.1, 'un trozo mono llena los dos canales');
  assert.equal(new JuntadorDeTrozos().resultado(), null);
});

test('el cableado: el botón y el chat buscan las pausas en el audio sin ruido, y cortan el original', () => {
  const runner = fuente('audio', 'borrar-silencios.ts');
  // Con la pausa mínima del pedido (ticket 31); el botón, sin ella, usa la de siempre. Y la red, en el worker (10/11/2026).
  assert.match(runner, /const silencios = await silenciosSinRuido\(\{ audio, reducir, opciones: \{ minSilencioS: minimoS \} \}\);/);
  assert.match(runner, /const reducir = reducirRuidoEnSegundoPlano;/, 'Borrar silencios volvió a correr la red en el hilo de la pantalla');
  assert.match(runner, /minimoS = PAUSA_MIN_S,/);
  assert.doesNotMatch(runner, /rangosDeSilencio\(/, 'quedó una búsqueda sobre el original');
  assert.match(runner, /alTrozo: \(trozo\) => juntador\.agregar\(trozo\)/);
  // Sin bajar el umbral: la búsqueda nueva usa el de siempre (rangosDeSilencio, con sus defaults).
  assert.match(fuente('audio', 'dsp', 'silencios-sin-ruido.ts'), /return rangosDeSilencio\(medidor\.resultado\(\), opciones\);/);
});

test('la pausa mínima (ticket 31): la de siempre es 0,4 s, y pidiendo 0,2 se saca la pausa corta que con 0,4 se deja', () => {
  assert.deepEqual(rangosDeSilencio(clipDePrueba(), { minSilencioS: PAUSA_MIN_S }), rangosDeSilencio(clipDePrueba()), 'PAUSA_MIN_S no es la de siempre');
  // Voz · una pausa de 300 ms · voz.
  const m = new MedidorVentanas();
  m.agregar(trozo(0, 1.0, 0.25));
  m.agregar(trozo(1.0, 0.3, 0.0));
  m.agregar(trozo(1.3, 1.0, 0.25));
  const v = m.resultado();
  assert.deepEqual(rangosDeSilencio(v), [], 'con 0,4 s la pausa de 300 ms se deja');
  const cortas = rangosDeSilencio(v, { minSilencioS: 0.2 });
  assert.equal(cortas.length, 1, 'pidiendo 0,2 s la pausa de 300 ms no apareció');
  assert.ok(cortas[0][0] > 1 && cortas[0][1] < 1.3, `la pausa corta cae en ${cortas[0].join('–')}, fuera de 1,0–1,3 s`);
});

test('el botón dice DÓNDE buscó cuando no hay pausas (ticket 31): sin nada elegido, sólo el clip bajo el cabezal', () => {
  const runner = fuente('audio', 'borrar-silencios.ts');
  assert.doesNotMatch(runner, /toast\("Sin silencios"\)/, 'volvió el «Sin silencios» que no dice dónde buscó');
  assert.match(runner, /const aviso = avisoBotonSinSilencios\(r, \(tracks \? clipsConSonido\(tracks\) : 0\) > r\.clips\);\s*toast\(aviso\.titulo, \{ description: aviso\.descripcion/);
  // Las pistas son un OBJETO (overlay, main, audio): contadas como lista, el aviso se rompía justo sin pausas (lo vio el tsc).
  const escena = {
    overlay: [{ elements: [{ type: 'text' }, { type: 'video' }] }],
    main: { elements: [{ type: 'video' }, { type: 'image' }, { type: 'video' }] },
    audio: [{ elements: [{ type: 'audio' }] }, { elements: [] }],
  } as unknown as SceneTracks;
  assert.equal(clipsConSonido(escena), 4, 'los clips con sonido de las tres clases de pista');
  // Lo que se escuchó: sólo los clips con audio, con lo que duran en la línea.
  assert.match(runner, /escuchados\+\+;\s*segundosEscuchados \+= duracion;/);
  assert.match(runner, /motivo: "sin-silencios", clips: escuchados,[\s\S]*?segundos: segundosEscuchados, minimoS \}/);
});

// Roturas (28/10/2026, base 19/0), cada una sola y restaurada con su copia:
// · S1 sin sacar el ruido (las pausas sobre el original) → 18/1 (CON RUIDO DE FONDO).
// · S2 el juntador pega los trozos uno tras otro, sin su tiempo → 18/1 (el juntador).
// · S3 el botón y el chat vuelven a medir el original → 18/1 (el cableado).
// · S4 el umbral bajado (−30 dBFS, 15 dB bajo el p95) → 17/2 (CON VOZ LIMPIA y el cableado).
//
// Roturas del ticket 31 (29/10/2026, base 21/0), cada una sola y restaurada con su copia:
// · R8 la búsqueda sin la pausa pedida (silenciosSinRuido sin opciones) → 20/1 (el cableado).
// · R9 el botón vuelve a «Sin silencios» → 20/1 (el botón dice DÓNDE buscó).
// · R10 la pausa de siempre cambia a 0,3 → 20/1 (la pausa mínima).
// · R12 la cuenta de clips sin la pista principal → 20/1 (el botón dice DÓNDE buscó). La versión que trataba las pistas
//   como una lista no la vio ningún test (leían el fuente): la vio el tsc acotado. Por eso la cuenta es una función pura.
//
// Rotura del worker (10/11/2026, base 21/0): «Borrar silencios» vuelve a la cuenta en la pantalla
// (`reductorEnEsteHilo(motorRnnoise)`) → 20/1 (el cableado). Lo demás del worker, en tests/video-editor-ruido-hilo.test.ts.
