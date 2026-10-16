// =============================================================================
// Una suscripción con PLAZO se cobra hasta el plazo, no para siempre (15/10/2026)
// =============================================================================
// Un producto del catálogo «6 meses» (`productos.suscripcion_meses`) se cobraba por la pasarela como suscripción sin fin:
// al séptimo mes la tarjeta del cliente se seguía cobrando. Lo que se fija:
//   1. el fin (`finDelPlazo`, se EJECUTA): N meses después del arranque, con el día capado al último del mes;
//   2. Stripe (Checkout no acepta un fin): al primer pago se programa `cancel_at` en el fin del período N, sin prorrateo
//      (se EJECUTA contra un `fetch` de mentira); Mercado Pago nace con `auto_recurring.end_date` UN DÍA ANTES de ese fin,
//      porque cobra desde que la persona autoriza: si autoriza tarde se pierde una mensualidad, no se cobra una de más;
//   3. el cableado (se lee del fuente): el plazo sale del producto; sin poder leerlo no se crea la suscripción de MP; en
//      Stripe se programa sólo en el PRIMER pago y nunca tumba el pago; el lead que se gana lleva el plazo.
//
// PROBADO ROMPIÉNDOLO (15/10/2026), una rotura por vez con un script que reemplaza en el fuente, corre y restaura.
// Con el código como está: 5 pases, 0 fallos. Rota (pases / fallos):
//   · finDelPlazo sin capar el día (31/01 + 1 → 3 de marzo)                          → 4 / 1
//   · programarFinSuscripcionStripe sin `proration_behavior: 'none'`                 → 4 / 1
//   · crearSuscripcionMp sin `end_date`                                              → 4 / 1
//   · el end_date de MP en el fin exacto (sin el día de margen)                       → 4 / 1
//   · ganarLead con `suscripcion_meses: null` (el MRR la cuenta para siempre)         → 4 / 1
//   · el plazo programado también en las renovaciones (sin `!renovacion`)             → 4 / 1
// Correr: node --import tsx --test tests/suscripcion-plazo.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { finDelPlazo } from '../lib/cobros-reglas';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) =>
  pedido === 'server-only' ? {} : Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain])) as Cargador;

type Llamada = { url: URL; metodo: string; headers: Headers; cuerpo: string | null };
let llamadas: Llamada[] = [];
let contestar: (l: Llamada) => Response = () => new Response('{}', { status: 500 });
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const l: Llamada = { url, metodo: (init.method ?? 'GET').toUpperCase(), headers: new Headers(init.headers), cuerpo: typeof init.body === 'string' ? init.body : null };
  llamadas.push(l);
  return contestar(l);
}) as typeof fetch;
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
function cuerpo(src: string, nombre: string): string {
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const /);
  return fin > 0 ? resto.slice(0, fin) : resto;
}

test('el fin del plazo: N meses después, a la misma hora, con el día capado al último del mes', () => {
  assert.equal(new Date(finDelPlazo(Date.UTC(2026, 9, 15, 14, 30, 5), 6)).toISOString(), '2027-04-15T14:30:05.000Z');
  assert.equal(new Date(finDelPlazo(Date.UTC(2026, 0, 31, 10, 0, 0), 1)).toISOString(), '2026-02-28T10:00:00.000Z', 'un 31 de enero + 1 es el 28 de febrero, como factura Stripe');
  assert.equal(new Date(finDelPlazo(Date.UTC(2027, 10, 30), 3)).toISOString(), '2028-02-29T00:00:00.000Z', 'año bisiesto');
});

test('Stripe: al primer pago, `cancel_at` en el fin del período N (desde el ancla de facturación) y sin prorrateo', async () => {
  const { programarFinSuscripcionStripe } = await import('../lib/stripe-api');
  const ancla = Math.floor(Date.UTC(2026, 9, 15, 14, 30, 5) / 1000);
  llamadas = [];
  contestar = (l) => (l.metodo === 'GET' ? json({ id: 'sub_1', billing_cycle_anchor: ancla, start_date: ancla - 60 }) : json({ id: 'sub_1', cancel_at: 1 }));
  const r = await programarFinSuscripcionStripe('sk_test_x', 'sub_1', 6);
  assert.deepEqual(r, { ok: true, cancelAt: Math.floor(Date.UTC(2027, 3, 15, 14, 30, 5) / 1000) });
  assert.deepEqual(llamadas.map((l) => `${l.metodo} ${l.url.pathname}`), ['GET /v1/subscriptions/sub_1', 'POST /v1/subscriptions/sub_1']);
  const f = new URLSearchParams(llamadas[1].cuerpo ?? '');
  assert.equal(f.get('cancel_at'), String(Math.floor(Date.UTC(2027, 3, 15, 14, 30, 5) / 1000)));
  assert.equal(f.get('proration_behavior'), 'none', 'el período termina justo ahí: nada que prorratear');
  assert.ok(llamadas[1].headers.get('Idempotency-Key'), 'un POST de Stripe lleva su clave');
});

test('Mercado Pago: la suscripción nace con `end_date` (y sin plazo, sin end_date)', async () => {
  const { crearSuscripcionMp } = await import('../lib/mercadopago-api');
  const p = { idem: 'mako-cobro-7', concepto: 'Plan', monto: 49900, moneda: 'ARS', email: 'quien@x.com', token: 'T'.repeat(32), volverUrl: 'https://mako.test/x' };
  contestar = () => json({ id: '2c9380848f', init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?x=1' });
  llamadas = [];
  await crearSuscripcionMp('APP_USR-1', { ...p, finAt: '2027-04-14T14:30:05.000+00:00' });
  assert.equal((JSON.parse(llamadas[0].cuerpo ?? '{}') as { auto_recurring: Record<string, unknown> }).auto_recurring.end_date, '2027-04-14T14:30:05.000+00:00');
  llamadas = [];
  await crearSuscripcionMp('APP_USR-1', p);
  assert.ok(!('end_date' in (JSON.parse(llamadas[0].cuerpo ?? '{}') as { auto_recurring: Record<string, unknown> }).auto_recurring), 'una indefinida no lleva fin');
});

test('el cableado: el plazo del producto, MP con un día de margen, y sin poder leerlo no se crea', () => {
  const c = fuente('lib/cobros.ts');
  const plazo = cuerpo(c, 'plazoDelCobro');
  assert.match(plazo, /if \(c\.tipo !== 'suscripcion' \|\| !c\.producto_id\) return null;/);
  assert.match(plazo, /\.from\('productos'\)\.select\('suscripcion_meses'\)\.eq\('id', c\.producto_id\)/, 'aunque el producto esté inactivo (sin filtrar `activo`)');
  const chk = cuerpo(c, 'crearCheckout');
  assert.match(chk, /if \(meses === undefined\) return \{ ok: false,/, 'sin poder leer el plazo, una suscripción sin fin es justo lo que esto evita');
  assert.match(chk, /finAt: meses \? instanteMp\(finDelPlazo\(Date\.now\(\), meses\) - 86_400_000\) : null/);
});

test('el cableado: Stripe sólo en el PRIMER pago y sin tumbarlo, y el lead que se gana lleva el plazo', () => {
  const c = fuente('lib/cobros.ts');
  const a = cuerpo(c, 'aplicarPagoAprobado');
  assert.match(a, /const plazo = actual\.tipo === 'suscripcion' && nuevo && !renovacion\s*\?/, 'una renovación o una reentrega no reprograma nada');
  assert.match(a, /if \(plazo && actual\.proveedor === 'stripe' && actual\.proveedor_suscripcion_id\) actual = await programarPlazoStripe\(actual, plazo\);/);
  assert.match(a, /await ganarLead\(actual, autor, plazo\)/);
  assert.match(cuerpo(c, 'ganarLead'), /suscripcion_meses: plazo \}/, 'sin el plazo en el lead, el MRR la cuenta para siempre');
  const prog = cuerpo(c, 'programarPlazoStripe');
  assert.match(prog, /\} catch \(e\) \{\s*console\.error/, 'la plata ya entró: programar el fin nunca tumba el pago');
  assert.match(prog, /cancélala a mano al cumplirse/, 'si falla, el cobro dice qué hacer');
});
