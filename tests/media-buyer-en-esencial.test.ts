// =============================================================================
// El Media Buyer también es de Esencial, en «propone» y con cupo (25/10/2026)
// =============================================================================
// Decisión del Cerebro (Martín pidió no preguntar), con la investigación de venta (docs/como-venden-otros.md §6c): Esencial suma
// el Media Buyer en modo «propone», 2 recomendaciones por día y sin piloto automático. Lo que separa a Pro es el piloto y el
// cupo, no la tab. Antes de esto, /ads-manager seguía en el candado de Pro (NAV_SOLO_PRO y TABS_SOLO_PRO) y un Esencial que
// pagó por la pasarela rebotaba a «no está en tu plan»: lo encontró el chat «Media Buyer».
// Fija:
//   1. /ads-manager no está en ninguno de los dos candados de Pro;
//   2. el cupo de Esencial es 2 por día y Pro no tiene tope;
//   3. la comparación de planes lo dice: la fila del cupo y el piloto automático sólo en Pro (y en el Acelerador).
//
// Correr: node --import tsx --test tests/media-buyer-en-esencial.test.ts
// ⚠️ PROBADO ROMPIENDOLO (25/10/2026): volver a poner 'ads-manager' en cualquiera de los dos candados, o sacar la fila del piloto.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV_SOLO_PRO } from '../lib/plan-esencial-reglas';
import { TABS_SOLO_PRO, topeDe } from '../lib/topes-plan';
import { filasDeComparacion } from '../lib/planes-comparacion';

test('1. el Media Buyer no tiene candado de Pro', () => {
  assert.equal(NAV_SOLO_PRO.has('ads-manager'), false, '/ads-manager en NAV_SOLO_PRO: un Esencial rebota a «no está en tu plan»');
  assert.equal((TABS_SOLO_PRO as readonly string[]).includes('ads-manager'), false, '/ads-manager en TABS_SOLO_PRO: la vitrina lo vende como sólo de Pro');
});

test('2. el cupo: Esencial propone 2 por día, Pro sin tope', () => {
  assert.equal(topeDe('completo', 'ads.recomendaciones_dia'), 2);
  assert.equal(topeDe('agencia', 'ads.recomendaciones_dia'), null);
});

test('3. la comparación de planes: el cupo, y el piloto automático sólo en Pro', () => {
  // Dichos sin «media buyer» ni «piloto automático» desde el 27/10/2026 (Leila: «Una persona que no sabe no entiende…»).
  const filas = filasDeComparacion();
  const cupo = filas.find((f) => /^Recomendaciones por día para tus campañas de Meta$/.test(f.que));
  assert.ok(cupo, 'falta la fila del cupo del media buyer');
  assert.deepEqual([cupo!.esencial, cupo!.pro], ['2', 'Sin tope']);
  const piloto = filas.find((f) => /^Piloto automático de tus anuncios de Meta$/.test(f.que));
  assert.ok(piloto, 'falta la fila del piloto automático');
  assert.deepEqual([piloto!.esencial, piloto!.pro, piloto!.acelerador], [false, true, true]);
});
