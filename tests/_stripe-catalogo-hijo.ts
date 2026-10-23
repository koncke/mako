// =============================================================================
// Hijo de tests/stripe-catalogo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Los productos de Stripe en «Vincular cobro» (23/10/2026, llamada con Mauricio). lib/stripe-catalogo.ts lleva
// `server-only`: corre en un node aparte con `--conditions=react-server`. Sin red ni base: `fetch` contesta la API de
// Stripe (los precios de cada cuenta, por su clave) y el PostgREST de Supabase (tests/_postgrest-de-mentira.ts).

import { crearPostgrest } from './_postgrest-de-mentira';

let nId = 100;
const pg = crearPostgrest({
  tablas: ['credenciales', 'webhook_routing', 'credenciales_auditoria', 'productos'],
  // Devuelve la fila ENTERA (el PostgREST de mentira la reemplaza por lo que devuelve).
  defaults: (tabla, f) => (tabla === 'productos' && f.id == null ? { ...f, id: nId++ } : { ...f }),
});

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const KEY_A = 'sk_test_principalAAAAAAAAAAAA';
const KEY_B = 'sk_test_segundaBBBBBBBBBBBBBB';
const prod = (name: string, active = true) => ({ id: `prod_${name.replace(/\W/g, '')}`, object: 'product', name, active });
/** Los precios de cada cuenta, por su clave. Lo de Mauricio: «sprint 3 días» a US$270 en una cuenta de México. */
const PRECIOS: Record<string, Array<Record<string, unknown>>> = {
  [KEY_A]: [
    { id: 'price_A270', active: true, currency: 'usd', unit_amount: 27000, type: 'one_time', billing_scheme: 'per_unit', product: prod('sprint 3 días') },
    { id: 'price_Amxn', active: true, currency: 'mxn', unit_amount: 500000, type: 'one_time', billing_scheme: 'per_unit', product: prod('Curso MX') },
    { id: 'price_Aanual', active: true, currency: 'usd', unit_amount: 99000, type: 'recurring', billing_scheme: 'per_unit', recurring: { interval: 'year', interval_count: 1 }, product: prod('Plan anual') },
    { id: 'price_Aarch', active: true, currency: 'usd', unit_amount: 1000, type: 'one_time', billing_scheme: 'per_unit', product: prod('Viejo', false) },
    { id: 'price_Amensual', active: true, currency: 'usd', unit_amount: 4900, type: 'recurring', billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1 }, product: prod('Membresía') },
    { id: 'price_Ataller', active: true, currency: 'usd', unit_amount: 30000, type: 'one_time', billing_scheme: 'per_unit', product: prod('Taller') },
  ],
  [KEY_B]: [
    { id: 'price_B100', active: true, currency: 'usd', unit_amount: 10000, type: 'one_time', billing_scheme: 'per_unit', product: prod('Mentoría') },
    // El MISMO producto de Stripe con otro precio (lo normal en Stripe): el de MaKo ya cobra US$100 único, no se pisa.
    { id: 'price_B50mes', active: true, currency: 'usd', unit_amount: 5000, type: 'recurring', billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1 }, product: prod('Mentoría') },
  ],
};
let claveRota: string | null = null;
/** Cada pedido a Stripe: con qué clave y a qué camino. */
let pedidos: string[] = [];

function stripe(u: URL, init: RequestInit): Response {
  const key = (new Headers(init.headers).get('Authorization') ?? '').replace(/^Bearer /, '');
  pedidos.push(`${key === KEY_A ? 'A' : key === KEY_B ? 'B' : '?'}:${(init.method ?? 'GET').toUpperCase()} ${u.pathname}`);
  if (key === claveRota || !PRECIOS[key]) return json(401, { error: { message: 'Invalid API Key provided' } });
  const expand = u.searchParams.getAll('expand[]');
  const conProducto = (p: Record<string, unknown>, campo: string) => (expand.includes(campo) ? p : { ...p, product: (p.product as { id: string }).id });
  if (u.pathname === '/v1/prices') {
    const activos = PRECIOS[key].filter((p) => u.searchParams.get('active') !== 'true' || p.active === true);
    return json(200, { object: 'list', data: activos.map((p) => conProducto(p, 'data.product')), has_more: false });
  }
  if (u.pathname.startsWith('/v1/prices/')) {
    const id = decodeURIComponent(u.pathname.split('/').pop() ?? '');
    const p = PRECIOS[key].find((x) => x.id === id);
    return p ? json(200, conProducto(p, 'product')) : json(404, { error: { message: `No such price: '${id}'` } });
  }
  return json(404, { error: { message: `sin mock: ${u.pathname}` } });
}

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  if (u.host === 'api.stripe.com') return stripe(u, init);
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales';

async function main() {
  const { guardarCredencial } = await import('../lib/credenciales');
  const { guardarAliasCuenta } = await import('../lib/cuentas-pago-server');
  const { preciosDeStripe, importarPrecioDeStripe } = await import('../lib/stripe-catalogo');
  const { runWithWorkspace } = await import('../lib/workspace');
  // El ws1, como el de Mauricio: su fila de credenciales es la que se lee (nunca el entorno).
  const WS = 1;
  const out: Record<string, unknown> = {};
  const en = <T>(f: () => Promise<T>) => runWithWorkspace(WS, f);

  for (const [c, k, acct] of [['', KEY_A, 'acct_1AAAAAAAAAAAAAAAA'], ['__C2', KEY_B, 'acct_1BBBBBBBBBBBBBBBB']] as const) {
    await guardarCredencial(WS, `STRIPE_SECRET_KEY${c}`, k, 'stripe', 'test');
    await guardarCredencial(WS, `STRIPE_ACCOUNT_ID${c}`, acct, 'stripe', 'test');
    await guardarCredencial(WS, `STRIPE_WEBHOOK_SECRET${c}`, `whsec_prueba${c || 'A'}AAAAAAAAAAAAAAAA`, 'stripe', 'test');
  }
  await guardarAliasCuenta(WS, 'stripe', 'c2', 'Stripe del equipo', 'test');
  // El catálogo de MaKo de Mauricio: «Sprint 3 días» SIN precio (el «no tiene precio» de la llamada), una «Mentoría»
  // que ya cobra lo mismo que en Stripe, y dos «Taller» con precios distintos (no se adivina cuál es).
  const fila = (id: number, nombre: string, monto: number | null, orden: number) =>
    ({ id, workspace_id: WS, nombre, tipo: 'unico', monto_usd: monto, suscripcion_meses: null, cuotas: null, activo: true, orden });
  pg.db.productos.push(fila(54, 'Sprint 3 días', null, 5), fila(60, 'Mentoría', 100, 6), fila(61, 'Taller', 250, 7), fila(62, 'taller', 280, 8));

  // 1. Los precios de LAS DOS cuentas, en vivo, con su cuenta y el producto de MaKo que es cada uno.
  const lista = await en(() => preciosDeStripe(WS));
  out.lista = lista.precios.map((p) => `${p.nombre}|${p.cuenta}|${p.cuentaNombre}|${p.montoUsd}|${p.tipo}|${p.noSe ? `no: ${p.noSe}` : 'sí'}|${p.enMako}`);
  out.errores = lista.errores;

  const traer = async (cuenta: string, precio: string, antesDeEscribir?: (id: number | null) => Promise<string | null>) => {
    const r = await en(() => importarPrecioDeStripe(WS, cuenta, precio, antesDeEscribir));
    return r.ok ? `${r.cambio}:${r.producto.id}:${r.producto.nombre}:${r.producto.tipo}:${r.producto.montoUsd}:antes=${r.antes}` : `error: ${r.error}`;
  };
  const cuantos = () => pg.db.productos.length;

  // 2. Lo que frena el vínculo (ya cobra en otro CRM) frena ANTES de escribir: el catálogo no se toca.
  const vistos: Array<number | null> = [];
  out.frenado = await traer('stripe:principal', 'price_A270', async (id) => { vistos.push(id); return 'Ese producto ya cobra en «Otro»: quítalo de ahí primero.'; });
  out.frenadoVio = vistos;
  out.frenadoFila = (pg.db.productos.find((f) => f.id === 54) as { monto_usd: unknown }).monto_usd;
  // 3. El de Mauricio: le pone el precio de Stripe al «Sprint 3 días» de MaKo (no crea otro), y otra vez no cambia nada.
  const antes = cuantos();
  out.sprint = await traer('stripe:principal', 'price_A270');
  out.sprintOtraVez = await traer('stripe:principal', 'price_A270');
  out.sprintFila = (({ nombre, monto_usd, tipo }) => `${nombre}|${monto_usd}|${tipo}`)(pg.db.productos.find((f) => f.id === 54) as never);
  out.creadosPorSprint = cuantos() - antes;
  // 4. La segunda cuenta, con SU clave; el que ya cobra lo mismo no se toca, y el que cobra OTRA cosa tampoco.
  out.mentoria = await traer('stripe:c2', 'price_B100');
  out.mentoriaMensual = await traer('stripe:c2', 'price_B50mes');
  out.mentoriaFila = (({ monto_usd, tipo }) => `${monto_usd}|${tipo}`)(pg.db.productos.find((f) => f.id === 60) as never);
  // 5. Uno que no está en MaKo se crea; una suscripción mensual va como suscripción.
  out.membresia = await traer('stripe:principal', 'price_Amensual');
  // 6. Lo que no se puede: otra moneda, el precio de otra cuenta (404 con su clave), una cuenta que no está, un id raro,
  //    y dos productos de MaKo con el mismo nombre y precios distintos.
  out.mxn = await traer('stripe:principal', 'price_Amxn');
  out.deOtraCuenta = await traer('stripe:c2', 'price_A270');
  out.sinCuenta = await traer('stripe:c9', 'price_A270');
  out.idRaro = await traer('stripe:principal', '../v1/charges');
  out.ambiguo = await traer('stripe:principal', 'price_Ataller');
  out.archivado = await traer('stripe:principal', 'price_Aarch');
  // 7. Una cuenta con la clave rota: se dice con su nombre, y la otra se lista igual.
  claveRota = KEY_B;
  const rota = await en(() => preciosDeStripe(WS));
  out.rota = { cuentas: [...new Set(rota.precios.map((p) => p.cuenta))], errores: rota.errores.map((e) => `${e.cuenta}|${e.cuentaNombre}|${e.error}`) };
  claveRota = null;
  // 8. Cada lectura va a Stripe (sin caché): «Volver a leer» trae lo recién creado.
  pedidos = [];
  await en(() => preciosDeStripe(WS));
  await en(() => preciosDeStripe(WS));
  out.listados = pedidos.filter((p) => p.endsWith('GET /v1/prices')).length;

  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`);
}

void main();

// Módulo, no script: sin esto tsc los junta en un solo ámbito global con los otros hijos y choca cada `db`/`json`.
export {};
