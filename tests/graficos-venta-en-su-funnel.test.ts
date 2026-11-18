// =============================================================================
// La hoja por fecha de CIERRE pone la venta en el funnel donde la ponen los OKR (18/11/2026)
// =============================================================================
// Pendiente O10 (1) de docs/pendientes-verificados-17-11.md: «La hoja por fecha de cierre filtrada por un funnel agregado
// pone la venta en 0 (soloCasa), mientras el OKR usa funnelDelMomento». Un lead del VSL que se agregó a «Renovación» y
// DESPUÉS cerró: el OKR de Renovación cuenta esa venta; la hoja de Renovación decía 0 y la del VSL la contaba entera.
//
// El test EJECUTA la cadena que usa la hoja (`funnelsDeLaFilaDeLead` → `filtrarFilas` → `agregar`, lo mismo que
// `filasLeads` arma para cada lead) y la compara con la regla del OKR (`sumarEnFunnels`, lib/funnels-elegidos.ts) sobre
// los MISMOS datos: la misma venta, el mismo número.
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026), una rotura por vez y vuelta atrás:
//   1. `filtrarFilas` sin mirar `duenoDe` (el dueño = la fila, como antes) .......... 2 fallos (el OKR y la casa en 0)
//   2. `funnelsDeLaFilaDeLead` sin el `duenoDe` (sólo `soloCasa`, como antes) ........ 2 fallos (los mismos)
//   3. `funnelsDeLaFilaDeLead` calculando el dueño también por fecha de alta ......... 1 fallo (la cohorte por alta)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { funnelsDeLaFilaDeLead, METRICAS_DE_LA_VENTA, type AgregadoDeLead } from '../lib/graficos-funnel-fila';
import { filtrarFilas, agregar, type Fila } from '../lib/graficos-agregar';
import { sumarEnFunnels, type Hecho } from '../lib/funnels-elegidos';
import type { Grafico } from '../lib/graficos-catalogo';

// Los funnels del negocio de mentira: 1 = el VSL (la casa, también el del negocio), 2 = Renovación.
const NOMBRES: Record<number, string> = { 1: 'VSL', 2: 'Renovación' };
const nombreDe = (id: number | null) => NOMBRES[id ?? 1] ?? null;
const renovacion = (dia: string): AgregadoDeLead => ({ nombre: 'Renovación', desde: dia, funnel: 2, creado: `${dia}T15:00:00.000Z` });

/** La fila de un lead ganado, como la arma `filasLeads` (sólo lo que mira el filtro). */
function filaDeVenta(p: { id: number; fecha: 'alta' | 'cierre'; dia: string; fechaCierre: string; agregados: AgregadoDeLead[]; monto: number }): Fila {
  const funnels = funnelsDeLaFilaDeLead({ fecha: p.fecha, dia: p.dia, casa: 1, casaNombre: 'VSL', agregados: p.agregados, vendio: true, fechaCierre: p.fechaCierre, nombreDe });
  return { f: p.dia, d: { producto: 'VSL' }, r: { lead: String(p.id) }, v: { leads: 1, cierres: 1, vendido: p.monto, cobrado: p.monto / 2 }, ...funnels };
}

const KPI = { id: 'g', clase: 'grafico', tipo: 'kpi', fuente: 'leads', metricas: ['vendido'], dimension: null, fecha: 'cierre', periodo: 'todo', x: 0, y: 0, w: 3, h: 3 } as unknown as Grafico;
const vendidoCon = (filas: Fila[], funnels: string[]) => agregar(KPI, filtrarFilas(filas, funnels.length ? [{ dimension: 'producto', valores: funnels }] : []), '2026-01-01', '2026-12-31').totales[0];

// El lead 7 se agregó a Renovación el 13/10 y cerró el 20/10 (la venta es de Renovación para el OKR); el lead 8 cerró el
// 10/10 y recién se lo agregó el 13/10 (la venta es del VSL).
const VENTAS = [
  { id: 7, fechaCierre: '2026-10-20', agregados: [renovacion('2026-10-13')], monto: 3000 },
  { id: 8, fechaCierre: '2026-10-10', agregados: [renovacion('2026-10-13')], monto: 500 },
];
const filasPorCierre = VENTAS.map((v) => filaDeVenta({ ...v, fecha: 'cierre', dia: v.fechaCierre }));

/** Lo que cuenta un OKR de «Firmado» filtrado por ESTOS funnels, con los mismos leads (lib/objectives-fuentes.ts). */
function okr(elegidos: number[]): number {
  const hechos: Hecho[] = VENTAS.map((v) => ({ lead: v.id, fecha: v.fechaCierre, valor: v.monto }));
  const casas = new Map(VENTAS.map((v) => [v.id, 1] as const));
  const agregados = new Map(VENTAS.map((v) => [v.id, v.agregados.map((a) => ({ funnel: a.funnel, desde: a.creado }))] as const));
  return sumarEnFunnels(hechos, elegidos, casas, agregados);
}

test('por fecha de cierre, la hoja filtrada por cada funnel suma lo mismo que el OKR de ese funnel', () => {
  assert.equal(vendidoCon(filasPorCierre, ['Renovación']), okr([2]), 'Renovación: la venta cerrada después de agregarlo');
  assert.equal(vendidoCon(filasPorCierre, ['Renovación']), 3000);
  assert.equal(vendidoCon(filasPorCierre, ['VSL']), okr([1]), 'el VSL ya no cuenta la venta que el OKR le da a Renovación');
  assert.equal(vendidoCon(filasPorCierre, ['VSL']), 500);
  assert.equal(vendidoCon(filasPorCierre, ['VSL', 'Renovación']), okr([1, 2]), 'los dos juntos: cada venta una vez');
  assert.equal(vendidoCon(filasPorCierre, []), 3500, 'sin filtro, las dos ventas una vez');
});

test('el lead sigue contando en las dos hojas; lo que cambia de funnel es sólo la venta', () => {
  const [fila7] = filasPorCierre;
  const [enVsl] = filtrarFilas([fila7], [{ dimension: 'producto', valores: ['VSL'] }]);
  assert.equal(enVsl.v.leads, 1, 'el lead está en su casa');
  for (const k of ['cierres', 'vendido', 'cobrado'] as const) assert.equal(enVsl.v[k], 0, `en el VSL, ${k} es de Renovación`);
  const [enRenov] = filtrarFilas([fila7], [{ dimension: 'producto', valores: ['Renovación'] }]);
  assert.deepEqual(enRenov.v, fila7.v, 'en Renovación la fila entera');
  // Con la búsqueda de texto, la misma regla.
  assert.equal(filtrarFilas([fila7], [{ dimension: 'producto', texto: 'renov' }])[0].v.vendido, 3000);
});

test('por fecha de ALTA la venta sigue en la casa (la cohorte): no se pierde en ninguna hoja filtrada', () => {
  // El lead 7 entró el 1/10 (antes de que se lo agregara): por alta es del VSL, y no está en Renovación ese día.
  const porAlta = [filaDeVenta({ id: 7, fecha: 'alta', dia: '2026-10-01', fechaCierre: '2026-10-20', agregados: [renovacion('2026-10-13')], monto: 3000 })];
  assert.equal(vendidoCon(porAlta, ['VSL']), 3000, 'la cohorte del VSL vendió esto');
  assert.equal(filtrarFilas(porAlta, [{ dimension: 'producto', valores: ['Renovación'] }]).length, 0);
});

test('sin agregados la fila no lleva nada de funnels (la fila de siempre)', () => {
  assert.deepEqual(funnelsDeLaFilaDeLead({ fecha: 'cierre', dia: '2026-10-20', casa: 1, casaNombre: 'VSL', agregados: [], vendio: true, fechaCierre: '2026-10-20', nombreDe }), {});
  // Una venta del funnel del negocio con la casa en NULL y el agregado igual a la casa: no cambia de dueño.
  const mismo = funnelsDeLaFilaDeLead({ fecha: 'cierre', dia: '2026-10-20', casa: null, casaNombre: 'VSL', agregados: [{ nombre: 'VSL', desde: '2026-10-13', funnel: 1, creado: '2026-10-13T00:00:00Z' }], vendio: true, fechaCierre: '2026-10-20', nombreDe });
  assert.deepEqual(mismo, {});
  // Las métricas que siguen a la venta son las de siempre.
  assert.deepEqual([...METRICAS_DE_LA_VENTA], ['cierres', 'vendido', 'cobrado', 'dias_ciclo', 'con_ciclo', 'dias_ciclo_cierre', 'con_ciclo_cierre']);
});
