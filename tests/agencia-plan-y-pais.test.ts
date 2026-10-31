// =============================================================================
// Las cuentas de agencia: el plan (Esencial o Pro), la pasarela según el país y los topes (29/10/2026)
// =============================================================================
// Llamada con Thiago (agencia de España, 27 clientes): «son los mismos planes, de 47 y 97» [10:24], y para España no salía
// ningún link (sólo cobraba Mercado Pago en pesos). Se fija: Mercado Pago sólo en su país, Stripe afuera (EUR en la zona
// euro con precio en EUR), Stripe primero sin país; el plan abre su capa; los topes corren también para estas cuentas.
//
// Probado rompiéndolo (29/10/2026; base 5 / 0). Una rotura por vez, restaurando (pasan / fallan):
//   · sin país, Mercado Pago primero                                          -> 4 / 1
//   · en la zona euro, USD aunque haya precio en EUR                          -> 4 / 1
//   · el plan Pro abre la capa `completo`                                     -> 4 / 1
//   · `aplicanTopes` no mira la cartera de las agencias                        -> 4 / 1
//   · cambiar el plan toca la capa ANTES que la pasarela                       -> 4 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAPA_DE_PLAN, cobroDeLaCuenta, paisDeZona, planCuentaDe, planDeCapa, abreRenovacionStripe } from '../lib/agencia-cobro-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/?\*.*$/gm, '');

const mp = { pasarela: 'mercadopago' as const, moneda: 'ARS', monto: 47000 };
const st = { pasarela: 'stripe' as const, moneda: 'USD', monto: 47 };

test('la pasarela: MP en su país, Stripe afuera (EUR en la zona euro), Stripe primero sin país', () => {
  assert.deepEqual(cobroDeLaCuenta({ pais: 'AR', opciones: [mp], eur: null }), mp);
  assert.deepEqual(cobroDeLaCuenta({ pais: 'ES', opciones: [st], eur: 44 }), { pasarela: 'stripe', moneda: 'EUR', monto: 44 });
  assert.deepEqual(cobroDeLaCuenta({ pais: 'ES', opciones: [st], eur: null }), st);
  assert.deepEqual(cobroDeLaCuenta({ pais: 'MX', opciones: [st], eur: 44 }), st);
  assert.deepEqual(cobroDeLaCuenta({ pais: null, opciones: [mp, st], eur: null }), st, 'MP rechaza a quien no es de su país');
  assert.equal(cobroDeLaCuenta({ pais: 'ES', opciones: [], eur: 44 }), null);
});

test('el país por la zona horaria de la agencia (cuando no hay encabezado)', () => {
  assert.equal(paisDeZona('Europe/Madrid'), 'ES');
  assert.equal(paisDeZona('America/Argentina/Buenos_Aires'), 'AR');
  assert.equal(paisDeZona('America/Tijuana'), 'MX');
  assert.equal(paisDeZona('Asia/Tokyo'), null);
});

test('el plan de la cuenta abre su capa, y se lee de vuelta', () => {
  assert.equal(planCuentaDe('pro'), 'pro');
  assert.equal(planCuentaDe('cualquiera'), 'esencial');
  assert.equal(CAPA_DE_PLAN.pro, 'agencia');
  assert.equal(CAPA_DE_PLAN.esencial, 'completo');
  assert.equal(planDeCapa('agencia'), 'pro');
  assert.equal(planDeCapa('completo'), 'esencial');
  assert.equal(abreRenovacionStripe('2026-11-20T10:00:00Z', Date.parse('2026-11-14T10:00:00Z')), false);
  assert.equal(abreRenovacionStripe('2026-11-20T10:00:00Z', Date.parse('2026-11-16T10:00:00Z')), true);
});

test('los topes corren también para las cuentas de agencia (una sola pregunta)', () => {
  const t = fuente('lib/topes-plan-server.ts');
  assert.match(t, /if \(\(await suscripcionDeMakoDe\(ws\)\) != null\) return true;/);
  assert.match(t, /from\('agencia_clientes'\)\.select\('estado'\)\.eq\('cliente_ws', ws\)\.neq\('estado', 'revocado'\)/);
  for (const f of ['lib/topes-crm.ts', 'lib/tope-cuentas.ts', 'lib/evolution.ts', 'app/api/equipo/route.ts', 'lib/editor-landing/tope-landings-server.ts']) {
    assert.match(fuente(f), /aplicanTopes\(ws\)/, f);
  }
});

test('cambiar el plan: la pasarela primero, después lo anotado y la capa', () => {
  const c = fuente('lib/agencia-plan.ts');
  const pasarela = c.indexOf('cambiarPrecioStripe(key,');
  const capa = c.indexOf(".update({ capa: CAPA_DE_PLAN[p.plan] })");
  assert.ok(pasarela > 0 && pasarela < capa, `${pasarela} < ${capa}`);
  assert.match(c, /if \(fallo\) return \{ ok: false/);
  assert.match(c, /if \(\(fila as \{ estado: string \}\)\.estado === 'revocado'\) return/);
});
