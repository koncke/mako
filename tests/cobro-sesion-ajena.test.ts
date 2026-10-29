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

// La verificación de a196d5a93 (C:/dev/revisiones/scratch-a196/cobro-mako-refuta/r3-monto-cero-decimales.ts): un cobro de 49900.4
// CLP se arma en Stripe por 49900 (sin decimales), y comparar contra el 49900.4 abría un ticket falso por una sesión que cobró justo
// lo pedido. Se compara en UNIDAD MÍNIMA, como se lo pidió MaKo a Stripe.
test('el monto se compara como se lo pidió MaKo a Stripe: CLP y JPY sin decimales', () => {
  const clp = { ...COBRO, monto: 49900.4, moneda: 'CLP' };
  assert.deepEqual(sesionDelCobro(clp, { ...deMaKo, monto: 49900, moneda: 'CLP' }, 'aprobado'), { ok: true }, 'la sesión cobró los 49900 que se le pidieron');
  assert.deepEqual(sesionDelCobro({ ...COBRO, monto: 4980.3, moneda: 'JPY' }, { ...deMaKo, monto: 4980, moneda: 'JPY' }, 'aprobado'), { ok: true });
  assert.ok(!sesionDelCobro(clp, { ...deMaKo, monto: 49899, moneda: 'CLP' }, 'aprobado').ok, 'un peso menos de lo pedido, no');
  assert.deepEqual(sesionDelCobro({ ...COBRO, monto: 49900.5, moneda: 'CLP' }, { ...deMaKo, monto: 49901, moneda: 'CLP' }, 'aprobado'), { ok: true });
  assert.deepEqual(sesionDelCobro({ ...COBRO, monto: 10.004 }, { ...deMaKo, monto: 10 }, 'aprobado'), { ok: true }, '10.004 USD se pidió como 1000 centavos');
});

// Y lo que el aviso no asienta, el CRON tampoco (antes lo asentaba media hora después): la misma regla, con el mismo ticket.
test('el cron (y el «marcar a mano») pasan por la misma regla antes de asentar una sesión pagada', () => {
  const C = sinComentarios(fuente('lib/cobros.ts'));
  const lee = C.slice(C.indexOf('async function pagoDelLinkEnLaPasarela('));
  const pagada = lee.indexOf("if (s.estado === 'complete' && s.pagoEstado === 'paid' && s.referencia === c.token) {");
  const regla = lee.indexOf("const deEste = sesionDelCobro(c, s, 'aprobado');");
  const pagoId = lee.indexOf("const pagoId = c.tipo === 'suscripcion' ? s.invoice : s.paymentIntent;");
  assert.ok(pagada > 0 && regla > pagada && pagoId > regla, 'la regla, antes de devolver el pago');
  assert.match(lee, /if \(!deEste\.ok\) \{\n\s*await avisarSesionQueNoCuadra\(c\.workspace_id, c, s, deEste\.motivo\);\n\s*return null;/);
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
  // El ticket vive en su módulo desde el 28/10/2026 (lo usan el aviso y el cron). Desde el 29/10 el webhook importa también el de
  // la factura de una suscripción anterior (`avisarFacturaDeOtraSuscripcion`, tests/cobro-reintento.test.ts).
  assert.match(fuente('lib/cobros-webhook.ts'), /import \{[^}]*\bavisarSesionQueNoCuadra\b[^}]*\} from '\.\/cobro-sesion-ajena';/);
  const A = sinComentarios(fuente('lib/cobro-sesion-ajena.ts'));
  const aviso = A.slice(A.indexOf('export async function avisarSesionQueNoCuadra('));
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
// Y los de a196d5a93 (base 7 / 0): el monto contra el del cobro, sin unidad mínima → 6 / 1; el cron sin la regla → 6 / 1. Con
// r3-monto-cero-decimales.ts: 49900.4 CLP y 4980.3 JPY, antes ignorados con un ticket falso; ahora pagados con el aviso. Con
// s1-sesion-ajena.ts: A3 y A4 (menos plata, otra moneda) ya no los asienta el cron media hora después; L1 a L7 siguen pagando.
