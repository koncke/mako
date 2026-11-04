// =============================================================================
// Los lectores del vigía de las aprobaciones, contra fuentes de MENTIRA (lib/vigia-aprobaciones-fuentes.ts)
// =============================================================================
// Ningún pedido sale a la red: `fetch` es una función de este test que contesta como contesta cada plataforma (la forma
// de cada respuesta, de la documentación oficial leída el 4/11/2026: docs/hallazgos-operaciones.md). Las claves se generan
// acá, en el momento: ninguna clave vive en el repo.
//
// Probado rompiéndolo el 4/11/2026 (base, con tests/vigia-aprobaciones.test.ts: 26 pases, 0 fallos). Cada rotura, 1 rojo:
//   · `estadoDeApple` con REJECTED → 'sin_enviar';
//   · un estado de Apple desconocido leído como aprobado (default);
//   · Play eligiendo la PRIMERA versión de la lista y no la de mayor código;
//   · `credsSinLeer` tratado como «falta cargarla»;
//   · el token de Google pedido una vez por lector (sin memoizar);
//   · el secreto de Meta en la URL en vez de la cabecera.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import {
  leerTodo, LECTORES, versionDeLaFicha, estadoDePlay, PERMISOS_META, type Entorno,
} from '../lib/vigia-aprobaciones-fuentes';
import { vuelta, mensajeDeAvisos } from '../lib/vigia-aprobaciones';

const T0 = Date.parse('2026-11-04T12:00:00Z');

const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const P8 = ec.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = JSON.stringify({
  type: 'service_account', client_email: 'vigia@proyecto-de-mentira.iam.gserviceaccount.com',
  private_key: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), private_key_id: 'abc',
  token_uri: 'https://oauth2.googleapis.com/token',
});
const SECRETO_META = 'secreto-de-mentira-meta-abc';

type Ruta = (url: string, init: RequestInit) => { status: number; body: unknown } | null;

/** Un `fetch` de mentira: la primera ruta que contesta gana; lo que nadie contesta es un 599 (y el test lo nota). */
function falso(rutas: Ruta[]) {
  const pedidos: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (u: string | URL | Request, init: RequestInit = {}) => {
    const url = String(u);
    pedidos.push({ url, init });
    for (const r of rutas) {
      const x = r(url, init);
      if (x) return new Response(typeof x.body === 'string' ? x.body : JSON.stringify(x.body), { status: x.status });
    }
    return new Response('sin ruta', { status: 599 });
  }) as typeof fetch;
  return { f, pedidos };
}

function entorno(fetchFalso: typeof fetch, o: Partial<Entorno> = {}): Entorno {
  return {
    fetch: fetchFalso, ahoraMs: () => T0, creds: {}, versionExtension: '0.75.0', extensionId: 'gapbemdaaghomjbnggechglkpmbgplle',
    dominiosResend: async () => ({ ok: true, domains: [] }), ...o,
  };
}

const CREDS_ASC = { ASC_ISSUER_ID: '00000000-1111-2222-3333-444444444444', ASC_KEY_ID: 'ABC123DEFG', ASC_P8: P8 };
const versiones = (...v: Array<[string, string, string]>) => ({
  data: v.map(([versionString, appVersionState, createdDate]) => ({ attributes: { versionString, appVersionState, createdDate } })),
});
const tokenGoogle: Ruta = (u) => (u === 'https://oauth2.googleapis.com/token' ? { status: 200, body: { access_token: 'tok-de-mentira' } } : null);

test('App Store por la API: la versión más nueva y su estado, con un JWT ES256 que Apple aceptaría', async () => {
  const { f, pedidos } = falso([(u) => (u.startsWith('https://api.appstoreconnect.apple.com/v1/apps/6830383006/appStoreVersions')
    ? { status: 200, body: versiones(['1.0', 'READY_FOR_DISTRIBUTION', '2026-11-01T00:00:00Z'], ['1.1', 'REJECTED', '2026-11-03T00:00:00Z']) } : null)]);
  const l = await LECTORES['app-store'](entorno(f, { creds: CREDS_ASC }), async () => ({ token: 'x' }));
  assert.deepEqual(l, { tipo: 'leido', fuente: 'asc-api', estado: 'rechazado', version: '1.1', detalle: null });
  const jwt = String((pedidos[0].init.headers as Record<string, string>).Authorization).replace('Bearer ', '');
  const [cab, cuerpo, firma] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(cab, 'base64url').toString()), { alg: 'ES256', kid: 'ABC123DEFG', typ: 'JWT' });
  const claims = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
  assert.equal(claims.aud, 'appstoreconnect-v1');
  assert.ok(claims.exp - claims.iat <= 20 * 60, 'Apple acepta 20 minutos como mucho');
  const ok = createVerify('SHA256').update(`${cab}.${cuerpo}`).verify({ key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(firma, 'base64url'));
  assert.ok(ok, 'la firma se verifica con la clave pública');
});

test('App Store: un estado que no conozco no se lee como aprobado, y un 401 es «no pude»', async () => {
  const raro = falso([() => ({ status: 200, body: versiones(['1.0', 'ESTADO_NUEVO_DE_APPLE', '2026-11-01T00:00:00Z']) })]);
  const l1 = await LECTORES['app-store'](entorno(raro.f, { creds: CREDS_ASC }), async () => ({ token: 'x' }));
  assert.equal(l1.tipo, 'no_pude');
  const no = falso([() => ({ status: 401, body: {} })]);
  const l2 = await LECTORES['app-store'](entorno(no.f, { creds: CREDS_ASC }), async () => ({ token: 'x' }));
  assert.deepEqual(l2, { tipo: 'no_pude', motivo: 'App Store Connect no aceptó la clave (HTTP 401)' });
});

test('App Store sin la clave: la búsqueda pública dice si ya está en la tienda, y qué falta para saber más', async () => {
  const esta = falso([(u) => (u.includes('itunes.apple.com/lookup') ? { status: 200, body: { resultCount: 1, results: [{ version: '1.0' }] } } : null)]);
  const l1 = await LECTORES['app-store'](entorno(esta.f), async () => ({ token: 'x' }));
  assert.deepEqual(l1, { tipo: 'leido', fuente: 'itunes', estado: 'aprobado', version: '1.0', faltan: ['ASC_ISSUER_ID', 'ASC_KEY_ID', 'ASC_P8'] });
  const noEsta = falso([(u) => (u.includes('itunes.apple.com/lookup') ? { status: 200, body: { resultCount: 0, results: [] } } : null)]);
  const l2 = await LECTORES['app-store'](entorno(noEsta.f), async () => ({ token: 'x' }));
  assert.equal(l2.tipo === 'leido' && l2.estado, 'sin_publicar');
  assert.equal(noEsta.pedidos.length, 2, 'prueba México y después Estados Unidos');
});

test('una credencial que NO SE PUDO LEER es «no pude», nunca «falta cargarla»', async () => {
  const { f, pedidos } = falso([]);
  const l = await LECTORES['app-store'](entorno(f, { credsSinLeer: ['ASC_P8'] }), async () => ({ token: 'x' }));
  assert.equal(l.tipo, 'no_pude');
  assert.equal(pedidos.length, 0, 'tampoco cae a la búsqueda pública: sería leer otra fuente por un error de la base');
});

test('Google Play por la API: la versión de mayor código, el estado con o sin prefijo, y 404 = todavía no está', async () => {
  const { f } = falso([tokenGoogle, (u) => (u.endsWith('/tracks/production/releases') ? {
    status: 200, body: { releases: [
      { releaseName: '3 (1.0.2)', releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_IN_REVIEW', activeArtifacts: [{ versionCode: 3 }] },
      { releaseName: '1 (1.0)', releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_PUBLISHED', activeArtifacts: [{ versionCode: 1 }] },
    ].reverse() },
  } : u.endsWith('/tracks/alpha/releases') ? { status: 404, body: {} } : null)]);
  const e = entorno(f, { creds: { TIENDAS_GOOGLE_CUENTA_SERVICIO: SA } });
  const todo = await leerTodo(e);
  assert.deepEqual(todo['play-produccion'], { tipo: 'leido', fuente: 'play-api', estado: 'en_revision', version: '3 (1.0.2)', detalle: null });
  assert.equal(todo['play-prueba-cerrada'].tipo === 'leido' && todo['play-prueba-cerrada'].estado, 'sin_enviar');
  assert.equal(estadoDePlay('NOT_APPROVED')?.estado, 'rechazado');
  assert.equal(estadoDePlay('RELEASE_LIFECYCLE_STATE_APPROVED_NOT_PUBLISHED')?.estado, 'aprobado');
});

test('el token de Google se pide UNA vez por vuelta aunque lo usen tres lectores', async () => {
  const { f, pedidos } = falso([tokenGoogle, (u) => (u.includes('androidpublisher') ? { status: 200, body: { releases: [] } } : null),
    (u) => (u.includes(':fetchStatus') ? { status: 200, body: { publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ crxVersion: '0.75.0' }] } } } : null)]);
  await leerTodo(entorno(f, { creds: { TIENDAS_GOOGLE_CUENTA_SERVICIO: SA, CWS_PUBLISHER_ID: 'pub-de-mentira' } }));
  assert.equal(pedidos.filter((p) => p.url === 'https://oauth2.googleapis.com/token').length, 1);
  const pedido = pedidos.find((p) => p.url === 'https://oauth2.googleapis.com/token')!;
  const assertion = new URLSearchParams(String(pedido.init.body)).get('assertion')!;
  const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString());
  assert.match(claims.scope, /androidpublisher/);
  assert.match(claims.scope, /chromewebstore\.readonly/, 'sólo lectura en la tienda de Chrome');
});

test('Google Play sin la cuenta de servicio: producción por la ficha pública; la prueba cerrada, a mano', async () => {
  const pub = falso([(u) => (u.startsWith('https://play.google.com/store/apps/details') ? { status: 404, body: 'no' } : null)]);
  const todo = await leerTodo(entorno(pub.f));
  assert.equal(todo['play-produccion'].tipo === 'leido' && todo['play-produccion'].estado, 'sin_publicar');
  assert.deepEqual(todo['play-prueba-cerrada'], { tipo: 'sin_credencial', faltan: ['TIENDAS_GOOGLE_CUENTA_SERVICIO'] });
});

test('Chrome Web Store por la API: en revisión, rechazada, bajada y con advertencia', async () => {
  const leer = async (body: unknown) => {
    const { f } = falso([(u) => (u.includes(':fetchStatus') ? { status: 200, body } : null)]);
    return LECTORES['chrome-web-store'](entorno(f, { creds: { TIENDAS_GOOGLE_CUENTA_SERVICIO: SA, CWS_PUBLISHER_ID: 'pub' } }), async () => ({ token: 'tok' }));
  };
  const enRev = await leer({ submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.75.0' }] }, publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ crxVersion: '0.74.3' }] } });
  assert.deepEqual(enRev, { tipo: 'leido', fuente: 'cws-api', estado: 'en_revision', version: '0.75.0', detalle: null });
  const rech = await leer({ submittedItemRevisionStatus: { state: 'REJECTED', distributionChannels: [{ crxVersion: '0.75.0' }] } });
  assert.equal(rech.tipo === 'leido' && rech.estado, 'rechazado');
  const bajada = await leer({ takenDown: true, publishedItemRevisionStatus: { state: 'PUBLISHED' } });
  assert.equal(bajada.tipo === 'leido' && bajada.estado, 'rechazado');
  const adv = await leer({ warned: true, publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ crxVersion: '0.74.3' }] } });
  assert.equal(adv.tipo === 'leido' && adv.estado, 'piden_algo');
  const cancelada = await leer({ submittedItemRevisionStatus: { state: 'CANCELLED' }, publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ crxVersion: '0.74.3' }] } });
  assert.deepEqual(cancelada.tipo === 'leido' && [cancelada.estado, cancelada.version], ['aprobado', '0.74.3']);
});

test('Chrome Web Store sin credencial: la versión de la ficha pública, y si MaKo va adelante lo dice', async () => {
  const html = (desc: string, v: string) => `<div>${desc}</div>…{\\"version\\": \\"${v}\\", \\"description\\": \\"${desc}\\"}<div class="nBZElf">${v}</div>`;
  const { f } = falso([(u) => (u.startsWith('https://chromewebstore.google.com/detail/') ? { status: 200, body: html('Genera los anuncios de MaKo', '0.74.3') } : null)]);
  const l = await LECTORES['chrome-web-store'](entorno(f), async () => ({ token: 'x' }));
  assert.equal(l.tipo === 'leido' && l.version, '0.74.3');
  assert.match(l.tipo === 'leido' ? String(l.detalle) : '', /MaKo va por la 0\.75\.0/);
  assert.deepEqual(l.tipo === 'leido' && l.faltan, ['TIENDAS_GOOGLE_CUENTA_SERVICIO', 'CWS_PUBLISHER_ID']);
  assert.equal(versionDeLaFicha(html('Conecta tu navegador con MaKo', '0.75.0')), '0.75.0', 'la descripción nueva también');
  assert.equal(versionDeLaFicha(`{\\"version\\": \\"0.75.0\\", Genera los anuncios de MaKo <div class="nBZElf">0.74.3</div>`), 'no_coinciden');
});

test('Meta: los permisos aprobados son logros; el secreto viaja en la cabecera, nunca en la URL', async () => {
  const { f, pedidos } = falso([(u) => (u.includes('/2586146911825340/permissions')
    ? { status: 200, body: { data: [{ permission: 'ads_read', status: 'live' }, { permission: 'ads_management', status: 'unapproved' }] } } : null)]);
  const l = await LECTORES['meta-permisos'](entorno(f, { creds: { MAKO_META_APP_SECRET: SECRETO_META } }), async () => ({ token: 'x' }));
  assert.equal(l.tipo === 'leido' && l.estado, 'sin_publicar');
  assert.deepEqual(l.tipo === 'leido' && l.logros, ['ads_read']);
  assert.ok(!pedidos[0].url.includes(SECRETO_META), 'una URL termina en un log');
  const todos = falso([() => ({ status: 200, body: { data: PERMISOS_META.map((permission) => ({ permission, status: 'live' })) } })]);
  const l2 = await LECTORES['meta-permisos'](entorno(todos.f, { creds: { MAKO_META_APP_SECRET: SECRETO_META } }), async () => ({ token: 'x' }));
  assert.equal(l2.tipo === 'leido' && l2.estado, 'aprobado');
  const sin = await LECTORES['meta-permisos'](entorno(falso([]).f), async () => ({ token: 'x' }));
  assert.deepEqual(sin, { tipo: 'sin_credencial', faltan: ['MAKO_META_APP_SECRET'] });
});

test('Resend: sólo los dominios de MaKo, y uno que falla pide algo', async () => {
  const e = (domains: Array<{ name: string; status: string }>) => entorno(falso([]).f, { dominiosResend: async () => ({ ok: true, domains }) });
  const l = await LECTORES['resend-dominios'](e([
    { name: 'hola-mako.com', status: 'verified' }, { name: 'send.hola-mako.com', status: 'temporary_failure' }, { name: 'negocio-de-un-cliente.com', status: 'failed' },
  ]), async () => ({ token: 'x' }));
  assert.equal(l.tipo === 'leido' && l.estado, 'piden_algo');
  assert.ok(l.tipo === 'leido' && !String(l.detalle).includes('negocio-de-un-cliente'), 'el dominio de un cliente no es una aprobación de MaKo');
  const sinClave = await LECTORES['resend-dominios'](entorno(falso([]).f, { dominiosResend: async () => ({ ok: false, error: 'x', sinClave: true }) }), async () => ({ token: 'x' }));
  assert.deepEqual(sinClave, { tipo: 'sin_credencial', faltan: ['RESEND_ADMIN_API_KEY'] });
});

test('nada tira: sin red, cada lector dice «no pude» o «a mano», y ningún motivo lleva una clave', async () => {
  const sinRed = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
  const todo = await leerTodo(entorno(sinRed, {
    creds: { ...CREDS_ASC, TIENDAS_GOOGLE_CUENTA_SERVICIO: SA, CWS_PUBLISHER_ID: 'pub', MAKO_META_APP_SECRET: SECRETO_META },
    dominiosResend: async () => { throw new Error('caída'); },
  }));
  for (const [id, l] of Object.entries(todo)) {
    assert.ok(l.tipo === 'no_pude' || l.tipo === 'a_mano', `${id}: ${JSON.stringify(l)}`);
    const texto = JSON.stringify(l);
    for (const secreto of [SECRETO_META, P8.slice(40, 80), 'tok-de-mentira']) assert.ok(!texto.includes(secreto), `${id} lleva una clave`);
  }
});

test('de punta a punta: la primera vuelta sólo dice lo que hay que mirar a mano; la aprobación que llega después avisa', async () => {
  const fichas = (version: string, appStore: number) => falso([
    (u) => (u.includes('itunes.apple.com') ? { status: 200, body: { resultCount: appStore, results: appStore ? [{ version: '1.0' }] : [] } } : null),
    (u) => (u.startsWith('https://play.google.com/store') ? { status: 404, body: 'no' } : null),
    (u) => (u.startsWith('https://chromewebstore.google.com') ? { status: 200, body: `{\\"version\\": \\"${version}\\", Genera los anuncios de MaKo` } : null),
    (u) => (u.includes('graph.facebook.com') ? { status: 200, body: { data: [] } } : null),
  ]);
  const e1 = entorno(fichas('0.74.3', 0).f, { creds: { MAKO_META_APP_SECRET: SECRETO_META }, dominiosResend: async () => ({ ok: true, domains: [{ name: 'hola-mako.com', status: 'verified' }] }) });
  const r1 = vuelta(null, await leerTodo(e1), T0);
  assert.deepEqual([...new Set(r1.avisos.map((a) => a.tipo))], ['a_mano'], 'nada viejo se anuncia como novedad');
  const e2 = entorno(fichas('0.75.0', 1).f, { creds: { MAKO_META_APP_SECRET: SECRETO_META }, dominiosResend: async () => ({ ok: true, domains: [{ name: 'hola-mako.com', status: 'verified' }] }) });
  const r2 = vuelta(r1.nuevo, await leerTodo(e2), T0 + 3600_000);
  assert.deepEqual(r2.avisos.map((a) => a.item).sort(), ['app-store', 'chrome-web-store']);
  const m = mensajeDeAvisos(r2.avisos)!;
  assert.match(m.texto, /App de iPhone \(App Store\)\*: aprobado \(1\.0\)/);
  assert.match(m.texto, /Extensión de Chrome \(Chrome Web Store\)\*: aprobado \(0\.75\.0\)/);
  const r3 = vuelta(r2.nuevo, await leerTodo(e2), T0 + 2 * 3600_000);
  assert.deepEqual(r3.avisos, [], 'la hora siguiente, con todo igual, silencio');
});
