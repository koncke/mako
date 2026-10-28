// =============================================================================
// La página de gracias le avisa la compra al píxel de Meta, con el MISMO id que el servidor y CON valor (27/10/2026, MAU-10)
// =============================================================================
// El servidor ya manda el Purchase por CAPI al llegar el aviso de Stripe de un Payment Link propio (tests/compra-payment-link.test.ts).
// El Pixel de MaKo v28, si la página abre con `?session_id=cs_…` y tiene el píxel de Meta, lo manda también desde el navegador con
// el mismo `eventID`. Sin valor no lo manda: Meta se queda con el evento que llega primero, y el del navegador suele ganarle al
// aviso de Stripe (lib/compra-navegador.ts). El valor lo da MaKo (app/api/track/compra/route.ts), que lo lee de Stripe.
//
// El bloque del snippet se CORRE acá, sacado del template como lo emite el server, con un `fbq` y un `fetch` de mentira.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SESION_PAGO_RE } from '../lib/meta-capi-payload';

const BT = String.fromCharCode(96);
const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const FUENTE = leer('../lib/landing-token.ts');
const SESION = 'cs_test_a1B2c3D4e5F6g7H8';

/** El bloque de la compra, como sale en la página (sin barras en el medio: sólo la base de la app por reemplazar). */
function bloque(): string {
  const desde = FUENTE.indexOf('  try {\n    var pagoSesion');
  const hasta = FUENTE.indexOf('})();\n</script>' + BT);
  assert.ok(desde > 0 && hasta > desde, 'no se encontró el bloque de la compra al final del snippet');
  const b = FUENTE.slice(desde, hasta);
  assert.ok(!b.includes('\\'), 'el bloque tiene una barra: en el template cambia de sentido');
  return b.split('${APP_BASE_URL}').join('https://hola-mako.com');
}

async function correr(o: { compra: unknown; search?: string; fbqTarde?: boolean }) {
  const llamadas: unknown[][] = [];
  const pedidos: string[] = [];
  const fbq = (...a: unknown[]) => { llamadas.push(a); };
  const ventana: { fbq?: typeof fbq } = o.fbqTarde ? {} : { fbq };
  const pedir = async (u: string) => { pedidos.push(u); return { json: async () => ({ ok: true, compra: o.compra }) }; };
  // El píxel de Meta carga DESPUÉS que el de MaKo: el primer reintento lo encuentra.
  const esperar = (f: () => void) => { ventana.fbq = fbq; f(); return 0; };
  new Function('window', 'location', 'fetch', 'setTimeout', 'CUENTA', 'URLSearchParams', bloque())(
    ventana, { search: o.search ?? `?session_id=${SESION}` }, pedir, esperar, 'mko_cuenta1234', URLSearchParams,
  );
  await new Promise((r) => globalThis.setTimeout(r, 5));
  return { llamadas, pedidos };
}

test('con la compra que da MaKo, el Purchase sale con el mismo eventID, el valor y la moneda', async () => {
  const compra = { eventId: `purchase:${SESION}`, value: 297, currency: 'USD' };
  const r = await correr({ compra });
  assert.deepEqual(r.pedidos, [`https://hola-mako.com/api/track/compra?c=mko_cuenta1234&s=${SESION}`]);
  assert.deepEqual(r.llamadas, [['track', 'Purchase', { value: 297, currency: 'USD' }, { eventID: `purchase:${SESION}` }]]);
  // El píxel de Meta que carga después también la recibe.
  assert.equal((await correr({ compra, fbqTarde: true })).llamadas.length, 1);
});

test('sin compra, sin valor o sin moneda no se manda nada; sin session_id ni se pregunta', async () => {
  assert.deepEqual((await correr({ compra: null })).llamadas, []);
  assert.deepEqual((await correr({ compra: { eventId: `purchase:${SESION}`, value: 0, currency: 'USD' } })).llamadas, []);
  assert.deepEqual((await correr({ compra: { eventId: `purchase:${SESION}`, value: 297, currency: null } })).llamadas, []);
  const sin = await correr({ compra: { eventId: 'x', value: 1, currency: 'USD' }, search: '?utm_source=fb' });
  assert.deepEqual([sin.pedidos, sin.llamadas], [[], []]);
  assert.deepEqual((await correr({ compra: null, search: '?session_id=<script>' })).pedidos, []);
});

test('la sesión se reconoce igual en la página y en el servidor, y la versión sube con su novedad', () => {
  assert.ok(bloque().includes(`/${SESION_PAGO_RE.source}/.test(pagoSesion)`), 'el snippet y el servidor aceptan sesiones distintas');
  assert.ok(SESION_PAGO_RE.test(SESION) && SESION_PAGO_RE.test('cs_live_' + 'a'.repeat(58)) && !SESION_PAGO_RE.test('pi_123'));
  const v = Number(/^export const SNIPPET_VERSION = (\d+);$/m.exec(FUENTE)?.[1]);
  assert.ok(v >= 28);
  assert.match(FUENTE, /^ {2}28: 'que tu página de gracias le avise la compra a tu píxel de Meta/m);
});

test('MaKo contesta sólo el valor, la moneda y el id, leídos de Stripe, y sólo de un link pagado', () => {
  const lib = leer('../lib/compra-navegador.ts');
  assert.match(lib, /compra = x \? \{ eventId: x\.eventId, value: x\.value, currency: x\.currency \} : null;/);
  assert.doesNotMatch(lib.slice(lib.indexOf('export async function')), /email|phone|telefono/, 'la respuesta va a una página pública');
  // La sesión de prueba no se busca con la clave real (y al revés), y una cuenta donde no está (404) no corta la búsqueda.
  assert.match(lib, /if \(!key \|\| modoDeClaveStripe\(key\) !== modo\) continue;/);
  assert.match(lib, /if \(s\.status === 404\) continue;/);
  const ruta = leer('../app/api/track/compra/route.ts');
  assert.match(ruta, /limitePorIp\(req, 'compra', /);
  assert.match(ruta, /wsPorIdentificadorEstricto\(LANDING_SERVICIO, cuenta\)/);
  assert.match(ruta, /SESION_PAGO_RE\.test\(sesion\)/);
});
