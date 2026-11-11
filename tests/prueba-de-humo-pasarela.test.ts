// =============================================================================
// La prueba de humo de una pasarela nueva se puede hacer desde Argentina (11/11/2026)
// =============================================================================
// El diseño del 23/10 (lib/compra-plan.ts, `ofertaDelPlan`): una pasarela conectada con claves de PRUEBA no se le ofrece al
// público (el alta no mira el modo: con la 4242 se sacaba una cuenta real), sólo al super admin, que hace la prueba de humo
// antes de pasar a las claves reales. Pero desde el 27/10 la pasarela depende del PAÍS (`pasarelasDelPais`), y en Argentina
// con Mercado Pago conectado la respuesta es «sólo Mercado Pago»: la Stripe de prueba quedaba tapada para el super admin, que
// está en Argentina. O sea: la prueba de humo de Stripe (la cuenta de Leila, 11/11) no se podía hacer.
//
// LO QUE SE CUIDA ACÁ:
//   · al público, igual que antes: sólo las reales, según su país; una de prueba nunca;
//   · al super admin, las reales según su país MÁS las de prueba, sin el filtro del país (elige con cuál paga);
//   · la compra (`iniciarCompraDePlan`) usa la misma oferta, así que lo que se ve es lo que se cobra.
//
// Probado rompiéndolo (11/11/2026): al pie del archivo.
// Correr: node --import tsx --test tests/prueba-de-humo-pasarela.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pasarelasParaOfrecer } from '../lib/compra-plan-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

const MP = { pasarela: 'mercadopago' as const, moneda: 'ARS', monto: 73_555 };
const ST = { pasarela: 'stripe' as const, moneda: 'USD', monto: 47 };

test('el super admin en Argentina ve la Stripe de PRUEBA además de Mercado Pago: puede hacer la prueba de humo', () => {
  assert.deepEqual(pasarelasParaOfrecer('AR', [MP], [ST]), [MP, ST], 'elige con cuál paga');
  assert.deepEqual(pasarelasParaOfrecer('MX', [MP], [ST]), [ST], 'en México, Mercado Pago argentino no; la de prueba sí');
  assert.deepEqual(pasarelasParaOfrecer(null, [MP], [ST]), [MP, ST]);
});

test('al público, como siempre: sólo las reales y según su país; sin ninguna de prueba', () => {
  assert.deepEqual(pasarelasParaOfrecer('AR', [MP, ST], []), [MP], 'en Argentina, la de su país');
  assert.deepEqual(pasarelasParaOfrecer('US', [MP, ST], []), [ST]);
  assert.deepEqual(pasarelasParaOfrecer('AR', [MP], []), [MP]);
});

test('una pasarela que está real Y de prueba no se ofrece dos veces', () => {
  assert.deepEqual(pasarelasParaOfrecer('US', [ST], [{ ...ST, monto: 1 }]), [ST], 'la real gana');
});

test('la oferta del plan separa las reales de las de prueba, y la de prueba sólo con `conPrueba`', () => {
  const f = fuente('lib/compra-plan.ts');
  const oferta = f.slice(f.indexOf('export async function ofertaDelPlan('), f.indexOf('export async function ofertasDeLosPlanes('));
  assert.match(oferta, /const reales = conPrecio\(monedas\.filter\(\(m\) => !m\.prueba\)\);/);
  assert.match(oferta, /const deUnaPrueba = opts\.conPrueba === true \? conPrecio\(monedas\.filter\(\(m\) => m\.prueba\)\) : \[\];/);
  assert.match(oferta, /return \{ plan, pasarelas: pasarelasParaOfrecer\(opts\.pais \?\? null, reales, deUnaPrueba\) \};/);
  // La compra pasa por la misma oferta: lo que se ve es lo que se cobra.
  assert.match(fuente('lib/compra-plan.ts'), /const oferta = await ofertaDelPlan\(p\.plan, opts\);/);
});

// Probado rompiéndolo (11/11/2026), una rotura por vez sobre la base en verde (4 / 0), restaurando el archivo desde una copia:
//   · la de prueba pasa por el filtro del país, como antes (el hueco)                    → 2 / 2
//   · la de prueba también al público                                                    → 3 / 1
//   · la misma pasarela dos veces (real y de prueba)                                     → 3 / 1
// Lo que NO corre acá: Stripe de verdad. La prueba de humo la hace Martín con la clave de PRUEBA de Stripe y la tarjeta
// 4242 (docs/hallazgos-planes-y-cobro.md, «Stripe con la cuenta de Leila»).
