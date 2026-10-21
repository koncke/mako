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
  botonMetaVisible, destinoDeVuelta, ENV_SECRETO_APP, leerResultadoMeta, META_APP_ID, META_CONFIG_ID, metaRedirectUri, urlDialogoMeta, volverSeguro,
  WORKSPACES_DE_REVISION,
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

// ── El botón en el negocio de REVISIÓN (21/10/2026) ──────────────────────────────
// El revisor de Meta entra con una cuenta de prueba del ws3 (usuario del negocio, no super
// admin) y tiene que ver «Conectar con Meta»; en cualquier otro negocio, un usuario común no.
//
// Verificado rompiéndolo (21/10/2026), de a una y restaurando:
//   · `WORKSPACES_DE_REVISION = [3, 11]` → 2 fallos («ws3» por la lista fija y «ws11 NO»)
//   · la regla sin mirar el ws (`return true` al final) → 1 fallo («ws1/ws11/ws21 NO»)
//   · `abiertoATodos` sin efecto → 1 fallo («META_OAUTH_ABIERTO»)
//   · el ws3 antes del chequeo del secreto → 1 fallo («sin secreto»)
//   · conectarMetaDisponible con la regla vieja antes (`if (!superAdmin) return false`) → 1 fallo (el de las rutas)
//   · la ruta del paso 1 sin pasar el ws (`conectarMetaDisponible()`) → 1 fallo (el de las rutas)
//   ⚠️ Un atajo `if (superAdmin) return true` antes de la regla NO es una rotura: da lo mismo.
//   Sumadas tras la revisión del Cerebro (21/10), las dos mutaciones que antes pasaban en verde:
//   · `esSuperAdmin: (await getSesionAdmin()) != null || true` → 1 fallo (el de las rutas)
//   · `abiertoATodos: true` → 1 fallo (el de las rutas)
//   · la ruta del paso 1 con `const ws = Number(url.searchParams.get('ws_destino')) || await adminDeWorkspaceActual();` → 1 fallo
const BASE = { haySecreto: true, abiertoATodos: false, esSuperAdmin: false };

test('botón de Meta: en el negocio de revisión (ws3) lo ve un usuario común', () => {
  assert.deepEqual([...WORKSPACES_DE_REVISION], [3]);
  assert.equal(botonMetaVisible({ ...BASE, ws: 3 }), true);
});

test('botón de Meta: en ws1, ws11 y ws21 NO lo ve un usuario común', () => {
  for (const ws of [1, 11, 21, null, undefined]) {
    assert.equal(botonMetaVisible({ ...BASE, ws }), false, `lo vio en ws ${String(ws)}`);
  }
});

test('botón de Meta: con META_OAUTH_ABIERTO y para el super admin sigue como antes', () => {
  for (const ws of [1, 3, 11, 21, null]) {
    assert.equal(botonMetaVisible({ ...BASE, abiertoATodos: true, ws }), true, `abierto, ws ${String(ws)}`);
    assert.equal(botonMetaVisible({ ...BASE, esSuperAdmin: true, ws }), true, `super admin, ws ${String(ws)}`);
  }
});

test('botón de Meta: sin el secreto no se ofrece a nadie, ni en revisión', () => {
  for (const extra of [{ ws: 3 }, { ws: 1, esSuperAdmin: true }, { ws: 1, abiertoATodos: true }]) {
    assert.equal(botonMetaVisible({ ...BASE, haySecreto: false, ...extra }), false, JSON.stringify(extra));
  }
});

test('botón de Meta: conectarMetaDisponible usa la regla, y las dos rutas le pasan el negocio activo', () => {
  const CX = sinComentarios(leer('lib/meta-conexion.ts'));
  const ini = CX.indexOf('export async function conectarMetaDisponible');
  const fn = CX.slice(ini, CX.indexOf('export type ResultadoConexion', ini));
  assert.ok(ini > 0 && fn.length < 600, `el recorte mide ${fn.length}: ¿se movió la función?`);
  assert.match(fn, /return botonMetaVisible\(\{/);
  assert.equal((fn.match(/\breturn\b/g) ?? []).length, 1, 'conectarMetaDisponible decide con botonMetaVisible y con nada más');
  assert.match(fn, /ws: ws === undefined \? await getWorkspaceActual\(\) : ws/);
  // De DÓNDE salen los datos de la regla (revisión del Cerebro, 21/10): sin esto, `esSuperAdmin: … || true` o
  // `abiertoATodos: true` abrían el botón para cualquier negocio con la suite en verde.
  assert.match(fn, /haySecreto: !!process\.env\[ENV_SECRETO_APP\]\?\.trim\(\),/);
  assert.match(fn, /abiertoATodos: process\.env\.META_OAUTH_ABIERTO === 'true',/);
  assert.match(fn, /esSuperAdmin: \(await getSesionAdmin\(\)\) != null,/);
  // Y el ws de las rutas sale de la SESIÓN, nunca del pedido: un `ws` del query abría el filtro del ws3.
  const RUTA = sinComentarios(leer('app/api/integraciones/meta/route.ts'));
  assert.match(RUTA, /const ws = await adminDeWorkspaceActual\(\);\s*if \(ws == null\) return fail\('no-permitido'\);\s*if \(!\(await conectarMetaDisponible\(ws\)\)\)/);
  assert.equal((RUTA.match(/searchParams\.get\(/g) ?? []).length, 1, 'la ruta del paso 1 sólo lee `volver` del query');
  const CRED = sinComentarios(leer('app/api/integraciones/credencial/route.ts'));
  assert.match(CRED, /const ctx = await resolverContexto\(\);[\s\S]{0,1200}conectarMetaDisponible\(ctx\.ws\)/);
});
