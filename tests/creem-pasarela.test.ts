// =============================================================================
// La TERCERA pasarela: Creem (31/10/2026)
// =============================================================================
// Hasta hoy `Pasarela` tenía DOS valores, y medio código preguntaba `=== 'stripe' ? A : B`. Con dos valores ese
// ternario es correcto; con tres, la rama B se traga al tercero EN SILENCIO — es código válido que corre contra el
// proveedor equivocado, así que no lo ve el compilador ni lo ve un test que no exista. La auditoría encontró 53 lugares
// así. Este archivo fija los que cuestan plata, más el contrato de Creem que se leyó de su documentación.
//
// Lo puro se EJECUTA; el cliente HTTP (`server-only`) se ejecuta con el `Module._load` que stubea 'server-only' y con
// `fetch` interceptado; el cableado que no se puede ejecutar sin base se lee del FUENTE.
//
// PROBADO ROMPIÉNDOLO (31/10/2026), una rotura por vez, restaurando después. Con el código como está: 12 pases, 0
// fallos. Rota (pases / fallos):
//   · `verificarFirmaCreem` devolviendo null sin secreto (o sea aceptando sin verificar)        → 11 / 1
//   · `eventoCreem` leyendo `b.type` en vez de `b.eventType`                                    → 10 / 2
//   · `avisoCreem` tratando `subscription.expired` como una baja                                → 11 / 1
//   · `avisoCreem` tratando `past_due` como 'cancelada' en vez de 'fallido'                      → 11 / 1
//   · `pasarelasDelPais` volviendo al `filter((o) => o.pasarela !== 'mercadopago')` de antes     → 11 / 1
//   · `crearProductoCreem` sin el corte de moneda (mandando ARS a Creem)                         → 11 / 1
//   · `crearProductoCreem` sin el piso de 100 centavos                                           → 11 / 1
//   · `cancelarSuscripcionCreem` sin mandar `mode` (el default sale del panel, no del código)    → 11 / 1
//   · `crearCheckout` sin la rama de Creem (cae a Mercado Pago y le cobra por el proveedor malo) → 11 / 1
//   · el webhook sin el 401 de la firma (acepta un `subscription.paid` de cualquiera)            → 11 / 1
//   · la migración 0358 sin 'creem' en el CHECK de `pasarela_eventos`                            → 11 / 1
//   · `comisionDeLaPasarela` devolviendo sólo el 3,9% (sin el cargo fijo)                        → 11 / 1
// Correr: node --import tsx --test tests/creem-pasarela.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { CAPACIDADES_PASARELA, NOMBRE_PASARELA, PASARELAS, comisionDeLaPasarela, esPasarela, type Pasarela } from '../lib/cobros-tipos';
import { firmarCreem, verificarFirmaCreem } from '../lib/pasarela-firma';
import { avisoCreem, eventoCreem } from '../lib/cobros-eventos';
import { leerPedidoCompra, pasarelasDelPais } from '../lib/compra-plan-reglas';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;
const creemApi = () => import('../lib/creem-api');

/** Lo que pidió el último fetch, para verificar el CUERPO que se le manda a Creem. */
let ultimo: { url: string; metodo: string; headers: Record<string, string>; body: unknown } | null = null;
let contestar: (u: URL) => Response = () => new Response('{}', { status: 200 });
globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const href = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  ultimo = {
    url: href,
    metodo: init?.method ?? 'GET',
    headers: Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>)),
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
  };
  return contestar(new URL(href));
}) as typeof fetch;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const RAIZ = join(__dirname, '..');
/** Sin comentarios y con LF: un `grep` sobre el fuente no tiene que poder pasar por un comentario. */
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const CLAVE = 'creem_1234567890abcdef';

// ─────────────────────────────────────────────────────────────────────────────

test('1. `Pasarela` tiene TRES valores y todas las tablas indexadas por pasarela están completas', () => {
  assert.deepEqual([...PASARELAS], ['stripe', 'mercadopago', 'creem']);
  assert.ok(esPasarela('creem'), 'el guard compartido no reconoce la pasarela nueva');
  assert.ok(!esPasarela('paypal'));
  // Las tablas TOTALES son el mecanismo: la pasarela #4 no compila hasta que alguien decida qué hace en cada una.
  for (const p of PASARELAS) {
    assert.ok(NOMBRE_PASARELA[p], `${p} no tiene nombre para mostrar`);
    assert.ok(CAPACIDADES_PASARELA[p], `${p} no declaró sus capacidades`);
  }
  // Lo que distingue a Creem de las otras dos y es la razón de que exista: se hace cargo del impuesto.
  assert.equal(CAPACIDADES_PASARELA.creem.merchantOfRecord, true);
  assert.equal(CAPACIDADES_PASARELA.stripe.merchantOfRecord, false);
  assert.equal(CAPACIDADES_PASARELA.mercadopago.merchantOfRecord, false);
  // Creem cobra en USD (su enum de moneda es cerrado: USD|EUR). Mercado Pago, en la de SU cuenta.
  assert.equal(CAPACIDADES_PASARELA.creem.monedaFija, 'USD');
  assert.equal(CAPACIDADES_PASARELA.mercadopago.monedaFija, null);
  // El descuento de un solo ciclo: Creem lo tiene de verdad (`duration: 'once'`), Mercado Pago NO.
  assert.equal(CAPACIDADES_PASARELA.creem.descuentoDeUnCiclo, true);
  assert.equal(CAPACIDADES_PASARELA.mercadopago.descuentoDeUnCiclo, false);
  // Y lo que Creem NO sabe hacer, dicho explícito para que nadie lo asuma por parecido con Mercado Pago.
  assert.equal(CAPACIDADES_PASARELA.creem.difiereElPrimerCobro, false);
});

test('2. la comisión de Creem es 3,9% + US$0,40, y en el ticket de US$47 eso pesa casi 5%, no 3,9%', () => {
  // El cargo FIJO manda en un ticket chico: decir «3,9%» sería mentir. 47 × 0,039 + 0,40 = 2,233 → 2,23.
  assert.equal(comisionDeLaPasarela('creem', 47), 2.23);
  const pct = (2.23 / 47) * 100;
  assert.ok(pct > 4.7 && pct < 4.8, `sobre US$47 la comisión real es ${pct.toFixed(2)}%, no 3,9%`);
  // Y en un ticket grande el fijo se diluye: ahí sí se acerca al 3,9%.
  assert.equal(comisionDeLaPasarela('creem', 1000), 39.4);
  // Las otras dos NO se inventan: dependen del país y del plan comercial de cada cuenta.
  assert.equal(comisionDeLaPasarela('stripe', 47), null);
  assert.equal(comisionDeLaPasarela('mercadopago', 47), null);
});

test('3. la firma del aviso es HMAC-SHA256 del cuerpo CRUDO y es FAIL-CLOSED sin secreto', () => {
  const crudo = '{"id":"evt_1","eventType":"subscription.paid","object":{"id":"sub_1"}}';
  const secreto = 'whsec_de_creem';
  const firma = createHmac('sha256', secreto).update(crudo).digest('hex');
  assert.equal(firmarCreem(crudo, secreto), firma, 'el firmador del test y el de producción no coinciden');
  assert.equal(verificarFirmaCreem(crudo, firma, secreto), null, 'una firma válida tiene que pasar');

  // ⚠️ LO MÁS IMPORTANTE DEL ARCHIVO: sin secreto se RECHAZA. El aviso de Creem trae el objeto entero y el
  // `eventType`, así que aceptar sin verificar sería dejar que cualquiera POSTee un `subscription.paid` y se dé de
  // alta un plan de MaKo gratis. (Mercado Pago sí se relee sin firma, porque allá el aviso es un id pelado.)
  assert.equal(verificarFirmaCreem(crudo, firma, null), 'sin-secreto');
  assert.equal(verificarFirmaCreem(crudo, firma, ''), 'sin-secreto');
  // Y sin firma en el header, tampoco.
  assert.equal(verificarFirmaCreem(crudo, null, secreto), 'faltan-headers');
  // Un header con otra forma es «faltan-headers» y no «no-coincide»: distingue «Creem cambió el formato» de
  // «el secreto está mal», que son dos problemas con dos arreglos distintos.
  assert.equal(verificarFirmaCreem(crudo, 't=1,v1=abc', secreto), 'faltan-headers');
  assert.equal(verificarFirmaCreem(crudo, 'no-es-hex', secreto), 'faltan-headers');
  // Otro secreto, no coincide.
  assert.equal(verificarFirmaCreem(crudo, firma, 'otro'), 'no-coincide');
  // Un cuerpo tocado, tampoco.
  assert.equal(verificarFirmaCreem(`${crudo} `, firma, secreto), 'no-coincide');

  // ⚠️ LA TRAMPA DEL EJEMPLO OFICIAL: la doc de Creem arma el mensaje con `JSON.stringify(req.body)`. Re-serializar
  // cambia bytes, y entonces la firma de un cuerpo legítimo DEJA de coincidir. Esto lo demuestra: el mismo objeto con
  // las claves en otro orden da otra firma. Por eso el webhook usa `req.text()` y no `JSON.stringify`.
  const reserializado = JSON.stringify(JSON.parse(crudo));
  const otroOrden = '{"eventType":"subscription.paid","object":{"id":"sub_1"},"id":"evt_1"}';
  assert.equal(JSON.stringify(JSON.parse(otroOrden)) === reserializado, false, 'el ejemplo ya no sirve para demostrarlo');
  assert.equal(verificarFirmaCreem(otroOrden, firmarCreem(crudo, secreto), secreto), 'no-coincide');
});

test('4. el evento se lee de `eventType` (camelCase) y de `created_at` en MILISEGUNDOS', () => {
  const ev = eventoCreem({
    id: 'evt_21mO1jWmU2QHe7u2oFV7y1', eventType: 'subscription.paid', created_at: 1728734327355,
    object: { id: 'sub_6pC2lNB6joCRQIZ1aMrTpi', status: 'active' },
  });
  assert.ok(ev, 'no leyó un evento de Creem bien formado');
  assert.equal(ev!.tipo, 'subscription.paid');
  assert.equal(ev!.id, 'evt_21mO1jWmU2QHe7u2oFV7y1');
  // Milisegundos, no segundos: con segundos esto daría 1970.
  assert.equal(ev!.creado, new Date(1728734327355).toISOString());
  assert.equal(new Date(ev!.creado!).getUTCFullYear(), 2024);

  // ⚠️ UN CUERPO CON FORMA DE STRIPE NO ES UN EVENTO DE CREEM. Es el error que se escribe de memoria: Creem usa
  // `evt_…` igual que Stripe, lo cual hace creíble suponer que el resto también es igual. `type` no es `eventType`.
  assert.equal(eventoCreem({ id: 'evt_1', type: 'subscription.paid', object: {} }), null);
  assert.equal(eventoCreem({ id: 'no_evt', eventType: 'subscription.paid' }), null);
  assert.equal(eventoCreem({ eventType: 'subscription.paid' }), null);
  assert.equal(eventoCreem(null), null);
});

test('5. qué hace MaKo con cada evento: el acceso lo da `subscription.paid`, y `expired` NO corta nada', () => {
  const ev = (tipo: string, object: Record<string, unknown> = {}) =>
    eventoCreem({ id: 'evt_x', eventType: tipo, created_at: Date.now(), object })!;

  // El alta Y la renovación entran por el mismo evento: la doc dice que `subscription.paid` «fires for the first
  // payment and every renewal», y que `subscription.active` es sólo para sincronizar.
  const pago = avisoCreem(ev('subscription.paid', { id: 'sub_1', metadata: { mako_cobro: 'tok' } }));
  assert.equal(pago.accion, 'aprobado');
  assert.equal(pago.accion === 'aprobado' ? pago.suscripcionId : null, 'sub_1');
  assert.equal(pago.accion === 'aprobado' ? pago.token : null, 'tok');
  // `subscription.active` NO da acceso (lo dice la propia doc de Creem).
  assert.equal(avisoCreem(ev('subscription.active', { id: 'sub_1' })).accion, 'ignorar');

  // ⚠️ `subscription.expired` NO ES UNA BAJA. El ejemplo oficial de ese evento llega con `status: "active"`, la doc
  // dice que «payment retries can happen at this stage» y que el estado es terminal SÓLO en `canceled`. Tratarlo como
  // baja le corta el acceso a alguien que todavía puede pagar.
  assert.equal(avisoCreem(ev('subscription.expired', { id: 'sub_1', status: 'active' })).accion, 'ignorar');
  // Y la baja AGENDADA tampoco corta: sigue activa hasta el fin del período que ya pagó.
  assert.equal(avisoCreem(ev('subscription.scheduled_cancel', { id: 'sub_1' })).accion, 'ignorar');

  // `past_due` y `unpaid` son el período de gracia mientras Creem reintenta: es un cobro FALLIDO, no una baja.
  assert.equal(avisoCreem(ev('subscription.past_due', { id: 'sub_1' })).accion, 'fallido');
  assert.equal(avisoCreem(ev('subscription.unpaid', { id: 'sub_1' })).accion, 'fallido');
  // La única baja de verdad.
  assert.equal(avisoCreem(ev('subscription.canceled', { id: 'sub_1' })).accion, 'cancelada');
  // Y la plata que vuelve.
  assert.equal(avisoCreem(ev('refund.created', { id: 'ref_1' })).accion, 'reembolso');
  assert.equal(avisoCreem(ev('dispute.created', { id: 'dis_1' })).accion, 'disputa');
  // Un pago único entra por el checkout, con su id.
  const ch = avisoCreem(ev('checkout.completed', { id: 'ch_1', request_id: 'tok2' }));
  assert.equal(ch.accion, 'aprobado');
  assert.equal(ch.accion === 'aprobado' ? ch.checkoutId : null, 'ch_1');
  assert.equal(ch.accion === 'aprobado' ? ch.token : null, 'tok2');
  // Lo que MaKo no usa, se ignora con rastro (nunca se aplica «por si acaso»).
  assert.equal(avisoCreem(ev('credits.granted')).accion, 'ignorar');
});

test('6. la pasarela por país: Mercado Pago sólo en el suyo, Creem en LatAm, Stripe en el resto — UNA sola', () => {
  const ops = [
    { pasarela: 'stripe' as Pasarela, moneda: 'USD' },
    { pasarela: 'mercadopago' as Pasarela, moneda: 'ARS' },
    { pasarela: 'creem' as Pasarela, moneda: 'USD' },
  ];
  // Argentina: Mercado Pago, en pesos. Es la decisión medida (a un argentino, US$47 con tarjeta de afuera le salen
  // el equivalente a US$71 por IVA y percepciones).
  assert.deepEqual(pasarelasDelPais('AR', ops).map((o) => o.pasarela), ['mercadopago']);

  // ⚠️ LA REGRESIÓN QUE ESTE TEST EXISTE PARA CAZAR. Antes la rama internacional era
  // `filter((o) => o.pasarela !== 'mercadopago')`, que con dos pasarelas quería decir «Stripe» y con tres devuelve
  // Stripe Y Creem juntas. Nadie falla: lo que pasa es que a quien compra se le PREGUNTA con qué pagar (una pantalla
  // de más y una decisión que no le toca). Tiene que venir UNA sola, y la correcta.
  for (const pais of ['MX', 'CO', 'CL', 'BR', 'PE', 'UY', 'EC', 'BO', 'PY', 'CR']) {
    assert.deepEqual(pasarelasDelPais(pais, ops).map((o) => o.pasarela), ['creem'], `${pais} tendría que cobrar por Creem (es merchant of record: se hace cargo del impuesto)`);
  }
  for (const pais of ['US', 'ES', 'DE', 'GB', 'AU']) {
    assert.deepEqual(pasarelasDelPais(pais, ops).map((o) => o.pasarela), ['stripe'], `${pais} tendría que seguir en Stripe`);
  }
  // Sin saber el país (local, o una IP que Vercel no ubica): todas, y elige la persona.
  assert.equal(pasarelasDelPais(null, ops).length, 3);
  // Y si la que le tocaba no está conectada, no se lo deja sin pagar: queda la internacional que haya.
  assert.deepEqual(pasarelasDelPais('MX', [ops[0], ops[1]]).map((o) => o.pasarela), ['stripe']);
  assert.deepEqual(pasarelasDelPais('US', [ops[1], ops[2]]).map((o) => o.pasarela), ['creem']);
  // Mercado Pago NUNCA sale fuera de su país: no puede cobrar ahí (una clienta de México fue rechazada el 27/10).
  assert.equal(pasarelasDelPais('MX', [ops[1]]).length, 0);

  // Y el pedido del checkout público acepta 'creem' (antes lo leía como «no eligió ninguna»).
  const p = leerPedidoCompra({ plan: 'pro', nombre: 'Ana Pérez', email: 'ana@x.com', pasarela: 'creem' });
  assert.equal(p.ok, true);
  assert.equal(p.ok && p.pedido.pasarela, 'creem');
});

test('7. el cliente: `x-api-key`, precio en CENTAVOS, sólo USD/EUR, y el mensual es `every-month`', async () => {
  const { crearProductoCreem, modoDeClaveCreem, esMonedaCreem } = await creemApi();

  // El modo sale del PREFIJO: es lo único que lo dice (una `creem_test_` contra el host de producción da 401).
  assert.equal(modoDeClaveCreem('creem_test_abc12345'), 'prueba');
  assert.equal(modoDeClaveCreem(CLAVE), 'real');
  assert.equal(modoDeClaveCreem('sk_live_abc'), null, 'una clave de Stripe no es una clave de Creem');
  assert.equal(modoDeClaveCreem(null), null);

  contestar = () => json({ id: 'prod_1', name: 'Plan Pro', price: 4700, currency: 'USD', billing_type: 'recurring' });
  const r = await crearProductoCreem(CLAVE, { idem: 'i1', nombre: 'Plan Pro', monto: 47, moneda: 'USD', recurrente: true });
  assert.equal(r.ok, true);
  // ⚠️ `x-api-key`, NO `Authorization: Bearer`. Es el primer error que se escribe de memoria suponiendo que Creem
  // es Stripe con otro nombre.
  assert.equal(ultimo!.headers['x-api-key'], CLAVE);
  assert.equal(ultimo!.headers.Authorization, undefined);
  assert.equal(ultimo!.headers['Idempotency-Key'], 'i1', 'sin esto, un reintento crea un producto duplicado');
  assert.match(ultimo!.url, /^https:\/\/api\.creem\.io\/v1\/products$/);
  const body = ultimo!.body as Record<string, unknown>;
  // CENTAVOS: 47 dólares son 4700.
  assert.equal(body.price, 4700);
  assert.equal(body.currency, 'USD');
  assert.equal(body.billing_type, 'recurring');
  assert.equal(body.billing_period, 'every-month');
  // ⚠️ `recurring_interval` NO se manda con un preset: la doc dice «must be omitted for preset billing periods».
  assert.equal('recurring_interval' in body, false);
  // Impuesto HACIA ADENTRO: el precio que ve la persona es el que paga, y Creem calcula y remite el de su país. Con
  // `exclusive`, un plan de US$47 se cobraría US$56,87 en un país con 21%, y la vitrina promete US$47.
  assert.equal(body.tax_mode, 'inclusive');

  // Una clave de prueba habla con OTRO host: los dos entornos están aislados y las claves no son intercambiables.
  contestar = () => json({ id: 'prod_t', price: 4700, currency: 'USD', billing_type: 'recurring' });
  await crearProductoCreem('creem_test_abc12345', { idem: 'i2', nombre: 'x', monto: 47, moneda: 'USD', recurrente: true });
  assert.match(ultimo!.url, /^https:\/\/test-api\.creem\.io\/v1\//);

  // ⚠️ NO SE INVENTA UNA TASA. Creem fija el precio en USD o EUR (enum cerrado): un monto en pesos NO se convierte,
  // se rechaza antes de salir a la red.
  assert.equal(esMonedaCreem('ARS'), false);
  assert.equal(esMonedaCreem('usd'), true);
  const antes = ultimo!.url;
  const ars = await crearProductoCreem(CLAVE, { idem: 'i3', nombre: 'x', monto: 49900, moneda: 'ARS', recurrente: true });
  assert.equal(ars.ok, false);
  assert.match(ars.ok === false ? ars.error : '', /dólares o en euros/);
  assert.equal(ultimo!.url, antes, 'salió a la red con una moneda que Creem no acepta');

  // El PISO de Creem: «Must be 0 (free product) or at least 100». Un monto que redondea a menos de un dólar se dice
  // acá, con el monto, en vez de volver como un 400 crudo del proveedor.
  const chico = await crearProductoCreem(CLAVE, { idem: 'i4', nombre: 'x', monto: 0.5, moneda: 'USD', recurrente: true });
  assert.equal(chico.ok, false);
  assert.match(chico.ok === false ? chico.error : '', /no cobra menos de 1 USD/);
  assert.equal(ultimo!.url, antes, 'salió a la red con un monto que Creem rechaza');
});

test('8. el descuento del primer mes es `duration: once`, y la baja manda `mode` SIEMPRE', async () => {
  const { crearDescuentoDeEntradaCreem, cancelarSuscripcionCreem, leerSuscripcionCreem } = await creemApi();

  contestar = () => json({ id: 'disc_1', code: 'MAKO9' });
  const d = await crearDescuentoDeEntradaCreem(CLAVE, { idem: 'i1', codigo: 'MAKO9', nombre: '50% del primer mes', pct: 50, productoId: 'prod_1' });
  assert.equal(d.ok, true);
  const body = ultimo!.body as Record<string, unknown>;
  assert.equal(body.type, 'percentage');
  assert.equal(body.percentage, 50);
  // ⚠️ `once` = «Applies only to the first payment», y el ejemplo de la doc es literal «50% off your first month». Con
  // `forever` el cliente se quedaría con la mitad de precio PARA SIEMPRE. Es la diferencia entre una promo y un agujero.
  assert.equal(body.duration, 'once');
  assert.deepEqual(body.applies_to_products, ['prod_1']);
  // Un porcentaje fuera de rango no sale a la red.
  assert.equal((await crearDescuentoDeEntradaCreem(CLAVE, { idem: 'i', codigo: 'X', nombre: 'x', pct: 0, productoId: 'p' })).ok, false);
  assert.equal((await crearDescuentoDeEntradaCreem(CLAVE, { idem: 'i', codigo: 'X', nombre: 'x', pct: 150, productoId: 'p' })).ok, false);

  // ⚠️ CANCELAR NO TIENE `cancel_at_period_end` (eso es Stripe): es `{ mode: 'immediate' | 'scheduled' }`. Y `mode` se
  // manda SIEMPRE explícito, porque sin él el default «can be configured in the store billing settings»: o sea que qué
  // hace «dar de baja» dependería de una pantalla del panel de Creem y no de este código.
  contestar = () => json({ id: 'sub_1', status: 'canceled' });
  await cancelarSuscripcionCreem(CLAVE, 'sub_1', 'idem1', false);
  assert.equal(ultimo!.metodo, 'POST');
  assert.match(ultimo!.url, /\/v1\/subscriptions\/sub_1\/cancel$/);
  assert.equal((ultimo!.body as Record<string, unknown>).mode, 'immediate');
  assert.equal('cancel_at_period_end' in (ultimo!.body as object), false);

  contestar = () => json({ id: 'sub_1', status: 'scheduled_cancel' });
  await cancelarSuscripcionCreem(CLAVE, 'sub_1', 'idem2', true);
  assert.equal((ultimo!.body as Record<string, unknown>).mode, 'scheduled');
  // `onExecute` es camelCase en una API que por lo demás es snake_case. No es un typo de la doc.
  assert.equal((ultimo!.body as Record<string, unknown>).onExecute, 'cancel');

  // ⚠️ LEER UNA SUSCRIPCIÓN ES POR QUERY STRING: `/v1/subscriptions?subscription_id=…`. `/v1/subscriptions/{id}` no
  // existe, y suponerlo (por parecido con Stripe) da 404 en el camino que decide si una baja se asienta.
  contestar = () => json({ id: 'sub_1', status: 'active', metadata: { mako_cobro: 'tok' } });
  const s = await leerSuscripcionCreem(CLAVE, 'sub_1');
  assert.equal(s.ok, true);
  assert.match(ultimo!.url, /\/v1\/subscriptions\?subscription_id=sub_1$/);
  assert.equal(ultimo!.metodo, 'GET');
  assert.equal(s.ok && s.referencia, 'tok');
});

test('9. la transacción separa el monto SIN impuesto del monto pagado: MaKo asienta el del plan', async () => {
  const { buscarTransaccionesCreem } = await creemApi();
  // El ejemplo real de la doc: amount 1000 (sin impuesto), tax_amount 210, amount_paid 1210 (lo que pagó la persona).
  contestar = () => json({ items: [{ id: 'tran_1', status: 'paid', amount: 1000, tax_amount: 210, amount_paid: 1210, currency: 'USD', created_at: '2024-10-12T11:58:38.000Z' }] });
  const r = await buscarTransaccionesCreem(CLAVE, 'sub_1');
  assert.equal(r.ok, true);
  const t = r.ok ? r.transacciones[0] : null;
  // ⚠️ MaKo asienta `amount`, no `amount_paid`: el impuesto lo cobra y lo REMITE Creem (es merchant of record), así
  // que no es ingreso de MaKo. Asentar `amount_paid` inflaría el MRR con plata que nunca fue nuestra.
  assert.equal(t!.monto, 1000);
  assert.equal(t!.montoPagado, 1210);
  assert.equal(t!.impuesto, 210);
});

test('10. el cableado del cobro: Creem tiene su rama en TODO camino que mueve plata, y el `never` cierra el resto', () => {
  const src = fuente('lib/cobros.ts');

  // ⚠️ EL BUG MÁS CARO QUE HABÍA. `crearCheckout` era `if (c.proveedor === 'stripe') {…}` y después, sin else, caía a
  // Mercado Pago: un cobro de Creem en un negocio con MP conectado le creaba una suscripción REAL en Mercado Pago, en
  // la moneda de ESA cuenta. Se le cobraba plata a una persona por el proveedor equivocado, sin un solo error.
  assert.match(src, /switch \(c\.proveedor\) \{[\s\S]*?case 'creem': \{[\s\S]*?crearCheckoutCreem\(c, cred\.creem/);
  assert.match(src, /const _x: never = c\.proveedor;/, 'sin el `never`, la pasarela #4 vuelve a caer por el hueco en silencio');

  // ⚠️ EL MÁS GRAVE. `cancelarSuscripcionCobro` caía en la rama de Mercado Pago: MP contestaba 404 por un id que no es
  // suyo, el `status !== 404` se comía el error como «ya estaba cancelada», y corría `aplicarSuscripcionCancelada`. La
  // base decía «cancelada», el cliente veía su baja hecha, y Creem le seguía cobrando todos los meses.
  assert.match(src, /c\.proveedor === 'creem'\) \{[\s\S]{0,900}cancelarSuscripcionCreem\(creem\.key, susId, idemBaja\(c\.id\), false\)/);
  // Y si Creem no la cancela, se RELEE y sólo vale si de verdad quedó cancelada (el mismo criterio que las otras dos).
  assert.match(src, /leerSuscripcionCreem\(creem\.key, susId\)[\s\S]{0,200}estado === 'canceled'/);

  // Un link anulado que sigue pagable es un DOBLE COBRO: `cerrarLinkEnLaPasarela` no tenía else y Creem se caía por el
  // hueco. Lo que se corta es la suscripción (lo que seguiría cobrando todos los meses).
  assert.match(src, /c\.proveedor === 'creem' && c\.proveedor_ref\)/);

  // El cron de reconciliación es la RED de lo que el aviso perdió (Creem abandona a las 24 h): tiene que ver Creem.
  assert.match(src, /c\.proveedor === 'creem' && creem && c\.proveedor_ref\)/);
  assert.match(src, /\.in\('servicio', \[\.\.\.PASARELAS\]\)/, 'el cron no visitaría a un negocio que sólo tiene Creem');
  // Y las pasarelas conectadas salen de la constante, no de una lista a mano.
  assert.match(src, /return PASARELAS\.filter\(\(p\) => cs\.some\(\(x\) => x\.proveedor === p\)\)/);
  assert.doesNotMatch(src, /\(\['stripe', 'mercadopago'\] as const\)/, 'volvió la lista de dos pasarelas escrita a mano');

  // EL CHECKOUT PÚBLICO TIENE QUE SABER NOMBRAR A CADA PASARELA (31/10/2026): al rótulo le faltaba Creem y el radio salía EN
  // BLANCO. El comprador de /planes no sabe qué está eligiendo y se va — y el que no se leía era el de LatAm. TypeScript lo
  // veía (el Record es total) pero `ignoreBuildErrors` lo dejó pasar, así que acá se mira el texto.
  const compra = fuente('app/planes/[plan]/CompraPlan.tsx');
  const rotulos = compra.slice(compra.indexOf('const NOMBRE'), compra.indexOf('};', compra.indexOf('const NOMBRE')));
  assert.ok(rotulos.length > 0, 'desapareció el catálogo de rótulos `NOMBRE` del checkout público');
  for (const pas of PASARELAS) {
    assert.match(rotulos, new RegExp(`\\b${pas}:\\s*'[^']+'`), `el checkout público no sabe cómo llamar a ${pas}: su opción sale con el rótulo en blanco`);
  }

  // Conectar Creem tiene que ser posible: el despachador era un ternario que mandaba su clave a la API de Mercado Pago.
  const conexion = fuente('lib/cobros-conexion.ts');
  assert.match(conexion, /case 'creem': return descubrirCreem\(ws, clave, autor, opts\)/);
  assert.match(conexion, /const _x: never = p;/);
  // Y sin el secreto del aviso NO se conecta: el webhook es fail-closed, así que una cuenta sin secreto no cobra nada.
  assert.match(conexion, /nadaGuardado: true, error: 'Creem no me dio el secreto del aviso\./);
});

test('11. el webhook: 401 sin firma válida, dedup por el `id` del evento ANTES de aplicar, y el crudo sin re-serializar', () => {
  const src = fuente('app/api/webhooks/creem/route.ts');
  // El cuerpo CRUDO: la firma es sobre esos bytes. `JSON.stringify(req.body)` (lo que hace el ejemplo oficial de la
  // doc de Creem) rompe la verificación en cuanto el cuerpo trae un acento.
  assert.match(src, /const raw = await req\.text\(\);/);
  assert.doesNotMatch(src, /JSON\.stringify\(/, 'el webhook re-serializa el cuerpo: la firma va a dejar de coincidir');
  // El ruteo ESTRICTO antes que nada (lo exige tests/webhooks-ruteo-estricto.test.ts).
  assert.match(src, /wsPorIdentificadorEstricto\('creem', wh\)/);
  // ⚠️ FAIL-CLOSED: todo fallo de firma es 401, incluido «no hay secreto». Sin esto, cualquiera POSTea un
  // `subscription.paid` y se da de alta un plan de MaKo gratis.
  assert.match(src, /const fallo = verificarFirmaCreem\(raw, req\.headers\.get\('creem-signature'\), secreto\);/);
  assert.match(src, /if \(fallo\) \{[\s\S]{0,400}status: 401/);
  // IDEMPOTENCIA: se reclama el evento ANTES de aplicar, y un duplicado no vuelve a cobrar ni a asentar.
  const iReclamo = src.indexOf('reclamarEvento(');
  const iProcesar = src.indexOf('procesarEventoCreem(');
  assert.ok(iReclamo > 0 && iProcesar > iReclamo, 'se aplica antes de deduplicar: un aviso repetido asienta dos veces');
  assert.match(src, /reclamarEvento\(\{ proveedor: 'creem', eventoId: ev\.id/);
  assert.match(src, /if \(reclamo === 'duplicado'\) return Response\.json\(\{ ok: true, evento: ev\.tipo, duplicado: true \}\)/);
  // El CRM corre con el ws ruteado fijado: sin eso, getTenantDb cae al ws1 (Mauricio, que es un cliente).
  assert.match(src, /runWithWorkspace\(wsFinal, \(\) => procesarEventoCreem\(/);

  // Y el procesador NO le cree al cuerpo: relee a Creem antes de aplicar.
  const proc = fuente('lib/cobros-webhook.ts');
  assert.match(proc, /export async function procesarEventoCreem\(/);
  assert.match(proc, /buscarTransaccionesCreem\(key, susId\)/, 'la plata tiene que salir de la relectura, no del aviso');
});

test('12. la migración ensancha los TRES CHECK, y el de `pasarela_eventos` es el que no se puede olvidar', () => {
  const mig = fuente('supabase/migrations/0358_cobros_pasarela_creem.sql');
  for (const tabla of ['cobros', 'pasarela_eventos', 'pagos']) {
    assert.match(mig, new RegExp(`alter table ${tabla} add constraint ${tabla}_proveedor_check`), `falta ensanchar el CHECK de ${tabla}`);
  }
  // Los tres aceptan las tres pasarelas.
  assert.equal((mig.match(/'stripe', 'mercadopago', 'creem'/g) ?? []).length, 3);
  // `pagos.proveedor` SIGUE aceptando null: una cuota cargada a mano no tiene proveedor.
  assert.match(mig, /check \(proveedor is null or proveedor in \('stripe', 'mercadopago', 'creem'\)\)/);
  // Y cada add va con su drop: sin el drop, el add falla por duplicado y el CHECK viejo queda puesto en silencio.
  assert.equal((mig.match(/drop constraint if exists/g) ?? []).length, 3);

  // Las claves de Creem NUNCA viven en process.env (se leen por workspace, cifradas): si la hidratación del ws1 las
  // copiara al entorno, cualquier lectura con `credWs` de otro camino cobraría con la cuenta de Mauricio.
  const cred = fuente('lib/credenciales.ts');
  for (const k of ['CREEM_API_KEY', 'CREEM_WEBHOOK_ID', 'CREEM_WEBHOOK_SECRET']) {
    assert.ok(cred.includes(`'${k}'`), `${k} no está en las listas que la mantienen fuera del entorno`);
  }
  // Y borrar UNA clave de Creem suelta SÓLO su fila de ruteo, no las de las otras cuentas del negocio.
  assert.match(cred, /const porCuenta = PASARELAS\.includes\(servicioDeRuteo as Pasarela\);/);
});
