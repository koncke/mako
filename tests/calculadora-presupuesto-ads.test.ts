// =============================================================================
// Calculadora de presupuesto de anuncios: cuántos ángulos se testean con lo que hay
// =============================================================================
// Pedido de Martín (22/10/2026): con US$2.000, «¿cuántas funcionalidades y cuántos
// avatares ataco?». La cuenta vive en lib/calculadora-presupuesto-ads.ts (pura); la
// usan la pantalla del Ads Manager, el chat de MaKo y la API. Acá se fija con números.
//
// Probado rompiéndolo (23/10/2026; base en verde: 15 pasan, 0 fallan). Cada rotura se
// aplicó, se corrió este archivo y se restauró (pasan / fallan):
//   · el mínimo para decidir en 20 en vez de la vara del Recon             -> 9 / 6
//   · sin preferir la escala fuera de aprendizaje                          -> 14 / 1
//   · sin el tope de 3 avatares y 3 funcionalidades                        -> 14 / 1
//   · sin exigir una semana para escalar después del testeo                -> 13 / 2
//   · prefiere la opción MÁS larga                                         -> 12 / 3
//   · tope de testeo al 100% del presupuesto                               -> 12 / 3
//   · el cierre ignorado (todo resultado es una venta)                     -> 13 / 2
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularPresupuestoAds, opciones, RESULTADOS_PARA_DECIDIR, RESULTADOS_APRENDIZAJE, MAX_POR_DIMENSION,
  type EntradaCalculadora, type PlanCalculadora,
} from '../lib/calculadora-presupuesto-ads';
import { RECON_LEADS_VALIDACION } from '../lib/config';

/** El caso de Martín: US$2.000 en la ventana del 1/11 al 15/12, campaña de mensajes. */
const martin = (extra: Partial<EntradaCalculadora> = {}): EntradaCalculadora => ({
  presupuesto: 2000, dias: 45, costoPorResultado: 2.5, evento: 'lead', ticket: 1500, cierre: 0.672,
  avatares: 3, funcionalidades: 3, ...extra,
});

function plan(e: EntradaCalculadora): PlanCalculadora {
  const p = calcularPresupuestoAds(e);
  assert.ok(p.ok, `debería calcular: ${'error' in p ? p.error : ''}`);
  return p as PlanCalculadora;
}

test('el mínimo para decidir es la MISMA vara del panel Recon', () => {
  // Si la calculadora dijera «alcanza» con 20 y la tabla «sin validar» con 10, se
  // contradicen con los mismos números.
  assert.equal(RESULTADOS_PARA_DECIDIR, RECON_LEADS_VALIDACION);
  assert.equal(RESULTADOS_APRENDIZAJE, 50);
});

test('Martín a US$2,50 por conversación: la matriz 3 × 3 entera, en una semana', () => {
  const p = plan(martin());
  assert.equal(p.modo, 'matriz');
  assert.equal(p.rondas.length, 1);
  assert.deepEqual([p.rondas[0].avatares, p.rondas[0].funcionalidades, p.rondas[0].anuncios], [3, 3, 9]);
  assert.equal(p.costoPorAngulo, 25, '10 conversaciones × 2,50');
  assert.equal(p.rondas[0].gasto, 225);
  assert.equal(p.rondas[0].diarioPorAnuncio, 3.57, '25 ÷ 7 días');
  assert.equal(p.testeo.dias, 7);
  // La escala: 1.775 en 38 días = 46,71 por día, más que los 17,86 que pide el aprendizaje.
  assert.equal(p.escala.gasto, 1775);
  assert.equal(p.escala.dias, 38);
  assert.equal(p.escala.diario, 46.71);
  assert.equal(p.escala.diarioParaAprendizaje, 17.86);
  assert.equal(p.escala.saleDeAprendizaje, true);
  assert.deepEqual(p.avisos, []);
  // 800 conversaciones × 0,672% = 5,38 ventas de 1.500.
  assert.equal(p.resultados, 800);
  assert.equal(p.ventas, 5.38);
  assert.equal(p.facturacion, 8070);
  assert.equal(p.costoPorVenta, 372.02);
});

test('el criterio estricto (50 por ángulo) se informa aparte, sin cambiar el plan', () => {
  assert.equal(plan(martin()).angulosEstricto, 8, '1.000 ÷ (50 × 2,50)');
  assert.equal(plan(martin({ costoPorResultado: 8 })).angulosEstricto, 2);
});

test('hasta ~US$5,50 la matriz entra y la escala igual sale de aprendizaje', () => {
  const p = plan(martin({ costoPorResultado: 5.5 }));
  assert.equal(p.modo, 'matriz');
  assert.equal(p.angulos, 9);
  assert.equal(p.escala.saleDeAprendizaje, true);
});

test('cuando la matriz ahoga la escala, prueba MENOS para que el ganador salga de aprendizaje', () => {
  // A 6: la matriz (540) deja 38,42 por día y el aprendizaje pide 42,86. Sin test daría
  // 44,44: hay una forma de probar algo y escalar bien, y es la que tiene que elegir.
  const p = plan(martin({ costoPorResultado: 6 }));
  assert.notEqual(p.modo, 'matriz');
  assert.equal(p.escala.saleDeAprendizaje, true);
  assert.ok(p.angulos >= 2, 'igual compara algo');
});

test('si ni sin testear sale de aprendizaje, gana la que más prueba y lo avisa', () => {
  const p = plan(martin({ costoPorResultado: 8 }));
  assert.equal(p.modo, 'matriz');
  assert.equal(p.escala.saleDeAprendizaje, false);
  assert.ok(p.avisos.includes('La escala no sale de aprendizaje'));
});

test('con poca plata por resultado: dos rondas (avatares y después funcionalidades)', () => {
  const p = plan(martin({ costoPorResultado: 15 }));
  assert.equal(p.modo, 'secuencial');
  assert.deepEqual(p.rondas.map((r) => [r.que, r.anuncios]), [['avatares', 3], ['funcionalidades', 3]]);
  assert.equal(p.testeo.dias, 14);
  assert.equal(p.escala.dias, 31);
});

test('sin días para dos rondas no propone la secuencial', () => {
  const p = plan(martin({ costoPorResultado: 15, dias: 20 }));
  assert.ok(p.rondas.length <= 1, `${p.modo} con ${p.rondas.length} rondas en 20 días`);
  assert.ok(p.testeo.dias + 7 <= 20);
});

test('optimizando a una agenda de US$125: no alcanza para comparar', () => {
  const p = plan(martin({ costoPorResultado: 125, evento: 'venta', cierre: undefined }));
  assert.equal(p.modo, 'sin-test');
  assert.equal(p.angulos, 0);
  assert.equal(p.escala.gasto, 2000);
  assert.ok(p.avisos.includes('No alcanza para comparar ángulos: un solo anuncio'));
});

test('nunca más de 3 avatares ni 3 funcionalidades, aunque sobre la plata', () => {
  const p = plan(martin({ avatares: 4, funcionalidades: 24, costoPorResultado: 1 }));
  for (const r of p.rondas) {
    assert.ok(r.avatares <= MAX_POR_DIMENSION && r.funcionalidades <= MAX_POR_DIMENSION, JSON.stringify(r));
  }
  for (const o of opciones(1000, 10, 10)) {
    for (const r of o.rondas) assert.ok(r.avatares <= 3 && r.funcionalidades <= 3);
  }
});

test('un solo avatar: compara funcionalidades', () => {
  const p = plan(martin({ avatares: 1, costoPorResultado: 30 }));
  assert.equal(p.modo, 'una-dimension');
  assert.equal(p.rondas[0].que, 'funcionalidades');
  assert.equal(p.rondas[0].avatares, 1);
});

test('nunca pasa del tope de testeo (la mitad)', () => {
  for (const costo of [0.5, 1, 2.5, 5, 8, 12, 15, 20, 33, 50, 100]) {
    for (const dias of [7, 14, 21, 30, 45, 90]) {
      const p = plan(martin({ costoPorResultado: costo, dias }));
      assert.ok(p.testeo.gasto <= 1000 + 1e-9, `costo ${costo} días ${dias}: testeo ${p.testeo.gasto}`);
      assert.ok(Math.abs(p.testeo.gasto + p.escala.gasto - 2000) < 0.02, 'testeo + escala = presupuesto');
      assert.ok(p.modo === 'sin-test' || p.testeo.dias + 7 <= dias, 'deja una semana para escalar');
    }
  }
});

test('con venta como evento, el costo por venta es el costo por resultado', () => {
  const p = plan(martin({ evento: 'venta', costoPorResultado: 300, cierre: undefined, presupuesto: 30000 }));
  assert.equal(p.costoPorVenta, 300);
  assert.equal(p.ventas, 100);
});

test('cada venta más cara que el ticket se avisa', () => {
  const p = plan(martin({ ticket: 97 }));
  assert.ok(p.avisos.includes('Cada venta cuesta más que el ticket'), '372 por venta contra 97');
});

test('los campos que faltan contestan qué poner, en una frase', () => {
  const casos: [Partial<EntradaCalculadora>, string][] = [
    [{ presupuesto: 0 }, 'Pon el presupuesto'],
    [{ dias: Number.NaN }, 'Pon los días de pauta'],
    [{ costoPorResultado: -1 }, 'Pon el costo por resultado'],
    [{ ticket: 0 }, 'Pon el ticket'],
    [{ cierre: undefined }, 'Pon cuántos de cada 100 compran'],
    [{ cierre: 120 }, 'De cada 100, no más de 100'],
    [{ avatares: 0 }, 'Pon cuántos avatares y funcionalidades tienes'],
    [{ costoPorResultado: 5000 }, 'El presupuesto no alcanza para un resultado'],
  ];
  for (const [extra, error] of casos) {
    const p = calcularPresupuestoAds(martin(extra));
    assert.equal(p.ok, false, JSON.stringify(extra));
    assert.equal((p as { error: string }).error, error);
  }
});
