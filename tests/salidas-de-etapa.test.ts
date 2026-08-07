// Tests de `salidasDeEtapa` / `etapaNoShowDe` (lib/pipeline.ts): los desenlaces
// que el form "¿Qué hacer ahora?" le ofrece al usuario.
//
// Blindan las DOS quejas del dueño que eran bugs de datos, no de layout:
//   · elegir "se perdió" escribía `asistio_j1 = true` en silencio, porque la
//     transición del funnel lo trae en true y se copiaba tal cual;
//   · "no asistió" ofrecía una lista donde la única respuesta correcta (la
//     nutrición No Show) estaba filtrada.
// Correr: npm test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  salidasDeEtapa, etapaNoShowDe, generateFunnel, DEFAULT_PIPELINE, DEFAULT_TRANSITIONS, DEFAULT_STAGES,
  type Stage, type FunnelTransition,
} from '../lib/pipeline';
import { motivosDeSalida, pideMotivo } from '../app/crm/motivos-salida';

const { stages, transitions } = generateFunnel(DEFAULT_PIPELINE);
const keys = (o: Array<{ to: string }>) => o.map((x) => x.to);

test('asistió: nunca se ofrece la nutrición de No Show', () => {
  const o = salidasDeEtapa(stages, transitions, 'agenda', { asistio: true, cual: 'r1' });
  assert.ok(!keys(o).includes('noshow_r1'), 'no-show contradice el hecho declarado');
  assert.ok(keys(o).includes('agendaj2'));
  assert.ok(keys(o).includes('perdido'));
});

test('asistió: el flag viaja en true por respuesta del humano, no por la transición', () => {
  const o = salidasDeEtapa(stages, transitions, 'agenda', { asistio: true, cual: 'r1' });
  for (const x of o) assert.equal(x.asistioJ1, true, `${x.to} debería llevar asistioJ1:true`);
});

test('NO asistió: perder el lead NO puede escribir "asistió"', () => {
  // Es el bug de fondo: `agenda → perdido` viene con asistioJ1:true en el funnel
  // generado (asist(p.key, true)) y se persistía sin preguntar.
  const trPerdido = transitions.find((t) => t.from === 'agenda' && t.to === 'perdido');
  assert.equal(trPerdido?.asistioJ1, true, 'el funnel efectivamente dice true');

  const o = salidasDeEtapa(stages, transitions, 'agenda', { asistio: false, cual: 'r1' });
  const perdido = o.find((x) => x.to === 'perdido');
  assert.ok(perdido, 'perder sigue siendo una salida posible tras un no-show');
  assert.equal(perdido.asistioJ1, false, 'el hecho declarado gana sobre el funnel');
});

test('NO asistió: no se ofrece avanzar', () => {
  const o = salidasDeEtapa(stages, transitions, 'agenda', { asistio: false, cual: 'r1' });
  assert.ok(!keys(o).includes('agendaj2'));
});

test('la etapa de No Show se DEDUCE, y con la key del funnel de cada quien', () => {
  // Funnel generado: noshow_r1 / noshow_r2. Grafo default legacy: 'noshow'.
  assert.equal(etapaNoShowDe(stages, transitions, 'agenda', 'r1'), 'noshow_r1');
  assert.equal(etapaNoShowDe(stages, transitions, 'agendaj2', 'r2'), 'noshow_r2');
  assert.equal(etapaNoShowDe(DEFAULT_STAGES, DEFAULT_TRANSITIONS, 'agenda', 'r1'), 'noshow');
  assert.equal(etapaNoShowDe(DEFAULT_STAGES, DEFAULT_TRANSITIONS, 'agendaj2', 'r2'), 'noshow');
});

test('la R2 mira asistioJ2, no asistioJ1', () => {
  const o = salidasDeEtapa(stages, transitions, 'agendaj2', { asistio: false, cual: 'r2' });
  const perdido = o.find((x) => x.to === 'perdido');
  assert.equal(perdido?.asistioJ2, false);
  assert.equal(perdido?.asistioJ1, undefined, 'no se toca la asistencia de la otra reunión');
  assert.ok(!keys(o).includes('facturando'));
});

test('orden: avanza → nutrición → pérdida (los negativos SIEMPRE al final)', () => {
  const o = salidasDeEtapa(stages, transitions, 'agendaj2', { asistio: true, cual: 'r2' });
  const cats = o.map((x) => x.category);
  const rank = { avanza: 0, nutricion: 1, perdida: 2 } as const;
  for (let i = 1; i < cats.length; i++) {
    assert.ok(rank[cats[i]] >= rank[cats[i - 1]], `desordenado en ${i}: ${cats.join(',')}`);
  }
  assert.equal(cats[0], 'avanza');
  assert.equal(cats[cats.length - 1], 'perdida');
});

test('el título es la ETAPA y el subtítulo la transición', () => {
  // En el funnel generado el label de avance es literalmente "Avanza": inútil
  // como título de un botón, y era lo que se pintaba antes.
  const o = salidasDeEtapa(stages, transitions, 'agenda', { asistio: true, cual: 'r1' });
  const r2 = o.find((x) => x.to === 'agendaj2');
  assert.equal(r2?.label, 'Agenda R2');
  assert.equal(r2?.sub, 'Avanza');
});

test('la nutrición automática no se ofrece como decisión humana', () => {
  const auto: FunnelTransition[] = [
    { from: 'agenda', to: 'nutridiaria', label: 'Nutrición diaria', category: 'nutricion', auto: true },
    { from: 'agenda', to: 'perdido', label: 'Se perdió', category: 'perdida' },
  ];
  assert.deepEqual(keys(salidasDeEtapa(stages, auto, 'agenda')), ['perdido']);
});

test('nunca devuelve vacío: sin transiciones cae al layout', () => {
  // Es el caso VIVO de 'manual': generateFunnel la coloca como catch-all pero no
  // le crea ni una arista saliente. Sin fallback, la pantalla quedaba muerta.
  assert.deepEqual(transitions.filter((t) => t.from === 'manual'), [], 'manual no tiene salidas en el funnel generado');
  const o = salidasDeEtapa(stages, transitions, 'manual');
  assert.ok(o.length > 0);
  assert.ok(keys(o).includes('agendaj2'), 'se puede volver al pipeline');
  assert.ok(keys(o).includes('perdido'), 'y se puede cerrar');
  assert.ok(!keys(o).includes('lead'), 'nunca al formulario de entrada');
  assert.ok(!keys(o).includes('manual'), 'nunca a donde ya está');
});

test('el fallback desde el pipeline solo mira hacia adelante', () => {
  const sinAristas: FunnelTransition[] = [];
  const o = salidasDeEtapa(stages, sinAristas, 'agendaj2');
  assert.ok(!keys(o).includes('agenda'), 'no se retrocede');
  assert.ok(keys(o).includes('facturando'));
  assert.ok(keys(o).includes('ganado'));
});

test('un destino que el tablero no conoce se descarta en vez de inventar una etapa', () => {
  // Con stageMeta (y no stageMetaOpt) esto caería en stages[0] y el resumen
  // prometería mover el lead a la primera etapa del tablero.
  const fantasma: FunnelTransition[] = [
    { from: 'agenda', to: 'etapa_que_no_existe_en_ningun_lado', label: 'X', category: 'avanza' },
    { from: 'agenda', to: 'perdido', label: 'Se perdió', category: 'perdida' },
  ];
  const soloReales: Stage[] = stages;
  assert.deepEqual(keys(salidasDeEtapa(soloReales, fantasma, 'agenda')), ['perdido']);
});

test('sin hecho declarado no se toca ninguna asistencia', () => {
  // Rama de la nutrición manual: el lead no viene de una reunión, así que copiar
  // los flags del funnel repetiría el bug desde otro pendiente.
  for (const o of salidasDeEtapa(stages, transitions, 'manual')) {
    assert.equal(o.asistioJ1, undefined);
    assert.equal(o.asistioJ2, undefined);
  }
});

// ── Cambiar de destino no puede arrastrar la respuesta anterior ──────────────
// El wizard resetea motivo/calificado al elegir otro destino (elegirQhEtapa).
// Este test blinda POR QUÉ hace falta: las dos listas de categorías son
// disjuntas, así que una categoría heredada de la otra pérdida no se ve
// seleccionada en pantalla y aun así se guardaría en el lead.
test('perder y descalificar no comparten ni una categoría de motivo', () => {
  const perdido = new Set(motivosDeSalida('perdido').filter((m) => m !== 'Otro'));
  const descal = motivosDeSalida('descal').filter((m) => m !== 'Otro');
  for (const m of descal) assert.ok(!perdido.has(m), `"${m}" está en las dos listas`);
});

test('el motivo se exige por DESTINO, y la nutrición de No Show no lo pide', () => {
  // La rama de no-show manda a una etapa de nutrición: ahí no hay motivo que
  // registrar. Pero si el funnel de un workspace no modela el No Show y el
  // usuario elige Perdido en la pantalla de excepción, sí.
  assert.equal(pideMotivo('noshow_r1'), false);
  assert.equal(pideMotivo('noshow'), false);
  assert.equal(pideMotivo('perdido'), true);
  assert.equal(pideMotivo('descal'), true);
  assert.equal(pideMotivo('noresp'), false, 'No responde no pide motivo server-side');
});

// El dueño: "también debes poner los casos de que se ganó directamente o
// facturando". El funnel solo modela el camino de a un paso (agenda → agendaj2 →
// facturando), así que cerrar EN la R1 no se podía elegir y había que mover el
// lead dos veces inventando una R2 que nunca existió.
test('cerró en la R1: se ofrecen las etapas de cierre salteando la R2', () => {
  const r = salidasDeEtapa(DEFAULT_STAGES, DEFAULT_TRANSITIONS, 'agenda', { asistio: true, cual: 'r1' });
  const keys = r.map((o) => o.to);
  assert.ok(keys.includes('agendaj2'), 'el camino normal sigue estando');
  assert.ok(keys.includes('facturando'), 'cerró y pasa a facturar, sin R2');
  assert.ok(keys.includes('ganado'), 'cerró y pagó en la misma reunión');
  // Van agrupadas con los avances, antes de las negativas.
  assert.equal(r.find((o) => o.to === 'ganado')?.category, 'avanza');
});

test('sin asistencia NO se puede cerrar una venta', () => {
  // No se cierra un trato en una reunión que nadie tuvo: si el destino apareciera,
  // el lead quedaría en Ganado con `asistio_j1 = false`.
  const keys = salidasDeEtapa(DEFAULT_STAGES, DEFAULT_TRANSITIONS, 'agenda', { asistio: false, cual: 'r1' }).map((o) => o.to);
  assert.ok(!keys.includes('ganado'));
  assert.ok(!keys.includes('facturando'));
});

test('desde la R2 las etapas de cierre no se duplican', () => {
  // 'facturando' y 'ganado' ya tienen transición propia desde agendaj2: el agregado
  // de cierre directo no puede volver a empujarlas con otro sub.
  const r = salidasDeEtapa(DEFAULT_STAGES, DEFAULT_TRANSITIONS, 'agendaj2', { asistio: true, cual: 'r2' });
  for (const k of ['facturando', 'ganado']) {
    assert.equal(r.filter((o) => o.to === k).length, 1, `${k} aparece una sola vez`);
  }
});
