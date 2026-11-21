// =============================================================================
// Binance se lee desde São Paulo: desde la región del proyecto (pdx1, EE. UU.) contesta 451 (lib/binance-pay-region.ts)
// =============================================================================
// El 20/11/2026, en producción, Binance contestó 451 «Service unavailable from a restricted location according to 'b. Eligibility'»
// (`grupo_mensajes` 1049): el proyecto corre en `pdx1` (vercel.json) y Binance bloquea EE. UU. La medición del 19/11 fue desde la PC,
// por eso no se vio. Con eso `verificarEnBinance` daba siempre «falla» y nada se aplicaba solo, ni con captura ni sin captura.
// El arreglo: una ruta interna sólo de lectura, /api/cron/binance-pagos, con `preferredRegion = 'gru1'`, que lee la cuenta; desde
// cualquier otra región de Vercel, lib/binance-pay.ts le pide los pagos a ella (con el secreto del cron). Desde la PC, directo.
// Correr: node --import tsx --test tests/binance-pay-region.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { caminoDeBinance, leerPorLaRuta, REGION_DE_BINANCE, RUTA_INTERNA_BINANCE } from '../lib/binance-pay-region';

const leer = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n');

const MOV = { orderId: '466000199987322880', at: Date.parse('2026-11-16T13:17:00Z'), monto: 59.54, moneda: 'USDT', pagadorNombre: 'JZ_', pagadorId: '206956446' };

/** Un fetch de mentira que anota lo que se le pidió. */
function fetchDe(respuesta: { status: number; body: unknown } | Error) {
  const pedidos: Array<{ url: string; init: RequestInit | undefined }> = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({ url: String(url), init });
    if (respuesta instanceof Error) throw respuesta;
    return new Response(JSON.stringify(respuesta.body), { status: respuesta.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { f, pedidos };
}

test('el camino: desde la PC, directo; en Vercel, directo SÓLO en la región de Binance (São Paulo); en cualquier otra, por la ruta', () => {
  assert.equal(REGION_DE_BINANCE, 'gru1');
  assert.equal(caminoDeBinance({}), 'directo');
  assert.equal(caminoDeBinance({ vercel: '1', region: 'gru1' }), 'directo');
  assert.equal(caminoDeBinance({ vercel: '1', region: 'pdx1' }), 'ruta');
  assert.equal(caminoDeBinance({ vercel: '1', region: 'iad1' }), 'ruta');
  // En Vercel sin saber la región: por la ruta (directo es el 451 seguro).
  assert.equal(caminoDeBinance({ vercel: '1' }), 'ruta');
});

test('por la ruta: GET a la ruta interna con el secreto del cron, y devuelve los pagos (sanos)', async () => {
  const { f, pedidos } = fetchDe({ status: 200, body: { ok: true, region: 'gru1', movs: [MOV, { orderId: 'X', monto: -1 }, null] } });
  const r = await leerPorLaRuta({ base: 'https://hola-mako.com/', secreto: 's3cr3t', desde: 1000, hasta: 2000, fetch: f });
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].url, `https://hola-mako.com${RUTA_INTERNA_BINANCE}?desde=1000&hasta=2000`);
  assert.equal(pedidos[0].init?.method, 'GET');
  assert.equal(new Headers(pedidos[0].init?.headers).get('authorization'), 'Bearer s3cr3t');
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.movs, [MOV]);
});

test('por la ruta: el 451 de Binance (o cualquier error de la ruta) vuelve como falla CON su texto y la región; nunca como «no hay pagos»', async () => {
  const { f } = fetchDe({ status: 200, body: { ok: false, region: 'gru1', error: "Binance contestó 451: Service unavailable from a restricted location according to 'b. Eligibility'" } });
  const r = await leerPorLaRuta({ base: 'https://hola-mako.com', secreto: 's', desde: 1, hasta: 2, fetch: f });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.error : '', /451.*gru1|gru1.*451/);
  for (const resp of [{ status: 401, body: { ok: false, error: 'Unauthorized' } }, { status: 500, body: 'no es json' }, { status: 404, body: {} }, new Error('timeout')]) {
    const x = await leerPorLaRuta({ base: 'https://hola-mako.com', secreto: 's', desde: 1, hasta: 2, fetch: fetchDe(resp).f });
    assert.equal(x.ok, false, JSON.stringify(resp));
  }
  // Una respuesta 200 sin la lista no es «cero pagos».
  const vacia = await leerPorLaRuta({ base: 'https://hola-mako.com', secreto: 's', desde: 1, hasta: 2, fetch: fetchDe({ status: 200, body: { ok: true } }).f });
  assert.equal(vacia.ok, false);
});

test('sin el secreto del cron no se llama a nada: falla', async () => {
  const { f, pedidos } = fetchDe({ status: 200, body: { ok: true, movs: [] } });
  const r = await leerPorLaRuta({ base: 'https://hola-mako.com', secreto: '', desde: 1, hasta: 2, fetch: f });
  assert.equal(r.ok, false);
  assert.equal(pedidos.length, 0);
});

test('la ruta interna: São Paulo, sólo GET, empieza con el secreto del cron y lee DIRECTO (sin volver a llamarse)', () => {
  const src = leer('app', 'api', 'cron', 'binance-pagos', 'route.ts');
  // La región la pone vercel.json: el export de Next lo IGNORÓ Vercel (21/11, los crons de las 00:17 y 00:47 corrieron en pdx1, 451).
  const v = JSON.parse(leer('vercel.json')) as { functions?: Record<string, { regions?: string[] }> };
  assert.deepEqual(v.functions?.['app/api/cron/binance-pagos/route.ts']?.regions, [REGION_DE_BINANCE]);
  assert.doesNotMatch(src, /preferredRegion/);
  assert.match(src, /export async function GET\(req: NextRequest\) \{\s*const denied = checkCronAuth\(req\);\s*if \(denied\) return denied;/);
  assert.doesNotMatch(src, /export (async )?function (POST|PUT|PATCH|DELETE)/);
  assert.match(src, /leerDeBinanceDirecto\(/);
  assert.match(src, /from '@\/lib\/binance-pay-directo'/);
  assert.doesNotMatch(src, /pagosRecibidosEnBinance\(/);
  // La región sale en la respuesta: así se ve desde afuera dónde corrió.
  assert.match(src, /VERCEL_REGION/);
});

test('lib/binance-pay.ts elige el camino con caminoDeBinance y, por la ruta, usa leerPorLaRuta con el secreto del cron', () => {
  const src = sinComentarios(leer('lib', 'binance-pay.ts'));
  assert.match(src, /caminoDeBinance\(\{ vercel: process\.env\.VERCEL, region: process\.env\.VERCEL_REGION \}\)/);
  assert.match(src, /leerPorLaRuta\(\{[^}]*secreto: process\.env\.CRON_SECRET/);
  // El único lugar que habla con Binance es `leerDeBinanceDirecto` (lib/binance-pay-directo.ts): acá ningún fetch propio.
  assert.equal((src.match(/fetch\(/g) ?? []).length, 0);
  assert.equal((sinComentarios(leer('lib', 'binance-pay-directo.ts')).match(/fetch\(/g) ?? []).length, 1);
});

test('la función de São Paulo NO toca la base: la ruta y el lector directo cargan sólo el secreto del cron, la firma y las reglas puras', () => {
  // La base vive en us-west-2, al lado de pdx1 (~5 ms); desde gru1 cada consulta en serie costaría mucho más (tests/region-funciones.test.ts).
  const importsDe = (src: string) => [...src.matchAll(/^import (?:type )?[^;]*? from '([^']+)';|^import '([^']+)';/gm)].map((m) => m[1] ?? m[2]).sort();
  assert.deepEqual(importsDe(leer('app', 'api', 'cron', 'binance-pagos', 'route.ts')), ['@/lib/binance-pay-directo', '@/lib/cron-auth', 'next/server']);
  assert.deepEqual(importsDe(leer('lib', 'binance-pay-directo.ts')), ['./binance-pay-region', './binance-pay-reglas', 'node:crypto', 'server-only']);
  assert.deepEqual(importsDe(leer('lib', 'binance-pay-region.ts')), ['./binance-pay-reglas']);
  assert.deepEqual(importsDe(leer('lib', 'binance-pay-reglas.ts')), []);
  assert.deepEqual(importsDe(leer('lib', 'cron-auth.ts')), ['node:crypto']);
});

test('⚠️ el lector por la ruta tampoco mueve plata: un solo GET, a la ruta interna', () => {
  const src = sinComentarios(leer('lib', 'binance-pay-region.ts'));
  assert.match(src, /method: 'GET'/);
  assert.doesNotMatch(src, /method:\s*'(POST|PUT|DELETE|PATCH)'/i);
  assert.doesNotMatch(src, /binance\.com|withdraw|transfer|\/trade|order\//i);
});
