// =============================================================================
// «Vendido por funnel» y la hoja filtrada por ese funnel dan lo MISMO (18/11/2026, la revisión de O10 1)
// =============================================================================
// Un revisor de O10 (1) encontró la otra mitad: el FILTRO por un funnel ya ponía la venta de un lead agregado donde la pone
// el OKR (`duenoDe`, lib/graficos-agregar.ts), pero AGRUPAR por la dimensión «Funnel» seguía mandando la fila entera a su
// casa. La misma venta daba un número en la barra de «Renovación» y otro en la hoja filtrada por «Renovación». Ahora el
// agrupado usa la misma regla (`partesParaAgrupar`): la venta va al grupo de su dueño y el lead se sigue contando una vez,
// en su casa. No suma ventas nuevas: las de los CRMs agregados (`ventasDeCrms`) siguen afuera (lo decide Martín).
//
// El test EJECUTA `agregar` y `filtrarFilas` sobre las filas que arma `funnelsDeLaFilaDeLead` (lo mismo que `filasLeads`).
//
// ⚠️ PROBADO ROMPIÉNDOLO (18/11/2026), una rotura por vez y vuelta atrás:
//   1. el agrupado sin `partesParaAgrupar` (la fila entera a su casa, como antes) ..... 2 fallos (la barra y el cruce)
//   2. la parte de la venta con las métricas de la fila entera (`v: f.v`) ............ 1 fallo (el lead contado dos veces)
//   3. el cruce sin mirar el desglose (`dimsCruce` = sólo la dimensión) ............... 1 fallo (el cruce por closer)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { funnelsDeLaFilaDeLead, type AgregadoDeLead } from '../lib/graficos-funnel-fila';
import { agregar, filtrarFilas, type Fila } from '../lib/graficos-agregar';
import { sanearGrafico, type Grafico } from '../lib/graficos-catalogo';

const NOMBRES: Record<number, string> = { 1: 'VSL', 2: 'Renovación' };
const nombreDe = (id: number | null) => NOMBRES[id ?? 1] ?? null;
const renovacion = (dia: string): AgregadoDeLead => ({ nombre: 'Renovación', desde: dia, funnel: 2, creado: `${dia}T15:00:00.000Z` });

/** Un lead ganado del VSL por fecha de cierre, como lo arma `filasLeads`. */
function venta(p: { id: number; closer: string; cierre: string; agregados: AgregadoDeLead[]; monto: number }): Fila {
  const funnels = funnelsDeLaFilaDeLead({ fecha: 'cierre', dia: p.cierre, casa: 1, casaNombre: 'VSL', agregados: p.agregados, vendio: true, fechaCierre: p.cierre, nombreDe });
  return { f: p.cierre, d: { producto: 'VSL', closer: p.closer }, r: { lead: String(p.id) }, v: { leads: 1, cierres: 1, vendido: p.monto, cobrado: p.monto / 2 }, ...funnels };
}

// El 7 se agregó a Renovación el 13/10 y cerró el 20/10 (la venta es de Renovación); el 8 cerró el 10/10, antes de que se lo
// agregara (la venta es del VSL); el 9 no se agregó a nada.
const FILAS = [
  venta({ id: 7, closer: 'Ana Inventada', cierre: '2026-10-20', agregados: [renovacion('2026-10-13')], monto: 3000 }),
  venta({ id: 8, closer: 'Ana Inventada', cierre: '2026-10-10', agregados: [renovacion('2026-10-13')], monto: 500 }),
  venta({ id: 9, closer: 'Beto Inventado', cierre: '2026-10-15', agregados: [], monto: 200 }),
];
const DESDE = '2026-10-01', HASTA = '2026-10-31';
const g = (r: Record<string, unknown>): Grafico => sanearGrafico({ id: 'g', fuente: 'leads', fecha: 'cierre', ...r })!;

/** Lo que dice la hoja filtrada por un funnel, en un KPI. */
function filtrada(funnel: string, metrica: string): number | null {
  return agregar(g({ tipo: 'kpi', metricas: [metrica] }), filtrarFilas(FILAS, [{ dimension: 'producto', valores: [funnel] }]), DESDE, HASTA).totales[0];
}

test('la barra de cada funnel en «Vendido por funnel» dice lo mismo que la hoja filtrada por ese funnel', () => {
  const r = agregar(g({ tipo: 'barras', dimension: 'producto', metricas: ['vendido', 'cobrado', 'cierres'], limite: 20 }), FILAS, DESDE, HASTA);
  const barra = (funnel: string, i: number) => r.filas.find((x) => x.clave === funnel)?.valores[i] ?? 0;
  for (const funnel of ['VSL', 'Renovación']) {
    assert.equal(barra(funnel, 0), filtrada(funnel, 'vendido'), `vendido de ${funnel}: la barra y la hoja filtrada no cuadran`);
    assert.equal(barra(funnel, 1), filtrada(funnel, 'cobrado'), `cobrado de ${funnel}`);
    assert.equal(barra(funnel, 2), filtrada(funnel, 'cierres'), `cierres de ${funnel}`);
  }
  assert.equal(barra('Renovación', 0), 3000, 'la venta cerrada después de agregarlo es de Renovación');
  assert.equal(barra('VSL', 0), 700, 'al VSL le quedan las otras dos');
  // Cada venta una vez: la suma de las barras es el total.
  assert.equal(r.filas.reduce((s, x) => s + (x.valores[0] ?? 0), 0), r.totales[0]);
  assert.equal(r.totales[0], 3700);
});

test('el lead se sigue contando UNA vez, en su casa: lo que se mueve es sólo la venta', () => {
  const r = agregar(g({ tipo: 'barras', dimension: 'producto', metricas: ['leads'], limite: 20 }), FILAS, DESDE, HASTA);
  const leads = (funnel: string) => r.filas.find((x) => x.clave === funnel)?.valores[0] ?? 0;
  assert.equal(leads('VSL'), 3);
  assert.equal(leads('Renovación'), 0, 'el lead agregado se contó dos veces');
  assert.equal(r.totales[0], 3);
});

test('el cruce por closer y funnel dice lo mismo que la hoja filtrada por ese funnel, agrupada por closer', () => {
  const r = agregar(g({ tipo: 'dinamica', dimension: 'closer', desglose: 'producto', metricas: ['vendido'] }), FILAS, DESDE, HASTA);
  const cruce = r.cruce!;
  for (const funnel of ['VSL', 'Renovación']) {
    const col = cruce.claves.indexOf(funnel);
    assert.ok(col >= 0, `falta la columna ${funnel}`);
    const porCloser = agregar(g({ tipo: 'barras', dimension: 'closer', metricas: ['vendido'], limite: 20 }), filtrarFilas(FILAS, [{ dimension: 'producto', valores: [funnel] }]), DESDE, HASTA);
    r.filas.forEach((fila, i) => {
      const esperado = porCloser.filas.find((x) => x.clave === fila.clave)?.valores[0] ?? 0;
      assert.equal(cruce.celdas[i][col] ?? 0, esperado, `${fila.clave} en ${funnel}`);
    });
  }
  // Cada fila del cruce suma lo de su closer.
  r.filas.forEach((f, i) => assert.equal(cruce.celdas[i].reduce<number>((s, v) => s + (v ?? 0), 0), f.valores[0]));
});

test('sin agregados nada cambia: la fila entera va a su grupo', () => {
  const r = agregar(g({ tipo: 'barras', dimension: 'producto', metricas: ['vendido', 'leads'], limite: 20 }), [FILAS[2]], DESDE, HASTA);
  assert.deepEqual(r.filas.map((x) => [x.clave, x.valores]), [['VSL', [200, 1]]]);
});
