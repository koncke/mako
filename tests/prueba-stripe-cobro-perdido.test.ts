// =============================================================================
// El cobro del día 8 de una prueba de Stripe, si se pierde su aviso, lo recupera el cron (28/10/2026)
// =============================================================================
// EL HUECO: el cron (`reconciliarCobros`, lib/cobros.ts) le pregunta a Stripe por la SESIÓN del checkout
// (`pagoDelLinkEnLaPasarela`). La de una prueba gratis queda `complete` / `no_payment_required` para siempre: lo que cobra
// el día 8 es una FACTURA de la suscripción (`subscription_cycle`), que sólo entra por el aviso `invoice.paid`. Si ese
// aviso se perdía (un deploy, un 5xx que Stripe dejó de reintentar), la plata entraba y el cobro seguía «pendiente»: sin
// cuota en el CRM, sin el lead ganado. Mercado Pago no tenía el hueco: el cron busca el pago por la referencia.
//
// LO QUE SE CUIDA ACÁ:
//   · Stripe lista las facturas PAGADAS de la suscripción, con su metadata y el día en que se pagaron;
//   · de esas, la primera con plata de ESTE cobro (la de US$ 0 del inicio no es un pago, la de otro cobro tampoco);
//   · el cron la usa con el MISMO id que el aviso (el de la factura): si después llega el `invoice.paid`, no es otra cuota.
//
// Probado rompiéndolo (28/10/2026): al pie del archivo.
// Correr: node --import tsx --test tests/prueba-stripe-cobro-perdido.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { primerCobroDeLaPrueba } from '../lib/cobros-eventos';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;
const api = () => import('../lib/stripe-api');

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El cuerpo de una función de un archivo (hasta la función siguiente). */
function cuerpo(rel: string, nombre: string): string {
  const src = fuente(rel);
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\n\/\*\*/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

// ── fetch de mentira (como tests/planes-stripe-afuera.test.ts) ─────────────────────────────────────────────────────

type Llamada = { url: URL; metodo: string };
let llamadas: Llamada[] = [];
let contestar: (l: Llamada) => Response = () => json(500, {});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const l: Llamada = { url, metodo: (init.method ?? 'GET').toUpperCase() };
  llamadas.push(l);
  return contestar(l);
}) as typeof fetch;
const KEY = 'sk_test_51MaKoPruebaAbcdefghijklmn';
const TOKEN = 'TokenDelCobroDeMaKo0123456789abc';

/** Una factura como la devuelve Stripe (basil en adelante: la suscripción y su metadata, en `parent`). */
const factura = (id: string, p: { centavos: number; motivo: string; pagadaEn: number; token?: string }) => ({
  id, object: 'invoice', status: 'paid', amount_paid: p.centavos, currency: 'usd', billing_reason: p.motivo, livemode: false,
  customer_email: 'ana@mx.com', status_transitions: { paid_at: p.pagadaEn },
  parent: { subscription_details: { subscription: 'sub_1', metadata: { mako_cobro: p.token ?? TOKEN } } },
});
const DIA_0 = 1_761_600_000;
const DIA_8 = DIA_0 + 7 * 86_400;

test('Stripe lista las facturas PAGADAS de la suscripción, con su metadata y el día en que se pagaron', async () => {
  const { facturasPagadasStripe } = await api();
  llamadas = [];
  // Stripe las da de la más nueva a la más vieja.
  contestar = () => json(200, { object: 'list', has_more: false, data: [
    factura('in_dia8', { centavos: 9700, motivo: 'subscription_cycle', pagadaEn: DIA_8 }),
    factura('in_dia0', { centavos: 0, motivo: 'subscription_create', pagadaEn: DIA_0 }),
  ] });
  const r = await facturasPagadasStripe(KEY, 'sub_1');
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].metodo, 'GET');
  assert.equal(llamadas[0].url.pathname, '/v1/invoices');
  assert.equal(llamadas[0].url.searchParams.get('subscription'), 'sub_1');
  assert.equal(llamadas[0].url.searchParams.get('status'), 'paid', 'sólo las pagadas: una abierta todavía no es plata');
  assert.ok(r.ok);
  assert.deepEqual(r.facturas.map((f) => [f.id, f.montoPagado, f.moneda, f.motivo, f.suscripcion, f.metadata.mako_cobro, f.pagadoAt]), [
    ['in_dia8', 97, 'USD', 'subscription_cycle', 'sub_1', TOKEN, new Date(DIA_8 * 1000).toISOString()],
    ['in_dia0', 0, 'USD', 'subscription_create', 'sub_1', TOKEN, new Date(DIA_0 * 1000).toISOString()],
  ]);
  contestar = () => json(404, { error: { message: 'No such subscription' } });
  const mal = await facturasPagadasStripe(KEY, 'sub_x');
  assert.ok(!mal.ok && mal.status === 404, 'si Stripe no contesta, quien llama decide (el cron lo cuenta como error)');
});

test('el cobro del día 8: la primera factura CON PLATA de ESTE cobro; la de US$ 0 del inicio y la de otro cobro, no', async () => {
  const { facturasPagadasStripe } = await api();
  const de = async (data: unknown[]) => {
    contestar = () => json(200, { object: 'list', has_more: false, data });
    const r = await facturasPagadasStripe(KEY, 'sub_1');
    assert.ok(r.ok);
    return primerCobroDeLaPrueba(r.facturas, TOKEN);
  };
  const dia8 = factura('in_dia8', { centavos: 9700, motivo: 'subscription_cycle', pagadaEn: DIA_8 });
  const dia0 = factura('in_dia0', { centavos: 0, motivo: 'subscription_create', pagadaEn: DIA_0 });
  assert.deepEqual(await de([dia8, dia0]), {
    proveedorPagoId: 'in_dia8', monto: 97, moneda: 'USD', suscripcionId: 'sub_1', pagadoAt: new Date(DIA_8 * 1000).toISOString(),
  });
  assert.equal(await de([dia0]), null, 'en la prueba todavía: sólo la factura en cero, nada que asentar');
  assert.equal(await de([]), null);
  assert.equal(await de([factura('in_otro', { centavos: 9700, motivo: 'subscription_cycle', pagadaEn: DIA_8, token: 'OtroCobro' }), dia0]), null,
    'una factura de otro cobro no se asienta en éste');
  // Si el cron llega tarde y ya se cobró también el mes 2, el que falta es el PRIMERO (el mes 2 entra por su aviso).
  const mes2 = factura('in_mes2', { centavos: 9700, motivo: 'subscription_cycle', pagadaEn: DIA_8 + 30 * 86_400 });
  assert.equal((await de([mes2, dia8, dia0]))?.proveedorPagoId, 'in_dia8');
});

test('el cron la busca cuando la sesión de una prueba quedó sin pago, y con el MISMO id que el aviso', () => {
  const f = cuerpo('lib/cobros.ts', 'pagoDelLinkEnLaPasarela');
  const prueba = f.indexOf("if (s.pagoEstado === 'no_payment_required' && esPruebaDePlan(c) && c.tipo === 'suscripcion' && s.subscription) {");
  assert.ok(prueba > 0, 'la prueba de Stripe tiene su camino en el cron');
  const resto = f.slice(prueba);
  assert.match(resto, /const facturas = await facturasPagadasStripe\(stripe\.key, s\.subscription\);/);
  assert.match(resto, /if \(!facturas\.ok\) throw new Error\(/, 'si Stripe no contesta, es un error del cron, no un «no pagó»');
  assert.match(resto, /return primerCobroDeLaPrueba\(facturas\.facturas, c\.token\);/);
  // El aviso asienta la factura con su id (lib/cobros-webhook.ts, rama 'factura'): el cron, igual.
  assert.match(fuente('lib/cobros-webhook.ts'), /const conf = confirmarFactura\(aviso\.accion === 'fallido' \? 'fallido' : 'aprobado', f\);/);
  assert.match(fuente('lib/cobros-eventos.ts'), /export function primerCobroDeLaPrueba[\s\S]*?confirmarFactura\('aprobado', f\)/,
    'el mismo filtro que el aviso: pagada, de la suscripción y con plata');
  // Y la prueba ACTIVADA llega a esta lectura: la que no se activó todavía se activa y sigue (`continue`).
  const cron = cuerpo('lib/cobros.ts', 'reconciliarCobros');
  assert.match(cron, /if \(esPruebaDePlan\(c\) && c\.estado === 'pendiente' && !c\.suscripcion_estado\) \{/);
});

// El cron leía los pendientes con `.limit(50)`, y cada compra abierta en /planes es un pendiente que nadie anula (toda compra
// de Stripe arranca como prueba): con 50 más nuevas, la prueba quedaba afuera y el cobro del día 8 no se acreditaba nunca, ni la
// prueba se activaba (la verificación de 3ca2d8328; de punta a punta con el código real:
// C:/dev/revisiones/scratch-3ca2/A-refuta/r1-cron-tope.ts, casos i50, i50_mes2 y j50).
test('el cron lee las pruebas de un plan APARTE y sin el tope de 50: las activadas y las recién compradas', () => {
  const cron = cuerpo('lib/cobros.ts', 'reconciliarCobros');
  const ayudante = cron.slice(cron.indexOf('const pruebas = (activada: boolean) => {'), cron.indexOf('const [pend, pag, anul, pruebasActivas, pruebasSinActivar]'));
  assert.ok(ayudante.length > 0, 'las pruebas tienen su lectura');
  assert.match(ayudante, /\.eq\('estado', 'pendiente'\)\.eq\('tipo', 'suscripcion'\)\.like\('creado_por', 'planes:%:prueba'\)/);
  assert.match(ayudante, /activada \? q\.eq\('suscripcion_estado', 'activa'\) : q\.is\('suscripcion_estado', null\)/);
  assert.match(ayudante, /\.limit\(TOPE_DE_PRUEBAS\)/);
  const tope = Number(/const TOPE_DE_PRUEBAS = (\d+);/.exec(fuente('lib/cobros.ts'))?.[1]);
  assert.ok(tope >= 500, `el seguro de la lectura (${tope}) no puede volver a ser un tope de trabajo`);
  assert.match(cron, /pruebas\(true\),\n\s*pruebas\(false\),\n\s*\]\);/, 'las dos lecturas van con las otras');
  assert.match(cron, /\.\.\.\(pruebasActivas\.data \?\? \[\]\), \.\.\.\(pruebasSinActivar\.data \?\? \[\]\)\]/, 'y entran a la vuelta de los pendientes');
  assert.match(cron, /\.filter\(\(c\) => !vistos\.has\(c\.id\) && \(vistos\.add\(c\.id\), true\)\)/, 'sin repetir la que viene en dos lecturas');
  assert.match(cron, /console\.error\(`\[cobros\] reconciliar ws \$\{ws\}: \$\{TOPE_DE_PRUEBAS\} pruebas/, 'si se llega al seguro, se dice');
  // El patrón del `like` es el de una prueba (`esPruebaDePlan`: /^planes:[a-z0-9-]{1,32}:prueba$/), no el de un plan pagado.
  const like = /^planes:.*:prueba$/;
  assert.ok(like.test('planes:pro:prueba') && like.test('planes:esencial-anual:prueba'));
  assert.ok(!like.test('planes:pro') && !like.test('usuario:7'));
});

// Probado rompiéndolo (28/10/2026), una rotura por vez sobre la base en verde (3 pases, 0 fallos), restaurando el archivo
// desde una copia (nunca git). Rota (pases / fallos):
//   · la factura más NUEVA en vez de la más vieja (el mes 2 en lugar del día 8)        → 2 / 1
//   · sin mirar de qué cobro es la factura                                              → 2 / 1
//   · la factura en cero del inicio cuenta como pago                                    → 1 / 2
//   · listar también las facturas abiertas (sin `status=paid`)                          → 2 / 1
//   · el cron sin el camino de la prueba (el hueco de antes)                            → 2 / 1
// Y el de las pruebas sin el tope de 50 (28/10/2026, base 4 / 0): el seguro vuelve a 50 → 3 / 1; las pruebas leídas no
// entran a la vuelta → 3 / 1. Con el código real (r1-cron-tope.ts apuntado a este árbol): sin las dos lecturas, i50 queda
// pendiente sin cuota y j50 sin activar; con ellas, i50 pagado con in_ana_8, i50_mes2 con las DOS cuotas y j50 activada.
