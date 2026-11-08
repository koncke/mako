// =============================================================================
// Los TOPES de Instagram y Messenger: no se pierde nada y MaKo lo avisa (Leandro, 28/10/2026)
// =============================================================================
// Leandro (Fiesta Music, ws10), por audio: hace ~500 respuestas a comentarios y ~1.000 DMs por mes; preguntó si hay un límite
// y pidió que MaKo le avise ANTES de que se trabe la automatización, «para no encontrarme con mil mensajes sin responder».
// Topes (el Cerebro, 28/10): Meta, 750 respuestas privadas por hora y por cuenta; Zernio, 60 pedidos por minuto (600 con 3+
// cuentas), con 429, `Retry-After` y `X-RateLimit-Remaining`.
// Fija:
//   · lo puro: el `Retry-After`, qué es un tope (de Zernio o de Meta) y que un tope NO es «Meta no deja» (antes un «muchos
//     pedidos» de Meta caía en `esLimiteDeMeta` y cerraba el hilo: el mensaje se perdía); el resumen y los datos del aviso;
//   · el cableado (leyendo el fuente): los tres envíos (DM, respuesta privada, respuesta pública) miran el tope ANTES que el
//     rechazo, no gastan la privada y vuelven a salir con su espera; el motor junta los topes y avisa UNA vez al final de la
//     corrida (y no más de uno por hora) por el evento de la plataforma `social_tope`, también ANTES del tope de Meta;
//   · el evento: en el catálogo de eventos, de la plataforma, y cada dato que manda el motor existe para su texto.
// Correr: node --import tsx --test tests/tope-social.test.ts
// ROTURAS (28/10/2026, una por vez y restaurada; base 7 / 0): el 429 de Meta como no-tope → 6 / 1; sin los códigos de Meta
// → 6 / 1; cualquier «límite» sin ser de la plataforma → 6 / 1; `esLimiteDeMeta` sin mirar el tope → 6 / 1; la privada mira
// el tope después → 6 / 1; el tope terminal → 6 / 1; el motor no junta los topes → 6 / 1; un aviso por mensaje (sin el
// reclamo) → 6 / 1; el resumen culpa a Zernio → 6 / 1; un dato del aviso sin declarar → 6 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { topeDeError as topeDe, esperaDeRetryAfter, ESPERA_TOPE_META_MS, ESPERA_TOPE_ZERNIO_MS, type ErrorDeZernio } from '../lib/zernio-tope';
import { resumirTopes, datosTopeSocial, textoEspera, cercaDelTopeDeMeta, cuentaMasCargada, TOPE_META_POR_HORA } from '../lib/tope-social';
import { EVENTOS_MAKO } from '../lib/disparadores';
import { AVISOS_SOLO_SUPERADMIN, CATALOGO_AVISOS } from '../lib/avisos-catalogo';
import { VARIABLES_AVISO } from '../lib/variables-aviso';

const RAIZ = join(__dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));
const funcion = (src: string, firma: string) => { const i = src.indexOf(firma); assert.ok(i >= 0, `no encontré ${firma}`); return src.slice(i, src.indexOf('\n}\n', i)); };

/** Un error de Zernio como lo arma `zFetch` (lib/zernio.ts es server-only: se prueba la pieza pura, `topeDeError`). */
const zerr = (status: number, body: Record<string, unknown>, esperaMs: number | null = null): ErrorDeZernio =>
  ({ status, type: typeof body.type === 'string' ? body.type : null, esperaMs, body });

test('el Retry-After: segundos o una fecha; lo que no se entiende, nada', () => {
  assert.equal(esperaDeRetryAfter('30'), 30_000);
  const ahora = Date.parse('2026-10-28T20:00:00Z');
  assert.equal(esperaDeRetryAfter('Wed, 28 Oct 2026 20:02:00 GMT', ahora), 120_000);
  assert.equal(esperaDeRetryAfter('Wed, 28 Oct 2026 19:00:00 GMT', ahora), 0, 'una fecha pasada: ya se puede');
  assert.equal(esperaDeRetryAfter(''), null);
  assert.equal(esperaDeRetryAfter('pronto'), null);
  assert.equal(esperaDeRetryAfter(null), null);
});

test('qué es un tope: el de Zernio, el de Meta, y lo que NO lo es', () => {
  // Zernio: su tope por minuto, con su Retry-After o el minuto.
  assert.deepEqual(topeDe(zerr(429, { error: 'Too many requests' }, 12_000)), { quien: 'zernio', esperaMs: 12_000 });
  assert.deepEqual(topeDe(zerr(429, { error: 'Too many requests' })), { quien: 'zernio', esperaMs: ESPERA_TOPE_ZERNIO_MS });
  // El 429 «upstream platform quota» es el de Meta: una hora.
  assert.deepEqual(topeDe(zerr(429, { error: 'quota exhausted', type: 'platform_error', platform: 'meta' })), { quien: 'meta', esperaMs: ESPERA_TOPE_META_MS });
  // Un error de Meta con código de «muchos pedidos» (613) o que lo dice en palabras.
  assert.equal(topeDe(zerr(400, { type: 'platform_error', platform: 'meta', platformError: { code: 613, message: 'Calls to this api have exceeded the rate limit.' } }))?.quien, 'meta');
  assert.equal(topeDe(zerr(400, { type: 'platform_error', error: 'Application request limit reached' }))?.quien, 'meta');
  // NO: un rechazo de verdad, un error de red, un 403 de permisos.
  assert.equal(topeDe(zerr(400, { type: 'platform_error', platformError: { code: 10, message: 'Permission denied' } })), null);
  assert.equal(topeDe(zerr(403, { error: 'Inbox addon required' })), null);
  // Un «límite» que no es de la plataforma (un 400 de validación de Zernio) tampoco: las palabras solas no alcanzan.
  assert.equal(topeDe(zerr(400, { error: 'Too many requests in the batch payload' })), null);
  // El wrapper de lib/zernio.ts: sólo un ZernioError (un error de red no es un tope).
  assert.match(leer('lib/zernio.ts'), /return e instanceof ZernioError \? topeDeError\(e\) : null;/);
});

test('⚠️ un tope NO es «Meta no deja»: antes cerraba el hilo y el mensaje se perdía', () => {
  // Un «muchos pedidos» de Meta es un 400 `platform_error`: la última regla de `esLimiteDeMeta` lo cerraba.
  assert.ok(topeDe(zerr(400, { type: 'platform_error', platformError: { code: 613 } })));
  const lim = funcion(leer('lib/zernio.ts'), 'export function esLimiteDeMeta(');
  const iTope = lim.indexOf('if (topeDe(e)) return false;');
  assert.ok(iTope > 0 && iTope < lim.indexOf("e.type === 'platform_error'"), 'el tope sale antes de la regla que cierra');
  // Las cabeceras: `zFetch` lee cuánto esperar y cuánto queda.
  const z = leer('lib/zernio.ts');
  assert.match(z, /esperaMs: esperaDeRetryAfter\(res\.headers\.get\('retry-after'\)\)/);
  assert.match(z, /res\.headers\.get\('x-ratelimit-remaining'\)/);
});

test('⚠️ «otra app es la dueña» NO es «Meta no deja»: cerrarlo costó 17 leads (tickets #63 y #64)', () => {
  const z = leer('lib/zernio.ts');
  // La pieza nueva: sólo el código de Meta, y sólo sobre un ZernioError.
  const otra = funcion(z, 'export function esDeOtraApp(');
  assert.match(otra, /e instanceof ZernioError && e\.code === 'not_thread_owner'/);

  // Sale ANTES de la regla que cierra, igual que el tope. Sin esto, el 409 se daba por permanente,
  // la inscripción se cancelaba y para cuando el negocio arreglaba el ajuste ya se había pasado la
  // ventana de 24 h de Meta: 17 de 19 leads quedaron inalcanzables (8/11/2026).
  const lim = funcion(z, 'export function esLimiteDeMeta(');
  const iOtra = lim.indexOf('if (esDeOtraApp(e)) return false;');
  assert.ok(iOtra > 0, 'esLimiteDeMeta tiene que dejar pasar «otra app es la dueña»');
  assert.ok(iOtra < lim.indexOf("e.code === 'not_thread_owner'"), 'sale antes de la regla que cierra');

  // Y el envío lo reintenta en vez de cerrar: los tres catch caen en su backoff, no en `terminal: true`.
  const c = leer('lib/canal-zernio.ts');
  const envio = funcion(c, 'export async function enviarPasoSocial(');
  for (const b of envio.split('} catch (e) {').slice(1)) {
    assert.match(b, /backoffHoras: 4 \}|backoffHoras: reintento \}/, 'el que no es terminal vuelve a salir');
  }
  // ⚠️ Y NO se marca la respuesta privada como gastada: no se gastó, la rechazó el dueño del hilo.
  // Marcarla quemaba para siempre la única privada que Meta da por comentario.
  const privada = envio.split('} catch (e) {')[2] ?? '';
  const iMarca = privada.indexOf('marcarComentarioRespondido');
  assert.ok(iMarca < 0 || privada.slice(0, iMarca).includes('esLimiteDeMeta'),
    'la privada sólo se marca usada cuando Meta DE VERDAD la rechazó');
});

test('el aviso: la corrida resumida, y lo que dice (frenado, cerca, por dónde)', () => {
  assert.equal(resumirTopes([]), null);
  const r = resumirTopes([
    { quien: 'zernio', esperaMs: 30_000, canal: 'instagram' },
    { quien: 'meta', esperaMs: 40 * 60_000, canal: 'instagram' },
    { quien: 'meta', esperaMs: 60 * 60_000, canal: 'instagram' },
  ])!;
  assert.deepEqual(r, { estado: 'frenado', quien: 'meta', canales: ['instagram'], cuantos: 3, esperaMs: 60 * 60_000 }, 'si frenaron los dos, se dice Meta: es el que tarda');
  assert.deepEqual(datosTopeSocial(r), { tope_estado: 'frenado', tope_quien: 'Instagram', tope_canal: 'Instagram', tope_cuantos: '3 mensajes', tope_espera: 'en 1 h', tope_limite: `${TOPE_META_POR_HORA} por hora` });
  const msg = datosTopeSocial({ estado: 'frenado', quien: 'meta', canales: ['messenger'], cuantos: 1, esperaMs: 90_000 });
  assert.equal(msg.tope_quien, 'Facebook', 'por Messenger, el negocio lo conoce como Facebook');
  assert.equal(msg.tope_cuantos, '1 mensaje');
  assert.equal(datosTopeSocial({ estado: 'frenado', quien: 'zernio', canales: ['instagram'], cuantos: 2, esperaMs: 20_000 }).tope_quien, 'Zernio');
  assert.equal(datosTopeSocial({ estado: 'cerca', quien: 'meta', canales: ['instagram'], cuantos: 640, esperaMs: 0 }).tope_cuantos, '640 mensajes en la última hora');
  assert.equal(textoEspera(20_000), 'en 1 min');
  assert.equal(textoEspera(25 * 60_000), 'en 25 min');
  assert.equal(cercaDelTopeDeMeta(599), false);
  assert.equal(cercaDelTopeDeMeta(600), true);
});

test('el envío: el tope se mira ANTES que el rechazo, no gasta la privada y vuelve a salir con su espera', () => {
  const c = leer('lib/canal-zernio.ts');
  const envio = funcion(c, 'export async function enviarPasoSocial(');
  const bloques = envio.split('} catch (e) {').slice(1);
  assert.equal(bloques.length, 3, 'la pública, la privada y los DM');
  for (const b of bloques) {
    const iTope = b.indexOf('const t = topeDe(e);');
    assert.ok(iTope >= 0 && iTope < b.indexOf('esLimiteDeMeta'), 'el tope va antes que «Meta no deja»');
    assert.match(b, /if \(t\) return porTope\(t, \{ salieron(: 0)?, textos(: \[\])?, destino \}, e\);/);
  }
  // La privada: con un tope, sale ANTES de marcarla usada.
  const privada = bloques[1];
  assert.ok(privada.indexOf('if (t) return porTope') < privada.indexOf('marcarComentarioRespondido'));
  assert.match(funcion(c, 'function porTope('), /backoffHoras: Math\.max\(1 \/ 60, t\.esperaMs \/ 3_600_000\), tope: t/);
  assert.doesNotMatch(funcion(c, 'function porTope('), /terminal/, 'un tope nunca es terminal');
});

test('el motor: junta los topes de la corrida y avisa UNA vez al final (y antes del tope de Meta)', () => {
  const n = leer('lib/nutricion.ts');
  assert.match(n, /if \(r\.tope\) topesSociales\.push\(\{ \.\.\.r\.tope, canal: paso\.canal \}\);/);
  const proc = funcion(n, 'export async function procesarEnvios(');
  const iAviso = proc.indexOf('await avisarTopesSociales(wsCorrida, topesSociales, socialesEnviados);');
  assert.ok(iAviso > 0 && iAviso > proc.lastIndexOf('esperaDespuesDeResponder'), 'al final de la corrida');
  const aviso = funcion(n, 'async function avisarTopesSociales(');
  assert.match(aviso, /cercaDelTopeDeMeta\(count \?\? 0\)/);
  // ⚠️ Y POR CUENTA (la verificación de 69b49a31c): la suma del negocio sólo decide si vale la pena mirar.
  assert.match(aviso, /const mas = cuentaMasCargada\(deLeads, \(leadId, canal\) => \{\s*const f = convs\.get\(leadId\)\?\.\[canal\];\s*return f \? conversacionDeFila\(f\)\.cuentaId : null;\s*\}\);/);
  assert.match(aviso, /if \(!mas \|\| !cercaDelTopeDeMeta\(mas\.cuantos\)\) return;\s*resumen = \{ estado: 'cerca', quien: 'meta', canales: \[mas\.canal\], cuantos: mas\.cuantos, esperaMs: 0 \};/);
  assert.doesNotMatch(aviso, /canales: \['instagram'\], cuantos: count/, 'ni la suma del negocio ni Instagram fijo');
  assert.match(aviso, /reclamarEspaciado\(ws, 'social-tope', VENTANA_AVISO_TOPE_MIN, resumen\.estado\)/, 'uno por estado y por hora');
  assert.match(aviso, /emitirEventoDePlataforma\('social-tope', \{ ws, datos: datosTopeSocial\(resumen\) \}\)/);
});

test('el evento: de la plataforma, sólo SuperAdmin, y cada dato que manda el motor tiene su lugar en el texto', () => {
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === 'social_tope');
  assert.ok(ev && ev.aviso === 'social-tope' && ev.plataforma === true && ev.trae.includes('tope'));
  assert.ok(AVISOS_SOLO_SUPERADMIN.includes('social-tope'));
  assert.ok(CATALOGO_AVISOS.some((a) => a.id === 'social-tope'));
  const declarados = new Set(VARIABLES_AVISO.filter((v) => v.alcance === 'tope').map((v) => v.key));
  for (const k of Object.keys(datosTopeSocial({ estado: 'frenado', quien: 'meta', canales: ['instagram'], cuantos: 1, esperaMs: 1 }))) {
    assert.ok(declarados.has(k), `{{${k}}} lo manda el motor y no está entre los datos del aviso`);
  }
});

// [baja] El «cerca» sumaba el negocio entero (la verificación del Cerebro sobre 69b49a31c, 29/10/2026): Leandro con sus dos
// cuentas a 320 cada una daba 640 y un falso «te estás acercando»; y un negocio sólo de Messenger recibía «Instagram».
test('el «cerca» es por cuenta, y dice el canal de esa cuenta', () => {
  const envios = (n: number, canal: 'instagram' | 'messenger', desde: number) => Array.from({ length: n }, (_, i) => ({ leadId: desde + i, canal }));
  const dosCuentas = [...envios(320, 'instagram', 1), ...envios(320, 'instagram', 1001)];
  const cuentaDe = (leadId: number) => (leadId > 1000 ? 'acc_leila' : 'acc_fiesta');
  const mas = cuentaMasCargada(dosCuentas, cuentaDe)!;
  assert.equal(mas.cuantos, 320);
  assert.equal(cercaDelTopeDeMeta(mas.cuantos), false, 'ninguna de las dos se acerca a su tope');
  const una = cuentaMasCargada([...envios(610, 'instagram', 1), ...envios(30, 'instagram', 1001)], cuentaDe)!;
  assert.deepEqual(una, { canal: 'instagram', cuenta: 'acc_fiesta', cuantos: 610 });
  const msn = cuentaMasCargada(envios(650, 'messenger', 1), () => 'pag_1')!;
  assert.equal(msn.canal, 'messenger');
  const d = datosTopeSocial({ estado: 'cerca', quien: 'meta', canales: [msn.canal], cuantos: msn.cuantos, esperaMs: 0 });
  assert.equal(d.tope_canal, 'Messenger');
  assert.equal(d.tope_quien, 'Facebook');
  // La misma cuenta por Instagram y por Messenger son dos topes: no se suman.
  assert.equal(cuentaMasCargada([...envios(300, 'instagram', 1), ...envios(300, 'messenger', 1)], () => 'acc')!.cuantos, 300);
  assert.equal(cuentaMasCargada([], () => null), null);
  // El texto del aviso dice el canal, no «Instagram» fijo.
  const P = leer('lib/plantillas-automatizaciones.ts');
  assert.match(P, /mako\('st_cerca_mk', '⚠️ \*Te estás acercando al tope de \{\{tope_canal\}\}\*/);
});
