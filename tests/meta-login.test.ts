// =============================================================================
// «Conectar con Meta» (07/10/2026): a dónde vuelve el navegador, qué se le pide a
// Meta, y que las dos puertas de conexión guarden LO MISMO
// =============================================================================
// lib/meta-login.ts no lleva server-only a propósito, así que se prueba
// ejecutándolo. Las rutas y lib/meta-conexion.ts sí lo llevan: ahí van asserts
// sobre el fuente, con el bloque recortado antes de preguntar.
//
// Verificado rompiéndolo (07/10/2026), de a una y restaurando de memoria; cada
// rotura dio 1 fallo:
//   · volverSeguro sin sus DOS defensas de host (el `startsWith('//')` y la
//     comparación de origen). ⚠️ Sacando sólo una el test sigue VERDE, y está bien:
//     son redundantes a propósito, y cualquiera de las dos alcanza contra `//evil`.
//   · volverSeguro sin sacar el `ws` del volver
//   · urlDialogoMeta sin `override_default_response_type`
//   · ENV_SECRETO_APP = 'META_APP_SECRET'
//   · el callback sin re-chequear el permiso contra la sesión
//   · meta-conexion sin re-derivar el token de la página actual
//   · el `descubrir` de credenciales guardando por su cuenta (sin guardarConexionMeta)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  destinoDeVuelta, ENV_SECRETO_APP, leerResultadoMeta, META_APP_ID, META_CONFIG_ID, metaRedirectUri, urlDialogoMeta, volverSeguro,
} from '../lib/meta-login';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('volver: sólo un path de esta app; cualquier otro host cae a /integraciones', () => {
  for (const malo of ['https://evil.com/x', '//evil.com/x', '/\\evil.com', 'evil.com', 'javascript:alert(1)', '', null, undefined, '/' + 'a'.repeat(400)]) {
    assert.equal(volverSeguro(malo as string | null | undefined), '/integraciones', `dejó pasar ${String(malo).slice(0, 40)}`);
  }
  assert.equal(volverSeguro('/onboarding?paso=3'), '/onboarding?paso=3');
});

test('volver: el ws y el resultado viejo no viajan en el parámetro', () => {
  // El ws lo pone el callback con el workspace que autorizó el paso 1; uno escrito
  // en el `volver` sería otra puerta para elegir a qué cliente se vuelve.
  assert.equal(volverSeguro('/integraciones?ws=13&meta=ok&x=1'), '/integraciones?x=1');
});

test('la vuelta a /integraciones reabre el modal de Meta; a otra pantalla, no toca nada', () => {
  assert.equal(destinoDeVuelta('/integraciones'), '/integraciones?servicio=meta');
  assert.equal(destinoDeVuelta('/onboarding?paso=3'), '/onboarding?paso=3');
  assert.equal(destinoDeVuelta('https://evil.com'), '/integraciones?servicio=meta');
});

test('el diálogo pide el token de usuario del sistema de la configuración MaKo', () => {
  const u = new URL(urlDialogoMeta({ version: 'v24.0', redirectUri: 'https://hola-mako.com/api/integraciones/meta/callback', state: 'abc' }));
  assert.equal(u.origin + u.pathname, 'https://www.facebook.com/v24.0/dialog/oauth');
  assert.equal(u.searchParams.get('client_id'), META_APP_ID);
  assert.equal(u.searchParams.get('config_id'), META_CONFIG_ID);
  assert.equal(u.searchParams.get('response_type'), 'code');
  // Sin esto, Login for Business devuelve un token de USUARIO (60 días) y no el del
  // sistema que no vence: la conexión se caería sola a los dos meses.
  assert.equal(u.searchParams.get('override_default_response_type'), 'true');
  assert.equal(u.searchParams.get('state'), 'abc');
});

test('el redirect es el registrado en modo estricto, no el origin de un preview', () => {
  const antes = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com/';
  try {
    assert.equal(metaRedirectUri('https://mako-abc123.vercel.app'), 'https://hola-mako.com/api/integraciones/meta/callback');
  } finally {
    if (antes === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = antes;
  }
});

test('el secreto de la app MaKo NO es META_APP_SECRET (ése firma el webhook de leads de la app vieja)', () => {
  assert.notEqual(ENV_SECRETO_APP, 'META_APP_SECRET');
  assert.match(leer('app/api/webhooks/meta-leads/route.ts'), /process\.env\.META_APP_SECRET/);
});

test('el resultado es un conjunto cerrado: un valor manoseado no se dibuja', () => {
  assert.equal(leerResultadoMeta('ok'), 'ok');
  assert.equal(leerResultadoMeta('<script>'), null);
  assert.equal(leerResultadoMeta(undefined), null);
});

test('el callback: workspace de la cookie, permiso re-chequeado contra la sesión, y guarda por meta-conexion', () => {
  const CB = sinComentarios(leer('app/api/integraciones/meta/callback/route.ts'));
  assert.match(CB, /leerEstadoGcal\(req\.cookies\.get\('meta_state'\)/);
  assert.match(CB, /puedeEscribirAgenda\(esSuperAdmin, await adminDeWorkspaceActual\(\), ws\)/, 'sin esto la cookie sola decide a quién se le escribe');
  assert.match(CB, /guardarConexionMeta\(ws, j\.access_token, autor, \{ guardarToken: true \}\)/);
  assert.ok(!CB.includes('getWorkspaceActual'), 'el ws del callback sale de la cookie, nunca de la sesión');
});

test('pegar un token y el botón guardan por el MISMO camino', () => {
  const RUTA = sinComentarios(leer('app/api/integraciones/credencial/route.ts'));
  const ini = RUTA.indexOf("body.action === 'descubrir'");
  const bloque = RUTA.slice(ini, RUTA.indexOf("body.action === 'elegir'", ini));
  assert.ok(ini > 0 && bloque.length < 2500, `el recorte mide ${bloque.length}: ¿se movió el bloque?`);
  assert.match(bloque, /guardarConexionMeta\(ctx\.ws,/);
  assert.ok(!bloque.includes('guardarCredencial('), 'una segunda copia de lo que se guarda se queda vieja');
});

test('reconectar re-deriva el token de la página ACTUAL aunque haya varias', () => {
  // La conexión son DOS tokens (AGENTS.md): sin esto, reconectar con la app MaKo
  // deja los leads entrando con la app vieja.
  const CX = sinComentarios(leer('lib/meta-conexion.ts'));
  const ini = CX.indexOf('d.paginas.length > 1');
  assert.ok(ini > 0, 'falta la rama de varias páginas');
  const rama = CX.slice(ini, CX.indexOf('d.pixeles.length === 1', ini));
  assert.match(rama, /credWs\('META_PAGE_ID', ws\)/);
  assert.match(rama, /'META_PAGE_ACCESS_TOKEN'/);
});
