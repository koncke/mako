// =============================================================================
// La extensión se publica sola en la Chrome Web Store (lib/extension-publicar.ts, 5/11/2026)
// =============================================================================
// Martín (27/10 y 5/11/2026): «si hay cosas que publicar... automáticamente». Estos tests fijan las seis reglas de la cabecera
// del módulo contra una tienda de MENTIRA: ningún pedido sale a la red. Las formas de la API V2 no se midieron contra Google
// (la nube no llega): un campo distinto tiene que dar un fallo con su motivo, nunca un éxito.
//
// Probado rompiéndolo el 5/11/2026 (base 8 pases, 0 fallos). Cada rotura, 1 rojo:
//   · cancelar/pisar una revisión en curso (sin la regla 1)            · volver a subir lo que la tienda ya tiene (regla 2)
//   · una subida con `uploadState: FAILED` contada como éxito (regla 4) · la versión del zip sin mirar (regla 6)
//   · seguir intentando después de tres fallos (regla 5)               · un fallo al publicar reintentado volviendo a subir
//   · la fila de la extensión anunciando como aprobada la versión vieja recién mandada
// La rotura se corrió con un script de un solo uso que restaura el archivo de memoria.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  conLaPublicacion, decidirPublicacion, estadoTiendaDe, guardarPaso, leerPublicacion, marcaDeSubida, publicar, subir, versionDelZip,
  MAX_INTENTOS, SUBIENDO_VENCE_MS, type Dependencias, type EstadoTienda, type Publicacion,
} from '../lib/extension-publicar';
import { vuelta, ITEMS, type Lectura } from '../lib/vigia-aprobaciones';

const T0 = Date.parse('2026-11-05T12:00:00Z');
const MAIN = '0.76.0';

const tienda = (o: Partial<EstadoTienda> = {}): EstadoTienda => ({
  enviada: { estado: null, version: null }, publicada: { estado: 'PUBLISHED', version: '0.75.0' }, subida: null, bajada: false, ...o,
});
const prev = (o: Partial<Publicacion>): Publicacion => ({ version: MAIN, paso: 'fallo', at: new Date(T0).toISOString(), ...o });

async function zipCon(version: string): Promise<Uint8Array> {
  const z = new JSZip();
  z.file('manifest.json', JSON.stringify({ manifest_version: 3, name: 'MaKo', version }));
  z.file('background.js', '// nada');
  return z.generateAsync({ type: 'uint8array' });
}

/** Una tienda de mentira: contesta por el final de la URL y anota lo que se le pidió. */
function tiendaFalsa(rutas: Record<string, { status: number; body: unknown }>) {
  const pedidos: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (u: string | URL | Request, init: RequestInit = {}) => {
    const url = String(u);
    pedidos.push({ url, init });
    const clave = Object.keys(rutas).find((k) => url.endsWith(k));
    if (!clave) return new Response('sin ruta', { status: 599 });
    return new Response(JSON.stringify(rutas[clave].body), { status: rutas[clave].status });
  }) as typeof fetch;
  return { f, pedidos };
}

const dep = (f: typeof fetch, zipVersion = MAIN): Dependencias => ({
  fetch: f, token: 'tok', publisherId: 'pub-1', extensionId: 'ext-1', versionMain: MAIN,
  zip: async () => ({ bytes: await zipCon(zipVersion), version: zipVersion }),
});

test('regla 1: una revisión en curso no se cancela; la nueva espera (y la misma no hace nada)', () => {
  const otra = decidirPublicacion(MAIN, tienda({ enviada: { estado: 'PENDING_REVIEW', version: '0.75.1' } }), null, T0);
  assert.equal(otra.hacer, 'esperar');
  assert.match('motivo' in otra ? otra.motivo : '', /0\.75\.1 está en revisión: la 0\.76\.0 se manda sola cuando termine/);
  assert.equal(decidirPublicacion(MAIN, tienda({ enviada: { estado: 'PENDING_REVIEW', version: MAIN } }), null, T0).hacer, 'nada');
});

test('regla 2: lo que la tienda ya tiene no se vuelve a subir; una rechazada sale con la próxima versión', () => {
  assert.equal(decidirPublicacion(MAIN, tienda({ publicada: { estado: 'PUBLISHED', version: MAIN } }), null, T0).hacer, 'nada');
  assert.equal(decidirPublicacion(MAIN, tienda({ publicada: { estado: 'PUBLISHED', version: '0.77.0' } }), null, T0).hacer, 'nada', 'más nueva que main');
  assert.equal(decidirPublicacion(MAIN, tienda({ enviada: { estado: 'REJECTED', version: MAIN } }), null, T0).hacer, 'nada');
  assert.equal(decidirPublicacion(MAIN, tienda({ enviada: { estado: 'CANCELLED', version: MAIN } }), null, T0).hacer, 'nada', 'una cancelación en el panel se respeta');
  assert.equal(decidirPublicacion(MAIN, tienda({ bajada: true }), null, T0).hacer, 'nada', 'bajada por Google: no se manda sola');
  assert.equal(decidirPublicacion(MAIN, tienda({ enviada: { estado: 'REJECTED', version: '0.75.5' } }), null, T0).hacer, 'subir', 'rechazada una VIEJA: la nueva sí sale');
  assert.equal(decidirPublicacion(MAIN, tienda(), null, T0).hacer, 'subir');
});

test('regla 5: tres fallos seguidos de la misma versión y se deja de intentar; un fallo al publicar se reintenta publicando', () => {
  assert.equal(decidirPublicacion(MAIN, tienda(), prev({ intentos: 2, en: 'subir' }), T0).hacer, 'subir');
  const basta = decidirPublicacion(MAIN, tienda(), prev({ intentos: MAX_INTENTOS, error: 'la tienda contestó HTTP 400' }), T0);
  assert.equal(basta.hacer, 'nada');
  assert.match('motivo' in basta ? basta.motivo : '', /3 intentos\): la tienda contestó HTTP 400/);
  assert.equal(decidirPublicacion(MAIN, tienda(), prev({ intentos: 1, en: 'publicar' }), T0).hacer, 'publicar');
  assert.equal(decidirPublicacion(MAIN, tienda(), prev({ version: '0.75.9', intentos: 3 }), T0).hacer, 'subir', 'los fallos de OTRA versión no cuentan');
  // La cuenta: la marca de «subiendo» la conserva, y un éxito la borra.
  let p = guardarPaso(null, MAIN, { paso: 'fallo', en: 'subir', error: 'x' }, T0);
  p = guardarPaso(marcaDeSubida(p, MAIN, T0), MAIN, { paso: 'fallo', en: 'subir', error: 'y' }, T0);
  assert.equal(p.intentos, 2);
  assert.equal(guardarPaso(p, MAIN, { paso: 'enviada' }, T0).intentos, undefined);
  assert.equal(marcaDeSubida(p, '0.80.0', T0).intentos, 0, 'otra versión empieza de cero');
});

test('regla 3: una marca de «subiendo» reciente hace esperar; una vieja (de una vuelta que murió) deja volver a intentar', () => {
  const subiendo = prev({ paso: 'subiendo', at: new Date(T0).toISOString() });
  assert.equal(decidirPublicacion(MAIN, tienda(), subiendo, T0 + 60_000).hacer, 'esperar');
  assert.equal(decidirPublicacion(MAIN, tienda(), subiendo, T0 + SUBIENDO_VENCE_MS + 1).hacer, 'subir');
  // Procesando aparte: se publica cuando la tienda dice que la subida salió.
  const proc = prev({ paso: 'procesando' });
  assert.equal(decidirPublicacion(MAIN, tienda({ subida: 'SUCCEEDED' }), proc, T0).hacer, 'publicar');
  assert.equal(decidirPublicacion(MAIN, tienda({ subida: 'IN_PROGRESS' }), proc, T0).hacer, 'esperar');
  assert.equal(decidirPublicacion(MAIN, tienda({ subida: 'FAILED' }), proc, T0).hacer, 'subir');
  assert.equal(decidirPublicacion(MAIN, tienda(), prev({ paso: 'subida' }), T0).hacer, 'publicar');
});

test('regla 4 y 6: la subida vale con SUCCEEDED y el zip de main; la publicación, con un estado que dice «entró»', async () => {
  const ok = tiendaFalsa({ ':upload': { status: 200, body: { uploadState: 'SUCCEEDED', crxVersion: MAIN } } });
  assert.deepEqual(await subir(dep(ok.f)), { paso: 'subida' });
  assert.match(ok.pedidos[0].url, /^https:\/\/chromewebstore\.googleapis\.com\/upload\/v2\/publishers\/pub-1\/items\/ext-1:upload$/);
  assert.equal(ok.pedidos[0].init.method, 'POST');
  assert.equal((ok.pedidos[0].init.headers as Record<string, string>).Authorization, 'Bearer tok');
  const fallo200 = tiendaFalsa({ ':upload': { status: 200, body: { uploadState: 'FAILED' } } });
  assert.equal((await subir(dep(fallo200.f))).paso, 'fallo', 'un 200 con FAILED no es un éxito');
  const proc = tiendaFalsa({ ':upload': { status: 200, body: { uploadState: 'IN_PROGRESS' } } });
  assert.deepEqual(await subir(dep(proc.f)), { paso: 'procesando' });
  const otraVersion = tiendaFalsa({ ':upload': { status: 200, body: { uploadState: 'SUCCEEDED', crxVersion: '0.75.0' } } });
  assert.equal((await subir(dep(otraVersion.f))).paso, 'fallo', 'la tienda leyó otra versión');
  const zipViejo = tiendaFalsa({});
  const r = await subir(dep(zipViejo.f, '0.75.0'));
  assert.equal(r.paso, 'fallo');
  assert.equal(zipViejo.pedidos.length, 0, 'un zip que no es el de main no sale');
  const err = tiendaFalsa({ ':upload': { status: 403, body: { error: { code: 403, message: 'The caller does not have permission' } } } });
  assert.deepEqual(await subir(dep(err.f)), { paso: 'fallo', en: 'subir', error: 'la tienda contestó HTTP 403: The caller does not have permission' });
  // Publicar.
  const pub = tiendaFalsa({ ':publish': { status: 200, body: { state: 'PENDING_REVIEW' } } });
  assert.deepEqual(await publicar(dep(pub.f)), { paso: 'enviada', estado: 'PENDING_REVIEW' });
  const raro = tiendaFalsa({ ':publish': { status: 200, body: { state: 'CANCELLED' } } });
  assert.equal((await publicar(dep(raro.f))).paso, 'fallo');
  const sinState = tiendaFalsa({ ':publish': { status: 200, body: {} } });
  assert.deepEqual(await publicar(dep(sinState.f)), { paso: 'fallo', en: 'publicar', error: 'la tienda dejó la publicación en un estado que no dice' });
});

test('el zip se abre y se lee su manifest; un zip roto no tiene versión', async () => {
  assert.equal(await versionDelZip(await zipCon('1.2.3')), '1.2.3');
  assert.equal(await versionDelZip(new TextEncoder().encode('<html>no es un zip</html>')), null);
});

test('fetchStatus en nuestro idioma, y lo guardado roto no es una publicación', () => {
  assert.deepEqual(estadoTiendaDe({
    submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '0.76.0' }] },
    publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ crxVersion: '0.75.0' }] },
    lastAsyncUploadState: 'SUCCEEDED', takenDown: false,
  }), { enviada: { estado: 'PENDING_REVIEW', version: '0.76.0' }, publicada: { estado: 'PUBLISHED', version: '0.75.0' }, subida: 'SUCCEEDED', bajada: false });
  assert.equal(estadoTiendaDe(null), null);
  assert.equal(leerPublicacion('{roto'), null);
  assert.equal(leerPublicacion(JSON.stringify({ version: MAIN, paso: 'inventado', at: 'x' })), null);
});

test('la fila de la extensión: mandada queda «en revisión»; sin claves dice que sale sola; tres fallos piden algo, una vez', () => {
  const leida: Lectura = { tipo: 'leido', fuente: 'cws-api', estado: 'aprobado', version: '0.75.0', detalle: null };
  const enviada = conLaPublicacion(leida, { tipo: 'hecho', resultado: { paso: 'enviada' }, guardado: prev({ paso: 'enviada' }) }, MAIN);
  assert.deepEqual(enviada, { tipo: 'leido', fuente: 'cws-api', estado: 'en_revision', version: MAIN, detalle: 'MaKo la mandó sola a revisión' });
  // La vuelta siguiente, si la tienda todavía dice la vieja, no se anuncia como aprobada la versión vieja.
  const despues = conLaPublicacion(leida, { tipo: 'decidido', decision: { hacer: 'nada', motivo: 'x' }, previa: prev({ paso: 'enviada' }) }, MAIN);
  assert.equal(despues.tipo === 'leido' && despues.estado, 'en_revision');
  const sinClaves = conLaPublicacion({ ...leida, fuente: 'cws-ficha' }, { tipo: 'falta', faltan: ['CWS_PUBLISHER_ID'] }, MAIN);
  assert.match(sinClaves.tipo === 'leido' ? String(sinClaves.detalle) : '', /La 0\.76\.0 se manda sola a revisión apenas estén las claves/);
  const alDia = conLaPublicacion({ ...leida, version: MAIN }, { tipo: 'falta', faltan: ['CWS_PUBLISHER_ID'] }, MAIN);
  assert.equal(alDia.tipo === 'leido' && alDia.detalle, null, 'si la tienda ya la tiene, no se dice nada');
  const tres = conLaPublicacion(leida, { tipo: 'hecho', resultado: { paso: 'fallo', error: 'HTTP 400' }, guardado: prev({ intentos: MAX_INTENTOS }) }, MAIN);
  assert.equal(tres.tipo === 'leido' && tres.estado, 'piden_algo');
  // Con el vigía: la primera vuelta de «piden algo» avisa; la siguiente, igual, no.
  const base: Record<string, Lectura> = Object.fromEntries(ITEMS.map((i) => [i.id, { tipo: 'no_pude', motivo: 'x' } as Lectura]));
  const g0 = vuelta(null, { ...base, 'chrome-web-store': leida }, T0).nuevo;
  const r1 = vuelta(g0, { ...base, 'chrome-web-store': tres }, T0 + 3600_000);
  assert.deepEqual(r1.avisos.filter((a) => a.item === 'chrome-web-store').map((a) => a.tipo), ['piden_algo']);
  const otraVez = conLaPublicacion(leida, { tipo: 'decidido', decision: { hacer: 'nada', motivo: 'No pude mandar la 0.76.0 sola (3 intentos): HTTP 400' }, previa: prev({ intentos: MAX_INTENTOS }) }, MAIN);
  const r2 = vuelta(r1.nuevo, { ...base, 'chrome-web-store': otraVez }, T0 + 2 * 3600_000);
  assert.deepEqual(r2.avisos.filter((a) => a.item === 'chrome-web-store'), [], 'no se repite cada hora');
  // Una lectura que no se pudo hacer no se toca.
  assert.deepEqual(conLaPublicacion({ tipo: 'no_pude', motivo: 'm' }, { tipo: 'falta', faltan: [] }, MAIN), { tipo: 'no_pude', motivo: 'm' });
});
