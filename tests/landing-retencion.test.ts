// =============================================================================
// La retención de cada video de una landing, por minuto (ticket #74, Mauricio, 10/11/2026)
// =============================================================================
// Lo que cuida: el punto más lejano por PERSONA (no por evento), los segundos de PÁGINA afuera (`salio` trae los de la
// página, no los del video), cada video con su curva, el autoplay aparte, «sin medidos» = null y nunca una fila de
// ceros, y el período en UTC con `hasta` inclusive.
//
// Probado ROMPIÉNDOLO (10/11/2026), sobre 6 / 0: contar eventos en vez de personas → 3 / 3; dejar entrar `salio` → 4 / 2;
// mezclar los videos (sin agrupar por video_id) → 4 / 2; contar el autoplay como play → 5 / 1; devolver ceros sin
// medidos → 5 / 1; `hasta` exclusivo → 5 / 1. Restaurado, 6 / 0.
//
// Correr: node --import tsx --test tests/landing-retencion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curvaPorMinuto, periodoDeFechas, retencionPorVideo, type EventoRetencion } from '../lib/landing-retencion';

const V = 'vid-sprint';
const ev = (visitor_id: string, tipo_evento: string, segundos: number | null, extra: Partial<EventoRetencion> = {}): EventoRetencion => ({
  visitor_id, video_id: V, vsl_titulo: 'Presentación del Sprint', tipo_evento, porcentaje: null, segundos, ...extra,
});

// Un video de 4 minutos (240 s). La duración la estima `duracionesDeEventos` con los pNN que traen segundos.
const eventos: EventoRetencion[] = [
  // a: le dio play y lo vio entero (varios eventos: cuenta UNA vez, por su punto más lejano).
  ev('a', 'play', 0), ev('a', 's30', 30), ev('a', 'p50', 120, { porcentaje: 50 }), ev('a', 'fin', null), ev('a', 'exit', 240, { porcentaje: 100 }),
  // b: le dio play y se fue en el minuto 2.
  ev('b', 'play', 0), ev('b', 'pausa', 95), ev('b', 'exit', 130),
  // c: arrancó solo (autoplay) y se fue a los 8 s. Su `salio` trae segundos de PÁGINA (300): no es video.
  ev('c', 'play', 0, { auto: true }), ev('c', 's8', 8), ev('c', 'salio', 300, { video_id: V }),
  // d: arrancó solo y no dejó avance: arrancó, pero no está medido.
  ev('d', 'play', 0, { auto: true }),
  // e: otro video de la misma página, 12 s: no entra en la curva del VSL.
  { visitor_id: 'e', video_id: 'v:conference', vsl_titulo: 'Conferencia', tipo_evento: 'exit', porcentaje: 100, segundos: 12 },
  // sin visitor_id: no hay a quién deduplicar.
  ev('', 'exit', 200),
];

test('la curva por minuto cuenta personas por su punto más lejano, sin los segundos de la página', () => {
  const [vsl, otro] = retencionPorVideo(eventos);
  assert.equal(vsl.video_id, V);
  assert.equal(vsl.titulo, 'Presentación del Sprint');
  assert.equal(vsl.duracion_segundos, 240);
  assert.equal(vsl.todos.arrancaron, 4, 'a, b, c y d: personas, no eventos');
  assert.equal(vsl.todos.medidos, 3, 'd no dejó avance');
  assert.deepEqual(vsl.todos.por_minuto?.map((m) => [m.minuto, m.personas]), [[0, 3], [1, 2], [2, 2], [3, 1], [4, 1]]);
  assert.equal(vsl.todos.por_minuto?.[1].porcentaje, 66.7);
  // Cada video con su curva: la conferencia no se mezcla.
  assert.equal(otro.video_id, 'v:conference');
  assert.equal(otro.todos.arrancaron, 1);
});

test('el autoplay va aparte: «dieron_play» son los que le dieron play ellos', () => {
  const [vsl] = retencionPorVideo(eventos);
  assert.equal(vsl.dieron_play.arrancaron, 2, 'a y b');
  assert.equal(vsl.dieron_play.medidos, 2);
  assert.deepEqual(vsl.dieron_play.por_minuto?.map((m) => m.porcentaje), [100, 100, 100, 50, 50]);
  assert.equal(vsl.solo_autoplay, 2, 'c y d sólo arrancaron solos');
});

test('los cortes de 5 % son los del VSL Analyst', () => {
  const [vsl] = retencionPorVideo(eventos);
  const p = vsl.todos.por_porcentaje ?? [];
  assert.equal(p.length, 20);
  assert.deepEqual(p.find((x) => x.corte === 50), { corte: 50, personas: 2, porcentaje: 66.7 });
  assert.deepEqual(p.find((x) => x.corte === 100), { corte: 100, personas: 1, porcentaje: 33.3 });
});

test('sin nadie con avance medido no hay curva: null, nunca una fila de ceros', () => {
  const c = curvaPorMinuto([null, null], 240);
  assert.deepEqual(c, { arrancaron: 2, medidos: 0, por_minuto: null, por_porcentaje: null });
  const [solo] = retencionPorVideo([ev('x', 'play', 0, { auto: true })]);
  assert.equal(solo.todos.por_minuto, null);
});

test('el período: desde y hasta inclusive, en UTC; si no, los días hacia atrás', () => {
  const ahora = Date.parse('2026-11-10T22:00:00Z');
  assert.deepEqual(periodoDeFechas({ desde: '2026-11-01', hasta: '2026-11-10' }, ahora), { desde: '2026-11-01T00:00:00.000Z', hasta: '2026-11-11T00:00:00.000Z' });
  assert.deepEqual(periodoDeFechas({ dias: 7 }, ahora), { desde: '2026-11-03T22:00:00.000Z', hasta: '2026-11-10T22:01:00.000Z' });
  assert.equal((periodoDeFechas({}, ahora) as { desde: string }).desde, '2026-10-11T22:00:00.000Z');
  assert.match((periodoDeFechas({ desde: '1/11/2026' }, ahora) as { error: string }).error, /YYYY-MM-DD/);
  assert.match((periodoDeFechas({ desde: '2026-11-10', hasta: '2026-11-01' }, ahora) as { error: string }).error, /anterior/);
});

test('el final del video se cuenta con medio segundo de gracia', () => {
  const c = curvaPorMinuto([239.7, 120], 240);
  assert.deepEqual(c.por_minuto?.at(-1), { minuto: 4, segundo: 240, personas: 1, porcentaje: 50 });
});
