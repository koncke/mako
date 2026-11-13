// =============================================================================
// Los cursores de la Edición automática, DONDE aparece su cambio (12/11/2026)
// =============================================================================
// Martín, mirando la Edición automática: «Funciona bastante mal… mira fotograma por fotograma cómo lo hace… no tiene sentido
// esos cursores que están haciendo cosas sobre algo que ya está creado». En el reel de referencia (rama `referencias/reels-0911`,
// `edicion-mako.mp4`, mirado cuadro por cuadro) cada cursor está donde aparece lo que hace: el bloque nuevo del subtítulo, el
// corte, el B-roll; varios a la vez. Hasta ese día recorrían por turno lo que ya existía.
//
// Correr: node --import tsx --test tests/video-editor-enjambre-cambios.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cambiosEntre, useCambiosEnjambre, VIDA_CAMBIO_MS } from '../app/video-editor/_opencut/enjambre/cambios';
import { FAMILIA, repartoDeCambios, type CambioARepartir } from '../app/video-editor/_opencut/enjambre/cursores';
import { AGENTES, type AgenteId } from '../app/video-editor/_opencut/enjambre/plan';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TPS = 1000;
const el = (id: string, type: string, ini: number, dur: number, extra: Record<string, unknown> = {}) => ({ id, type, startTime: ini * TPS, duration: dur * TPS, trimStart: 0, trimEnd: 0, params: {}, ...extra });
const pistas = (main: unknown[], overlay: unknown[][] = []) => ({ main: { elements: main }, overlay: overlay.map((elements) => ({ elements })), audio: [] });

test('C1: un subtítulo, un B-roll o un plano NUEVOS son «aparece», en el orden del video', () => {
  const toma = el('t', 'video', 0, 30, { mediaId: 'toma' });
  const antes = pistas([toma]);
  const despues = pistas([toma], [[el('s2', 'text', 4, 2), el('s1', 'text', 0, 2)], [el('b', 'image', 10, 3, { mediaId: 'pexels-1' })]]);
  assert.deepEqual(cambiosEntre(antes, despues, TPS).map((c) => [c.tipo, c.id, c.en]), [['aparece', 's1', 0], ['aparece', 's2', 4], ['aparece', 'b', 10]]);
});

test('C2: borrar las pausas son CORTES (los pedazos del mismo archivo y lo que se sacó); lo que sólo se corrió no cuenta', () => {
  const p1 = el('p1', 'video', 0, 10, { mediaId: 'toma' });
  const sub = el('s', 'text', 20, 2);
  const antes = pistas([p1, el('p2', 'video', 10, 10, { mediaId: 'toma' })], [[sub]]);
  // p1 se achica (corte), aparece un pedazo nuevo del mismo archivo (corte), p2 se va (corte), y el subtítulo sólo se corre.
  const despues = pistas([{ ...p1, duration: 4 * TPS }, el('p3', 'video', 4, 3, { mediaId: 'toma' })], [[{ ...sub, startTime: 7 * TPS }]]);
  const c = cambiosEntre(antes, despues, TPS);
  assert.deepEqual(c.map((x) => [x.tipo, x.id, x.en]), [['corte', 'p1', 0], ['corte', 'p3', 4], ['corte', '', 10]]);
  assert.ok(!c.some((x) => x.id === 's'), 'el subtítulo que sólo se corrió no lo tocó nadie');
});

test('C3: el estilo o las palabras clave de un subtítulo son «cambia»; el mismo objeto, nada; con tope', () => {
  const s = el('s', 'text', 0, 2, { params: { fontSize: 5 } });
  assert.deepEqual(cambiosEntre(pistas([], [[s]]), pistas([], [[{ ...s, params: { fontSize: 6 } }]]), TPS).map((x) => x.tipo), ['cambia']);
  assert.deepEqual(cambiosEntre(pistas([], [[s]]), pistas([], [[s]]), TPS), []);
  const muchos = Array.from({ length: 300 }, (_, i) => el(`n${i}`, 'text', i, 1));
  assert.equal(cambiosEntre(pistas([]), pistas([], [muchos]), TPS, 50).length, 50);
});

test('C4: el store guarda cada cambio con el agente que trabajaba, y olvida lo viejo', () => {
  useCambiosEnjambre.getState().limpiar();
  useCambiosEnjambre.getState().sumar([{ tipo: 'aparece', id: 'a', en: 1, elemento: 'text' }], 'subs-01', 1_000);
  useCambiosEnjambre.getState().sumar([{ tipo: 'corte', id: 'b', en: 2, elemento: 'video' }], 'corte-01', 1_000 + VIDA_CAMBIO_MS + 1);
  assert.deepEqual(useCambiosEnjambre.getState().lista.map((c) => [c.agente, c.id]), [['corte-01', 'b']]);
  useCambiosEnjambre.getState().limpiar();
});

const tanda = (agente: AgenteId, n: number, t: number) =>
  Array.from({ length: n }, (_, i): CambioARepartir & { agente: AgenteId } => ({ id: `${agente}-${i}`, en: i, tipo: 'aparece', elemento: 'text', t, agente }));

test('C5: el que trabaja y los de su rol se reparten la tanda: cosas DISTINTAS a la vez, una por paseo', () => {
  const cambios = tanda('subs-01', 7, 0);
  const r0 = repartoDeCambios({ trabajando: 'subs-01', cambios, ahora: 0, paseoMs: 100 });
  assert.deepEqual([...r0].map(([a, c]) => [a, c.id]), [['subs-01', 'subs-01-0'], ['subs-02', 'subs-01-1'], ['subs-03', 'subs-01-2']]);
  const r1 = repartoDeCambios({ trabajando: 'subs-01', cambios, ahora: 150, paseoMs: 100 });
  assert.deepEqual([...r1].map(([a, c]) => [a, c.id]), [['subs-01', 'subs-01-3'], ['subs-02', 'subs-01-4'], ['subs-03', 'subs-01-5']]);
  // Al terminar, el que trabaja queda en el último; los ayudantes vuelven a su lugar.
  const fin = repartoDeCambios({ trabajando: 'subs-01', cambios, ahora: 1_000, paseoMs: 100 });
  assert.deepEqual([...fin].map(([a, c]) => [a, c.id]), [['subs-01', 'subs-01-6']]);
});

test('C6: sólo la ÚLTIMA tanda del que trabaja, y los ocupados no ayudan; sin cambios, nadie va a ningún lado', () => {
  const cambios = [...tanda('corte-01', 3, 0), ...tanda('corte-01', 2, 500), ...tanda('subs-01', 4, 600)];
  const r = repartoDeCambios({ trabajando: 'corte-01', cambios, ahora: 500, ocupados: ['corte-01', 'corte-02'], paseoMs: 100 });
  assert.deepEqual([...r].map(([a, c]) => [a, c.t, c.id]), [['corte-01', 500, 'corte-01-0']], 'corte-02 corre lo suyo: no ayuda; y la tanda vieja no vuelve');
  assert.equal(repartoDeCambios({ trabajando: 'mezcla-01', cambios, ahora: 0 }).size, 0);
  // Cada familia empieza por su agente y sólo tiene agentes que existen.
  for (const a of AGENTES) {
    assert.equal(FAMILIA[a.id][0], a.id);
    for (const x of FAMILIA[a.id]) assert.ok(AGENTES.some((y) => y.id === x), x);
  }
});

test('C7: el cableado: se escucha la línea de tiempo mientras trabajan, y el que no tiene nada que hacer espera en su panel', () => {
  const comp = sinComentarios(leer('app/video-editor/_opencut/enjambre/components/cursores.tsx'));
  assert.match(comp, /useCambiosEnjambre\.getState\(\)\.sumar\(cambiosEntre\(previo, ahora, TICKS_PER_SECOND\), quien\);/);
  assert.match(comp, /const soltarEscenas = editor\.scenes\.subscribe\(mirar\);/);
  assert.match(comp, /const soltarLinea = editor\.timeline\.subscribe\(mirar\);/);
  // Quieto en su panel: ya no recorre lo que existe (la vuelta del paseo para los que no trabajan se fue).
  assert.match(comp, /const p = enSuLugar\(a\.id\);\s*const opacidad = agentes\[a\.id\] === "esperando" \? 0\.55 : 0\.4;/);
  assert.doesNotMatch(comp, /vuelta: trabajando \? vuelta : paso/, 'los que no trabajan volvieron a recorrer lo que ya está');
  // La revisión sí recorre lo que ya está: revisar es eso.
  assert.match(comp, /a\.id === "qa-01" \? tareaDeAgente\(/);
  // Un cambio se busca por su elemento en la línea de tiempo; el estilo, en el recuadro del subtítulo del reproductor.
  assert.match(comp, /const \[caja\] = c\.id \? clipsPorId\(\[c\.id\]\) : \[\];/);
  assert.match(comp, /if \(esElQueTrabaja && agente === "subs-03" && c\.elemento === "text" && sub\)/);
});
