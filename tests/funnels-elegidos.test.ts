// =============================================================================
// «De qué funnels» cuando se elige UNO O VARIOS (lib/funnels-elegidos.ts)
// =============================================================================
// Nació el 17/10/2026 con los OKR de /general: un cliente quería que su objetivo de facturación sumara el funnel del
// VSL y el de renovación. Lo que se prueba es lo que se puede equivocar sin que nada se vea roto: un OKR viejo que
// cambia de número al leerse, y un pago que cuenta en el funnel equivocado (o en dos).
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leerFunnelIds, sanearFunnelIds, alternarFunnel, rotuloDeFunnels, funnelDelMomento, sumarEnFunnels,
  TOPE_FUNNELS_ELEGIDOS, type Agregado, type Hecho,
} from '../lib/funnels-elegidos';

test('un OKR viejo (sin nada guardado) se lee como «todos»: mide lo mismo que antes', () => {
  assert.deepEqual(leerFunnelIds(null), []);
  assert.deepEqual(leerFunnelIds(undefined), []);
  assert.deepEqual(leerFunnelIds([]), []);
});

test('un valor suelto de antes se lee como una lista de uno', () => {
  assert.deepEqual(leerFunnelIds(29), [29]);
  assert.deepEqual(leerFunnelIds('29'), [29]);
  assert.deepEqual(leerFunnelIds([1, '29']), [1, 29]);
});

test('lo que llega de afuera se sanea: sin repetidos, sin basura, con tope', () => {
  assert.deepEqual(sanearFunnelIds([3, 3, -1, 0, 1.5, 'x', '7', null]), [3, 7]);
  const muchos = Array.from({ length: 50 }, (_, i) => i + 1);
  assert.equal(sanearFunnelIds(muchos).length, TOPE_FUNNELS_ELEGIDOS);
});

test('el desplegable: «Todos» vacía, tocar prende o apaga, apagar el último vuelve a «Todos»', () => {
  assert.deepEqual(alternarFunnel([1, 29], ''), []);
  assert.deepEqual(alternarFunnel([], '29'), [29]);
  assert.deepEqual(alternarFunnel([29], '1'), [29, 1]);
  assert.deepEqual(alternarFunnel([29, 1], '29'), [1]);
  assert.deepEqual(alternarFunnel([1], '1'), []);
  assert.deepEqual(alternarFunnel([1], 'basura'), [1]);
});

test('el botón dice CUÁLES, y uno borrado se dice', () => {
  const fs = [{ id: 1, nombre: 'Negocio que ESCALA' }, { id: 29, nombre: 'Renovación' }, { id: 5, nombre: 'Taller' }];
  assert.equal(rotuloDeFunnels([], fs), 'Todos los funnels');
  assert.equal(rotuloDeFunnels([29], fs), 'Renovación');
  assert.equal(rotuloDeFunnels([1, 29], fs), 'Negocio que ESCALA y Renovación');
  assert.equal(rotuloDeFunnels([1, 29, 5], fs), 'Negocio que ESCALA, Renovación y 1 más');
  assert.equal(rotuloDeFunnels([99], fs), 'Un funnel que ya no está');
});

// El caso del pedido, con los números del ws1 (17/10/2026): la casa de todos es el funnel del negocio (id 1) y a cinco
// se los agregó a «Renovación» (id 29) el 13/10. Sus cuotas son de la venta del VSL, cobradas antes.
const CASAS = new Map<number, number | null>([[21, 1], [28, 1], [700, 1]]);
const AGREGADOS = new Map<number, Agregado[]>([[21, [{ funnel: 29, desde: '2026-10-13T15:02:00Z' }]], [28, [{ funnel: 29, desde: '2026-10-13T15:02:00Z' }]]]);
const PAGOS: Hecho[] = [
  { lead: 21, fecha: '2026-08-15', valor: 2333.33 }, // cuota del VSL, antes de agregarlo
  { lead: 28, fecha: '2026-08-09', valor: 2500 },
  { lead: 21, fecha: '2026-10-20', valor: 3000 }, // la renovación, después
  { lead: 700, fecha: '2026-10-20', valor: 1000 }, // un cliente sólo del VSL
  { lead: null, fecha: '2026-10-20', valor: 999 }, // un pago sin lead no es de ningún funnel
];

// PROBADO ROMPIENDOLO: con `return casa;` en vez de `return mejor ? mejor.funnel : casa;` (la regla vieja, «sólo la
// casa»), este archivo pasa de **pass 8 / fail 0** a **pass 6 / fail 2**: Renovación da 0 y el VSL se queda con la
// renovación.
test('⚠️ cada pago cuenta en el funnel donde estaba el lead ESE día: Renovación no da cero', () => {
  assert.equal(sumarEnFunnels(PAGOS, [29], CASAS, AGREGADOS), 3000);
  assert.equal(sumarEnFunnels(PAGOS, [1], CASAS, AGREGADOS), 2333.33 + 2500 + 1000);
});

test('⚠️ los dos juntos suman el total de esos leads sin contar nada dos veces', () => {
  assert.equal(sumarEnFunnels(PAGOS, [1, 29], CASAS, AGREGADOS), 2333.33 + 2500 + 3000 + 1000);
});

test('el funnel del momento: el último agregado a esa fecha, el mismo día cuenta, si no la casa', () => {
  const ag: Agregado[] = [{ funnel: 29, desde: '2026-10-13T15:00:00Z' }, { funnel: 40, desde: '2026-11-01T10:00:00Z' }];
  assert.equal(funnelDelMomento(1, ag, '2026-10-12'), 1);
  assert.equal(funnelDelMomento(1, ag, '2026-10-13'), 29);
  assert.equal(funnelDelMomento(1, ag, '2026-10-31T23:00:00Z'), 29);
  assert.equal(funnelDelMomento(1, ag, '2026-11-02'), 40);
  assert.equal(funnelDelMomento(null, [], '2026-11-02'), null);
});
