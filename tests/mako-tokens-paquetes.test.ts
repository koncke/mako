// =============================================================================
// Los paquetes: el piso que manda es UNO, y no es el que parece (7/11/2026)
// =============================================================================
// El 7/11 recomendé US$3 el clip usando como piso «lo que el plan cobra por clip» (US$2,69). Eso
// daba un paquete de US$90 por 5 minutos contra un plan de US$97 que da 6 minutos Y todo el
// producto: absurdo, y lo cazó Martín. La causa: **el plan no cobra clips, cobra el producto.**
//
// Estos tests fijan esa distinción, que es la que se vuelve a perder: `respetaElPiso` mira el
// marginal y SOLO el marginal, y un precio que pase el promedio del plan pero no el marginal tiene
// que dar falso.
//
// Correr: node --import tsx --test tests/mako-tokens-paquetes.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  USD_POR_CLIP, USD_POR_CLIP_SUELTO, CLIPS_POR_MINUTO, CLIPS_POR_MES, MT_POR_CLIP, PAQUETES,
  pisoMarginal, rateDelPlan, respetaElPiso, paqueteDeMinutos, gananciaDe, margenDe, minutosDelPlan,
} from '../lib/mako-tokens-paquetes';

test('lo que da cada nivel, en minutos: la prueba no da un video entero y el Pro da uno', () => {
  assert.equal(CLIPS_POR_MES.free, 1, 'la prueba de 7 días da UN clip, no un video');
  assert.equal(minutosDelPlan('pro'), 1, 'el Pro da un minuto: es para ver cómo queda, no para producir');
  assert.equal(minutosDelPlan('growth'), 6);
});

test('EL PISO es el marginal, y es lo que cuesta subir de plan por cada clip de más', () => {
  const m = pisoMarginal();
  assert.ok(m != null);
  // US$50 de diferencia por 30 clips de más.
  assert.ok(Math.abs(m - 50 / 30) < 1e-9, `el piso dio US$${m}`);
});

test('el promedio del plan NO es piso, y por eso respetaElPiso no lo mira', () => {
  const promedio = rateDelPlan();
  const piso = pisoMarginal();
  assert.ok(promedio != null && piso != null);
  assert.ok(promedio > piso, 'el promedio del plan es más alto que el piso: por eso confundía');
  // ⚠️ EL CASO QUE ME HIZO EQUIVOCAR: un precio ENTRE el piso y el promedio del plan es válido.
  const entreMedio = (piso + promedio) / 2;
  assert.equal(respetaElPiso(entreMedio), true,
    'un precio arriba del marginal es válido aunque quede debajo del promedio del plan');
});

test('el precio decidido pasa el piso, y uno por debajo no', () => {
  assert.equal(respetaElPiso(USD_POR_CLIP_SUELTO), true, `US$${USD_POR_CLIP_SUELTO} tiene que pasar`);
  assert.equal(respetaElPiso(1.5), false, 'por debajo del piso, a un Pro le conviene recargar antes que subir');
  assert.equal(respetaElPiso(pisoMarginal()!), false, 'empatar el piso no alcanza: no habría razón para subir');
});

test('el precio suelto siempre es más caro que subir de plan: el escalón se sostiene', () => {
  const piso = pisoMarginal()!;
  assert.ok(USD_POR_CLIP_SUELTO > piso,
    `el clip suelto (US$${USD_POR_CLIP_SUELTO}) tiene que salir más que subir de plan (US$${piso.toFixed(2)})`);
});

test('un paquete se arma por minutos y los MT salen de la unidad, no del precio', () => {
  const p = paqueteDeMinutos(1);
  assert.equal(p.clips, CLIPS_POR_MINUTO);
  assert.equal(p.usd, CLIPS_POR_MINUTO * USD_POR_CLIP_SUELTO);
  assert.equal(p.mt, CLIPS_POR_MINUTO * MT_POR_CLIP, 'los MT miden COSTO: no se mueven si cambia el precio');
});

test('los paquetes dejan el mismo margen, que es lo que los hace explicables', () => {
  assert.ok(PAQUETES.length >= 3);
  const margenes = PAQUETES.map(margenDe);
  for (const m of margenes) assert.ok(Math.abs(m - margenes[0]) < 1e-9, 'un paquete con otro margen pide explicar por qué');
  assert.ok(margenes[0] > 0.75, `el margen dio ${(margenes[0] * 100).toFixed(1)}%`);
});

test('ninguna ganancia es negativa, y cada paquete cubre su costo', () => {
  for (const p of PAQUETES) {
    assert.ok(gananciaDe(p) > 0, `el paquete de ${p.minutos} min no cubre su costo`);
    assert.ok(p.usd > p.clips * USD_POR_CLIP);
  }
});

test('el paquete grande da MÁS video que el plan, y eso está bien', () => {
  // Es la comparación que chocaba: con el precio viejo, US$90 daba 5 minutos contra los 6 del plan
  // de US$97. Ahora el paquete de precio parecido da MÁS video — el plan gana por el producto, no
  // por los minutos, y así cada uno se entiende solo.
  const grande = PAQUETES[PAQUETES.length - 1];
  assert.ok(grande.minutos > minutosDelPlan('growth'),
    `el paquete grande da ${grande.minutos} min y el plan ${minutosDelPlan('growth')}`);
});
