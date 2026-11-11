// =============================================================================
// Fuera de Argentina se cobra con Stripe; Mercado Pago, sólo en su país (27/10/2026)
// =============================================================================
// La llamada con Leila (Fathom 876470842, 18): en vivo, una clienta de México recibió el link de la Mercado Pago de MaKo y
// MP la rechazó, «No se puede continuar con este pago. La cuenta del vendedor es de otro país»; terminó pagando por Binance.
//
// EL DIAGNÓSTICO: Stripe andaba, pero /planes NUNCA la ofrecía. `monedasDeLaPlataforma` salta toda pasarela que no arma la
// prueba gratis con tarjeta (`PASARELAS_CON_PRUEBA`), y esa lista era sólo ['mercadopago']. Así, cualquiera, de cualquier
// país, salía al checkout de la Mercado Pago argentina. Lo que se cuida acá:
//   · Stripe arma la prueba: `trial_period_days` y la tarjeta siempre, también en la sesión que se rehace al vencer;
//   · la prueba de Stripe se ACTIVA como la de MP (checkout completo + `trialing`), con su huella (`card.fingerprint`) y el
//     día del primer cobro que dice Stripe; un link de una prueba ya empezada no abre otra suscripción;
//   · la pasarela según el país: Mercado Pago sólo en el de su cuenta, y ahí la única; afuera, Stripe; sin país, las dos.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// Correr: node --import tsx --test tests/planes-stripe-afuera.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pasarelasDelPais, paisDelVisitante } from '../lib/compra-plan-reglas';
import { compartenHuella, huellaMp, huellaStripe, partesDeHuella, PASARELAS_CON_PRUEBA } from '../lib/prueba-plan-reglas';
import { confirmarFactura } from '../lib/cobros-eventos';

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

// ── fetch de mentira (como tests/stripe-api.test.ts) ─────────────────────────────────────────────────────────────

type Llamada = { url: URL; metodo: string; cuerpo: string | null };
let llamadas: Llamada[] = [];
let contestar: (l: Llamada) => Response = () => json(500, {});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const l: Llamada = { url, metodo: (init.method ?? 'GET').toUpperCase(), cuerpo: typeof init.body === 'string' ? init.body : null };
  llamadas.push(l);
  return contestar(l);
}) as typeof fetch;
const form = (l: Llamada) => new URLSearchParams(l.cuerpo ?? '');
const KEY = 'sk_test_51MaKoPruebaAbcdefghijklmn';
const TOKEN = 'TokenDelCobroDeMaKo0123456789abc';
const base = {
  idem: 'mako-cobro-7', concepto: 'MaKo Pro', email: 'ana@mx.com', token: TOKEN, ws: 9, cobroId: 7, monto: 97, moneda: 'USD',
  successUrl: 'https://mako.test/pagar/x/listo', cancelUrl: 'https://mako.test/pagar/x/listo?cancelado=1',
};
const sesion = () => json(200, { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1', expires_at: 2_000_000_000 });

// ── Stripe arma la prueba ────────────────────────────────────────────────────────────────────────────────────────

test('Stripe ARMA la prueba: 7 días con la tarjeta siempre; sin prueba, nada de eso', async () => {
  const { crearCheckoutStripe } = await api();
  // Las TRES que arman la prueba con tarjeta (31/10/2026): Creem la hace con `trial_period_days` en el PRODUCTO.
  assert.deepEqual([...PASARELAS_CON_PRUEBA], ['mercadopago', 'stripe', 'creem']);
  llamadas = []; contestar = sesion;
  await crearCheckoutStripe(KEY, { ...base, tipo: 'suscripcion', diasDePrueba: 7 });
  const f = form(llamadas[0]);
  assert.equal(f.get('mode'), 'subscription');
  assert.equal(f.get('subscription_data[trial_period_days]'), '7', 'el primer cobro, a los 7 días');
  assert.equal(f.get('payment_method_collection'), 'always', 'la prueba es CON tarjeta');
  // Y SÓLO con tarjeta (28/10/2026, la verificación de 3ca2d8328): con Link o un débito bancario no hay `card.fingerprint`, la
  // huella quedaba vacía y la misma persona sacaba otra prueba con otro email.
  assert.deepEqual(f.getAll('payment_method_types[]'), ['card'], 'una prueba por tarjeta necesita una tarjeta');
  assert.equal(f.get('subscription_data[metadata][mako_cobro]'), TOKEN, 'la metadata sigue llegando a cada factura');
  llamadas = [];
  await crearCheckoutStripe(KEY, { ...base, tipo: 'suscripcion' });
  assert.equal(form(llamadas[0]).get('subscription_data[trial_period_days]'), null, 'una suscripción sin prueba cobra hoy');
  assert.equal(form(llamadas[0]).get('payment_method_collection'), null);
  assert.deepEqual(form(llamadas[0]).getAll('payment_method_types[]'), [], 'sin prueba, los medios que tenga prendidos la cuenta');
  llamadas = [];
  await crearCheckoutStripe(KEY, { ...base, tipo: 'unico', diasDePrueba: 7 });
  assert.ok(![...form(llamadas[0]).keys()].some((k) => k.includes('trial') || k === 'payment_method_collection'), 'un pago único no tiene prueba');
});

test('leer la prueba en Stripe: la suscripción con su tarjeta, el día del primer cobro y la huella', async () => {
  const { leerPruebaStripe } = await api();
  llamadas = [];
  contestar = () => json(200, {
    id: 'sub_1', status: 'trialing', trial_end: 1_762_000_000, metadata: { mako_cobro: TOKEN },
    default_payment_method: { id: 'pm_1', card: { fingerprint: 'Xt5EWLLDS7FJjR1c' } },
  });
  const r = await leerPruebaStripe(KEY, 'sub_1');
  assert.equal(llamadas[0].metodo, 'GET');
  assert.equal(llamadas[0].url.pathname, '/v1/subscriptions/sub_1');
  assert.equal(llamadas[0].url.searchParams.get('expand[]'), 'default_payment_method', 'sin expandir, la tarjeta llega como un id y no hay huella');
  assert.deepEqual(r, { ok: true, id: 'sub_1', estado: 'trialing', finPrueba: new Date(1_762_000_000 * 1000).toISOString(), huella: 'Xt5EWLLDS7FJjR1c', referencia: TOKEN });
  contestar = () => json(200, { id: 'sub_2', status: 'active', default_payment_method: 'pm_2' });
  const sinTarjeta = await leerPruebaStripe(KEY, 'sub_2');
  assert.ok(sinTarjeta.ok && sinTarjeta.huella === null && sinTarjeta.finPrueba === null);
});

test('la HUELLA de Stripe es la de la tarjeta, y se compara con el mismo filtro que la de Mercado Pago', () => {
  const a = huellaStripe('Xt5EWLLDS7FJjR1c');
  assert.equal(a, 'st:-|card:Xt5EWLLDS7FJjR1c');
  assert.deepEqual(partesDeHuella(a), { cuenta: null, tarjeta: 'Xt5EWLLDS7FJjR1c' });
  assert.ok(compartenHuella(a, huellaStripe('Xt5EWLLDS7FJjR1c')), 'la misma tarjeta, otra prueba');
  assert.ok(!compartenHuella(a, huellaStripe('OtraTarjeta123')));
  assert.ok(!compartenHuella(a, huellaMp({ pagadorId: '-', tarjetaId: null })), 'un «-» de cuenta no es una coincidencia');
  assert.equal(huellaStripe(null), null);
  assert.equal(huellaStripe('fp;drop table'), null, 'nada raro entra a un filtro de la base');
});

test('la factura en cero del inicio de la prueba NO es un pago (no se asienta un mes cobrado)', () => {
  const f = { id: 'in_1', estado: 'paid', montoPagado: 0, moneda: 'USD', motivo: 'subscription_create', suscripcion: 'sub_1' };
  assert.deepEqual(confirmarFactura('aprobado', f), { ok: false, motivo: 'factura en cero: no hay plata que registrar' });
  assert.equal(confirmarFactura('aprobado', { ...f, id: 'in_2', montoPagado: 97, motivo: 'subscription_cycle' }).ok, true, 'el día 8 sí');
});

// ── El cableado (lib/cobros.ts es `server-only`: se lee del fuente) ─────────────────────────────────────────────────

test('la prueba sale del COBRO: también la sesión que se rehace al vencer la trae', () => {
  assert.match(cuerpo('lib/cobros.ts', 'crearCheckout'), /diasDePrueba: esPruebaDePlan\(c\) \? PRUEBA_DIAS : null,/);
  // La prueba por días (Stripe, Creem) puede llevar su día de cobro aunque la pasarela no acepte una fecha: la decide la tabla.
  const crear = cuerpo('lib/cobros.ts', 'crearCobro');
  assert.match(crear, /const pruebaPorDias = !!capacidades\?\.pruebaConTarjeta && esPruebaDePlan\(/, 'la prueba de Stripe no podría llevar su día de cobro');
  assert.match(crear, /!capacidades\?\.difiereElPrimerCobro && !pruebaPorDias/, 'cualquier cobro podría pedir una fecha futura');
});

test('un link de una prueba de Stripe ya empezada NO abre una segunda suscripción', () => {
  const f = cuerpo('lib/cobros.ts', 'urlParaPagar');
  const guardia = f.indexOf("if (esPruebaDePlan(c) && c.suscripcion_estado) return { error: 'ya_pagado' };");
  const completa = f.indexOf("if (s.ok && s.estado === 'complete' && !(c.estado === 'fallido' && s.pagoEstado === 'unpaid')) return { error: 'ya_pagado' };");
  const rehace = f.indexOf('const r = await crearCheckout(c, { stripe, mp: null, creem: null }, vuelta);');
  assert.ok(guardia > 0 && completa > guardia && rehace > completa, 'las dos guardias, antes de rehacer la sesión');
});

// La verificación de a196d5a93 (C:/dev/revisiones/scratch-a196/cobro-mako-refuta/r1-pagar-tras-fallo.ts): un pago diferido que
// FALLÓ (OXXO, Boleto, SEPA) deja la sesión `complete` sin pagar y el cobro `fallido`. /pagar contestaba «ya pagado» y /listo
// ofrecía «Volver a intentar», que volvía a /pagar: un bucle para siempre. Con el script: R1a/R1b/R1c arman cs_live_B; R1d (el
// voucher EN CURSO, el cobro pendiente) sigue sin armar otra; R4 (Stripe no contesta la lectura) devuelve la sesión que había.
test('después de un pago diferido que FALLÓ se arma otra sesión; con el voucher en curso, no; sin poder leer la anterior, tampoco', () => {
  const f = cuerpo('lib/cobros.ts', 'urlParaPagar');
  const resto = f.slice(f.indexOf('if (c.proveedor_ref) {'));
  // La excepción es EXACTA: el cobro `fallido` Y la sesión sin pagar (`unpaid`). Una prueba (`no_payment_required`) o una
  // pagada siguen en «ya pagado»: armar otra abría una segunda suscripción.
  assert.ok(resto.includes("if (s.ok && s.estado === 'complete' && !(c.estado === 'fallido' && s.pagoEstado === 'unpaid')) return { error: 'ya_pagado' };"));
  const noLee = resto.indexOf('if (!s.ok && s.status !== 404) {');
  assert.ok(noLee > 0 && noLee < resto.indexOf('const r = await crearCheckout('), 'sin poder leerla, no se arma otra');
  assert.match(resto, /return viva \? \{ url: c\.url_proveedor! \} : \{ error: 'pasarela', detalle: s\.error \};/, 'la que había si sigue viva; si no, un error');
  // Y la sesión nueva vuelve el cobro a PENDIENTE (la verificación de e6fd6d88d, scratch-e6fd/cobros-v/v1-segunda-sesion.ts): si
  // seguía `fallido`, un segundo voucher en curso en ella se leía como «falló», se armaba otra, y pagadas las dos quedaban dos
  // cuotas. Con el script: V1 (OXXO) y V2 (SEPA), antes dos cuotas; ahora una, y no se arma C.
  assert.match(resto, /url_vence_at: r\.venceAt, estado: 'pendiente', motivo: null \}, \{ estado: \['pendiente', 'fallido'\] \}\);/);
});

// La verificación de 3ca2d8328 (C:/dev/revisiones/scratch-3ca2/A-refuta/r2r3-prueba-stripe.ts, casos k): el link se rehace a 5
// minutos de vencer, y la sesión vieja seguía ABIERTA. Pagada en la pestaña vieja, la prueba no se activaba; pagadas las dos,
// quedaban dos suscripciones cobrando. Con el arreglo, el script da `GET A → POST A/expire → POST nueva` y A queda `expired`.
test('rehacer el link expira ANTES la sesión anterior que sigue abierta, en todo cobro de Stripe; si no se pudo, no arma otra', () => {
  const f = cuerpo('lib/cobros.ts', 'urlParaPagar');
  const guarda = f.indexOf('if (c.proveedor_ref) {');
  assert.ok(guarda > 0, 'mira la sesión anterior de CUALQUIER cobro de Stripe, no sólo de una prueba');
  const resto = f.slice(guarda);
  const abierta = resto.indexOf("if (s.ok && s.estado === 'open') {");
  const expira = resto.indexOf('const x = await expirarCheckoutStripe(stripe.key, c.proveedor_ref);');
  const rehace = resto.indexOf('const r = await crearCheckout(c, { stripe, mp: null, creem: null }, vuelta);');
  assert.ok(abierta > 0 && expira > abierta && rehace > expira, 'abierta → se expira → recién ahí la nueva');
  assert.match(resto, /if \(!x\.ok\) \{\n\s*const otra = await leerCheckoutStripe\(stripe\.key, c\.proveedor_ref\);\n\s*if \(otra\.ok && otra\.estado === 'complete'\) return \{ error: 'ya_pagado' \};\n\s*return c\.url_proveedor \? \{ url: c\.url_proveedor \} : \{ error: 'pasarela', detalle: x\.error \};/,
    'si no se pudo cerrar (o se completó en el medio), no se arma otra');
});

test('la ACTIVACIÓN de Stripe: checkout completo de ESTE cobro, suscripción en prueba, y el día del cobro de Stripe', () => {
  const s = cuerpo('lib/cobros.ts', 'pruebaAutorizadaStripe');
  assert.match(s, /if \(!s\.ok \|\| s\.estado !== 'complete' \|\| s\.referencia !== c\.token \|\| !s\.subscription\) return null;/);
  assert.match(s, /if \(!sub\.ok \|\| sub\.estado !== 'trialing' \|\| \(sub\.referencia != null && sub\.referencia !== c\.token\)\) return null;/);
  assert.match(s, /huella: huellaStripe\(sub\.huella\), finPrueba: sub\.finPrueba,/);
  assert.match(s, /cancelar: \(\) => cancelarSuscripcionStripe\(stripe\.key, sub\.id, idemBaja\(c\.id\)\)/);
  const f = cuerpo('lib/cobros.ts', 'activarPruebaSiAutorizo');
  assert.ok(!/c\.proveedor !== 'mercadopago'/.test(f), 'antes, una prueba de Stripe no se activaba nunca');
  assert.match(f, /\{ suscripcion_estado: 'activa', proveedor_suscripcion_id: s\.id, \.\.\.\(s\.finPrueba \? \{ inicio_at: s\.finPrueba \} : \{\}\) \}/,
    'el aviso de 2 días antes y «Tu plan» leen el día que dice Stripe');
});

// ── La pasarela según el país ────────────────────────────────────────────────────────────────────────────────────

const MP = { pasarela: 'mercadopago' as const, moneda: 'ARS', monto: 140_000 };
const ST = { pasarela: 'stripe' as const, moneda: 'USD', monto: 97 };

test('Mercado Pago SÓLO en su país, y ahí la única; afuera, Stripe; sin saber el país, las dos', () => {
  assert.deepEqual(pasarelasDelPais('MX', [MP, ST]), [ST], 'la clienta de México: Stripe, nunca la MP argentina');
  assert.deepEqual(pasarelasDelPais('US', [MP, ST]), [ST]);
  assert.deepEqual(pasarelasDelPais('AR', [MP, ST]), [MP], 'en Argentina, en pesos (sin el recargo de la tarjeta internacional)');
  assert.deepEqual(pasarelasDelPais('AR', [ST]), [ST], 'en Argentina sin precio en pesos: Stripe');
  assert.deepEqual(pasarelasDelPais('MX', [MP]), [], 'desde México con sólo la MP argentina: no se cobra en línea (se pide)');
  assert.deepEqual(pasarelasDelPais(null, [MP, ST]), [MP, ST], 'sin país, elige la persona');
  assert.deepEqual(pasarelasDelPais('MX', [{ ...MP, moneda: 'MXN' }, ST]), [{ ...MP, moneda: 'MXN' }], 'una MP de México cobra en México');
});

test('el país es el encabezado de Vercel, dos letras; lo que no ubica es «no se sabe»', () => {
  assert.equal(paisDelVisitante('MX'), 'MX');
  assert.equal(paisDelVisitante(' ar '), 'AR');
  for (const x of [null, undefined, '', 'XX', 'T1', 'MEX', 'M1']) assert.equal(paisDelVisitante(x), null, String(x));
});

test('el país viaja: /planes, la página del plan y la compra lo leen de Vercel, y la oferta lo aplica', () => {
  // (Desde el 11/11/2026, por `pasarelasParaOfrecer`, que aplica `pasarelasDelPais` a las reales: tests/prueba-de-humo-pasarela.)
  assert.match(cuerpo('lib/compra-plan.ts', 'ofertaDelPlan'), /return \{ plan, pasarelas: pasarelasParaOfrecer\(opts\.pais \?\? null, reales, deUnaPrueba\) \};/);
  assert.match(fuente('lib/compra-plan-reglas.ts'), /const segunPais = pasarelasDelPais\(pais, reales\);/);
  assert.match(cuerpo('lib/compra-plan.ts', 'ofertasDeLosPlanes'), /cobrable: pasarelasDelPais\(pais, monedas\.filter\(\(m\) => precioEn\(plan, m\.moneda\) != null\)\)\.length > 0,/);
  const enc = "paisDelVisitante(req.headers.get('x-vercel-ip-country'))";
  assert.ok(fuente('app/api/planes/comprar/route.ts').includes(`pais: ${enc}`), 'la compra');
  // La página del plan lo guarda en una variable porque lo usa DOS veces: la oferta y la lada con la que arranca el WhatsApp
  // que se pide antes del checkout (31/10/2026). Lo que se cuida sigue siendo lo mismo: que el país llegue a la oferta.
  const pagPlan = fuente('app/planes/[plan]/page.tsx');
  assert.ok(pagPlan.includes("const pais = paisDelVisitante((await headers()).get('x-vercel-ip-country'))"), 'la página del plan lee el país');
  const trozoOferta = pagPlan.slice(pagPlan.indexOf('ofertaDelPlan(id, {'), pagPlan.indexOf('if (!oferta) notFound()'));
  assert.ok(trozoOferta.includes('pais,'), 'la página del plan le pasa ese país a la oferta');
  assert.ok(pagPlan.includes('ladaInicial={ladaDelPais(pais)}'), 'y el WhatsApp arranca con la lada de ese país');
  assert.ok(fuente('app/planes/page.tsx').includes("ofertasDeLosPlanes(paisDelVisitante((await headers()).get('x-vercel-ip-country')))"), '/planes');
  // Pidió Mercado Pago desde México y Stripe sirve: se le ofrece Stripe, no «todavía no cobramos en línea».
  assert.match(cuerpo('lib/compra-plan.ts', 'iniciarCompraDePlan'), /if \(eleccion\.motivo === 'elegir' \|\| \(eleccion\.motivo === 'no-sirve' && pasarelas\.length\)\) return \{ ok: false, status: 409/);
});

// Probado rompiéndolo (27/10/2026), una rotura por vez sobre la base en verde (10 pases, 0 fallos), restaurando el texto con un
// script (nunca git). Rota (pases / fallos):
//   · PASARELAS_CON_PRUEBA sin Stripe (el bug de la clienta de México)        → 9 / 1
//   · sin `trial_period_days`                                                  → 9 / 1
//   · sin la guarda de la segunda suscripción en `urlParaPagar`               → 9 / 1
//   · Mercado Pago para todos los países                                       → 9 / 1
//   · «XX» tomado como un país                                                 → 9 / 1
//   · sin expandir la tarjeta (sin huella)                                     → 9 / 1
// Y lo de la verificación de 3ca2d8328 (28/10/2026, base 11 / 0): sin expirar la sesión anterior → 10 / 1; la guarda sólo para
// las pruebas, como antes → 10 / 1; la prueba con cualquier medio de pago (sin `payment_method_types`) → 10 / 1.
// Y el del páís en la página del plan (31/10/2026, base 12 / 0): sin `pais` en la oferta → 11 / 1; otro encabezado en vez de
// `x-vercel-ip-country` → 11 / 1; sin la lada del WhatsApp → 11 / 1.
// Y los de a196d5a93 (base 12 / 0): sin la excepción del diferido que falló → 10 / 2; armar otra sin poder leer la anterior →
// 11 / 1. De punta a punta: r1-pagar-tras-fallo.ts, antes R1a/R1b/R1c daban 302 a /listo; ahora arman cs_live_B (R1d igual).
