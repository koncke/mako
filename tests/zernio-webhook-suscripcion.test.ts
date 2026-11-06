// =============================================================================
// La suscripción del webhook de Zernio, EJECUTADA: los leads van aparte y un rechazo no le saca los mensajes al negocio
// =============================================================================
// 23/10/2026. `lead.received` es un evento del complemento de ANUNCIOS de Zernio, y la doc dice que sin él los eventos de anuncios dan 403
// `ads_addon_required` al registrar el webhook (NO dice si éste está entre ellos). `asegurarWebhook` (lib/zernio.ts) pide todo junto y, si
// Zernio rechaza, registra los de siempre solos: sin eso, un negocio sin el complemento perdería los mensajes y comentarios de Instagram y
// Messenger, que hoy andan.
//
// ⚠️ ESTO SE EJECUTA Y NO SE LEE: la revisión adversarial del 23/10 armó cuatro roturas de ese reintento (el reintento que manda otra vez
// los mismos eventos, el PUT y el POST cambiados, el reintento envuelto en un catch vacío, el webhook de otro negocio) que dejaban 22 de 22
// tests de texto en verde. El módulo es `server-only`: se neutraliza el marcador con el parche de Module._load (tests/alta-cliente.test.ts),
// se reemplazan las cinco dependencias que tocan la base o el entorno, y `fetch` es uno falso que anota cada pedido.
//
// Correr: npx tsx --test tests/zernio-webhook-suscripcion.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { webhookDeLaCuenta } from '../lib/zernio-firma';

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
type Pedido = { metodo: string; ruta: string; body: Record<string, unknown> | null };
type Respuesta = { status: number; body: unknown };

const WS = 5; // un negocio con key propia (el OWNER_WS del stub es el 1)
const MAESTRO = 'maestro-de-prueba';
let hayMaestro = true;
const pedidos: Pedido[] = [];
let guion: Respuesta[] = [];
const URL_NUESTRA = `https://app.test${webhookDeLaCuenta(MAESTRO, WS, true).ruta}`;

const STUBS: Record<string, unknown> = {
  'server-only': {},
  './credenciales': {
    envCred: async (clave: string) => (clave === 'ZERNIO_WEBHOOK_SECRET' && hayMaestro ? MAESTRO : null),
    credDelClienteEstricta: async () => 'key_del_negocio',
    credWsEstricta: async () => null,
    clavesGuardadasConBase: async () => [] as string[],
  },
  './supabase': { getSupabaseServer: () => { throw new Error('este test no toca la base'); } },
  './workspace': { OWNER_WS: 1 },
  './webhook-routing': { upsertRouting: async () => 'ok' },
  './app-url': { linkApp: (ruta: string) => `https://app.test${ruta}` },
  './canal-social': { seguimientoDe: () => null, seguimientoNoSe: () => null, conTope: async (p: Promise<unknown>) => p, CONCURRENCIA_SEGUIMIENTO: 1 },
};

const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
const conStubs = ((pedido: string, padre: unknown, esMain: boolean) => {
  const archivo = String((padre as { filename?: string } | null)?.filename ?? '').replace(/\\/g, '/');
  if (archivo.endsWith('/lib/zernio.ts') && pedido in STUBS) return STUBS[pedido];
  return Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain]);
}) as Cargador;
// El módulo se carga UNA vez y con los stubs puestos sólo mientras se carga (el formato CJS de tsx no admite `await` de nivel superior).
let cargado: Promise<typeof import('../lib/zernio')> | null = null;
const zernio = () => (cargado ??= (async () => {
  M._load = conStubs;
  try { return await import('../lib/zernio'); } finally { M._load = cargarOriginal; }
})());

globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const ruta = String(url).replace('https://zernio.com/api/v1', '');
  pedidos.push({ metodo: init?.method ?? 'GET', ruta, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null });
  const r = guion.shift();
  assert.ok(r, `un pedido que el guion no esperaba: ${init?.method ?? 'GET'} ${ruta}`);
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const ok = (body: unknown = { success: true }): Respuesta => ({ status: 200, body });
const lista = (...webhooks: Array<Record<string, unknown>>): Respuesta => ok({ webhooks });
const propio = (events: string[], extra: Record<string, unknown> = {}) => ({ _id: 'wh_1', url: URL_NUESTRA, events, isActive: true, ...extra });
const rechazo = (status: number, code?: string): Respuesta => ({ status, body: { error: 'no', ...(code ? { code } : {}) } });
const correr = async <T>(g: Respuesta[], f: () => Promise<T>) => { pedidos.length = 0; guion = [...g]; const r = await f(); assert.equal(guion.length, 0, 'sobraron respuestas del guion'); return r; };
const eventosDe = (p: Pedido) => (p.body?.events ?? []) as string[];

// ── asegurarWebhook ──────────────────────────────────────────────────────────

test('con el complemento: un webhook nuevo se crea (POST) con los de siempre Y los leads', async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS, ZernioError } = await zernio();
  const r = await correr([lista(), ok()], () => asegurarWebhook(WS));
  assert.equal(r, 'creado');
  assert.deepEqual(pedidos.map((p) => `${p.metodo} ${p.ruta}`), ['GET /webhooks/settings', 'POST /webhooks/settings']);
  assert.deepEqual(eventosDe(pedidos[1]), [...EVENTOS_WEBHOOK, EVENTO_LEADS]);
  assert.equal(pedidos[1].body?.url, URL_NUESTRA);
  assert.equal(pedidos[1].body?.secret, webhookDeLaCuenta(MAESTRO, WS, true).secret, 'el secreto del NEGOCIO, no el maestro');
});

test('con el complemento: el webhook que ya existía se actualiza (PUT), se reactiva y escucha los leads', async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS, ZernioError } = await zernio();
  const r = await correr([lista(propio([...EVENTOS_WEBHOOK], { isActive: false })), ok()], () => asegurarWebhook(WS));
  assert.equal(r, 'actualizado');
  assert.deepEqual(pedidos.map((p) => `${p.metodo} ${p.ruta}`), ['GET /webhooks/settings', 'PUT /webhooks/settings']);
  assert.equal(pedidos[1].body?.webhookId, 'wh_1');
  assert.equal(pedidos[1].body?.isActive, true);
  assert.deepEqual(eventosDe(pedidos[1]), [...EVENTOS_WEBHOOK, EVENTO_LEADS]);
});

for (const status of [400, 403, 422]) {
  test(`sin el complemento (${status}): un webhook NUEVO se registra igual con los de siempre, sin los leads`, async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS, ZernioError } = await zernio();
    const r = await correr([lista(), rechazo(status, 'ads_addon_required'), ok()], () => asegurarWebhook(WS));
    assert.equal(r, 'creado');
    assert.deepEqual(pedidos.map((p) => `${p.metodo} ${p.ruta}`), ['GET /webhooks/settings', 'POST /webhooks/settings', 'POST /webhooks/settings']);
    assert.deepEqual(eventosDe(pedidos[2]), [...EVENTOS_WEBHOOK], 'el reintento sigue pidiendo los leads');
    assert.ok(!eventosDe(pedidos[2]).includes(EVENTO_LEADS));
    assert.equal(pedidos[2].body?.url, URL_NUESTRA);
    assert.equal(pedidos[2].body?.secret, webhookDeLaCuenta(MAESTRO, WS, true).secret, 'el reintento perdió el secreto');
  });

  test(`sin el complemento (${status}): el webhook que YA existía queda con los de siempre, activo, con su id y su secreto`, async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS, ZernioError } = await zernio();
    const r = await correr([lista(propio([...EVENTOS_WEBHOOK, EVENTO_LEADS])), rechazo(status), ok()], () => asegurarWebhook(WS));
    assert.equal(r, 'actualizado');
    assert.deepEqual(pedidos.map((p) => `${p.metodo} ${p.ruta}`), ['GET /webhooks/settings', 'PUT /webhooks/settings', 'PUT /webhooks/settings']);
    assert.deepEqual(eventosDe(pedidos[2]), [...EVENTOS_WEBHOOK]);
    assert.equal(pedidos[2].body?.webhookId, 'wh_1');
    assert.equal(pedidos[2].body?.isActive, true);
    assert.equal(pedidos[2].body?.secret, webhookDeLaCuenta(MAESTRO, WS, true).secret);
  });
}

for (const [status, que] of [[401, 'una key mala'], [402, 'un pago pendiente'], [500, 'una caída de Zernio'], [429, 'el límite de pedidos']] as const) {
  test(`${que} (${status}) NO se confunde con «sin complemento»: sube tal cual, sin un segundo pedido`, async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS, ZernioError } = await zernio();
    await assert.rejects(
      correr([lista(), rechazo(status)], () => asegurarWebhook(WS)),
      (e: unknown) => e instanceof ZernioError && e.status === status,
    );
    assert.equal(pedidos.length, 2, 'hubo un reintento que no correspondía');
  });
}

test('si el reintento sin leads TAMBIÉN falla, sube SU error (el de los eventos de siempre es el que importa)', async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS, ZernioError } = await zernio();
  await assert.rejects(
    correr([lista(), rechazo(403, 'ads_addon_required'), rechazo(500)], () => asegurarWebhook(WS)),
    (e: unknown) => e instanceof ZernioError && e.status === 500,
  );
  assert.equal(pedidos.length, 3);
});

test('sin el secreto maestro no se registra nada (y no se toca Zernio)', async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS, ZernioError } = await zernio();
  hayMaestro = false;
  try {
    assert.equal(await correr([], () => asegurarWebhook(WS)), 'sin_secreto');
    assert.equal(pedidos.length, 0);
  } finally { hayMaestro = true; }
});

// ── leadsEnElWebhook ─────────────────────────────────────────────────────────

test('leadsEnElWebhook: true sólo con NUESTRO webhook activo y suscripto a los leads', async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS, ZernioError } = await zernio();
  assert.equal(await correr([lista(propio([...EVENTOS_WEBHOOK, EVENTO_LEADS]))], () => leadsEnElWebhook(WS)), true);
  assert.equal(await correr([lista(propio([...EVENTOS_WEBHOOK]))], () => leadsEnElWebhook(WS)), false, 'sin el evento');
  assert.equal(await correr([lista(propio([...EVENTOS_WEBHOOK, EVENTO_LEADS], { isActive: false }))], () => leadsEnElWebhook(WS)), false, 'apagado');
  assert.equal(await correr([lista(propio([EVENTO_LEADS], { isActive: undefined }))], () => leadsEnElWebhook(WS)), true, 'sin el campo isActive no es «apagado»');
});

test('leadsEnElWebhook: null = no hay webhook nuestro (otra URL, o ninguno), o no hay secreto maestro', async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS, ZernioError } = await zernio();
  assert.equal(await correr([lista()], () => leadsEnElWebhook(WS)), null);
  assert.equal(await correr([lista(propio([EVENTO_LEADS], { url: 'https://otro.test/api/webhooks/zernio' }))], () => leadsEnElWebhook(WS)), null, 'sólo la URL EXACTA');
  // El de OTRO negocio (`?w=6`) no es el nuestro aunque escuche los leads.
  assert.equal(await correr([lista(propio([EVENTO_LEADS], { url: `https://app.test${webhookDeLaCuenta(MAESTRO, 6, true).ruta}` }))], () => leadsEnElWebhook(WS)), null);
  hayMaestro = false;
  try { assert.equal(await correr([], () => leadsEnElWebhook(WS)), null); assert.equal(pedidos.length, 0); } finally { hayMaestro = true; }
});

test('el ws1 (la cuenta de la plataforma): su webhook va SIN `?w=` y con el secreto maestro, y leadsEnElWebhook lo encuentra ahí', async () => {
  const { asegurarWebhook, leadsEnElWebhook, EVENTOS_WEBHOOK, EVENTO_LEADS } = await zernio();
  const plataforma = webhookDeLaCuenta(MAESTRO, 1, false);
  assert.equal(plataforma.secret, MAESTRO);
  assert.ok(!plataforma.ruta.includes('?w='));
  await correr([lista(), ok()], () => asegurarWebhook(1));
  assert.equal(pedidos[1].body?.url, `https://app.test${plataforma.ruta}`);
  assert.equal(pedidos[1].body?.secret, MAESTRO);
  const suyo = { _id: 'wh_p', url: `https://app.test${plataforma.ruta}`, events: [...EVENTOS_WEBHOOK, EVENTO_LEADS], isActive: true };
  assert.equal(await correr([lista(suyo)], () => leadsEnElWebhook(1)), true);
  // El webhook de un negocio con cuenta propia (`?w=5`) NO es el del ws1.
  assert.equal(await correr([lista(propio([EVENTO_LEADS]))], () => leadsEnElWebhook(1)), null);
});

test('el webhook de un negocio con key propia lleva SU secreto y su `?w=` (no el maestro ni el de otro)', () => {
  const a = webhookDeLaCuenta(MAESTRO, WS, true);
  const b = webhookDeLaCuenta(MAESTRO, 6, true);
  assert.notEqual(a.secret, b.secret);
  assert.notEqual(a.secret, MAESTRO);
  assert.match(a.ruta, new RegExp(`\\?w=${WS}$`));
});

// ── avisoDeLeadsZernio (5/11/2026): el aviso del modal «Anuncios de Meta», EJECUTADO contra el webhook y la API de Zernio ──
// Probado rompiéndolo (5/11/2026, el archivo en 21/0): `avisoDeLeadsZernio` sin preguntar a la API (sólo el webhook) → 19/2 (los dos
// de abajo que la necesitan).

test('avisoDeLeadsZernio: con el webhook escuchando, «si» y un solo pedido (no se le pregunta a la API)', async () => {
  const { avisoDeLeadsZernio, EVENTOS_WEBHOOK, EVENTO_LEADS } = await zernio();
  assert.equal(await correr([lista(propio([...EVENTOS_WEBHOOK, EVENTO_LEADS]))], () => avisoDeLeadsZernio(WS, 'acc_ads')), 'si');
  assert.equal(pedidos.length, 1);
});

test('avisoDeLeadsZernio: sin webhook (o pausado, o sin los leads) y la API los entrega → «tarde», nunca «no recibe»', async () => {
  const { avisoDeLeadsZernio, EVENTOS_WEBHOOK, EVENTO_LEADS } = await zernio();
  assert.equal(await correr([lista(), ok({ leads: [] })], () => avisoDeLeadsZernio(WS, 'acc_ads')), 'tarde');
  assert.match(pedidos[1].ruta, /^\/ads\/leads\?.*accountIds=acc_ads/, 'el mismo pedido del barrido');
  assert.equal(await correr([lista(propio([...EVENTOS_WEBHOOK, EVENTO_LEADS], { isActive: false })), ok({ leads: [] })], () => avisoDeLeadsZernio(WS, 'acc_ads')), 'tarde');
  assert.equal(await correr([lista(propio([...EVENTOS_WEBHOOK])), ok({ leads: [] })], () => avisoDeLeadsZernio(WS, 'acc_ads')), 'tarde', 'un webhook viejo sin los leads no es «falta el complemento»');
});

test('avisoDeLeadsZernio: 403 de la API = falta el complemento; otra falla o sin el secreto maestro = no se afirma nada', async () => {
  const { avisoDeLeadsZernio } = await zernio();
  assert.equal(await correr([lista(), rechazo(403, 'ads_addon_required')], () => avisoDeLeadsZernio(WS, 'acc_ads')), 'sin-permiso');
  assert.equal(await correr([lista(), rechazo(500)], () => avisoDeLeadsZernio(WS, 'acc_ads')), null);
  hayMaestro = false;
  try {
    assert.equal(await correr([ok({ leads: [] })], () => avisoDeLeadsZernio(WS, 'acc_ads')), null, '«Volver a conectar» no arreglaría nada');
    assert.equal(await correr([rechazo(403)], () => avisoDeLeadsZernio(WS, 'acc_ads')), 'sin-permiso');
  } finally { hayMaestro = true; }
});
