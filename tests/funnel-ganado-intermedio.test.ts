// LA ETAPA DE GANADO USADA COMO UN PASO DEL MEDIO (grupo Makito, MK-19, 27/10/2026). La renombraron «Calificado» y la usaban
// para los que pasaban el filtro: su clave sigue siendo `ganado`, así que cada lead que caía ahí quedaba como CLIENTE y como
// venta. El editor del funnel ahora lo marca como problema (avisa, no bloquea: «guardar nunca se bloquea»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemasDePipeline, nombreDePasoIntermedio, type Stage } from '../lib/pipeline';

const etapa = (key: string, label: string, kind: Stage['kind']): Stage => ({ key, label, kind, dot: '', tone: 'neutral' });
const delGanado = (ps: string[]) => ps.filter((p) => p.includes('es la etapa de Ganado'));

test('«Calificado» con etapas abiertas después: se marca, y dice qué pasa y qué viene después', () => {
  const p = problemasDePipeline([
    etapa('lead', 'Lead entrante', 'entrada'),
    etapa('agenda', 'Agenda R1', 'reunion'),
    etapa('ganado', 'Calificado', 'cierre'),
    etapa('st1', 'Tasación', 'reunion'),
  ]);
  const g = delGanado(p);
  assert.equal(g.length, 1, 'la etapa de Ganado usada como paso del medio no se marcó');
  assert.match(g[0], /«Calificado» es la etapa de Ganado: cada lead que pongas ahí cuenta como cliente y como venta, y después vienen «Tasación»/);
});

test('al final pero con nombre de paso, también; con nombre de venta, no', () => {
  const conNombre = (label: string) => delGanado(problemasDePipeline([
    etapa('lead', 'Lead entrante', 'entrada'), etapa('agenda', 'Agenda R1', 'reunion'), etapa('ganado', label, 'cierre'),
  ]));
  assert.equal(conNombre('Calificado').length, 1);
  assert.equal(conNombre('Agendado').length, 1);
  assert.deepEqual(conNombre('Ganado'), [], 'marcó un funnel bien armado');
  assert.deepEqual(conNombre('Venta cerrada'), []);
  assert.deepEqual(conNombre('Cliente calificado'), [], '«Cliente calificado» es una venta');
});

test('lo que viene después y está CERRADO (perdido) no cuenta como paso abierto', () => {
  const p = delGanado(problemasDePipeline([
    etapa('lead', 'Lead entrante', 'entrada'), etapa('ganado', 'Ganado', 'cierre'), etapa('perdido', 'Perdido', 'grupo'),
  ]));
  assert.deepEqual(p, []);
  assert.equal(nombreDePasoIntermedio('En revisión'), true, 'con tilde no lo reconoce');
  assert.equal(nombreDePasoIntermedio('Pagó'), false);
});
