// =============================================================================
// Dónde se ENCHUFA el Web Push de MaKo Mobile, y lo que no puede hacer
// =============================================================================
// Guards sobre el FUENTE (el envío real necesita red y un teléfono). Cada uno mira el
// BLOQUE que le importa —la función, sin comentarios—, no el archivo entero: un guard que
// lee el archivo entero encuentra lo que el archivo dice de sí (AGENTS.md).
//
//   1. emitirAviso: el push sale DESPUÉS del interruptor, del espaciado y de la cola del
//      resumen, y ANTES del correo y del WhatsApp (en paralelo); al workspace LECTOR.
//   2. crearPendiente / crearPropuesta: el push sólo tras el insert que salió bien.
//   3. lib/push.ts: el par VAPID se LEE del workspace de plataforma y nunca se genera.
//   4. La suscripción se ata a la PERSONA (no a la pestaña) y el endpoint pasa la guarda.
//   5. public/sw.js: sin 'fetch', y todo push muestra una notificación con su tag.
//   6. La frontera: ningún 'use client' importa lib/push.ts, y lib/push-cliente.ts no importa nada.
//   7. El feed: toda consulta a `notificaciones` lleva su workspace; la ruta no corta al ws1.
//   8. Las piezas de configuración: /sw.js en PUBLICOS (sólo leer) y sus cabeceras.
//   9. Las migraciones: push_suscripciones sin workspace_id y cerrada; notificaciones con él.
//
// ⚠️ Barre el DISCO, no `git ls-files`: los archivos nuevos de esta tanda todavía no están
// en el índice, y un guard que barre el índice no los ve.
//
// Probado rompiéndolo (base: 11 pasan / 0 fallan, 11/10/2026), restaurando de memoria. Cada
// rotura tumba SU test y ninguno más:
//   · el push de emitirAviso movido ANTES de `reclamarEspaciado`        → 10 / 1
//   · el push de emitirAviso con `ws` en vez de `wsLector`               → 10 / 1
//   · el push de crearPendiente antes del `return repetida`              → 10 / 1
//   · el push de crearPropuesta antes del insert                          → 10 / 1
//   · lib/push.ts generando el par (`generateVAPIDKeys`)                  → 10 / 1
//   · la suscripción atada con `getWorkspaceActual`                       → 10 / 1
//   · sw.js con un `addEventListener('fetch'`                              → 10 / 1
//   · un `.from('notificaciones')` sin workspace en lib/notificaciones.ts → 10 / 1
//   · /api/notificaciones con `esWorkspaceDueno` de vuelta                → 10 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Las líneas primero (un `//` puede abrir un `/*` que se cierra páginas abajo). */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** El bloque entre dos anclas, con su cierre REAL. */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré el arranque del bloque: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre del bloque: ${hasta}`);
  return src.slice(i, j);
}

const pos = (src: string, aguja: string, que: string) => {
  const i = src.indexOf(aguja);
  assert.ok(i >= 0, `no está ${que} (${aguja})`);
  return i;
};

test('1. emitirAviso: el push sale después del interruptor, del espaciado y de la cola, antes del correo', () => {
  const f = bloque(sinComentarios(leer('lib/avisos.ts')), 'export async function emitirAviso(', 'async function enviarAvisoPorEmail(');
  const push = pos(f, 'enviarPushAviso(', 'el push');
  assert.ok(push > pos(f, 'apagado: true', 'el corte del interruptor'), 'el push sale ANTES del interruptor: pushearía avisos apagados');
  assert.ok(push > pos(f, 'reclamarEspaciado(', 'el espaciado'), 'el push sale ANTES del espaciado: ignoraría el «cada cuánto»');
  assert.ok(push > pos(f, 'agrupado: true', 'la cola del resumen'), 'el push sale ANTES de la cola: interrumpiría con lo que se pidió juntar');
  assert.ok(push < pos(f, 'enviarAvisoPorEmail(a, texto)', 'el correo'), 'el push tiene que arrancar ANTES del correo (en paralelo)');
  assert.ok(push < pos(f, 'enviarAlGrupoMaKo(ws, texto)', 'el WhatsApp'));
  assert.match(f, /const push = await pushP;/, 'el push arranca pero nadie lo espera');
  assert.match(f, /return \{[^}]*\bpush\b[^}]*\}/, 'el resultado no lleva el push');
});

test('1b. emitirAviso: el feed y el push van al workspace de quien LO LEE (alDueno → plataforma)', () => {
  const f = bloque(sinComentarios(leer('lib/avisos.ts')), 'export async function emitirAviso(', 'async function enviarAvisoPorEmail(');
  assert.match(f, /const wsLector = a\.alDueno === true \? await wsSuperAdmin\(\)/, 'wsLector dejó de resolver al dueño por alDueno');
  assert.match(f, /enviarPushAviso\(wsLector, a\)/, 'el push no va al workspace lector');
  assert.match(f, /crearNotificacion\(\{\s*ws: wsLector,/, 'el feed no va al workspace lector');
});

test('2. crearPendiente: el push sólo tras el insert que salió bien, nunca en la rama de la repetida', () => {
  const f = bloque(sinComentarios(leer('lib/mako-pendientes.ts')), 'export async function crearPendiente(', 'async function avisarPendiente(');
  const push = pos(f, 'avisarPendiente(', 'el push');
  assert.ok(push > pos(f, 'return repetida;', 'la rama de la repetida'), 'el push quedó antes de la rama de la repetida');
  assert.ok(push > pos(f, ".from('mako_acciones_pendientes')\n      .insert(", 'el insert'), 'el push quedó antes del insert');
  assert.ok(push > pos(f, "if (error) { console.error('[pendientes] crear:'", 'el corte del error'), 'el push quedó antes del corte del error');
  const a = bloque(sinComentarios(leer('lib/mako-pendientes.ts')), 'async function avisarPendiente(', 'async function vencerExpiradas(');
  assert.match(a, /soloAdmins: true/, '«MaKo te pide confirmar» es sólo para admin');
  assert.match(a, /Math\.min\(ttlMin, 120\)/, 'el TTL perdió el techo de 2 h');
  assert.match(a, /origen === 'app' \|\| origen\?\.startsWith\('flujo:'\)/, 'se pushea lo que nace en el chat de la app o en un flujo (que se confirma solo)');
});

test('2b. crearPropuesta: el push sólo con una propuesta NUEVA', () => {
  const f = bloque(sinComentarios(leer('lib/propuestas.ts')), 'export async function crearPropuesta(', 'async function avisarPropuesta(');
  const push = pos(f, 'avisarPropuesta(', 'el push');
  assert.ok(push > pos(f, ".from('propuestas').insert(", 'el insert'), 'el push quedó antes del insert');
  assert.ok(push > pos(f, 'if (error) throw new Error(`crearPropuesta', 'el corte del error'));
  assert.ok(push < pos(f, 'return { id, nueva: true };', 'el retorno de la nueva'));
  // Las ramas que devuelven una existente (`nueva: false`) quedan ANTES del push.
  for (const m of f.matchAll(/nueva: false/g)) assert.ok((m.index ?? 0) < push, 'hay una rama `nueva: false` después del push');
});

test('3. lib/push.ts: el par VAPID se LEE del workspace de plataforma y NUNCA se genera', () => {
  const src = sinComentarios(leer('lib/push.ts'));
  assert.doesNotMatch(src, /generateVAPIDKeys/, 'lib/push.ts genera el par: dos instancias frías lo partirían');
  assert.doesNotMatch(src, /\benvCred\b/, 'envCred resuelve contra el ws1, que es un CLIENTE');
  assert.doesNotMatch(src, /process\.env\.[A-Z_]*VAPID/, 'el par no vive en variables de entorno');
  const f = bloque(src, 'export async function clavesVapid(', 'export async function clavePublicaPush(');
  assert.match(f, /const ws = await wsSuperAdmin\(\);\s*const crudo = await credWsEstricta\(CLAVE_VAPID, ws\);/);
  assert.match(src, /import 'server-only';/);
  // Y el script sí genera, pero sólo si no hay fila: insert-if-absent, nunca un upsert que pise.
  const gen = sinComentarios(leer('scripts/push-vapid-generar.mts'));
  assert.match(gen, /ignoreDuplicates: true/, 'el generador pisaría un par existente');
  assert.doesNotMatch(gen, /guardarCredencial\(/, 'guardarCredencial hace un upsert que PISA');
});

test('4. la suscripción se ata a la PERSONA, con la guarda del endpoint', () => {
  const src = sinComentarios(leer('app/api/push/suscripcion/route.ts'));
  assert.match(src, /await usuarioPropio\(\)/, 'la suscripción no sale de la fila propia');
  assert.doesNotMatch(src, /getTenantDb|getWorkspaceActual|searchParams/, 'la suscripción se ata a la pestaña: un super admin recibiría los avisos del cliente que miraba');
  assert.match(src, /endpointPermitido\(endpoint\)/, 'un endpoint inventado convierte la prueba en un SSRF');
  assert.match(src, /onConflict: 'endpoint'/, 'el mismo teléfono con otra cuenta no mueve la fila');
  const del = bloque(src, 'export async function DELETE(', '\n}\n');
  assert.match(del, /\.eq\('usuario_id', u\.id\)/, 'el DELETE borra suscripciones ajenas');
  for (const r of ['app/api/push/suscripcion/route.ts', 'app/api/push/clave/route.ts', 'app/api/push/prueba/route.ts', 'app/api/perfil/notif-push/route.ts', 'app/api/notificaciones/route.ts']) {
    const s = sinComentarios(leer(r));
    for (const m of s.matchAll(/export async function (GET|POST|DELETE)\([^)]*\) \{\n\s*([^\n]*)/g)) {
      assert.match(m[2], /getUsuarioActual\(\)/, `${r} ${m[1]} no exige sesión en su primera línea`);
    }
  }
});

test('5. public/sw.js: sin handler fetch, y todo push muestra una notificación con su tag', () => {
  const src = sinComentarios(leer('public/sw.js'));
  assert.doesNotMatch(src, /addEventListener\(\s*['"]fetch['"]/, 'un caché offline sirve el HTML de una cuenta a otra');
  const push = bloque(src, "addEventListener('push'", "addEventListener('notificationclick'");
  assert.match(push, /showNotification\(/, 'un push sin notificación hace que Safari revoque la suscripción');
  assert.match(push, /renotify: true/);
  assert.match(push, /tag,/);
  assert.match(push, /: 'mako';/, 'renotify sin tag tira TypeError en Chrome: el tag necesita un default');
  assert.match(push, /badge: '\/icon-192\.png'/);
  assert.match(push, /setAppBadge/);
  for (const ev of ['install', 'activate', 'notificationclick', 'pushsubscriptionchange']) assert.match(src, new RegExp(`addEventListener\\('${ev}'`), `falta '${ev}'`);
  assert.match(src, /skipWaiting\(\)/);
  assert.match(src, /clients\.claim\(\)/);
});

function archivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) archivos(p, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

test('6. la frontera: ningún use client importa lib/push.ts, y el módulo del navegador no importa nada', () => {
  const culpables: string[] = [];
  for (const dir of ['app', 'lib']) {
    for (const f of archivos(join(RAIZ, dir))) {
      const s = readFileSync(f, 'utf8');
      if (!/^\s*['"]use client['"]/m.test(s.slice(0, 400))) continue;
      if (/from\s+['"](?:@\/lib|\.{1,2}(?:\/\.\.)*\/lib|\.)\/push['"]/.test(s) || /import\(\s*['"][^'"]*\/push['"]\s*\)/.test(s)) culpables.push(relative(RAIZ, f));
    }
  }
  assert.deepEqual(culpables, [], 'un use client importa lib/push.ts (server-only, trae web-push y las claves)');
  const cliente = sinComentarios(leer('lib/push-cliente.ts'));
  assert.doesNotMatch(cliente, /^\s*import\s/m, 'lib/push-cliente.ts tiene que quedar sin dependencias');
  assert.doesNotMatch(cliente, /^\s*['"]use client['"]/m, 'no es un componente: con la directiva sus exports serían referencias de cliente');
});

test('7. el feed: toda consulta a notificaciones lleva su workspace; la ruta no corta al ws1', () => {
  const src = sinComentarios(leer('lib/notificaciones.ts'));
  const usos = [...src.matchAll(/\.from\('notificaciones'\)/g)];
  assert.ok(usos.length >= 3, 'faltan las consultas del feed');
  for (const m of usos) {
    const i = m.index ?? 0;
    const sentencia = src.slice(i, src.indexOf(';', i));
    assert.match(sentencia, /workspace_id/, `una consulta a notificaciones sin workspace: ${sentencia.slice(0, 80)}`);
  }
  assert.doesNotMatch(src, /\bleido\b|canal_wa/, 'el leído es por persona y la cola de WhatsApp murió');
  const ruta = sinComentarios(leer('app/api/notificaciones/route.ts'));
  assert.doesNotMatch(ruta, /esWorkspaceDueno/, 'el feed volvió a contestar sólo al ws1');
  assert.match(ruta, /getWorkspaceActual\(\)/);
  assert.match(ruta, /getNotifVistoHasta\(ws\)/, 'el leído no es por persona y por workspace');
});

test('8. /sw.js es público y sólo se lee; next.config.ts le pone sus cabeceras', () => {
  assert.equal(esPublica('/sw.js'), true);
  assert.equal(esPublicaSoloLeer('/sw.js'), true);
  // Las rutas de push NO son públicas: se suscribe sólo una persona logueada.
  for (const r of ['/api/push/clave', '/api/push/suscripcion', '/api/push/prueba']) assert.equal(esPublica(r), false, r);
  const cfg = sinComentarios(leer('next.config.ts'));
  const b = bloque(cfg, "source: '/sw.js'", ']');
  assert.match(b, /'Content-Type', value: 'application\/javascript; charset=utf-8'/);
  assert.match(b, /'Cache-Control', value: 'no-cache, no-store, must-revalidate'/);
  assert.match(b, /'Content-Security-Policy', value: "default-src 'self'; script-src 'self'"/);
});

test('9. migraciones: push_suscripciones sin workspace y cerrada; notificaciones con workspace NOT NULL', () => {
  const sinSql = (s: string) => s.replace(/--.*$/gm, '');
  const push = sinSql(leer('supabase/migrations/0249_push_suscripciones.sql'));
  assert.doesNotMatch(push, /workspace_id/, 'la suscripción es de la PERSONA, no del workspace');
  assert.match(push, /usuario_id\s+bigint not null references usuarios\(id\) on delete cascade/);
  assert.match(push, /unique index if not exists push_suscripciones_endpoint_uk on push_suscripciones \(endpoint\)/);
  assert.match(push, /enable row level security/);
  assert.match(push, /revoke all on push_suscripciones from anon, authenticated/);
  const notif = sinSql(leer('supabase/migrations/0250_notificaciones_ws.sql'));
  assert.match(notif, /workspace_id\s+bigint not null references workspaces\(id\) on delete cascade/);
  assert.match(notif, /alter column workspace_id set not null/);
  assert.doesNotMatch(notif, /workspace_id[^,\n]*default/, 'un default de workspace manda los avisos sin dueño al ws1');
  assert.match(notif, /revoke all on notificaciones from anon, authenticated/);
});
