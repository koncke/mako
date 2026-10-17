// =============================================================================
// Marcar a mano una cuota cuyo link YA se cobró no cuenta la plata dos veces (17/10/2026)
// =============================================================================
// Entre que el cliente paga el link y que el aviso o el cron lo asientan, la cuota sigue impaga. Si el closer la
// marcaba a mano en ese rato, `marcarPago` anulaba el link (ya pagado) y cuando llegaba el aviso el pago entraba como
// OTRA cuota cobrada: lo cobrado salía inflado (docs/hallazgos-pagos.md §4). Ahora, antes de marcar a mano, se le
// pregunta a la pasarela (`asentarLinkPagadoDeCuota`, lib/cobros.ts): si cobró, la cuota queda con ESE pago y la marca
// a mano no se hace. Si no cobró —o no contesta— se marca como siempre: frenar la marca podía trabar una cuota.
//
// `marcarPago` y `cobrarCuota` se EJECUTAN contra un PostgREST de mentira (el molde es tests/pagos-nacio-cobrada.test.ts);
// lib/cobros.ts se reemplaza por un doble que dice qué contestó la pasarela (habla con Stripe, Mercado Pago y media
// base). Lo de adentro de `asentarLinkPagadoDeCuota` se lee del fuente.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez, restaurando después (pasan / fallan; base 6 / 0):
//   · marcarPago sin mirar los links (la plata se cuenta dos veces)                               -> 5 / 1
//   · cobrarCuota sin mirar los links (cambia el monto y deja la diferencia de algo ya cobrado)    -> 5 / 1
//   · linkYaPagado deja pasar el error de la pasarela (la marca a mano se traba)                    -> 5 / 1
//   · registrarCobroDeProveedor llama a marcarPago sin `mirarLinks: false`                          -> 5 / 1
//   · asentarLinkPagadoDeCuota pregunta a la pasarela ANTES de reparar el pagado sin cuota         -> 5 / 1
// Correr: node --import tsx --test tests/pagos-link-ya-pagado.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── lo que contesta la pasarela, según el caso ───────────────────────────────────────────────────────────────
type Respuesta = { asentado: true; pasarela: 'stripe' | 'mercadopago' } | { asentado: false; sinLeer: number } | 'tira';
let respuesta: Respuesta = { asentado: false, sinLeer: 0 };
let preguntas = 0;
const dobleDeCobros = {
  asentarLinkPagadoDeCuota: async (_ws: number, pagoId: number) => {
    preguntas++;
    if (respuesta === 'tira') throw new Error('Mercado Pago no contestó');
    // Lo que hace `aplicarPagoAprobado` cuando la pasarela cobró: la cuota queda cobrada con ESE pago.
    if (respuesta.asentado) {
      const q = db.pagos.find((f) => f.id === pagoId);
      if (q) Object.assign(q, { pagado: true, fecha_pago: '2026-10-15', proveedor: respuesta.pasarela, proveedor_pago_id: 'mp-1', cobro_id: 77 });
    }
    return respuesta;
  },
  anularLinksDeCuota: async () => 0,
};

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) => {
  if (pedido === 'server-only') return {};
  // `import('./cobros')` adentro de lib/pagos.ts llega como './cobros' o, por el cargador de ESM, con la ruta entera.
  return Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain]);
}) as Cargador;

const RAIZ = join(import.meta.dirname, '..');
// `import('./cobros')` adentro de lib/pagos.ts pasa por el cargador de ESM, que toma el módulo de la caché de CommonJS
// por su ruta entera: el doble se deja ahí, ya cargado, antes de que nadie lo pida.
{
  const ruta = join(RAIZ, 'lib', 'cobros.ts');
  const m = new Module(ruta) as Module & { filename: string; loaded: boolean; exports: unknown };
  m.filename = ruta;
  m.loaded = true;
  m.exports = dobleDeCobros;
  (Module as unknown as { _cache: Record<string, unknown> })._cache[ruta] = m;
}
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');

// ── una base PostgREST de mentira: lo justo para marcarPago y cobrarCuota ─────────────────────────────────────
type Fila = Record<string, unknown>;
const WS = 5;
let db: Record<string, Fila[]> = {};
let escrituras: string[] = [];
let proximoId = 1000;
const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function cumple(f: Fila, u: URL): boolean {
  for (const [k, v] of u.searchParams) {
    if (['select', 'order', 'limit', 'columns', 'on_conflict', 'offset'].includes(k)) continue;
    if (v.startsWith('eq.') && String(f[k]) !== v.slice(3)) return false;
    if (v.startsWith('neq.') && String(f[k]) === v.slice(4)) return false;
    if (v === 'is.null' && f[k] != null) return false;
    if (v.startsWith('in.(') && !v.slice(4, -1).split(',').includes(String(f[k]))) return false;
  }
  return true;
}
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test' || !u.pathname.startsWith('/rest/v1/')) throw new Error(`fetch sin mock: ${u.href}`);
  const tabla = u.pathname.replace('/rest/v1/', '');
  const filas = (db[tabla] ??= []);
  const metodo = (init.method ?? 'GET').toUpperCase();
  const h = new Headers(init.headers);
  const uno = (h.get('Accept') ?? '').includes('vnd.pgrst.object');
  const devolver = (h.get('Prefer') ?? '').includes('return=representation');
  const responder = (rs: Fila[]) => (!uno ? json(200, rs) : rs.length === 1 ? json(200, rs[0]) : rs.length === 0 && u.searchParams.has('limit') ? json(200, null) : json(406, { code: 'PGRST116', message: `${rs.length} filas` }));
  if (metodo === 'GET' || metodo === 'HEAD') return responder(filas.filter((f) => cumple(f, u)));
  if (metodo === 'DELETE') { escrituras.push(`DELETE ${tabla}`); db[tabla] = filas.filter((f) => !cumple(f, u)); return json(204, undefined); }
  if (metodo === 'PATCH') {
    const cambios = JSON.parse(String(init.body ?? '{}')) as Fila;
    const tocadas = filas.filter((f) => cumple(f, u));
    for (const f of tocadas) Object.assign(f, cambios);
    escrituras.push(`PATCH ${tabla} ${JSON.stringify(cambios)}`);
    return devolver ? responder(tocadas) : json(204, undefined);
  }
  const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila | Fila[];
  const nuevas: Fila[] = [];
  for (const fila of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) {
    escrituras.push(`POST ${tabla} ${JSON.stringify(fila)}`);
    const nueva = { id: proximoId++, ...fila };
    filas.push(nueva);
    nuevas.push(nueva);
  }
  return devolver ? responder(nuevas) : json(201, undefined);
}) as typeof fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

const LEAD = 61;
const CUOTA = 920;
function sembrar(r: Respuesta) {
  respuesta = r;
  preguntas = 0;
  proximoId = 1000;
  escrituras = [];
  db = {
    leads: [{ id: LEAD, workspace_id: WS, nombre: 'Con link', estado_lead: 'ganado' }],
    pagos: [{ id: CUOTA, workspace_id: WS, lead_id: LEAD, numero: 2, monto_usd: 300, pagado: false, fecha_pago: null, fecha_esperada: '2026-10-14', proveedor: null, cobro_id: null }],
  };
}
const correr = async <T>(fn: () => Promise<T>): Promise<T> => {
  const { runWithWorkspace } = await import('../lib/workspace');
  return runWithWorkspace(WS, fn);
};
const marcoAMano = () => escrituras.some((e) => e.startsWith('PATCH pagos') && e.includes('"pagado":true'));

test('el link ya se cobró: la cuota queda con ESE pago y la marca a mano no se hace', async () => {
  const { marcarPago } = await import('../lib/pagos');
  sembrar({ asentado: true, pasarela: 'mercadopago' });
  const r = await correr(() => marcarPago(CUOTA, true, '2026-10-16'));
  assert.deepEqual(r, { quitada: false, porLink: 'mercadopago' });
  assert.equal(preguntas, 1);
  assert.ok(!marcoAMano(), `se marcó a mano igual: ${escrituras.join(' | ')}`);
  assert.equal(db.pagos.length, 1, 'una sola cuota cobrada');
  assert.equal(db.pagos[0].fecha_pago, '2026-10-15', 'la fecha es la del pago de la pasarela, no la que se tipeó');
});

test('el link no se cobró: se marca a mano como siempre', async () => {
  const { marcarPago } = await import('../lib/pagos');
  sembrar({ asentado: false, sinLeer: 0 });
  const r = await correr(() => marcarPago(CUOTA, true, '2026-10-16'));
  assert.deepEqual(r, { quitada: false, porLink: null });
  assert.ok(marcoAMano(), escrituras.join(' | '));
  assert.equal(db.pagos[0].fecha_pago, '2026-10-16');
});

test('la pasarela no contesta: la marca a mano NO se traba', async () => {
  const { marcarPago } = await import('../lib/pagos');
  sembrar('tira');
  const r = await correr(() => marcarPago(CUOTA, true, '2026-10-16'));
  assert.deepEqual(r, { quitada: false, porLink: null });
  assert.ok(marcoAMano());
});

test('cobrar con otro monto: si el link ya se cobró no toca el monto ni deja una diferencia de algo ya pagado', async () => {
  const { cobrarCuota } = await import('../lib/pagos');
  sembrar({ asentado: true, pasarela: 'stripe' });
  const r = await correr(() => cobrarCuota(CUOTA, LEAD, { monto: 200, fecha: '2026-10-16' }));
  assert.equal(r.porLink, 'stripe');
  assert.equal(r.pendiente, null);
  assert.equal(db.pagos.length, 1, `insertó una diferencia: ${escrituras.join(' | ')}`);
  assert.equal(db.pagos[0].monto_usd, 300, 'cambió el monto de una cuota que ya cobró la pasarela');
});

test('la pasarela misma (y quien ya miró) no vuelve a preguntar', async () => {
  const { marcarPago } = await import('../lib/pagos');
  sembrar({ asentado: true, pasarela: 'mercadopago' });
  await correr(() => marcarPago(CUOTA, true, '2026-10-16', { mirarLinks: false }));
  assert.equal(preguntas, 0);
  assert.ok(marcoAMano());
  const p = fuente('lib/pagos.ts');
  const reg = p.slice(p.indexOf('export async function registrarCobroDeProveedor('), p.indexOf('export async function remarcarCobroDeProveedor('));
  const llamadas = reg.match(/await marcarPago\([^)]*\)/g) ?? [];
  assert.equal(llamadas.length, 2);
  for (const l of llamadas) assert.match(l, /\{ mirarLinks: false \}\)$/, `la pasarela preguntándose a sí misma: ${l}`);
});

test('asentarLinkPagadoDeCuota: primero repara el pagado sin su cuota (sin red), después le pregunta a la pasarela', () => {
  const c = fuente('lib/cobros.ts');
  const f = c.slice(c.indexOf('export async function asentarLinkPagadoDeCuota('));
  const cuerpoF = f.slice(0, f.indexOf('\n}\n'));
  const iRepara = cuerpoF.indexOf("if (c.estado !== 'pagado' || !c.proveedor_pago_id");
  const iPregunta = cuerpoF.indexOf('pagoDelLinkEnLaPasarela(c, stripe, mp)');
  assert.ok(iRepara > 0 && iPregunta > iRepara, 'el orden: reparar lo que ya se sabe antes de ir a la red');
  assert.match(cuerpoF, /\.eq\('workspace_id', ws\)\.eq\('pago_id', pagoId\)/, 'los links de ESTA cuota de ESTE negocio');
  assert.match(cuerpoF, /catch \(e\) \{\s*sinLeer\+\+;/, 'una pasarela que no contesta no corta: sigue');
});
