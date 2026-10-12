// =============================================================================
// MaKo Mobile — /m/plan v2: las reglas puras del segmentado (app/m/plan/formato.ts)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · «Hoy» incluye las PRIORIDADES que vencen hoy (`PlanHoy.hoy` viene sin ellas, porque
//     Today pinta las dos listas juntas): sin esto, la tarea más importante del día no sale
//     en la pestaña «Hoy»;
//   · el plazo del riel, corto y contado contra la fecha del negocio;
//   · la fila que se completa no desaparece de golpe cuando el refresco ya no la manda;
//   · el color del proyecto va a un `style`: sólo un hex.
//
// Verificado ROMPIÉNDOLO (11/10/2026), cada rotura contra la base en verde, restaurando el
// archivo después de cada una: ver la tabla al final.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { colorProyecto, conEnTransito, listaHoy, plazoCorto } from '../app/m/plan/formato';

type It = { id: string; cuando: string; deadline: string | null };
const it = (id: string, cuando: string, deadline: string | null): It => ({ id, cuando, deadline });

test('listaHoy: suma las prioridades que vencen hoy, sin las de la semana ni repetidas', () => {
  const prio = [it('p1', 'hoy', '2026-10-11'), it('p2', 'semana', '2026-10-13'), it('p3', 'hoy', '2026-10-09')];
  const hoy = [it('h1', 'hoy', '2026-10-08'), it('h2', 'hoy', '2026-10-11'), it('p3', 'hoy', '2026-10-09')];
  const r = listaHoy(prio, hoy).map((x) => x.id);
  // Lo más vencido arriba; empatado el día, la prioridad antes que el resto.
  assert.deepEqual(r, ['h1', 'p3', 'p1', 'h2']);
});

test('listaHoy: sin fecha (un Quarter pasado) va al final', () => {
  const r = listaHoy([it('q', 'hoy', null)], [it('a', 'hoy', '2026-10-11')]).map((x) => x.id);
  assert.deepEqual(r, ['a', 'q']);
});

test('plazoCorto: el riel del prototipo, contado contra la fecha del negocio', () => {
  const hoy = '2026-10-11'; // domingo
  assert.equal(plazoCorto('2026-10-11', hoy), 'Hoy');
  assert.equal(plazoCorto('2026-10-12', hoy), 'Mañana');
  assert.equal(plazoCorto('2026-10-10', hoy), 'Ayer');
  assert.equal(plazoCorto('2026-10-14', hoy), 'Mié');
  assert.equal(plazoCorto('2026-10-17', hoy), 'Sáb');
  assert.equal(plazoCorto('2026-10-18', hoy), '18 oct');
  assert.equal(plazoCorto('2026-10-30', hoy), '30 oct');
  assert.equal(plazoCorto('2026-10-08', hoy), '8 oct');
  assert.equal(plazoCorto(null, hoy), null);
  assert.equal(plazoCorto('pronto', hoy), null);
});

test('conEnTransito: la fila que se va vuelve a su lugar aunque el server ya no la mande', () => {
  const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' }, d = { id: 'd' };
  // Se completó «b» (tenía arriba a «a») y el refresco ya no la trae.
  assert.deepEqual(conEnTransito([a, c, d], [{ item: b, antes: 'a' }]).map((x) => x.id), ['a', 'b', 'c', 'd']);
  // La primera de la lista vuelve arriba.
  assert.deepEqual(conEnTransito([c], [{ item: a, antes: null }]).map((x) => x.id), ['a', 'c']);
  // Dos seguidas, en el orden en que se tocaron.
  assert.deepEqual(conEnTransito([c], [{ item: a, antes: null }, { item: b, antes: 'a' }]).map((x) => x.id), ['a', 'b', 'c']);
  // Si el server todavía la manda, no se duplica.
  assert.deepEqual(conEnTransito([a, b], [{ item: b, antes: 'a' }]).map((x) => x.id), ['a', 'b']);
});

test('colorProyecto: sólo un hex llega al style; sin color, el punto va gris', () => {
  assert.equal(colorProyecto({ nombre: 'x', color: '#2F6FED' }), '#2F6FED');
  assert.equal(colorProyecto({ nombre: 'x', color: 'red;background:url(x)' }), null);
  assert.equal(colorProyecto({ nombre: 'x' }), null);
  assert.equal(colorProyecto(null), null);
});

// ── La tabla de roturas ─────────────────────────────────────────────────────────
// Base en verde: 5/5. Una rotura a la vez en formato.ts (scratchpad/plan/romper.cjs):
//
//  Qué se rompió                                                   fallan / pasan
//  listaHoy sin las prioridades (sólo PlanHoy.hoy)                       2 / 3
//  listaHoy con TODAS las prioridades (sin mirar cuando === hoy)         1 / 4
//  listaHoy con lo sin fecha arriba                                      1 / 4
//  listaHoy sin el filtro de repetidas                                   1 / 4
//  plazoCorto con el día de la semana hasta 7 días (dias <= 7)           1 / 4
//  conEnTransito poniendo la fila al final                               1 / 4
//  conEnTransito sin mirar si el server todavía la manda                 1 / 4
//  colorProyecto aceptando cualquier texto (no sólo un hex)              1 / 4
