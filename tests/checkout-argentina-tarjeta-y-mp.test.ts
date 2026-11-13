// =============================================================================
// El checkout de un plan desde Argentina: Mercado Pago Y tarjeta (13/11/2026)
// =============================================================================
// Visto desde Argentina en /planes/<plan>: «NO apareció el botón de Mercado Pago, sólo tarjeta. Tiene que ofrecer tarjeta y
// Mercado Pago». Medido en producción (sólo lectura) ese día: la Mercado Pago de la plataforma está bien (real, sitio MLA,
// pesos), los planes tienen precio en pesos, y la Stripe está con claves de PRUEBA. Con todo leído, desde Argentina salía
// SÓLO Mercado Pago (la regla del 27/10). «Sólo tarjeta» salía cuando Mercado Pago NO llegaba a la lista:
//   · `credDelCliente` contesta `null` también cuando la base no contesta, y una Mercado Pago que no contestó una vez
//     (`leerCuentaMp`) la sacaba en silencio;
//   · y en ese mismo pedido la clave de Stripe sin leer daba `modoDeClaveStripe(null) === null`, que NO es 'prueba': la
//     Stripe de PRUEBA pasaba por real y se le ofrecía al público. Desde Argentina, la única opción: la tarjeta (de prueba).
// LO QUE SE CUIDA:
//   1. en el país de Mercado Pago, el checkout ofrece Mercado Pago (primero) Y la tarjeta (`pasarelasParaOfrecer`); donde no
//      elige nadie (`pasarelasDelPais`: el primer plan propio, la agencia) sigue Mercado Pago sola;
//   2. lo que no se sabe que es real no lo es (`opcionStripe`): una clave sin leer no se ofrece;
//   3. el checkout REAL (tests/_checkout-ar-tarjeta-y-mp-hijo.ts): con un reintento, una caída de una vez no saca a Mercado
//      Pago; con todo caído no se ofrece nada (la página pide los datos), nunca la Stripe de prueba al público.
//
// PROBADO ROMPIÉNDOLO (13/11/2026), con el archivo en verde (5 / 0), una rotura por vez y restaurada (pasan / fallan):
//   · `pasarelasParaOfrecer` sin la tarjeta (la regla de antes)                                    → 2 / 3 (1, 3 y 4)
//   · la rama de Stripe como antes (`prueba: modoDeClaveStripe(...) === 'prueba'`, sin `opcionStripe`)  → 3 / 2 (2 y 5)
//   · `leerCuentaMp` sin el reintento                                                               → 3 / 2 (2 y 4)
//   · `claveDeLaPasarela` sin el reintento (una sola lectura)                                       → 3 / 2 (2 y 4)
// ⚠️ La base del hijo falla con un 500, no con un 503: postgrest-js reintenta SOLO los 503 y 520 de un GET (3 veces, esperando
// 1, 2 y 4 s). Con un 503 la última rotura pasaba el checkout real (sólo la cazaba el test de la fuente) y el archivo tardaba 50 s.
// Correr: node --import tsx --test tests/checkout-argentina-tarjeta-y-mp.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esFalloPasajero, opcionStripe, pasarelasDelPais, pasarelasParaOfrecer } from '../lib/compra-plan-reglas';
import type { Pasarela } from '../lib/cobros-tipos';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

type Oferta = { pasarela: Pasarela; moneda: string; monto: number };
const MP: Oferta = { pasarela: 'mercadopago', moneda: 'ARS', monto: 73_555 };
const ST: Oferta = { pasarela: 'stripe', moneda: 'USD', monto: 47 };
const CREEM: Oferta = { pasarela: 'creem', moneda: 'USD', monto: 47 };

// El hijo corre UNA vez y los tests leen su salida. Lo que imprime antes de la marca (logs del camino) no es el JSON.
let salidaDelHijo: ReturnType<typeof JSON.parse> | null = null;
function hijo(): ReturnType<typeof JSON.parse> {
  if (salidaDelHijo) return salidaDelHijo;
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_checkout-ar-tarjeta-y-mp-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const i = salida.lastIndexOf('@@HIJO@@');
  assert.ok(i >= 0, `el hijo no contestó: ${salida.slice(-400)}`);
  salidaDelHijo = JSON.parse(salida.slice(i + '@@HIJO@@'.length));
  return salidaDelHijo;
}

test('1. en Argentina el checkout ofrece Mercado Pago Y la tarjeta; donde no elige nadie, Mercado Pago sola', () => {
  assert.deepEqual(pasarelasParaOfrecer('AR', [MP, ST], []), [MP, ST], 'Mercado Pago primero (el precio en pesos del resumen) y la tarjeta');
  assert.deepEqual(pasarelasParaOfrecer('AR', [ST, MP], []), [MP, ST], 'el orden no depende del de las conectadas');
  // La tarjeta es la que le tocaría a ese país sin Mercado Pago: en LatAm, un merchant of record si lo hubiera.
  assert.deepEqual(pasarelasParaOfrecer('AR', [MP, ST, CREEM], []), [MP, CREEM]);
  assert.deepEqual(pasarelasParaOfrecer('AR', [MP], []), [MP], 'sin tarjeta real conectada, Mercado Pago');
  assert.deepEqual(pasarelasParaOfrecer('AR', [ST], []), [ST], 'sin precio en pesos, la tarjeta');
  // Afuera, nada cambia: la Mercado Pago argentina rechaza a quien no es de su país.
  assert.deepEqual(pasarelasParaOfrecer('MX', [MP, ST], []), [ST]);
  assert.deepEqual(pasarelasParaOfrecer('US', [MP, ST], []), [ST]);
  assert.deepEqual(pasarelasParaOfrecer(null, [MP, ST], []), [MP, ST]);
  // La de prueba (sólo el super admin) no se duplica con la real.
  assert.deepEqual(pasarelasParaOfrecer('AR', [MP], [ST]), [MP, ST]);
  assert.deepEqual(pasarelasParaOfrecer('AR', [MP, ST], [{ ...ST, monto: 1 }]), [MP, ST]);
  // `pasarelasDelPais` no cambia: el primer plan propio y la agencia, que no preguntan, siguen en pesos.
  assert.deepEqual(pasarelasDelPais('AR', [MP, ST]), [MP]);
  assert.match(fuente('lib/compra-plan.ts'), /const opciones = pasarelasDelPais\(p\.pais \?\? null,/);
});

test('2. lo que no se sabe que es real no lo es: una clave de Stripe sin leer no se ofrece', () => {
  assert.equal(opcionStripe(null), null, 'antes: `null === \'prueba\'` era false, o sea REAL');
  assert.deepEqual(opcionStripe('prueba'), { pasarela: 'stripe', moneda: 'USD', prueba: true });
  assert.deepEqual(opcionStripe('real'), { pasarela: 'stripe', moneda: 'USD', prueba: false });
  for (const s of [0, 429, 500, 502, 503]) assert.equal(esFalloPasajero(s), true, String(s));
  for (const s of [400, 401, 403, 404]) assert.equal(esFalloPasajero(s), false, `${s}: un token malo no mejora reintentando`);
  const f = fuente('lib/compra-plan.ts');
  const monedas = f.slice(f.indexOf('async function monedasDeLaPlataforma('), f.indexOf('export async function ofertaDelPlan('));
  assert.match(monedas, /const st = opcionStripe\(modoDeClaveStripe\(await claveDeLaPasarela\('STRIPE_SECRET_KEY', ws\)\)\);\n\s*if \(st\) out\.push\(st\);/);
  assert.match(monedas, /const token = await claveDeLaPasarela\('MERCADOPAGO_ACCESS_TOKEN', ws\);/);
  assert.match(monedas, /if \(!c\.ok && esFalloPasajero\(c\.status\)\) c = await leerCuentaMp\(token\);/);
  assert.match(monedas, /const v = \(await credDelCliente\(clave, ws\)\) \?\? \(await credDelCliente\(clave, ws\)\);/);
});

test('3. el checkout REAL con las dos reales: desde Argentina Mercado Pago y tarjeta, y la compra con tarjeta abre el pago', () => {
  const r = hijo();
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.sinMock, [], 'una tabla que el hijo no preparó');
  assert.deepEqual(r.ambas.AR, ['mercadopago', 'stripe']);
  assert.deepEqual(r.ambas.MX, ['stripe'], 'México sigue sin la Mercado Pago argentina');
  assert.deepEqual(r.ambas.US, ['stripe']);
  assert.deepEqual([...r.ambas.sinPais].sort(), ['mercadopago', 'stripe']);
  // Sin elegir, se le pregunta con las dos; con la tarjeta, el link de pago de Stripe.
  assert.equal(r.compraArSinElegir.status, 409);
  assert.deepEqual(r.compraArSinElegir.elegir, ['mercadopago', 'stripe']);
  assert.equal(r.compraArTarjeta.status, 200, JSON.stringify(r.compraArTarjeta));
  assert.match(String(r.compraArTarjeta.link), /^https:\/\/mako\.test\/pagar\//);
  assert.equal(r.checkoutsStripe, 1, 'abrió la sesión de Stripe');
});

test('4. una caída de UNA vez no saca a Mercado Pago (el reporte: «sólo tarjeta»)', () => {
  const r = hijo();
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.mpNoContestaUnaVez, ['mercadopago', 'stripe'], 'Mercado Pago no contestó una vez: se reintenta');
  assert.deepEqual(r.tokenNoSeLeeUnaVez, ['mercadopago', 'stripe'], 'la base no devolvió el token una vez: se reintenta');
  assert.equal(r.avisosConReintento, 0, 'con el reintento no hay nada que avisar');
});

test('5. la Stripe de PRUEBA nunca al público, tampoco con su clave sin leer; con todo caído, nada (la página pide los datos)', () => {
  const r = hijo();
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.stripeDePrueba.publicoAR, ['mercadopago'], 'hoy en producción: al público, Mercado Pago');
  assert.deepEqual(r.stripeDePrueba.superAdminAR, ['mercadopago', 'stripe'], 'el super admin hace la prueba de humo');
  assert.deepEqual(r.stripeDePrueba.publicoMX, []);
  // Antes: ['stripe'] en los dos, con la clave de PRUEBA tomada por real.
  assert.deepEqual(r.todoCaido.AR, []);
  assert.deepEqual(r.todoCaido.MX, []);
  assert.ok(r.todoCaido.cobrablesAR.every((c: boolean) => c === false), '/planes: «Quiero …», no «Empezar»');
  assert.ok(r.avisosCaido > 0, 'y queda en el log por qué no se ofreció');
});
