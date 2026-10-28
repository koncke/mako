// =============================================================================
// Un cobro de MaKo se paga sólo con la sesión que MaKo armó para ÉL, y por lo que pide (28/10/2026)
// =============================================================================
// LO QUE PASABA (la verificación de 3ca2d8328, C:/dev/revisiones/2810-verificacion-3ca2d8328.md, «El cruce»): el aviso de
// Stripe encuentra el cobro por el `client_reference_id`, y un Payment Link lo acepta en su URL. Una venta de US$1 por un link
// del negocio con `?client_reference_id=<token>` (el token viaja en /pagar/<token>, y la landing de Mauricio copia ese
// parámetro a cada link de Stripe) marcaba PAGADO un cobro de MaKo de US$1.500: la cuota, el lead ganado, el historial.
// Estaba en main desde antes de MAU-10; con los negocios vendiendo por Payment Link, la entrada es real.
//
// LO QUE SE CUIDA ACÁ:
//   · la sesión tiene que ser la de ESTE cobro (la metadata `mako_cobro` que pone MaKo, o la sesión guardada en el cobro) y
//     nunca de un Payment Link;
//   · lo cobrado alcanza: el monto y la moneda del cobro (o los de origen, si Stripe le cobró en otra moneda);
//   · si no cuadra, no se asienta y queda un ticket, una vez por sesión; un pago diferido que FALLÓ tampoco marca el cobro.
//
// El rojo-verde de punta a punta, por la ruta real: C:/dev/revisiones/scratch-3ca2/B-refuta/refuta.ts, bloque H2 (antes, el
// cobro 77 quedaba pagado en los 4 casos; ahora queda pendiente, sin cuota y con el lead abierto).
// Probado rompiéndolo (28/10/2026): al pie del archivo.
// Correr: node --import tsx --test tests/cobro-sesion-ajena.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sesionDelCobro } from '../lib/cobros-eventos';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const TOKEN = 'TokEnDeUnCobroDeMaKo_77-abcdefgh';
const COBRO = { token: TOKEN, monto: 1500, moneda: 'USD', proveedor_ref: 'cs_live_SESIONDEMAKO77' };
const deMaKo = { id: 'cs_live_SESIONDEMAKO77', metadata: { mako_cobro: TOKEN }, paymentLink: null, monto: 1500, moneda: 'USD' };

test('la sesión que MaKo armó para este cobro, por lo que pide: se asienta', () => {
  assert.deepEqual(sesionDelCobro(COBRO, deMaKo, 'aprobado'), { ok: true });
  // Una sesión anterior del MISMO cobro (la que se rehízo al vencer) trae la metadata: también es suya.
  assert.deepEqual(sesionDelCobro(COBRO, { ...deMaKo, id: 'cs_live_VIEJA' }, 'aprobado'), { ok: true });
  // La sesión guardada en el cobro, aunque viniera sin metadata.
  assert.deepEqual(sesionDelCobro(COBRO, { ...deMaKo, metadata: {} }, 'aprobado'), { ok: true });
  // Stripe le cobró en pesos mexicanos (el precio adaptado al país): vale el monto de origen.
  assert.deepEqual(sesionDelCobro(COBRO, { ...deMaKo, monto: 25_875, moneda: 'MXN', montoOrigen: 1500, monedaOrigen: 'USD' }, 'aprobado'), { ok: true });
  assert.deepEqual(sesionDelCobro({ ...COBRO, moneda: 'usd' }, { ...deMaKo, moneda: 'usd' }, 'aprobado'), { ok: true }, 'la moneda, sin importar mayúsculas');
});

test('el cruce: un Payment Link con el token del cobro, por US$1 o por US$1.500, NUNCA paga el cobro de MaKo', () => {
  const link = { id: 'cs_live_ATAQUE100', metadata: {}, paymentLink: 'plink_DONACION', monto: 1, moneda: 'USD' };
  const r1 = sesionDelCobro(COBRO, link, 'aprobado');
  assert.ok(!r1.ok && /Payment Link/.test(r1.motivo));
  assert.ok(!sesionDelCobro(COBRO, { ...link, monto: 1500 }, 'aprobado').ok, 'aunque el monto alcance: no es la sesión de MaKo');
  assert.ok(!sesionDelCobro(COBRO, { ...link, metadata: { mako_cobro: TOKEN } }, 'aprobado').ok, 'ni con la metadata copiada');
  assert.ok(!sesionDelCobro(COBRO, link, 'fallido').ok, 'un pago diferido que falló en un link ajeno tampoco marca el cobro');
});

test('una sesión que no es la de este cobro, o que cobró menos o en otra moneda, no se asienta', () => {
  const r = sesionDelCobro(COBRO, { ...deMaKo, id: 'cs_live_OTRA', metadata: { mako_cobro: 'OtroCobro' } }, 'aprobado');
  assert.ok(!r.ok && /no es la que MaKo armó/.test(r.motivo));
  const menos = sesionDelCobro(COBRO, { ...deMaKo, monto: 1 }, 'aprobado');
  assert.ok(!menos.ok && /cobró 1 USD y el cobro es de 1500 USD/.test(menos.motivo), menos.ok ? '' : menos.motivo);
  assert.ok(!sesionDelCobro(COBRO, { ...deMaKo, monto: 1499.98 }, 'aprobado').ok, 'dos centavos menos ya no alcanza');
  assert.ok(!sesionDelCobro(COBRO, { ...deMaKo, moneda: 'MXN' }, 'aprobado').ok, '1500 pesos no son 1500 dólares');
  assert.ok(!sesionDelCobro(COBRO, { ...deMaKo, monto: null }, 'aprobado').ok, 'sin monto, no se sabe: no se asienta');
  assert.deepEqual(sesionDelCobro(COBRO, { ...deMaKo, monto: 0 }, 'fallido'), { ok: true }, 'un pago diferido que falló no trae plata: no se mira el monto');
});

test('la sesión releída trae el monto de origen si Stripe convirtió la moneda', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: 'cs_1', status: 'complete', payment_status: 'paid', currency: 'mxn', amount_total: 2_587_500, livemode: true,
    metadata: { mako_cobro: TOKEN }, client_reference_id: TOKEN,
    currency_conversion: { amount_subtotal: 150_000, amount_total: 150_000, fx_rate: '17.25', source_currency: 'usd' },
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const { leerCheckoutStripe } = await import('../lib/stripe-api');
  const r = await leerCheckoutStripe('sk_test_51MaKoPruebaAbcdefghijklmn', 'cs_1');
  assert.ok(r.ok);
  assert.equal(r.monto, 25_875);
  assert.equal(r.moneda, 'MXN');
  assert.equal(r.montoOrigen, 1500);
  assert.equal(r.monedaOrigen, 'USD');
});

test('el webhook lo mira ANTES de asentar el pago o el fallo, y si no cuadra deja un ticket (uno por sesión) y no tira', () => {
  const W = sinComentarios(fuente('lib/cobros-webhook.ts'));
  const p = W.slice(W.indexOf('export async function procesarEventoStripe('));
  const checkout = p.slice(p.indexOf("if (objeto === 'checkout') {"), p.indexOf("if (objeto === 'factura') {"));
  const mira = checkout.indexOf("const deEste = sesionDelCobro(c, s, aviso.accion === 'fallido' ? 'fallido' : 'aprobado');");
  assert.ok(mira > 0, 'la rama de MaKo del checkout mira la sesión');
  assert.ok(mira > checkout.indexOf('confirmarCheckout('), 'después de confirmar que está pagada');
  assert.ok(mira < checkout.indexOf('aplicarPagoFallido('), 'antes de marcar el fallo');
  assert.ok(mira < checkout.indexOf('aplicarPagoAprobado('), 'antes de asentar el pago');
  assert.match(checkout, /if \(!deEste\.ok\) \{\n\s*if \(aviso\.accion !== 'fallido'\) await avisarSesionQueNoCuadra\(ws, c, s, deEste\.motivo\);\n\s*return ignorado\(deEste\.motivo, c\.id\);/);
  const aviso = W.slice(W.indexOf('async function avisarSesionQueNoCuadra('));
  const cuerpo = aviso.slice(0, aviso.indexOf('\n}\n'));
  assert.match(cuerpo, /crearTicket\(/);
  assert.match(cuerpo, /ref: `cobro-ajeno:\$\{s\.id\}`/, 'los reintentos de Stripe no abren otro ticket');
  assert.match(cuerpo, /\} catch \(e\) \{/, 'un ticket que no se pudo abrir no hace reintentar a Stripe');
});

// Probado rompiéndolo (28/10/2026), una rotura por vez sobre la base en verde (5 pases, 0 fallos), restaurando el archivo
// desde una copia (nunca git). Rota (pases / fallos):
//   · sin el corte por Payment Link                                                     → 4 / 1
//   · sin pedir que la sesión sea la de este cobro                                      → 4 / 1
//   · sin comparar el monto (cualquier monto alcanza)                                   → 4 / 1
//   · sin el monto de origen de la conversión                                           → 4 / 1
//   · `leerCheckoutStripe` sin leer `currency_conversion`                               → 4 / 1
//   · el webhook sin mirar la sesión (el hueco de antes)                                → 4 / 1
