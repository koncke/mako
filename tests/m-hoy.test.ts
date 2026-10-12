// Today v2 (app/m/hoy/modelo.ts): qué entra en «Para hoy», la tarjeta de lo que bloquea y
// la fila del trimestre. El plazo corto y el color del proyecto son los de /m/plan
// (app/m/plan/formato.ts) y los fija tests/m-plan.test.ts: aquí no se vuelven a probar.
//
// Verificado ROMPIENDO cada cosa que persigue (11/10/2026), con la base en 0 fallos:
//   · `paraHoy` sin el relleno de prioridades (un plan sin fechas deja la sección vacía): 3 fallos.
//   · `paraHoy` sobre `p.hoy` solo, sin `listaHoy` (la prioridad que vence hoy no sale): 1 fallo.
//   · `paraHoy` sin el `Set` de vistos (una tarea sale dos veces): 2 fallos.
//   · `bloqueoDeHoy` con 0 en vez de null cuando una bandeja no se leyó: 1 fallo.
//   · `filaTrimestre` sin la guarda de `sinFuentes` (#165): 1 fallo.
//   · `filaTrimestre` con `actual ?? 0` (un avance sin leer como cero): 1 fallo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloqueoDeHoy, filaTrimestre, paraHoy } from '../app/m/hoy/modelo';
import type { ItemPlan } from '../app/plan/board/hoy';

const item = (id: string, cuando: ItemPlan['cuando'], deadline: string | null = null): ItemPlan => ({
  id, titulo: `Tarea ${id}`, proyecto: null, deadline, cuando, banda: 'media',
  esInstancia: false, vencida: false, linkEscritorio: `/plan?tarea=${id}`,
});

test('para hoy: las primeras de la pestaña «Hoy» de Plan, con la prioridad que vence hoy adentro', () => {
  const p = {
    prioridades: [item('p1', 'sin-fecha'), item('p2', 'hoy', '2026-10-11'), item('p3', 'semana', '2026-10-14')],
    hoy: [item('h1', 'hoy', '2026-10-01'), item('h2', 'hoy', '2026-10-11')],
  };
  // El orden es el de `listaHoy`: lo vencido arriba; empatado el día, la prioridad primero.
  assert.deepEqual(paraHoy(p).map((i) => i.id), ['h1', 'p2', 'h2']);
  // Con lugar de sobra, el relleno son las prioridades que no vencen hoy, en su orden.
  assert.deepEqual(paraHoy(p, 10).map((i) => i.id), ['h1', 'p2', 'h2', 'p1', 'p3']);
});

test('para hoy: un plan sin fechas (casi todos los clientes) no deja la sección vacía', () => {
  assert.deepEqual(paraHoy({ prioridades: [item('a', 'sin-fecha'), item('b', 'quarter')], hoy: [] }).map((i) => i.id), ['a', 'b']);
});

test('para hoy: una tarea no sale dos veces', () => {
  const x = item('x', 'hoy', '2026-10-11');
  assert.deepEqual(paraHoy({ prioridades: [x], hoy: [] }).map((i) => i.id), ['x']);
  assert.deepEqual(paraHoy({ prioridades: [x, item('z', 'sin-fecha')], hoy: [x] }).map((i) => i.id), ['x', 'z']);
});

test('lo que bloquea: una bandeja da su nombre, varias dan el total y el desglose', () => {
  assert.equal(bloqueoDeHoy({ pendiente: 0, accion: 0, confirmacion: 0 }), null);
  assert.deepEqual(bloqueoDeHoy({ pendiente: 1, accion: 0 }), { titulo: '1 acción por confirmar', consecuencia: 'Nada se aplica hasta que decidas.' });
  assert.deepEqual(bloqueoDeHoy({ pendiente: 2, confirmacion: 1 }), { titulo: '3 decisiones pendientes', consecuencia: '2 acciones por confirmar · 1 cambio del CRM' });
  // Los borradores y los contactos se revisan en la computadora: no bloquean el teléfono.
  assert.equal(bloqueoDeHoy({ borrador: 9, lead: 4 }), null);
  // Una bandeja sin leer no es cero: sin tarjeta antes que un número inventado.
  assert.equal(bloqueoDeHoy({ pendiente: 2, accion: null }), null);
});

const OBJ = { quarter: 4, anio: 2026, metrica: 'cash_usd' as const, unidad: 'usd' as const, metaValor: 45000 };

test('el trimestre: lo cobrado, la barra contra el tiempo y el ritmo', () => {
  const t = filaTrimestre({
    objetivoPrincipal: { ...OBJ, actual: 6000, ritmo: { esperado: 5380, desvio: 620, desvioPct: 11.5, llegadaEstimada: null, alDia: true } },
    fraccionObjetivo: 0.12, objetivoAtrasado: false, sinFuentes: false,
  });
  assert.ok(t);
  assert.equal(t.titulo, 'Trimestre');
  assert.equal(t.rotulo, 'Cobrado · Q4');
  assert.equal(t.valor, '$6,000');
  assert.equal(t.meta, 'Meta $45,000');
  assert.deepEqual(t.ritmo, { texto: '$620 arriba', sube: true });
  assert.ok(t.barra && Math.abs(t.barra.avance - 6000 / 45000) < 1e-9 && t.barra.tiempo === 0.12);

  const abajo = filaTrimestre({
    objetivoPrincipal: { ...OBJ, metrica: 'cierres', unidad: 'cantidad', metaValor: 20, quarter: null, actual: 3, ritmo: { esperado: 8, desvio: -5, desvioPct: -62, llegadaEstimada: null, alDia: false } },
    fraccionObjetivo: 0.4, objetivoAtrasado: true, sinFuentes: false,
  });
  assert.equal(abajo?.titulo, 'Año');
  assert.equal(abajo?.rotulo, 'Cierres · 2026');
  assert.deepEqual(abajo?.ritmo, { texto: '5 abajo', sube: false });
});

test('el trimestre no opina sin fuentes (#165) ni dibuja un cero que no leyó', () => {
  const base = { ...OBJ, actual: 6000, ritmo: { esperado: 5380, desvio: 620, desvioPct: 11.5, llegadaEstimada: null, alDia: true } };
  assert.equal(filaTrimestre({ objetivoPrincipal: base, fraccionObjetivo: 0.12, objetivoAtrasado: false, sinFuentes: true })?.ritmo, null);

  const sinLeer = filaTrimestre({ objetivoPrincipal: { ...base, actual: null }, fraccionObjetivo: 0.12, objetivoAtrasado: false, sinFuentes: false });
  assert.equal(sinLeer?.valor, '—');
  assert.equal(sinLeer?.barra, null);
  assert.equal(sinLeer?.ritmo, null);
  assert.equal(sinLeer?.nota, 'No se pudo leer');

  assert.equal(filaTrimestre({ objetivoPrincipal: null, fraccionObjetivo: 0, objetivoAtrasado: false, sinFuentes: false }), null);
  assert.deepEqual(
    filaTrimestre({ objetivoPrincipal: { ...base, actual: 50000 }, fraccionObjetivo: 0.5, objetivoAtrasado: false, sinFuentes: false })?.ritmo,
    { texto: 'Meta superada', sube: true },
  );
});
