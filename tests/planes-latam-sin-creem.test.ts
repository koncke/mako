// =============================================================================
// Los planes desde Latinoamérica fuera de Argentina, SIN CREEM (5/11/2026)
// =============================================================================
// Creem rechazó la tienda de MaKo el 5/11/2026, de forma definitiva (docs/creem-retiros.md), y la plataforma ya no tiene sus
// claves. Desde el 31/10 Creem era la pasarela de LatAm fuera de Argentina (lib/compra-plan-reglas.ts, `pasarelasDelPais`).
// Acá se fija, EJECUTANDO, que sin ella quien compra desde México, Colombia o Chile NUNCA ve un error:
//   1. la regla: sin un merchant of record conectado, LatAm fuera del país de Mercado Pago queda con Stripe si está, y si no,
//      sin ninguna (y entonces /planes dice «Quiero …» y la página del plan pide los datos con `TEXTO_SIN_PASARELA`);
//   2. el checkout REAL (tests/_planes-latam-sin-creem-hijo.ts): con sólo el Mercado Pago argentino conectado, desde México
//      ningún plan se cobra en línea, la página no ofrece pasarela, y una compra de una pestaña de antes —con
//      `pasarela: 'creem'`— queda como PEDIDO con un 200: con su ficha en el CRM de MaKo, en «Quieren entrar», sin cobro y
//      sin un solo pedido a Creem. Argentina sigue con Mercado Pago, y con Stripe conectado México se cobra con Stripe.
//
// PROBADO ROMPIÉNDOLO (5/11/2026), con el archivo en verde (3 / 0), una rotura por vez y restaurada (pasan / fallan):
//   · `iniciarCompraDePlan` vuelve a contestar 503 sin pasarela (sin el pedido)                    → 2 / 1
//   · `pasarelasDelPais` sin el filtro de `soloEnSuPais` (Mercado Pago argentino a México)        → 0 / 3
//   · la preferencia de LatAm al revés (`merchantOfRecord !== enLatam`)                             → 2 / 1
// Correr: node --import tsx --test tests/planes-latam-sin-creem.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { botonDelPlan, pasarelasDelPais, TEXTO_SIN_PASARELA } from '../lib/compra-plan-reglas';

const RAIZ = join(__dirname, '..');

// El hijo corre UNA vez y los dos tests leen su salida. Lo que imprime antes de la marca (logs del camino) no es el JSON.
let salidaDelHijo: ReturnType<typeof JSON.parse> | null = null;
function hijo(): ReturnType<typeof JSON.parse> {
  if (salidaDelHijo) return salidaDelHijo;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_planes-latam-sin-creem-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const i = salida.lastIndexOf('@@HIJO@@');
  assert.ok(i >= 0, `el hijo no contestó: ${salida.slice(-400)}`);
  salidaDelHijo = JSON.parse(salida.slice(i + '@@HIJO@@'.length));
  return salidaDelHijo;
}

const MP_AR = { pasarela: 'mercadopago' as const, moneda: 'ARS' };
const ST = { pasarela: 'stripe' as const, moneda: 'USD' };
const CREEM = { pasarela: 'creem' as const, moneda: 'USD' };
const LATAM_SIN_AR = ['MX', 'CO', 'CL', 'PE', 'UY', 'BR', 'EC', 'GT', 'DO', 'PY', 'BO', 'CR', 'PA', 'SV', 'HN', 'NI', 'VE', 'PR', 'CU'];

test('1. sin Creem, LatAm fuera de Argentina: Stripe si está; si no, ninguna (y se piden los datos)', () => {
  for (const pais of LATAM_SIN_AR) {
    assert.deepEqual(pasarelasDelPais(pais, [MP_AR, ST]), [ST], `${pais}: con Stripe conectado, Stripe (nunca la Mercado Pago argentina)`);
    assert.deepEqual(pasarelasDelPais(pais, [MP_AR]), [], `${pais}: con sólo la Mercado Pago argentina, ninguna: no se ofrece un pago que la rechaza`);
    assert.deepEqual(pasarelasDelPais(pais, []), [], pais);
  }
  assert.deepEqual(pasarelasDelPais('AR', [MP_AR]), [MP_AR], 'Argentina sigue con Mercado Pago');
  assert.deepEqual(pasarelasDelPais('US', [MP_AR, ST]), [ST], 'afuera de LatAm, Stripe');
  // Lo que hacía antes con Creem conectado no cambió: el merchant of record sigue mandando en LatAm (por su capacidad).
  assert.deepEqual(pasarelasDelPais('MX', [MP_AR, ST, CREEM]), [CREEM]);
  // Lo que ve quien no puede pagar en línea: «Quiero …», y la página le pide los datos (nunca un error).
  assert.equal(botonDelPlan({ id: 'esencial', nombre: 'MaKo Esencial', cobrable: false, sufijo: '' }).texto, 'Quiero MaKo Esencial');
  assert.match(TEXTO_SIN_PASARELA, /Déjanos tus datos/);
});

test('2. el checkout REAL desde México sin Creem: nada se cobra en línea, y una compra queda como pedido con un 200', () => {
  const r = hijo();
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.sinMock, [], 'una tabla que el hijo no preparó');
  assert.ok(r.cobrablesMx.length > 0 && r.cobrablesMx.every((c: boolean) => c === false), '/planes desde México: ningún «Empezar», todos «Quiero …»');
  assert.deepEqual(r.pasarelas.MX, [], 'la página del plan desde México no ofrece pasarela: muestra TEXTO_SIN_PASARELA y el pedido');
  assert.deepEqual(r.pasarelas.CO, []);
  assert.deepEqual(r.pasarelas.CL, []);
  assert.deepEqual(r.pasarelas.AR, ['mercadopago'], 'Argentina no se rompió');
  for (const k of ['compraMx', 'compraMxSinElegir']) {
    assert.equal(r[k].status, 200, `${k}: nunca un error (antes, un 503)`);
    assert.equal(r[k].pedido, true, `${k}: lo que escribió quedó como pedido`);
    assert.equal(r[k].error, undefined, k);
  }
  assert.equal(r.trasMx.cobros, 0, 'ningún cobro abierto');
  assert.equal(r.trasMx.leads, 2, 'su ficha en el CRM de MaKo');
  assert.equal(r.trasMx.pedidos, 2, 'y en «Quieren entrar»');
  assert.ok(r.trasMx.detalle.every((d: string) => /Quiere MaKo Esencial/.test(d)));
  assert.equal(r.alCreem, 0, 'ni un pedido a Creem');
});

test('3. con Stripe conectado, México se cobra con Stripe y Argentina sigue con Mercado Pago', () => {
  const r = hijo();
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.conStripe.MX, ['stripe']);
  assert.deepEqual(r.conStripe.AR, ['mercadopago']);
  assert.ok(r.conStripe.cobrablesMx.every((c: boolean) => c === true), 'con Stripe, «Empezar»');
});
