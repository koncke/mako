// =============================================================================
// El debate: cuando el número lo pide el DUEÑO y el Perro tiene que poder decir que no
// =============================================================================
// El pedido, textual:
//
//   «Lo que nos quedó abierto es la funcionalidad de cambiar prioridad por el usuario. Que
//    eso también debería re-priorizar el resto. Y es por eso que el perro debe ser muy
//    estricto y debe tener la capacidad de rechazar una re-priorización si los argumentos
//    no son fuertes. Y claro que para eso tiene que hacer buenas preguntas.»
//
// Son tres cosas encadenadas y el orden manda: la cascada hace CARO aceptar, aceptar caro
// obliga a poder RECHAZAR, y rechazar bien obliga a PREGUNTAR. Lo que se testea acá son las
// dos capas deterministas — la que decide si el argumento alcanza (sin gastar un token) y la
// que reparte los números cuando alcanza.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { veredictoDe, fijarYDesempatar, mismoOrdenRelativo, noPisaManuales, respetaElReclamo, sinEmpates, type Puntuado } from '../app/plan/board/metodologia';
import { exigenciaDe, cumpleLaCarga, preguntaPorFaltante, huellaDePruebas, type Prueba } from '../lib/plan-prueba';

const P = (id: string, titulo: string, score: number): Puntuado => ({ id, titulo, score });
const pr = (clase: Prueba['clase'], ref: string, estado?: Prueba['estado']): Prueba => ({ clase, ref, etiqueta: ref, estado });

// ── El veredicto se DERIVA, no se lee ────────────────────────────────────────────────

test('veredictoDe — conceder todo es acepta, conceder una parte es ajusta', () => {
  assert.equal(veredictoDe(87, 32, 87), 'acepta');
  assert.equal(veredictoDe(87, 32, 60), 'ajusta');
});

test('veredictoDe — no moverse es rechazar, aunque el modelo diga otra cosa', () => {
  assert.equal(veredictoDe(87, 32, 32), 'rechaza');
});

test('veredictoDe — el bug que cerró: una BAJADA pedida y concedida no es un rechazo', () => {
  // `coerceVeredicto` hacía `subio ? 'acepta' : 'rechaza'` mirando solo el signo contra el
  // score actual, sin saber qué se había pedido. El dueño pedía bajar de 32 a 20, el Perro
  // se lo concedía, y la etiqueta salía 'rechaza' — con lo cual el guard de «un rechazo no
  // mueve el número» le descartaba la concesión. El Perro decía que sí y el tablero no.
  assert.equal(veredictoDe(20, 32, 20), 'acepta');
  assert.equal(veredictoDe(20, 32, 26), 'ajusta');
  assert.equal(veredictoDe(20, 32, 32), 'rechaza');
});

test('veredictoDe — moverlo al revés de lo pedido es un rechazo, nunca una aceptación', () => {
  assert.equal(veredictoDe(87, 32, 20), 'rechaza'); // pidió subir, bajó
  assert.equal(veredictoDe(20, 32, 87), 'rechaza'); // pidió bajar, subió
});

test('veredictoDe — pedir el número que ya tiene no es pedir nada', () => {
  assert.equal(veredictoDe(32, 32, 32), 'rechaza');
});

// ── La cascada: reservar antes de repartir ───────────────────────────────────────────

test('fijarYDesempatar — el fijado se queda con SU número y el que lo ocupaba baja', () => {
  const items = [P('a', 'A', 90), P('b', 'B', 87), P('c', 'C', 86), P('m', 'Mindset', 32)];
  const out = fijarYDesempatar(items, { m: 87 });
  assert.equal(out.m, 87, 'el fijado se queda con el número que pidió el dueño');
  assert.equal(out.a, 90, 'lo que está por encima del hueco no se toca');
  assert.equal(out.b, 86);
  assert.equal(out.c, 85);
});

test('fijarYDesempatar — nadie empata, que es la única falla dura de proyectos', () => {
  const items = Array.from({ length: 71 }, (_, i) => P(`p${i}`, `P${i}`, 100 - i)); // 100..30 saturado
  const out = fijarYDesempatar(items, { p70: 100 }); // el último al norte
  const vals = Object.values(out);
  assert.equal(new Set(vals).size, vals.length, 'no puede haber dos proyectos con el mismo número');
  assert.equal(out.p70, 100);
  assert.equal(sinEmpates(items.map((p) => ({ ...p, score: out[p.id] }))), null);
});

test('fijarYDesempatar — un score fijado a mano por otro debate tampoco se mueve', () => {
  const items = [P('a', 'A', 90), P('b', 'B', 89), P('c', 'C', 40)];
  const out = fijarYDesempatar(items, { c: 90, b: 89 });
  assert.equal(out.c, 90, 'el que se está debatiendo ahora');
  assert.equal(out.b, 89, 'el que se ganó su número en un debate anterior: intacto');
  assert.equal(out.a, 88, 'el que cede es el que no tiene candado');
});

test('fijarYDesempatar — dos fijados al mismo número se resuelven, no se duplican', () => {
  const out = fijarYDesempatar([P('a', 'A', 10), P('b', 'B', 10)], { a: 80, b: 80 });
  assert.notEqual(out.a, out.b);
  assert.deepEqual([out.a, out.b].sort((x, y) => y - x), [80, 79]);
});

// ── Las auditorías DURAS de la cascada ───────────────────────────────────────────────

test('mismoOrdenRelativo — correr a todos un punto NO reordena nada', () => {
  const antes = [P('a', 'A', 90), P('b', 'B', 87), P('c', 'C', 86), P('m', 'M', 32)];
  const out = fijarYDesempatar(antes, { m: 87 });
  assert.equal(mismoOrdenRelativo(antes, out, 'm'), null);
});

test('mismoOrdenRelativo — si dos que el dueño no tocó se cruzan, es falla DURA', () => {
  const antes = [P('a', 'A', 90), P('b', 'B', 80), P('m', 'M', 32)];
  const cruzado = { a: 70, b: 85, m: 87 }; // A y B se dieron vuelta sin que nadie lo pidiera
  const f = mismoOrdenRelativo(antes, cruzado, 'm');
  assert.ok(f);
  assert.equal(f.peso, 'dura');
  assert.deepEqual(f.ids.sort(), ['a', 'b']);
});

test('noPisaManuales — mover un candado «solo un punto» lo apaga igual de bien', () => {
  const antes = [P('a', 'A', 90), P('b', 'B', 80)];
  assert.equal(noPisaManuales(antes, { a: 90, b: 80 }, ['b']), null);
  const f = noPisaManuales(antes, { a: 90, b: 79 }, ['b']);
  assert.ok(f);
  assert.equal(f.peso, 'dura');
});

test('noPisaManuales — el que se está debatiendo AHORA sí se puede mover', () => {
  const antes = [P('b', 'B', 80)];
  assert.equal(noPisaManuales(antes, { b: 95 }, ['b'], 'b'), null);
});

test('respetaElReclamo — que el modelo se olvide justo del que se debatía es falla dura', () => {
  const f = respetaElReclamo({ id: 'm', scorePedido: 87, scoreActual: 32 }, { a: 90 });
  assert.ok(f);
  assert.equal(f.peso, 'dura');
});

test('respetaElReclamo — quedarse quieto es un rechazo válido, no una falla', () => {
  assert.equal(respetaElReclamo({ id: 'm', scorePedido: 87, scoreActual: 32 }, { m: 32 }), null);
});

test('respetaElReclamo — conceder al revés de lo pedido sí es una falla', () => {
  const f = respetaElReclamo({ id: 'm', scorePedido: 87, scoreActual: 32 }, { m: 20 });
  assert.ok(f);
  assert.equal(f.peso, 'dura');
});

// ── La carga de la prueba: el rechazo que no gasta un token ──────────────────────────

test('exigenciaDe — bajar algo no hay que probarlo', () => {
  const ex = exigenciaDe('proyecto', 80, 40, false);
  assert.equal(ex.nivel, 'baja');
  assert.equal(ex.minimo, 0);
  assert.ok(cumpleLaCarga(ex, []).ok, 'sin traer nada, ya se puede pedir');
});

test('exigenciaDe — bajar EL NORTE sí, porque alguien tiene que reemplazarlo', () => {
  const ex = exigenciaDe('proyecto', 98, 40, true);
  assert.equal(ex.nivel, 'baja-norte');
  assert.equal(cumpleLaCarga(ex, []).ok, false);
  assert.ok(cumpleLaCarga(ex, [pr('proyecto', 'p-cobros')]).ok);
});

test('exigenciaDe — pedir el norte cuesta DOS pruebas, y una es cuál deja de serlo', () => {
  const ex = exigenciaDe('proyecto', 32, 97, false);
  assert.equal(ex.nivel, 'norte');
  assert.equal(cumpleLaCarga(ex, [pr('cliente', 'lead-9')]).ok, false, 'un cliente solo no alcanza');
  assert.equal(cumpleLaCarga(ex, [pr('proyecto', 'p-1')]).ok, false, 'nombrar al que baja tampoco alcanza solo');
  assert.ok(cumpleLaCarga(ex, [pr('proyecto', 'p-1'), pr('cliente', 'lead-9')]).ok);
});

test('exigenciaDe — cruzar de banda para arriba pide UN hecho de afuera de la cabeza', () => {
  const ex = exigenciaDe('proyecto', 60, 80, false); // Media → Alta
  assert.equal(ex.nivel, 'sube-banda');
  assert.equal(cumpleLaCarga(ex, []).ok, false);
  assert.ok(cumpleLaCarga(ex, [pr('fecha', '2026-09-15')]).ok);
});

test('exigenciaDe — un ajuste fino dentro de la misma banda no pide nada', () => {
  assert.equal(exigenciaDe('proyecto', 60, 70, false).nivel, 'sube-dentro');
  assert.ok(cumpleLaCarga(exigenciaDe('proyecto', 60, 70, false), []).ok);
});

test('cumpleLaCarga — una prueba que la base no encontró NO cuenta', () => {
  // Si contara, la carga se cumpliría escribiendo cualquier cosa — que es exactamente el
  // «argumento fuerte» de mentira que todo esto viene a evitar.
  const ex = exigenciaDe('proyecto', 60, 80, false);
  const r = cumpleLaCarga(ex, [pr('cliente', 'lead-inventado', 'no-existe')]);
  assert.equal(r.ok, false);
  assert.match(r.detalle, /no se pudieron verificar/);
});

test('cumpleLaCarga — el detalle dice QUÉ falta, no solo que falta algo', () => {
  const r = cumpleLaCarga(exigenciaDe('proyecto', 32, 97, false), []);
  assert.equal(r.ok, false);
  assert.match(r.detalle, /un proyecto|una tarea/);
  assert.match(r.detalle, /un cliente/);
});

// ── Las preguntas que salen del código ───────────────────────────────────────────────

test('preguntaPorFaltante — «cuál deja de serlo» es una comparación de DOS opciones', () => {
  const q = preguntaPorFaltante(['proyecto', 'tarea'], { norteActual: 'Cobranza', segundo: 'Onboarding', enDebate: 'Mindset' });
  assert.ok(q);
  assert.equal(q.tipo, 'comparacion');
  assert.equal(q.opciones.length, 2, 'comparacion exige exactamente dos');
});

test('preguntaPorFaltante — con un solo candidato NO manda una comparación coja', () => {
  // El bug original de las preguntas del Perro fue justo este: un tipo que no cierra con
  // sus opciones. «¿Cuál es el deadline?» con botones del 1 al 5.
  const q = preguntaPorFaltante(['proyecto', 'tarea'], { norteActual: 'Cobranza', enDebate: 'Mindset' });
  assert.ok(q);
  assert.notEqual(q.tipo, 'comparacion');
});

test('preguntaPorFaltante — la fecha se pregunta como fecha, nunca como escala', () => {
  const q = preguntaPorFaltante(['fecha'], { enDebate: 'Mindset' });
  assert.equal(q?.tipo, 'fecha');
  assert.deepEqual(q?.opciones, []);
});

test('huellaDePruebas — no depende del orden en que se eligieron', () => {
  assert.equal(huellaDePruebas([pr('cliente', 'b'), pr('fecha', 'a')]), huellaDePruebas([pr('fecha', 'a'), pr('cliente', 'b')]));
});
