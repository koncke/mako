// =============================================================================
// «Conectar con Facebook / Instagram / anuncios de Meta», vía Zernio y con la key DEL NEGOCIO (23/10/2026)
// =============================================================================
// Martín: «Que ellos conecten su API de Zernio y luego cuando quieran hacer X cosa que requiera un login, que en MaKo esté el
// botón de logearse con Facebook, Instagram o lo que haga falta». La pieza (lib/zernio-redes.ts lo puro, lib/zernio-conectar.ts el
// servidor, app/_components/ConectarViaZernio.tsx la pantalla) la usan Ads Manager, Chats, Automations y el modal de Zernio de
// /integraciones. Copiada de Nango (Connect UI + SDK frontend) y de las trampas de Ayrshare.
//
// Lo PURO se EJECUTA (`lib/zernio-redes.ts` no importa nada de la app). Lo del servidor y de la pantalla (`server-only`, React con
// ventanas) se fija sobre el FUENTE sin comentarios, y cada regla se probó rompiéndola (ver `ROTURAS` al pie).
//
// Lo que cuida, porque ninguna de estas fallas se ve:
//   · `volver` es del NAVEGADOR y termina como `redirect_url` de un tercero: sólo una RUTA de la app (un redirect abierto si no).
//   · «Conectada» sale de lo que lista Zernio AHORA y no estaba ANTES; el `accountId` de la vuelta es una pista, y sin la lista de
//     antes NADA de lo que ya estaba cuenta como nuevo (dar por hecho un login que nadie hizo).
//   · Un popup que se ve «cerrado» NO es «canceló»: con `Cross-Origin-Opener-Policy` se ve cerrado aunque la persona siga adentro.
//   · `window.open` en el clic, antes de cualquier `await` (si no, el navegador lo bloquea), y los mensajes de la ventana se aceptan
//     sólo del mismo origen y de ESA ventana.
//   · `conexionesViaZernio` es SOLO LECTURA (se llama cada 4 s): lo que escribe va en `recibirConexion`, una vez.
//   · Una clave de Zernio con VARIOS perfiles no le muestra a un negocio las cuentas del otro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CANAL_VENTANA, CLAVE_VUELTA, PARAMS_DE_VUELTA, REDES, REDES_VISIBLES, TIPO_MENSAJE_VENTANA, VIGENCIA_VUELTA_MS, clavesDe, delaRed, esFlujoValido, esRedZernio, estadoDeRed,
  errorDeVueltaAjena, guardarVuelta, leerCuentasDeZernio, leerVueltaGuardada, tieneListaDeCuentas,
  leerMensajeVentana, lineaDeCobro, medirConexion, motivoDeRespuesta, redDeCanal, retornoDeZernio, sinParamsDeVuelta, sinVentanaEmergente,
  textoDeErrorDeRetorno, urlDeLoginDeZernio, urlDePagoDeZernio, validarVolver, volverConMarca, MENSAJES_DE_MOTIVO, SONDEO_MAX, SONDEO_MS,
  type ConexionZernio,
} from '../lib/zernio-redes';
import { esVistaSinChrome } from '../app/_components/PublicRouteGate';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (rel: string) => sinComentarios(leer(rel));
function bloque(src: string, desde: string, hasta: string, tope = 5000): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  const b = src.slice(i, j);
  assert.ok(b.length < tope, `el recorte de «${desde}» mide ${b.length}: está mirando otra cosa`);
  return b;
}

const con = (id: string, extra: Partial<ConexionZernio> = {}): ConexionZernio => ({
  accountId: id, plataforma: 'instagram', usuario: `u_${id}`, nombre: `Nombre ${id}`, activa: true, vencida: false, ...extra,
});

// ── 1. A dónde vuelve: sólo una ruta de la app ───────────────────────────────

test('validarVolver: una ruta de la app sí; todo lo que sale de ella o ejecuta algo, no', () => {
  assert.equal(validarVolver('/ads-manager'), '/ads-manager');
  assert.equal(validarVolver('/integraciones?abrir=zernio'), '/integraciones?abrir=zernio');
  assert.equal(validarVolver('  /chats  '), '/chats');
  assert.equal(validarVolver('/automations?sec=4#paso'), '/automations?sec=4', 'el fragmento no viaja');
  // El `ws` lo pone el SERVIDOR y sólo si hace falta: uno que venga en `volver` sería un destino que el servidor no controla.
  assert.equal(validarVolver('/chats?ws=9'), '/chats');
  assert.equal(validarVolver('/chats?ws=9&c=lead:4'), '/chats?c=lead%3A4');
  for (const malo of [
    '//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com/x', 'http://evil.com', 'evil.com', 'javascript:alert(1)', 'data:text/html,x',
    '', '   ', '/a\nb', '/a\r\nLocation: https://evil.com', '/a\u0000b', '/api/auth/logout', '/api', '/api/zernio', `/${'a'.repeat(400)}`,
  ]) assert.equal(validarVolver(malo), null, `dejó pasar ${JSON.stringify(malo).slice(0, 40)}`);
  for (const raro of [null, undefined, 3, {}, ['/chats']]) assert.equal(validarVolver(raro), null);
  // Una ruta que se parece a /api sin serlo sigue valiendo.
  assert.equal(validarVolver('/api-mako'), '/api-mako');
});

test('volverConMarca y sinParamsDeVuelta: la marca de la red viaja y se consume sin tocar el resto', () => {
  assert.equal(volverConMarca('/ads-manager', 'metaads'), '/ads-manager?zernio=metaads');
  assert.equal(volverConMarca('/integraciones?abrir=zernio', 'facebook'), '/integraciones?abrir=zernio&zernio=facebook');
  // Lo que Zernio agrega y lo que se consume; `ws`, `abrir` y lo demás se quedan.
  const q = '?ws=7&abrir=zernio&zernio=metaads&connected=metaads&profileId=p1&accountId=acc12345&username=ads&error=oauth_denied&request_id=r&stage=s&tempToken=t';
  assert.equal(sinParamsDeVuelta(q), '?ws=7&abrir=zernio');
  assert.equal(sinParamsDeVuelta('?zernio=facebook&connected=facebook'), '');
  for (const p of ['zernio', 'connected', 'accountId', 'error', 'tempToken', 'userProfile', 'connect_token']) assert.ok(PARAMS_DE_VUELTA.includes(p), `no consume ${p}`);
});

// ── 2. Las redes ─────────────────────────────────────────────────────────────

test('el catálogo: Facebook, Instagram y anuncios hoy; «toString» y compañía no son redes; Messenger es la página de Facebook', () => {
  assert.deepEqual([...REDES_VISIBLES], ['facebook', 'instagram', 'metaads']);
  assert.equal(REDES.metaads.ruta, 'facebook/ads');
  assert.deepEqual(REDES.metaads.params, { loginMode: 'business' });
  assert.equal(REDES.metaads.plataforma, 'metaads');
  assert.equal(REDES.metaads.anuncios, true);
  for (const r of ['facebook', 'instagram', 'metaads', 'linkedin', 'tiktok']) assert.equal(esRedZernio(r), true);
  for (const r of ['toString', 'constructor', '__proto__', 'hasOwnProperty', '', 'Facebook', 'whatsapp', null, undefined, 3]) assert.equal(esRedZernio(r), false, String(r));
  assert.equal(redDeCanal('messenger'), 'facebook');
  assert.equal(redDeCanal('instagram'), 'instagram');
  // Cada red tiene lo que la pantalla necesita, y sin voseo ni punto de más.
  for (const [k, d] of Object.entries(REDES)) {
    assert.ok(d.etiqueta && d.ruta && d.plataforma && d.ayuda, k);
    assert.ok(d.ayuda.length <= 60, `la ayuda de ${k} es larga (${d.ayuda.length})`);
  }
});

// ── 3. Medir: ¿quedó conectada? ──────────────────────────────────────────────

test('medirConexion: una cuenta sana que ANTES no estaba; nada de lo que ya estaba cuenta', () => {
  const a = con('cuenta_aaaaaa'); const b = con('cuenta_bbbbbb');
  assert.deepEqual(medirConexion({ red: 'instagram', antes: [a], ahora: [a, b] }), b);
  assert.equal(medirConexion({ red: 'instagram', antes: [a], ahora: [a] }), null, 'con la de antes sola no se conectó nada');
  assert.deepEqual(medirConexion({ red: 'instagram', antes: [], ahora: [a] }), a);
  // De otra red: no cuenta.
  assert.equal(medirConexion({ red: 'instagram', antes: [], ahora: [con('face_cccccc', { plataforma: 'facebook' })] }), null);
  // Vencida o apagada: no está conectada.
  assert.equal(medirConexion({ red: 'instagram', antes: [], ahora: [con('vieja_dddddd', { vencida: true })] }), null);
  assert.equal(medirConexion({ red: 'instagram', antes: [], ahora: [con('apag_eeeeee', { activa: false })] }), null);
  // Dos cuentas nuevas: devuelve una (la primera), no se confunde.
  assert.deepEqual(medirConexion({ red: 'instagram', antes: [], ahora: [a, b] }), a);
});

test('medirConexion: sin la lista de ANTES falla CERRADO; la pista y la reconexión confirman, siempre contra lo de AHORA', () => {
  const a = con('cuenta_aaaaaa'); const b = con('cuenta_bbbbbb');
  assert.equal(medirConexion({ red: 'instagram', antes: null, ahora: [a, b] }), null, 'sin saber qué había, «alguna» no es «nueva»');
  // El accountId de la vuelta es una PISTA: confirma sólo si existe y está sana en la lista de ahora.
  assert.deepEqual(medirConexion({ red: 'instagram', antes: null, ahora: [a, b], pista: b.accountId }), b);
  assert.equal(medirConexion({ red: 'instagram', antes: null, ahora: [a], pista: 'otra_ffffffff' }), null, 'una pista que Zernio no lista no confirma nada');
  assert.equal(medirConexion({ red: 'instagram', antes: null, ahora: [con('cuenta_aaaaaa', { vencida: true })], pista: 'cuenta_aaaaaa' }), null, 'una pista sobre una vencida tampoco');
  // Volver a entrar con una cuenta que YA estaba conectada no le cambia el id: sin la pista esperaría para siempre.
  assert.deepEqual(medirConexion({ red: 'instagram', antes: [a], ahora: [a], pista: a.accountId }), a);
  // Reconectar una vencida: esa misma, ya sana.
  assert.equal(medirConexion({ red: 'instagram', antes: [con('cuenta_aaaaaa', { vencida: true })], ahora: [con('cuenta_aaaaaa', { vencida: true })], reconectarId: 'cuenta_aaaaaa' }), null, 'sigue vencida: todavía no');
  assert.deepEqual(medirConexion({ red: 'instagram', antes: [con('cuenta_aaaaaa', { vencida: true })], ahora: [a], reconectarId: 'cuenta_aaaaaa' }), a);
  // ⚠️ «Volver a conectar» los ANUNCIOS (una conexión por profile: la única forma de rehacerla es `force` sobre la que ya anda): la cuenta ya estaba SANA, y la
  // primera medición (a los 0,5 s, con la ventana recién abierta) la daba por hecha y la cerraba. Sólo la pista (el accountId con que vuelve) la confirma.
  const ads = con('ads_cuenta_001', { plataforma: 'metaads' });
  assert.equal(medirConexion({ red: 'metaads', antes: [ads], ahora: [ads], reconectarId: ads.accountId }), null, 'una sana no se confirma por reconectarId');
  assert.deepEqual(medirConexion({ red: 'metaads', antes: [ads], ahora: [ads], reconectarId: ads.accountId, pista: ads.accountId }), ads, 'la pista de la vuelta sí');
  assert.equal(medirConexion({ red: 'metaads', antes: null, ahora: [ads], reconectarId: ads.accountId }), null, 'sin la lista de antes, tampoco');
});

test('estadoDeRed y delaRed: conectada, vencida o sin conectar', () => {
  const ig = con('cuenta_aaaaaa'); const fb = con('face_bbbbbbb', { plataforma: 'facebook' });
  assert.deepEqual(delaRed('instagram', [ig, fb]), [ig]);
  assert.equal(estadoDeRed('instagram', [ig, fb]).estado, 'conectada');
  assert.equal(estadoDeRed('metaads', [ig, fb]).estado, 'sin-conectar');
  assert.equal(estadoDeRed('instagram', [con('cuenta_aaaaaa', { vencida: true })]).estado, 'vencida');
  assert.equal(estadoDeRed('instagram', [con('cuenta_aaaaaa', { vencida: true }), con('cuenta_gggggg')]).estado, 'conectada', 'con una sana está conectada aunque otra pida reconectar');
  assert.equal(estadoDeRed('instagram', [con('apag_eeeeee', { activa: false })]).estado, 'sin-conectar', 'una apagada no cuenta como vencida');
});

// ── 3b. La vuelta de página entera, atada al clic que la inició ──────────────

test('guardarVuelta / leerVueltaGuardada: la vuelta sólo vale si ESTA pestaña salió a hacer ese login, hace menos de 30 minutos y de ESA red', () => {
  const ahora = 1_760_000_000_000;
  const a = con('cuenta_aaaaaa'); const f = con('face_bbbbbbb', { plataforma: 'facebook' });
  const guardado = guardarVuelta({ red: 'instagram', antes: [a, f], reconectarId: 'cuenta_aaaaaa', ahoraMs: ahora });
  const v = leerVueltaGuardada(guardado, 'instagram', ahora + 60_000);
  assert.deepEqual(v?.antes?.map((c) => c.accountId), ['cuenta_aaaaaa'], 'sólo las cuentas de ESA red viajan');
  assert.equal(v?.reconectarId, 'cuenta_aaaaaa');
  assert.equal(v?.antes?.[0].activa, true);
  // Nada guardado, roto, vencido, del futuro o de OTRA red: no hay vuelta.
  assert.equal(leerVueltaGuardada(null, 'instagram', ahora), null);
  assert.equal(leerVueltaGuardada('{no es json', 'instagram', ahora), null);
  assert.equal(leerVueltaGuardada('3', 'instagram', ahora), null);
  assert.equal(leerVueltaGuardada(guardado, 'instagram', ahora + VIGENCIA_VUELTA_MS + 1), null, 'venció (el state de Zernio vence a los 30 minutos)');
  assert.equal(leerVueltaGuardada(guardado, 'instagram', ahora - 10 * 60_000), null, 'una hora del futuro no es un login en curso');
  assert.equal(leerVueltaGuardada(guardado, 'facebook', ahora), null, 'la vuelta de Instagram no se aplica a la de Messenger');
  // Sin la lista de antes (no se pudo leer): se guarda como null y la medición sólo confirma con la pista.
  assert.equal(leerVueltaGuardada(guardarVuelta({ red: 'metaads', antes: null, ahoraMs: ahora }), 'metaads', ahora)?.antes, null);
  // Lo que viene del navegador se vuelve a leer con rigor: ids raros y campos sobrantes no pasan.
  const sucio = JSON.stringify({ red: 'instagram', t: ahora, reconectarId: '<x>', antes: [{ accountId: '<script>', plataforma: 'instagram' }, { accountId: 'cuenta_cccccc', plataforma: 'instagram', activa: 'si', extra: 1 }] });
  const l = leerVueltaGuardada(sucio, 'instagram', ahora);
  assert.equal(l?.reconectarId, null);
  assert.deepEqual(l?.antes?.map((c) => [c.accountId, c.activa]), [['cuenta_cccccc', false]], 'un «activa» que no es true cuenta como no activa');
  assert.equal(CLAVE_VUELTA, 'mako-zernio-vuelta');
});

// ── 4. Leer lo que contesta Zernio ───────────────────────────────────────────

test('leerCuentasDeZernio: tolerante con el envoltorio y el profile; descarta lo que no se entiende; NO mezcla perfiles', () => {
  const x = { _id: 'acc_000001', platform: 'instagram', username: 'tienda', displayName: 'La Tienda', isActive: true, profileId: 'p_uno' };
  const y = { _id: 'acc_000002', platform: 'metaads', username: 'act_1', isActive: true, enabled: true, profileId: { _id: 'p_uno' }, needsReconnection: true };
  const otra = { _id: 'acc_000003', platform: 'facebook', username: 'ajena', profileId: 'p_otro' };
  const sinPerfil = { _id: 'acc_000004', platform: 'youtube', username: 'canal' };
  for (const raw of [{ accounts: [x, y] }, { data: [x, y] }, [x, y]]) {
    const r = leerCuentasDeZernio(raw, 'p_uno');
    assert.deepEqual(r.map((c) => c.accountId), ['acc_000001', 'acc_000002']);
    assert.equal(r[0].nombre, 'La Tienda');
    assert.equal(r[1].nombre, 'act_1', 'sin displayName, el usuario');
    assert.equal(r[0].vencida, false);
    assert.equal(r[1].vencida, true);
  }
  // ⚠️ Una clave con varios perfiles: lo del OTRO perfil no se ve, aunque Zernio lo devuelva.
  assert.deepEqual(leerCuentasDeZernio({ accounts: [x, otra, sinPerfil] }, 'p_uno').map((c) => c.accountId), ['acc_000001', 'acc_000004']);
  assert.deepEqual(leerCuentasDeZernio({ accounts: [x, otra] }, null).map((c) => c.accountId), ['acc_000001', 'acc_000003'], 'sin profile no se filtra');
  // Apagada, y el alias de /accounts/health.
  const r2 = leerCuentasDeZernio([{ _id: 'acc_000005', platform: 'instagram', isActive: false }, { id: 'acc_000006', platform: 'instagram', enabled: false }, { _id: 'acc_000007', platform: 'instagram', needsReconnect: true }]);
  assert.deepEqual(r2.map((c) => [c.activa, c.vencida]), [[false, false], [false, false], [true, true]]);
  // Basura: nada tira y nada entra.
  for (const raw of [null, undefined, 3, 'x', {}, { accounts: 'no' }, { accounts: [null, 1, 'x', {}, { _id: 'a' }, { platform: 'x' }, { _id: 'no valido', platform: 'x' }] }]) {
    assert.deepEqual(leerCuentasDeZernio(raw, 'p_uno'), [], JSON.stringify(raw)?.slice(0, 40));
  }
  // Una cuenta OCULTA (el modo classic de anuncios crea una de Facebook con `enabled: false`) no cuenta, sea cual sea el campo que lo diga.
  assert.deepEqual(leerCuentasDeZernio([{ _id: 'acc_000009', platform: 'facebook', hidden: true }, { _id: 'acc_000010', platform: 'facebook', isHidden: true }]).map((c) => c.activa), [false, false]);
  // Largos acotados y sin controles.
  const larga = leerCuentasDeZernio([{ _id: 'acc_000008', platform: 'instagram', username: `a\n${'b'.repeat(500)}` }])[0];
  assert.ok(larga.usuario.length <= 200 && !/\n/.test(larga.usuario));
});

test('tieneListaDeCuentas: una lista vacía es «no hay cuentas»; un objeto sin lista es «no entendí», y el log dice las CLAVES, nunca los valores', () => {
  for (const ok of [[], { accounts: [] }, { data: [] }, { accounts: [{ _id: 'x' }] }]) assert.equal(tieneListaDeCuentas(ok), true, JSON.stringify(ok));
  for (const mal of [{}, { cuentas: [] }, { accounts: 'no' }, { ok: true }, null, undefined, 'x', 3]) assert.equal(tieneListaDeCuentas(mal), false, JSON.stringify(mal));
  assert.equal(clavesDe({ cuentas: [], secreto: 'abc', n: 3 }), 'cuentas,secreto,n');
  assert.doesNotMatch(clavesDe({ token: 'valor-secreto' }), /valor-secreto/);
  assert.equal(clavesDe([1]), 'arreglo');
  assert.equal(clavesDe(null), 'object');
});

test('el link del login y el link de pago: sólo https, sin datos de acceso, sin nada que ejecute', () => {
  assert.equal(urlDeLoginDeZernio({ authUrl: 'https://zernio.com/oauth/start?state=abc' }), 'https://zernio.com/oauth/start?state=abc');
  assert.equal(urlDeLoginDeZernio({ url: 'https://zernio.com/x' }), 'https://zernio.com/x', 'el campo que la doc parafraseó');
  for (const malo of ['http://zernio.com/x', 'javascript:alert(1)', 'data:text/html,x', 'https://user:pass@zernio.com/x', 'https://zernio.com/a b', 'zernio.com/x', '', `https://zernio.com/${'a'.repeat(5000)}`]) {
    assert.equal(urlDeLoginDeZernio({ authUrl: malo }), null, malo.slice(0, 40));
  }
  assert.equal(urlDeLoginDeZernio(null), null);
  assert.equal(urlDeLoginDeZernio({}), null);
  assert.equal(urlDePagoDeZernio({ dashboard_url: 'https://zernio.com/dashboard/billing' }), 'https://zernio.com/dashboard/billing');
  assert.equal(urlDePagoDeZernio({ dashboard_url: 'javascript:alert(1)' }), null);
});

test('motivoDeRespuesta: cada status de Zernio se dice como lo que es', () => {
  assert.equal(motivoDeRespuesta(401, { error: 'Invalid API key' }).motivo, 'clave-mala');
  const pago = motivoDeRespuesta(402, { error: 'x', code: 'PAYMENT_REQUIRED', reason: 'free_tier_exceeded', dashboard_url: 'https://zernio.com/dashboard/billing' });
  assert.equal(pago.motivo, 'pago');
  assert.equal(pago.pagoUrl, 'https://zernio.com/dashboard/billing');
  // Cualquier OTRO 402 es la cuenta pausada: el caso de ws11 (10/10/2026).
  assert.equal(motivoDeRespuesta(402, { error: 'x', code: 'PAYMENT_REQUIRED' }).motivo, 'pausada');
  assert.equal(motivoDeRespuesta(402, { details: { reason: 'free_tier_exceeded' } }).motivo, 'pago');
  assert.equal(motivoDeRespuesta(403, { code: 'platform_account_limit' }).motivo, 'limite');
  assert.equal(motivoDeRespuesta(403, { error: 'otra cosa' }).motivo, 'error');
  for (const s of [429, 500, 502, 503]) assert.equal(motivoDeRespuesta(s, null).motivo, 'sin-red', String(s));
  const e = motivoDeRespuesta(400, { error: `Falta ${'x'.repeat(400)}`, code: 'x' });
  assert.equal(e.motivo, 'error');
  assert.ok(e.texto && e.texto.length <= 200, 'el texto de Zernio va recortado');
  assert.equal(motivoDeRespuesta(404, null).texto, null);
  // Todos los motivos tienen su texto, en neutro.
  for (const m of ['sin-clave', 'clave-mala', 'clave-en-uso', 'pausada', 'pago', 'limite', 'sin-perfil', 'sin-red', 'respuesta', 'error'] as const) {
    assert.ok(MENSAJES_DE_MOTIVO[m], m);
    assert.doesNotMatch(MENSAJES_DE_MOTIVO[m], /\b(tenés|podés|hacé|pegá|probá|revisá|conectá|vos)\b/i, `voseo en «${m}»`);
  }
});

// ── 5. La vuelta y el mensaje de la ventana ──────────────────────────────────

test('retornoDeZernio: lo que trae la URL se acota y se lee como TEXTO; nada lo hace «conectado» sin que el servidor lo mida', () => {
  const ok = retornoDeZernio('?zernio=metaads&connected=metaads&profileId=p1&accountId=acc_000001&username=Mi%20Tienda');
  assert.deepEqual(ok, { red: 'metaads', conectado: true, accountId: 'acc_000001', usuario: 'Mi Tienda', error: null, mensaje: null, arreglable: null });
  const mal = retornoDeZernio('?zernio=facebook&error=oauth_denied&error_message=Cancelaste&is_user_fixable=true');
  assert.equal(mal.conectado, false);
  assert.equal(mal.error, 'oauth_denied');
  assert.equal(mal.arreglable, true);
  assert.equal(mal.mensaje, 'Cancelaste', 'Zernio lo marcó arreglable: se muestra');
  // ⚠️ Cualquiera puede armar un link con el dominio de MaKo y un `error_message`: sin `is_user_fixable=true` el texto de la URL no se muestra.
  assert.equal(retornoDeZernio('?zernio=facebook&error=x&error_message=Tu%20cuenta%20fue%20suspendida').mensaje, null);
  assert.equal(retornoDeZernio('?zernio=facebook&error=x&error_message=hola&is_user_fixable=false').mensaje, null);
  // Con error nunca es «conectado», aunque diga `connected`.
  assert.equal(retornoDeZernio('?zernio=facebook&connected=facebook&error=x').conectado, false);
  // Basura: la red desconocida, el id raro, el código raro y el texto enorme no pasan.
  const r = retornoDeZernio(`?zernio=hasOwnProperty&accountId=<script>&error=a b<c>&error_message=${'z'.repeat(900)}%0A%0Ahola&username=${'u'.repeat(400)}`);
  assert.equal(r.red, null);
  assert.equal(r.accountId, null);
  assert.equal(r.error, 'desconocido', 'un código raro no se muestra');
  assert.ok((r.mensaje ?? '').length <= 300 && !/\n/.test(r.mensaje ?? ''));
  assert.ok((r.usuario ?? '').length <= 100);
  assert.equal(retornoDeZernio('').red, null);
  assert.equal(retornoDeZernio('').conectado, false);
});

test('textoDeErrorDeRetorno: cada error de la vuelta dice qué hacer', () => {
  assert.match(textoDeErrorDeRetorno('oauth_denied'), /Cancelaste/);
  assert.match(textoDeErrorDeRetorno('meta_ads_authorization_denied'), /Cancelaste/);
  assert.match(textoDeErrorDeRetorno('no_facebook_pages'), /página de Facebook/);
  assert.match(textoDeErrorDeRetorno('no_pages_granted'), /página/);
  assert.match(textoDeErrorDeRetorno('payment_required'), /tarjeta/);
  assert.equal(textoDeErrorDeRetorno('raro', 'Algo falló'), 'Zernio dice: Algo falló');
  assert.equal(textoDeErrorDeRetorno('raro'), MENSAJES_DE_MOTIVO.error);
});

test('leerMensajeVentana: sólo el formato esperado, y un error nunca es «conectado»', () => {
  assert.deepEqual(leerMensajeVentana({ tipo: TIPO_MENSAJE_VENTANA, conectado: true, accountId: 'acc_000001', error: null }), { tipo: TIPO_MENSAJE_VENTANA, conectado: true, accountId: 'acc_000001', error: null, mensaje: null, flujo: null });
  // El id del flujo (el clic) y el texto de Zernio, acotados: la pantalla sólo mira los avisos del SUYO.
  assert.equal(leerMensajeVentana({ tipo: TIPO_MENSAJE_VENTANA, flujo: 'abc123XYZ789' })?.flujo, 'abc123XYZ789');
  assert.equal(leerMensajeVentana({ tipo: TIPO_MENSAJE_VENTANA, flujo: '<script>' })?.flujo, null);
  assert.equal(leerMensajeVentana({ tipo: TIPO_MENSAJE_VENTANA, mensaje: 'x'.repeat(900) })?.mensaje?.length, 200);
  assert.equal(esFlujoValido('abc123'), true);
  for (const mal of ['', 'abc', 'a b c d e f', 'a'.repeat(40), null, 3]) assert.equal(esFlujoValido(mal), false, String(mal));
  assert.equal(leerMensajeVentana({ tipo: TIPO_MENSAJE_VENTANA, conectado: true, error: 'oauth_denied' })?.conectado, false);
  assert.equal(leerMensajeVentana({ tipo: TIPO_MENSAJE_VENTANA, accountId: '<img src=x>' })?.accountId, null);
  for (const raro of [null, undefined, 'x', 3, [], {}, { tipo: 'otra-cosa' }, { tipo: 'mako-zernio-falso' }]) assert.equal(leerMensajeVentana(raro), null);
  assert.equal(CANAL_VENTANA, 'mako-zernio');
});

// ── 6. Cuándo no hay ventana emergente, y el cobro ───────────────────────────

test('sinVentanaEmergente: teléfonos y navegadores internos van por página entera; la computadora, por ventana', () => {
  const escritorio = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  assert.equal(sinVentanaEmergente(escritorio, 1440), false);
  assert.equal(sinVentanaEmergente(escritorio, 700), true, 'una ventana chica de escritorio');
  assert.equal(sinVentanaEmergente('Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36', 1000), true);
  assert.equal(sinVentanaEmergente('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0', 400), true);
  assert.equal(sinVentanaEmergente('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]', 900), true);
  assert.equal(sinVentanaEmergente(null, null), false);
});

test('lineaDeCobro: UNA línea, con el número real si se sabe y sin inventarlo si no', () => {
  assert.match(lineaDeCobro(null), /Cada red cuenta aparte en Zernio.*2 gratis.*3\.ª/);
  assert.match(lineaDeCobro(1), /Tienes 1 cuenta conectada en Zernio/);
  assert.match(lineaDeCobro(0), /Tienes 0 cuentas conectadas/);
  assert.match(lineaDeCobro(4), /Tienes 4 cuentas conectadas.*2 primeras son gratis.*3\.ª/);
  assert.match(lineaDeCobro(Number.NaN), /Cada red cuenta aparte/);
  assert.match(lineaDeCobro(-1), /Cada red cuenta aparte/);
  for (const n of [null, 0, 1, 7]) assert.ok(lineaDeCobro(n).length <= 140, `larga para ${n}`);
  // Los tiempos: 4 s × 60 = 4 min, y a 15 pedidos por minuto cabe en los 60 de un equipo con 0 a 2 cuentas.
  assert.equal(SONDEO_MS * SONDEO_MAX, 240_000);
  assert.ok(60_000 / SONDEO_MS <= 20);
});

// ── 7. El servidor, sobre el fuente ──────────────────────────────────────────

const CONECTAR = fuente('lib/zernio-conectar.ts');

test('el servidor: la key es la del negocio, el link nace de una ruta validada y sólo `recibirConexion` escribe', () => {
  assert.match(CONECTAR, /^import 'server-only';/m);
  // Clave del negocio: por `cfg` (lib/zernio.ts), que no cae a la plataforma; sin ella, `sin-clave`.
  const ctx = bloque(CONECTAR, 'async function contexto(ws: number)', '\n}\n', 3200);
  assert.match(ctx, /c = await cfg\(ws\);/);
  assert.match(ctx, /e\.status === 0 && e\.message === NO_CONFIGURADO\) throw new ZernioConectarError\('sin-clave'\);/);
  assert.match(ctx, /const clave = `\$\{ws\}:\$\{huella\(c\.apiKey\)\}`;/, 'el profile cacheado no se ata a la key');
  // Dos negocios con la MISMA key comparten el profile Default: si el profile ya es de OTRO negocio, no se sigue.
  assert.match(ctx, /const dueno = await wsPorIdentificadorEstricto\(RUTEO_PERFIL, profileId\);\n\s+if \(dueno != null && Number\(dueno\) !== ws\) throw new ZernioConectarError\('clave-en-uso'\);/);
  assert.ok(ctx.indexOf('wsPorIdentificadorEstricto') < ctx.indexOf('perfiles.set(clave'), 'el profile se cachea ANTES de saber de quién es');
  assert.match(CONECTAR, /const NO_CONFIGURADO = 'Zernio no está configurado';/);
  assert.match(fuente('lib/zernio.ts'), /throw new ZernioError\('Zernio no está configurado', 0, null\);/, 'el mensaje que compara el servidor cambió');
  assert.doesNotMatch(CONECTAR, /envCred|credWs\(|process\.env/, 'esta pieza leyó la key de la plataforma');
  // El link: `volver` validado, `?ws=` sólo si hace falta, ventana → la landing, página → la misma pantalla con la marca.
  const url = bloque(CONECTAR, 'export async function urlConectarViaZernio(', '\n}\n', 6500);
  assert.match(url, /const v = validarVolver\(volver\);\n\s+if \(!v\) throw new ZernioConectarError\('error', 'La dirección de vuelta no vale\.'\);/);
  // El `?ws=` sólo si un admin de plataforma está ADENTRO de un cliente (`estaImpersonando`): `wsDeVuelta` no sirve acá, porque la petición ya trae el ?ws= de la pestaña.
  assert.match(url, /const w = \(await estaImpersonando\(\)\.catch\(\(\) => false\)\) \? ws : null;/);
  assert.match(url, /const flujo = esFlujoValido\(opc\.flujo\) \? opc\.flujo : null;/);
  assert.match(url, /\? linkApp\(`\/integraciones\/zernio-vuelta\?red=\$\{red\}\$\{flujo \? `&f=\$\{flujo\}` : ''\}`, w\)\n\s+: linkApp\(volverConMarca\(v, red\), w\);/);
  assert.doesNotMatch(CONECTAR, /wsDeVuelta|adminDeWorkspaceActual/, 'volvió la comparación que siempre sacaba el ws de la vuelta');
  assert.match(url, /const url = urlDeLoginDeZernio\(r\);\n\s+if \(url\) return \{ ok: true, tipo: 'url', url \};/);
  assert.match(url, /throw new ZernioConectarError\('respuesta', undefined\);/, 'un 200 sin link no es un éxito');
  assert.match(url, /if \(def\.anuncios\) q\.set\('force', 'true'\); else q\.set\('reconnectAccountId', opc\.reconectarId\);/);
  assert.match(url, /ID_ANUNCIOS\.test\(opc\.adAccountId\)/);
  // Nunca al log: la key ni el link del login.
  const logs = [...CONECTAR.matchAll(/console\.error\(([^\n]+)\)/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(logs, /apiKey|authUrl|\burl\b|redirect/, 'se loguea la key o el link del login');
});

test('el servidor: `conexionesViaZernio` sólo LEE (se llama cada 4 s); lo que escribe es `recibirConexion`', () => {
  const lee = bloque(CONECTAR, 'export async function conexionesViaZernio(', '\n}\n', 2800);
  assert.match(lee, /excludeHidden: 'true'/);
  assert.match(lee, /q\.set\('platform', REDES\[red\]\.plataforma\);/);
  assert.match(lee, /return leerCuentasDeZernio\(r, profileId\);/);
  // Una respuesta SIN lista no es «no hay cuentas»: se dice `respuesta` y se loguean las claves (nunca los valores).
  assert.match(lee, /if \(!tieneListaDeCuentas\(r\)\) \{\n\s+console\.error\(`\[zernio-conectar\] \/accounts ws\$\{ws\}: la respuesta no trae lista \(claves: \$\{clavesDe\(r\)\}\)`\);\n\s+throw new ZernioConectarError\('respuesta'\);/);
  // El ws1 (OWNER_WS) sigue con la key de la PLATAFORMA: su 401/402 es de la cuenta de MaKo, no suyo.
  assert.match(CONECTAR, /if \(deLaCasa && \(r\.motivo === 'clave-mala' \|\| r\.motivo === 'pausada' \|\| r\.motivo === 'pago' \|\| r\.motivo === 'limite'\)\) return new ZernioConectarError\('error'\);/);
  assert.match(CONECTAR, /const m = motivoDeError\(e, ws === OWNER_WS\);/);
  assert.doesNotMatch(lee, /cuentasConectadas|asegurarWebhook|upsertRouting|method:\s*'(POST|PUT|PATCH|DELETE)'/, 'una lectura que escribe');
  const arma = bloque(CONECTAR, 'export async function recibirConexion(', '\n}\n', 2800);
  assert.match(arma, /const cuentas = await cuentasConectadas\(ws\);/);
  // «Conectado ✓» no garantiza que llegue nada: `cuentasConectadas` reclama cada cuenta y NO dice si lo logró; se mira de quién quedó.
  assert.match(arma, /const dueno = await wsPorIdentificadorEstricto\(RUTEO_CUENTA, a\._id\);/);
  assert.match(arma, /else if \(Number\(dueno\) !== ws\) ruteo = 'ocupado';/);
  assert.match(arma, /await asegurarWebhook\(ws\);/);
  // Y nadie más en el archivo.
  assert.equal([...CONECTAR.matchAll(/cuentasConectadas\(|asegurarWebhook\(/g)].length, 2, 'otra función reclama ruteo o toca el webhook');
});

test('la ruta: sólo el admin, las redes del catálogo y los motivos de la pieza', () => {
  const ruta = fuente('app/api/zernio/route.ts');
  assert.match(ruta, /if \(ws == null \|\| rol !== 'admin'\) return Response\.json\(\{ ok: false, error: 'Solo el admin del workspace' \}, \{ status: 403 \}\);/);
  assert.match(ruta, /if \(!body \|\| typeof body !== 'object' \|\| Array\.isArray\(body\)\) return Response\.json\(\{ ok: false, error: 'body inválido' \}, \{ status: 400 \}\);/, 'un JSON null tira un 500');
  assert.match(ruta, /flujo: typeof body\.flujo === 'string' \? body\.flujo : null,/);
  assert.match(ruta, /const red = esRedZernio\(body\.plataforma\) \? body\.plataforma : null;/);
  // «No pude leer tus credenciales» NO es «no tienes Zernio»: con eso la pantalla abre «pega tu key» y puede pisar una key buena.
  assert.match(ruta, /try \{ configurado = await zernioConfigurado\(ws\); \} catch \(e\) \{/);
  assert.match(ruta, /if \(body\.action === 'conectar' && !red\) return Response\.json\(\{ ok: false, error: 'plataforma inválida' \}, \{ status: 400 \}\);/);
  assert.match(ruta, /const r = await urlConectarViaZernio\(ws, red!, String\(body\.volver \?\? ''\), \{/);
  assert.match(ruta, /modo: body\.modo === 'pagina' \? 'pagina' : 'ventana',/);
  assert.match(ruta, /const conexiones = await conexionesViaZernio\(ws, red \?\? undefined\);/);
  assert.match(ruta, /return Response\.json\(\{ ok: true, \.\.\.\(await recibirConexion\(ws\)\) \}\);/);
  assert.match(ruta, /return Response\.json\(\{ ok: false, motivo: m\.motivo, error: m\.message, \.\.\.\(m\.pagoUrl \? \{ pagoUrl: m\.pagoUrl \} : \{\}\) \}\);/);
  // El «estado» de la cabecera de Automations sigue pidiendo una de las dos plataformas de mensajes.
  assert.match(ruta, /const plataforma = body\.plataforma === 'facebook' \? 'facebook' : body\.plataforma === 'instagram' \? 'instagram' : null;/);
});

// ── 8. La pantalla, sobre el fuente ──────────────────────────────────────────

const HOOK = fuente('app/_components/ConectarViaZernio.tsx');

test('la pantalla: la ventana se abre EN el clic, los mensajes se aceptan sólo del mismo origen y de ESA ventana, y «cerrada» no es «canceló»', () => {
  const conectar = bloque(HOOK, 'const conectarAsync = useCallback(async (redElegida: RedZernio, extra: ExtraZernio = {}) => {', "setFase('esperando');", 9000);
  const iVentana = conectar.indexOf("window.open('', 'mako-zernio', 'popup=yes,width=560,height=740')");
  assert.ok(iVentana >= 0, 'no abre la ventana por su nombre');
  assert.equal(conectar.slice(0, iVentana).includes('await'), false, 'hay un `await` antes de abrir la ventana: el navegador la bloquea');
  assert.doesNotMatch(conectar, /noopener/, 'con `noopener` window.open devuelve null y no se le puede asignar la URL');
  assert.match(conectar, /const sinPopup = sinVentanaEmergente\(navigator\.userAgent, window\.innerWidth\);/);
  // Sin ventana, la pestaña navega y vuelve: ANTES de salir se guarda que ESTA pestaña inició el login (la vuelta sólo vale así).
  assert.match(conectar, /if \(!ventana\) \{\n\s+try \{ window\.sessionStorage\.setItem\(CLAVE_VUELTA, guardarVuelta\(\{ red: redElegida, antes, reconectarId: extra\.reconectarId \?\? null, ahoraMs: Date\.now\(\) \}\)\); \} catch/);
  assert.ok(conectar.indexOf('sessionStorage.setItem') < conectar.indexOf('window.location.assign(res.url)'), 'se sale a Zernio antes de guardar');
  // El vínculo con la ventana se corta ya (reverse tabnabbing), y un segundo clic NO cierra la ventana del primero.
  assert.match(conectar, /try \{ if \(ventana\) ventana\.opener = null; \} catch/);
  assert.match(conectar, /const cerrar = \(\) => \{ if \(!vivo\.current \|\| corrida\.current === mia\) \{ try \{ ventana\?\.close\(\); \}/);
  // El id del flujo viaja al servidor y sólo se miran los avisos que lo traen.
  assert.match(conectar, /api\('conectar', \{ plataforma: redElegida, volver: optsRef\.current\.volver, modo, flujo, \.\.\.extra \}\),/);
  assert.match(HOOK, /if \(!m \|\| m\.flujo !== flujo\) return;/);
  assert.match(HOOK, /const alMensaje = \(e: MessageEvent\) => \{ if \(e\.origin === window\.location\.origin && e\.source === ventana\) recibir\(e\.data\); \};/);
  assert.match(HOOK, /new BroadcastChannel\(CANAL_VENTANA\)/, 'sin el canal, un COOP corta el aviso de la ventana');
  // «Cerrada»: sólo adelanta una medición y avisa; el único `fallar` del bucle es por error de la ventana, key o el tope.
  const bucle = bloque(HOOK, 'while (Date.now() - inicio < SONDEO_MAX * SONDEO_MS) {', '} finally {', 7000);
  assert.match(bucle, /if \(cierre == null && ventana\.closed\) cierre = Date\.now\(\);/);
  assert.match(bucle, /avisoDeCierre = true;\n\s+ponerNota\(/);
  // Un error que no se arregla esperando se dice YA; los demás, si se repiten 3 veces seguidas (no se espera 4 minutos a algo que no va a llegar).
  assert.match(bucle, /if \(fallosSeguidos >= FALLOS_SEGUIDOS\) \{ cerrar\(\); fallar\(j\?\.error \|\| MENSAJES_DE_MOTIVO\[motivo\], j\?\.pagoUrl \?\? null\); return; \}/);
  // El error de la ventana se dice con lo que trajo y la ventana NO se cierra (la landing queda unos segundos para que se alcance a leer).
  // 2a6a166d8 (tipos, 24/10) pasó el `let errorDeVentana` a `deLaVentana.msg` para que tipara: mismo camino.
  assert.match(bucle, /if \(deLaVentana\.msg\) \{ fallar\(textoDeErrorDeRetorno\(deLaVentana\.msg\.error, deLaVentana\.msg\.mensaje\), null\); return; \}/);
  const iGracia = bucle.indexOf('if (graciaCumplida) {');
  assert.ok(iGracia > 0);
  const deLaGracia = bucle.slice(iGracia, bucle.indexOf('\n        }\n', iGracia));
  assert.match(deLaGracia, /avisoDeCierre = true;/);
  assert.doesNotMatch(deLaGracia, /fallar\(/, 'una ventana vista cerrada da la conexión por no hecha (con COOP se ve cerrada con la persona adentro)');
  // La medición la hace el servidor, contra la lista de ANTES.
  assert.match(bucle, /medirConexion\(\{ red: redElegida, antes, ahora: j\.conexiones, pista, reconectarId: extra\.reconectarId \?\? null \}\)/);
});

test('la pantalla: sin key se abre EL modal de Zernio de /integraciones, y la vuelta de página entera se consume una vez', () => {
  assert.match(HOOK, /import \{ useConectarIntegracion \} from '\.\/ConectarIntegracion';/);
  assert.match(HOOK, /abrirIntegracion\('zernio'\)/);
  assert.match(HOOK, /const vueltasVistas = new Set<string>\(\);/);
  assert.match(HOOK, /if \(!ret\.red \|\| vueltasVistas\.has\(clave\)\) return;/);
  // ⚠️ `null` y no el `state` de la página: con el que ya tiene (`__NA`) el parche de Next (app-router.js, replaceState) deja pasar el cambio SIN enterarse de la
  // URL, y su router vuelve a escribir los parámetros en el próximo cambio; con `null` copia su estado interno y sincroniza la URL.
  assert.match(HOOK, /window\.history\.replaceState\(null, '', `\$\{window\.location\.pathname\}\$\{sinParamsDeVuelta\(clave\)\}\$\{window\.location\.hash\}`\);/);
  assert.doesNotMatch(HOOK, /replaceState\(window\.history\.state/);
  // La vuelta se procesa SÓLO si esta pestaña la inició (y es de ESA red), y se mide como la ventana; `connected` de la URL no decide.
  assert.match(HOOK, /guardada = leerVueltaGuardada\(window\.sessionStorage\.getItem\(CLAVE_VUELTA\), r, Date\.now\(\)\);/);
  // Sin lo guardado no se conecta NADA; sólo se dice un error, con el texto de MaKo (25/10/2026, errorDeVueltaAjena).
  const sinGuardada = bloque(HOOK, 'if (!guardada) {', 'const g = guardada;', 600);
  assert.match(sinGuardada, /return;/);
  assert.doesNotMatch(sinGuardada, /medirConexion|terminar\(|setFase\('abriendo'\)|ret\.conectado|ret\.mensaje/, 'sin lo guardado de esta pestaña, nada se da por conectado');
  assert.match(HOOK, /const nueva = medirConexion\(\{ red: r, antes: g\.antes, ahora: j\.conexiones, pista: ret\.accountId, reconectarId: g\.reconectarId \}\);/);
  assert.doesNotMatch(bloque(HOOK, 'const g = guardada;', '}, []);', 3500), /ret\.conectado/, 'la vuelta vuelve a depender del parámetro de la URL');
  // La conexión queda armada ANTES de avisarle a la pantalla, y si el ruteo no quedó, se dice.
  assert.match(HOOK, /const c = await api\('conectada'\);/);
  assert.match(HOOK, /c\.ruteo === 'ocupado'\) ponerNota\(/);
  // Volver con «atrás» desde Meta (bfcache): el botón no queda «Conectando…».
  assert.match(HOOK, /window\.addEventListener\('pageshow', alVolver\);/);
  // La key de Zernio se dice acá mismo si el bloque «Redes» ya está dentro del modal de Zernio (no se abre OTRO encima).
  assert.match(HOOK, /if \(optsRef\.current\.keyAca\) \{ fallar\(/);
  // Todo `role="alert"` lleva «Reportar a Soporte», y todo fetch del navegador, su tope.
  assert.match(HOOK, /<span role="alert"[\s\S]*?<ReportarASoporte \/>\s*<\/span>/);
  assert.match(HOOK, /signal: AbortSignal\.timeout\(65_000\)/);
  // El botón: no se bloquea en «esperando» (es la salida de quien cerró la ventana), y muestra que trabaja al pedir el link.
  assert.match(HOOK, /const ocupado = z\.fase === 'abriendo';/);
});

test('la landing de la ventana: avisa por opener y por canal, al MISMO origen, y no tiene chrome', () => {
  const v = fuente('app/integraciones/zernio-vuelta/VueltaDeZernio.tsx');
  assert.match(v, /window\.opener\.postMessage\(mensaje, window\.location\.origin\);/);
  assert.doesNotMatch(v, /postMessage\([^)]*'\*'/, 'postMessage a cualquier origen');
  assert.match(v, /new BroadcastChannel\(CANAL_VENTANA\)/);
  assert.match(v, /window\.close\(\)/);
  // El aviso lleva el id del flujo (el `f` de la URL) y el texto de Zernio; el error es un alert con «Reportar a Soporte»; «Volver» conserva el ?ws=.
  assert.match(v, /flujo: esFlujoValido\(f\) \? f : null,/);
  assert.match(v, /<span role="alert"[^>]*>\{estado\.texto\}<ReportarASoporte \/><\/span>/);
  assert.match(v, /setVolverAMako\(`\/integraciones\?abrir=zernio&ws=\$\{ws\}`\)/);
  assert.equal(esVistaSinChrome('/integraciones/zernio-vuelta'), true);
  assert.equal(esVistaSinChrome('/integraciones/zernio-vuelta/'), true);
  assert.equal(esVistaSinChrome('/integraciones'), false, 'la grilla sí lleva chrome');
  // La página no lee la sesión ni la base: sólo lo que trae la URL.
  assert.doesNotMatch(fuente('app/integraciones/zernio-vuelta/page.tsx'), /getUsuarioActual|supabase|getTenantDb|credWs/);
});

test('los consumidores usan la MISMA pieza: el modal de Zernio, Automations y Chats; ninguno arma su popup ni su redirect', () => {
  assert.match(fuente('app/integraciones/ServicioConfigForm.tsx'), /servicio\.key === 'zernio' && servicio\.campos\.some\(\(c\) => c\.configurado\) && <ConectarRedes \/>/);
  assert.match(fuente('app/integraciones/ServicioConfigForm.tsx'), /const ConectarRedes = dynamic\(\(\) => import\('\.\/ConectarRedes'\), \{ ssr: false \}\);/);
  const redes = fuente('app/integraciones/ConectarRedes.tsx');
  assert.match(redes, /useConectarViaZernio\(\{ volver: '\/integraciones\?abrir=zernio', keyAca: true,/);
  // La fila de «esperando» NO se bloquea (es la salida de quien cerró la ventana): sólo «Conectando…» mientras se pide el link.
  assert.match(redes, /const activaAhora = z\.red === red && z\.fase === 'abriendo';/);
  // La vuelta de un teléfono la recibe UNA pieza montada en la pantalla de Automations, aunque su botón viva adentro de un modal que ya no existe.
  assert.match(fuente('app/automations/ChatAgentApp.tsx'), /<VueltaZernio volver="\/automations" onConectado=\{avisarMedioConectado\} \/>/);
  assert.match(fuente('app/_components/VueltaZernio.tsx'), /useConectarViaZernio\(\{ volver, onConectado: \(\) => onConectado\?\.\(\) \}\)/);
  assert.match(fuente('app/automations/ConectarMedio.tsx'), /z\.conectar\(redDeCanal\(medio\)\)/);
  // Desde el 24/10/2026 Chats conecta TODOS sus canales desde una pieza (app/chats/ConectarCanal.tsx, docs/diseno-chats.md §8.4),
  // y ChatsApp la monta en sus dos pantallas (la vacía y la de siempre) con `conectarCanal.modal`.
  const chats = fuente('app/chats/ConectarCanal.tsx');
  assert.match(chats, /const viaZernio = useConectarViaZernio\(\{\n\s+volver: RUTA_CHATS,/);
  assert.match(chats, /conectarRed\(redDeCanal\(c\)\);/);
  // La causa del error va como el TÍTULO del aviso (a la vista), no como detalle (sólo un tooltip: en un teléfono no se ve).
  assert.match(chats, /alError: \(texto, pago\) => alError\(pago \? `\$\{texto\} Agrega la tarjeta en tu cuenta de Zernio\.` : texto\),/);
  const app = fuente('app/chats/ChatsApp.tsx');
  assert.match(app, /alError: \(texto\) => aviso\.error\(texto, null\),/);
  assert.equal((chats.match(/\{viaZernio\.modal\}/g) ?? []).length, 1, 'el modal de la key va con la pieza');
  assert.equal((app.match(/\{conectarCanal\.modal\}/g) ?? []).length, 2, 'la pieza va en las dos pantallas de Chats');
  assert.doesNotMatch(chats + app, /action: 'conectar'|window\.location\.href = r\.url/, 'Chats volvió al redirect de página entera a /automations');
  // Ni popup ni sondeo propios en otro lado de la app.
  for (const f of ['app/automations/ConectarMedio.tsx', 'app/automations/EditorMensajeSocial.tsx', 'app/chats/ChatsApp.tsx', 'app/chats/ConectarCanal.tsx', 'app/integraciones/ConectarRedes.tsx']) {
    // (El «Pagar Zernio» de la cabecera abre el link de pago con `window.open(url, '_blank', …)`: no es un login.)
    assert.doesNotMatch(fuente(f), /window\.open\(''|mako-conectar/, `${f} abre su propia ventana de login`);
  }
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────
// Una por vez, con un arnés que guarda el original en memoria, rompe, corre ESTE archivo y restaura comprobando el contenido. Base: 23 pasan / 0
// fallan. Las 46 cazadas (el número es «pasan/fallan» y, tras la flecha, el primer test que la cazó). Las 24 primeras son de la construcción; de R25 en
// adelante, de la revisión adversarial (tres revisores independientes sobre el código ya escrito):
//   ⚠️ R1: con SÓLO sacar `startsWith('//')` no cae: el chequeo del origen la cubre. Son DOS capas a propósito, por eso la rotura saca las dos.
//   R1   validarVolver sin NINGUNA defensa contra //evil.com (sintaxis y origen)                      → 22/1 · validarVolver: una ruta de la app sí; todo lo que sale de el…
//   R2   validarVolver deja pasar /api/…                                                              → 22/1 · validarVolver: una ruta de la app sí; todo lo que sale de el…
//   R3   esRedZernio con `in` (toString pasa)                                                         → 21/2 · el catálogo: Facebook, Instagram y anuncios hoy; «toString» …
//   R4   medirConexion sin la lista de antes da la primera                                            → 22/1 · medirConexion: sin la lista de ANTES falla CERRADO; la pista…
//   R5   una cuenta vencida cuenta como conectada                                                     → 20/3 · medirConexion: una cuenta sana que ANTES no estaba; nada de …
//   R6   la pista confirma sin estar en la lista de ahora                                             → 22/1 · medirConexion: sin la lista de ANTES falla CERRADO; la pista…
//   R7   leerCuentasDeZernio sin el filtro por profile                                                → 22/1 · leerCuentasDeZernio: tolerante con el envoltorio y el profil…
//   R8   el link del login acepta http                                                                → 22/1 · el link del login y el link de pago: sólo https, sin datos d…
//   R9   todo 402 es «pausada»                                                                        → 22/1 · motivoDeRespuesta: cada status de Zernio se dice como lo que…
//   R10  la vuelta con error igual es «conectado»                                                     → 22/1 · retornoDeZernio: lo que trae la URL se acota y se lee como T…
//   R11  el servidor no valida `volver`                                                               → 22/1 · el servidor: la key es la del negocio, el link nace de una r…
//   R12  conexionesViaZernio escribe (reclama ruteo)                                                  → 22/1 · el servidor: `conexionesViaZernio` sólo LEE (se llama cada 4…
//   R13  un await ANTES de window.open                                                                → 22/1 · la pantalla: la ventana se abre EN el clic, los mensajes se …
//   R14  el mensaje de la ventana sin chequear origen ni fuente                                       → 22/1 · la pantalla: la ventana se abre EN el clic, los mensajes se …
//   R15  una ventana vista cerrada da la conexión por no hecha                                        → 22/1 · la pantalla: la ventana se abre EN el clic, los mensajes se …
//   R16  sin el canal de la ventana                                                                   → 22/1 · la pantalla: la ventana se abre EN el clic, los mensajes se …
//   R17  la landing manda a cualquier origen                                                          → 22/1 · la landing de la ventana: avisa por opener y por canal, al M…
//   R18  la landing de la ventana con chrome                                                          → 22/1 · la landing de la ventana: avisa por opener y por canal, al M…
//   R19  la ruta sin el chequeo de admin                                                              → 22/1 · la ruta: sólo el admin, las redes del catálogo y los motivos…
//   R20  Chats vuelve al redirect de página entera                                                    → 22/1 · los consumidores usan la MISMA pieza: el modal de Zernio, Au…
//   R21  el bloque «Redes» sin montar                                                                 → 22/1 · los consumidores usan la MISMA pieza: el modal de Zernio, Au…
//   R22  el profile cacheado no se ata a la key                                                       → 22/1 · el servidor: la key es la del negocio, el link nace de una r…
//   R23  el link del login al log                                                                     → 22/1 · el servidor: la key es la del negocio, el link nace de una r…
//   R24  la vuelta consume los parámetros con replaceState(state de la página)                        → 22/1 · la pantalla: sin key se abre EL modal de Zernio de /integrac…
//   R25  reconectarId confirma una cuenta que YA estaba sana                                          → 22/1 · medirConexion: sin la lista de ANTES falla CERRADO; la pista…
//   R26  el servidor no mira de quién es el profile                                                   → 22/1 · el servidor: la key es la del negocio, el link nace de una r…
//   R27  un segundo clic cierra la ventana del primero                                                → 22/1 · la pantalla: la ventana se abre EN el clic, los mensajes se …
//   R28  la vuelta guardada de OTRA red vale                                                          → 22/1 · guardarVuelta / leerVueltaGuardada: la vuelta sólo vale si E…
//   R29  la vuelta guardada no vence                                                                  → 22/1 · guardarVuelta / leerVueltaGuardada: la vuelta sólo vale si E…
//   R30  el aviso de la ventana sin mirar el flujo                                                    → 22/1 · la pantalla: la ventana se abre EN el clic, los mensajes se …
//   R31  la ventana conserva el opener                                                                → 22/1 · la pantalla: la ventana se abre EN el clic, los mensajes se …
//   R32  el ruteo ocupado se informa «ok»                                                             → 22/1 · el servidor: `conexionesViaZernio` sólo LEE (se llama cada 4…
//   R33  el body null tira un 500                                                                     → 22/1 · la ruta: sólo el admin, las redes del catálogo y los motivos…
//   R34  sin keyAca: abre otro modal de Zernio encima                                                 → 22/1 · la pantalla: sin key se abre EL modal de Zernio de /integrac…
//   R35  el 402 del ws1 se le atribuye al negocio                                                     → 22/1 · el servidor: `conexionesViaZernio` sólo LEE (se llama cada 4…
//   R36  el ?ws= de la vuelta siempre null                                                            → 22/1 · el servidor: la key es la del negocio, el link nace de una r…
//   R37  la landing sin el id del flujo                                                               → 22/1 · la landing de la ventana: avisa por opener y por canal, al M…
//   R38  la vuelta decide por `connected` de la URL                                                   → 22/1 · la pantalla: sin key se abre EL modal de Zernio de /integrac…
//   R39  sin el pageshow (bfcache)                                                                    → 22/1 · la pantalla: sin key se abre EL modal de Zernio de /integrac…
//   R40  el texto de la URL se muestra siempre                                                        → 22/1 · retornoDeZernio: lo que trae la URL se acota y se lee como T…
//   R41  las cuentas ocultas cuentan                                                                  → 22/1 · leerCuentasDeZernio: tolerante con el envoltorio y el profil…
//   R42  «sin lista» se lee «sin cuentas»                                                             → 22/1 · tieneListaDeCuentas: una lista vacía es «no hay cuentas»; un…
//   R43  validarVolver deja pasar un ws                                                               → 22/1 · validarVolver: una ruta de la app sí; todo lo que sale de el…
//   R44  conexiones no avisa cuando la respuesta no trae lista                                        → 22/1 · el servidor: `conexionesViaZernio` sólo LEE (se llama cada 4…
//   R45  el error repetido se espera 4 minutos                                                        → 22/1 · la pantalla: la ventana se abre EN el clic, los mensajes se …
//   R46  el error de la ventana pierde el texto de Zernio                                             → 22/1 · la pantalla: la ventana se abre EN el clic, los mensajes se …
// Restaurado: 23 / 0.

test('errorDeVueltaAjena: un error de un login que no salió de esta pestaña SE DICE, con el texto de MaKo y nunca el de la URL', () => {
  // Medido el 25/10/2026: dos clics de Martín no conectaron nada y la pantalla no dijo por qué (se descartaba en silencio).
  const negado = retornoDeZernio('?zernio=metaads&error=meta_ads_authorization_denied');
  assert.equal(errorDeVueltaAjena(negado), textoDeErrorDeRetorno('meta_ads_authorization_denied'));
  const conTexto = retornoDeZernio('?zernio=metaads&error=reconnect_mismatch&error_message=Entra%20a%20evil.example&is_user_fixable=true');
  const dicho = errorDeVueltaAjena(conTexto);
  assert.ok(dicho, 'un error desconocido igual se dice');
  assert.ok(!dicho!.includes('evil'), 'sin lo guardado de esta pestaña, el texto de la URL no se muestra');
  assert.equal(errorDeVueltaAjena(retornoDeZernio('?zernio=metaads&connected=metaads&accountId=acc_000001')), null, 'un éxito ajeno no hace nada');
  assert.equal(errorDeVueltaAjena(retornoDeZernio('?error=access_denied')), null, 'sin la marca de la vuelta no es una vuelta de Zernio');
  // Y la pantalla lo usa en la rama sin lo guardado (antes: `if (!guardada) return;`).
  const fuente = readFileSync(join(import.meta.dirname, '..', 'app', '_components', 'ConectarViaZernio.tsx'), 'utf8');
  assert.match(fuente, /if \(!guardada\) \{[\s\S]{0,300}errorDeVueltaAjena\(ret\)/);
});
