// =============================================================================
// Los textos del motor concuerdan con el resultado (14/11/2026)
// =============================================================================
// Con el KPI en agendas o ventas, el motor escribía «no trajo ningún agenda», «lo que te cuesta un agenda», «9 agendas a US$ 31
// cada uno» y «Subir el presupuesto de el conjunto». Es lo que se lee en «Espera tu OK» y «Lo que hice» del Marketing CoPilot y en
// el Media Buyer (docs/hallazgos-ads.md). Fija, corriendo el motor de verdad con los tres KPIs sobre una cuenta con un conjunto
// barato (Surf), uno caro (Sunsetting) y uno sin resultados (Stop Loss):
//   · ninguna forma masculina pegada a «agenda» o «venta», y ningún «de el»;
//   · lead sigue en masculino;
//   · el test ejercita las tácticas (si el motor dejara de proponer, no pasaría en blanco).
// Correr: node --import tsx --test tests/media-buyer-textos-genero.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deLo, proponer, NOMBRE_RESULTADO, type EntradaMotor, type NodoMB, type SenalMB } from '../lib/media-buyer/motor';
import { CONFIG_POR_DEFECTO, type KpiMediaBuyer } from '../lib/media-buyer/tipos';

const AHORA = Date.parse('2026-10-25T15:00:00Z');
const HOY = '2026-10-25';
const VIEJA = '2026-09-01T00:00:00Z';
const nodo = (id: string, nivel: NodoMB['nivel'], parentId: string | null, x: Partial<NodoMB> = {}): NodoMB => ({
  id, nombre: id, nivel, parentId, configurado: 'ACTIVE', entrega: 'ACTIVE', presupuestoDia: null, nivelPresupuesto: null, creada: VIEJA, ...x,
});
const senal = (adId: string, x: Partial<SenalMB> = {}): SenalMB => ({
  adId, gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 1000, frecuencia: 1.2, diasCorriendo: 7, esVideo: false, miniatura: null, ...x,
});
const CAMPO: Record<KpiMediaBuyer, 'leadsMeta' | 'agendasMeta' | 'cierres'> = { lead: 'leadsMeta', agenda: 'agendasMeta', venta: 'cierres' };

function textos(kpi: KpiMediaBuyer): { todo: string; tacticas: string[] } {
  const r = (n: number) => ({ [CAMPO[kpi]]: n, ...(kpi === 'agenda' ? { agendasCrm: n } : {}) });
  const entrada: EntradaMotor = {
    ahora: AHORA,
    config: { ...CONFIG_POR_DEFECTO, encendido: true, kpi },
    objetivo: 10,
    arbol: [
      nodo('c1', 'campaign', null, { nivelPresupuesto: 'adset' }),
      nodo('s1', 'adset', 'c1', { presupuestoDia: 50, nivelPresupuesto: 'adset' }), nodo('a1', 'ad', 's1'),
      nodo('s2', 'adset', 'c1', { presupuestoDia: 40, nivelPresupuesto: 'adset' }), nodo('a2', 'ad', 's2'),
      nodo('s3', 'adset', 'c1', { presupuestoDia: 30, nivelPresupuesto: 'adset' }), nodo('a3', 'ad', 's3'),
    ],
    // a1: barato y gasta todo (Surf). a2: caro, con resultados (Sunsetting). a3: gasta sin traer nada (Stop Loss).
    corta: [senal('a1', { gasto: 150, ...r(20) }), senal('a2', { gasto: 100, ...r(3) }), senal('a3', { gasto: 60, diasCorriendo: 6 })],
    larga: [senal('a1', { gasto: 350, ...r(45) }), senal('a2', { gasto: 200, ...r(5) }), senal('a3', { gasto: 140, diasCorriendo: 6 })],
    crm: [], historial: [],
    aUnidad: (m) => m, fmt: (u) => `US$ ${u.toFixed(2)}`, presupuestoMinimo: 5,
  };
  const ps = proponer(entrada, HOY);
  const todo = ps.flatMap((p) => [p.titulo, p.titular, ...p.porque, ...p.numeros.flatMap((n) => [n.condicion, n.valor, n.porQue])]).join('\n');
  return { todo, tacticas: [...new Set(ps.map((p) => p.tactica))].sort() };
}

test('agendas y ventas: ninguna forma masculina pegada, ningún «de el»', () => {
  for (const kpi of ['agenda', 'venta'] as const) {
    const { todo, tacticas } = textos(kpi);
    assert.ok(tacticas.length >= 2, `${kpi}: el motor tiene que proponer algo para que esto pruebe algo (propuso: ${tacticas.join(', ')})`);
    const uno = NOMBRE_RESULTADO[kpi].uno, varios = NOMBRE_RESULTADO[kpi].varios;
    for (const mal of [new RegExp(`ningún ${uno}`), new RegExp(`\\bun ${uno}\\b`), new RegExp(`un solo ${uno}`), new RegExp(`${varios} a US\\$ [\\d.,]+ cada uno`), /\bde el\b/]) {
      assert.doesNotMatch(todo, mal, `${kpi}: ${mal}\n${todo}`);
    }
  }
});

test('lead sigue en masculino, y «del» / «de la» salen bien', () => {
  assert.deepEqual([NOMBRE_RESULTADO.lead.ningun, NOMBRE_RESULTADO.lead.cadaUno], ['ningún', 'cada uno']);
  assert.deepEqual([NOMBRE_RESULTADO.agenda.ningun, NOMBRE_RESULTADO.venta.unSolo], ['ninguna', 'una sola']);
  assert.equal(deLo('el conjunto'), 'del conjunto');
  assert.equal(deLo('la campaña'), 'de la campaña');
  assert.doesNotMatch(textos('lead').todo, /\bde el\b/);
});
