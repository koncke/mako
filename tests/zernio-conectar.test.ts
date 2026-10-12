// =============================================================================
// Conectar Zernio sin cambiar de tab (duodécima tanda, docs/diseno-duodecima-tanda.md §2.11)
// =============================================================================
// Lo que se vio en la prueba con Fiesta Music (ws10, 12/10/2026): el CRON de Instagram y la tarjeta de Instagram
// contestaban distinto a «¿está conectado?» (el CRON miraba la página de Facebook por Graph; la tarjeta, Zernio,
// que es por donde llegan los eventos), el «Conectar» del CRON mandaba a /integraciones, y una key de Zernio que no
// servía o una cuenta pausada llegaban como «Zernio no contestó».
//
//   1. UNA SOLA VERDAD: `estadoCanalesDisparo` (lib/disparadores-canales.ts) toma Instagram y Messenger de
//      `estadoMedios`, la misma lectura que la tarjeta, Probar y Publicar. Graph se fue.
//   2. SIN KEY O CON KEY MALA, AHÍ MISMO: el modal (`ConectarSocial`, app/automations/ConectarMedio.tsx) pide «API key
//      de Zernio» con «Falta conectar Zernio» y con el 401 de la key propia, la guarda por la puerta de
//      /integraciones y sigue con el OAuth. La tarjeta también ofrece «Conectar» en esos dos casos.
//   3. EL 402 VIAJA COMO 402, con su link de pago (sólo con key PROPIA: el de la plataforma no es del cliente).
//
// Un test no puede importar un módulo `server-only` (el webhook y la ruta se fijan sobre el FUENTE); el modal se
// DIBUJA con renderToStaticMarkup (sin DOM: los efectos no corren) y lo que decide (`leerZernio`) se EJECUTA.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ConectarSocial, leerZernio, pideKeyZernio, ZERNIO_KEY_MALA, ZERNIO_PAUSADA, ZERNIO_SIN_KEY, type EstadoZernio,
} from '../app/automations/ConectarMedio';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));
/** El bloque de `desde` hasta `hasta` (su cierre real), con el largo acotado para no mirar otra cosa. */
function bloque(src: string, desde: string, hasta: string, tope = 4000): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  const b = src.slice(i, j);
  assert.ok(b.length < tope, `el recorte de «${desde}» mide ${b.length}: está mirando otra cosa`);
  return b;
}

const modal = (inicial?: EstadoZernio | null) => renderToStaticMarkup(createElement(ConectarSocial, {
  medio: 'instagram', inicial, onCerrar: () => {}, onConectado: () => {},
}));
const CAMPO_KEY = /<input[^>]*type="password"[^>]*data-zernio-key/;

// ── 1. Una sola verdad de «conectado» ───────────────────────────────────────────────────────

test('el CRON pregunta por Instagram y Messenger a `estadoMedios` (Zernio, la de la tarjeta), no a Graph', () => {
  const dc = fuente('lib/disparadores-canales.ts');
  const cron = bloque(dc, 'export async function estadoCanalesDisparo(', 'export async function estadoMedios(');
  assert.match(cron, /estadoMedios\(\['instagram', 'messenger'\]\)/, 'el CRON no pregunta lo mismo que la tarjeta');
  assert.match(cron, /const instagram: EstadoCanal = medios\.instagram \?\? \{ conectado: null, motivo: MOTIVO_NO_SE \};/);
  assert.match(cron, /const messenger: EstadoCanal = medios\.messenger \?\? \{ conectado: null, motivo: MOTIVO_NO_SE \};/);
  // Ni la página de Facebook ni su cuenta de Instagram: en TODO el archivo, no sólo en la función.
  assert.doesNotMatch(dc, /graph\.facebook\.com|META_PAGE_ID|META_PAGE_ACCESS_TOKEN|instagram_business_account|instagramDeLaPagina/,
    'volvió la segunda verdad (Graph)');
  // Y `estadoMedios` mide Zernio con su tope: lo cuida tests/medios-automatizacion.test.ts.
  assert.match(bloque(dc, 'export async function estadoMedios(', 'export async function medioSinConectar('), /zernioConfigurado\(ws\)/);
});

// ── 2. Sin key o con la key mala: el campo, ahí mismo ───────────────────────────────────────

test('`leerZernio`: sin Zernio y con el 401 de la key propia piden la key; lo demás no', () => {
  // Sin Zernio la ruta contesta `ok: true` y `configurado: false`: no es un fallo de la llamada.
  assert.deepEqual(leerZernio({ ok: true, configurado: false, cuentas: [] }), { estado: 'sin_zernio' });
  assert.deepEqual(leerZernio({ ok: false, motivo: 'key', error: 'x' }), { estado: 'key_mala', error: ZERNIO_KEY_MALA });
  assert.deepEqual(leerZernio({ ok: true, url: 'https://zernio.com/oauth' }), { estado: 'ok', url: 'https://zernio.com/oauth', cuentas: [] });
  assert.deepEqual(leerZernio({ ok: false, error: 'Zernio no contestó' }), { estado: 'error', error: 'Zernio no contestó' });
  assert.deepEqual(leerZernio(null), { estado: 'error', error: 'Sin conexión' });
  assert.equal(pideKeyZernio(leerZernio({ ok: true, configurado: false })), true);
  assert.equal(pideKeyZernio(leerZernio({ ok: false, motivo: 'key' })), true);
  assert.equal(pideKeyZernio(leerZernio({ ok: false, motivo: 'pausada' })), false, 'una cuenta pausada no se arregla con otra key');
  assert.equal(pideKeyZernio(leerZernio({ ok: true, cuentas: [] })), false);
});

test('el modal abre EN el campo «API key de Zernio» con sin Zernio y con la key mala, y diciendo por qué', () => {
  const sin = modal({ estado: 'sin_zernio' });
  assert.match(sin, />API key de Zernio</);
  assert.match(sin, CAMPO_KEY, 'la key es un secreto: va en un campo de contraseña');
  assert.match(sin, new RegExp(`role="alert"[^>]*>${ZERNIO_SIN_KEY}<`));
  const mala = modal({ estado: 'key_mala', error: ZERNIO_KEY_MALA });
  assert.match(mala, CAMPO_KEY);
  assert.match(mala, /Tu key de Zernio no sirve/);
  // Sin la key escrita, «Conectar» no se puede tocar (el campo está vacío al abrir).
  assert.match(mala, /<button[^>]*disabled=""[^>]*>Conectar Instagram<\/button>/);
  // Sin nada que arreglar: el botón de siempre, sin campo.
  for (const html of [modal(), modal({ estado: 'ok', cuentas: [] })]) {
    assert.doesNotMatch(html, /data-zernio-key/);
    assert.match(html, /<button[^>]*>Conectar Instagram<\/button>/);
    assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Conectar Instagram/);
  }
});

test('la key se guarda por la MISMA puerta que /integraciones y recién después se pide el OAuth', () => {
  const cm = fuente('app/automations/ConectarMedio.tsx');
  assert.match(cm, /fetch\('\/api\/integraciones\/credencial', \{/);
  assert.match(cm, /body: JSON\.stringify\(\{ action: 'guardar', servicio: 'zernio', valores: \{ ZERNIO_API_KEY: key \} \}\)/);
  const conectar = bloque(cm, 'const conectar = async () => {', "setFase('esperando');");
  const iVentana = conectar.indexOf("window.open('', 'mako-conectar'");
  const iGuardar = conectar.indexOf('await guardarKeyZernio(k)');
  const iPedir = conectar.indexOf("await pedir('conectar')");
  assert.ok(iVentana >= 0 && iVentana < iGuardar, 'la ventana se abre en el clic, antes de cualquier espera (si no, el navegador la bloquea)');
  assert.ok(iGuardar > 0 && iGuardar < iPedir, 'el OAuth se pide antes de guardar la key');
  // Una key mala que vuelve (401) vuelve a pedir el campo, vacío.
  assert.match(conectar, /if \(pideKeyZernio\(res\)\) \{ setPideKey\(true\); setKey\(''\); \}/);
  // El contrato de la ruta de credenciales: `guardar` con servicio, valores y la whitelist por campo.
  const cred = fuente('app/api/integraciones/credencial/route.ts');
  assert.match(cred, /if \(body\.action === 'guardar'\) \{/);
  assert.match(cred, /return NextResponse\.json\(\{ ok: true, guardadas, servicio: estado \}\);/);
  assert.match(fuente('lib/metodo-catalogo.ts'), /\{ env: 'ZERNIO_API_KEY', label: 'API key de Zernio'/);
});

test('la tarjeta ofrece «Conectar» también sin Zernio y con la key mala, y le pasa al modal lo que ya sabe', () => {
  const ed = fuente('app/automations/EditorMensajeSocial.tsx');
  assert.match(ed, /const v: Cuenta = leerZernio\(j\);/, 'la tarjeta y el modal leen la ruta distinto');
  assert.match(ed, /const puedeConectar = cuenta != null && \(\(cuenta\.estado === 'ok' && !usuario\) \|\| pideKeyZernio\(cuenta\)\);/);
  assert.match(ed, /\{puedeConectar && \(\s*<button type="button" data-conectar-social /);
  assert.match(ed, /<ConectarMedio medio=\{canal\} zernio=\{cuenta\} /);
  // La key mala y la cuenta pausada no se guardan en el caché de la visita: arreglarlas tiene que verse.
  assert.match(ed, /if \(v\.estado === 'ok' \|\| v\.estado === 'sin_zernio'\) cacheCuenta\.set\(/);
  // Y el modal acepta lo que ya se sabe sin romper a quien lo monta sin eso (FlujoLienzo, Probar, Publicar).
  assert.match(fuente('app/automations/ConectarMedio.tsx'), /onConectado, zernio = null \}: \{/);
});

// ── 3. El 402: la cuenta de Zernio del negocio, pausada, con su link de pago ─────────────────

test('el 402 viaja como 402 con su link (sólo con key PROPIA), y la pantalla lo dice con el link', () => {
  const ruta = fuente('app/api/zernio/route.ts');
  const cat = bloque(ruta, '} catch (e) {', "return Response.json({ ok: false, error: 'Zernio no contestó' }, { status });");
  assert.match(cat, /if \(e instanceof ZernioError && \(e\.status === 401 \|\| e\.status === 402\) && \(await usaCuentaPropia\(ws\)\.catch\(\(\) => false\)\)\) \{/,
    'con la key de la plataforma el 402 es de MaKo: su link de pago no es del cliente');
  assert.match(cat, /return Response\.json\(\{ ok: false, motivo: 'pausada', error: ZERNIO_PAUSADA, billingUrl: linkDePago\(e\.body\) \}, \{ status: 402 \}\);/);
  assert.match(cat, /return Response\.json\(\{ ok: false, motivo: 'key', error: ZERNIO_KEY_MALA \}\);/);
  // El link sale del cuerpo del error de Zernio y sólo si es https (va a un href).
  assert.match(bloque(ruta, 'function linkDePago(', '\n}'), /return url && \/\^https:\\\/\\\/\[\^\\s"'<>\]\+\$\/\.test\(url\) \? url : null;/);
  // Los textos de la ruta son los de la pantalla.
  assert.ok(ruta.includes(`const ZERNIO_KEY_MALA = '${ZERNIO_KEY_MALA}';`), 'la ruta y la pantalla dicen distinto la key mala');
  assert.ok(ruta.includes(`const ZERNIO_PAUSADA = '${ZERNIO_PAUSADA}';`), 'la ruta y la pantalla dicen distinto la cuenta pausada');

  const pausada = leerZernio({ ok: false, motivo: 'pausada', error: 'x', billingUrl: 'https://zernio.com/dashboard/billing' });
  assert.deepEqual(pausada, { estado: 'pausada', error: ZERNIO_PAUSADA, pago: 'https://zernio.com/dashboard/billing' });
  // Un link que no es https no llega a un href (un `javascript:` ahí es un XSS).
  assert.deepEqual(leerZernio({ ok: false, motivo: 'pausada', billingUrl: 'javascript:alert(1)' }), { estado: 'pausada', error: ZERNIO_PAUSADA, pago: null });
  const html = modal(pausada);
  assert.match(html, /Tu cuenta de Zernio está pausada/);
  assert.match(html, /<a href="https:\/\/zernio\.com\/dashboard\/billing" target="_blank" rel="noopener noreferrer" data-zernio-pago[^>]*>Pagar en Zernio<\/a>/);
  assert.doesNotMatch(html, /data-zernio-key/, 'una cuenta pausada no se arregla con otra key');
  // La tarjeta: el link de pago en la cabecera.
  assert.match(fuente('app/automations/EditorMensajeSocial.tsx'), /\{cuenta\?\.estado === 'pausada' && cuenta\.pago && \(\s*<a href=\{cuenta\.pago\} target="_blank" rel="noopener noreferrer" data-zernio-pago/);
});

// ── ROTURAS (12/10/2026) ──────────────────────────────────────────────────────────────────────
// Una por vez, con el arnés romper.mjs del scratchpad (wf-duodecima/ig-conectar-filtro: guarda el original en
// memoria, rompe, corre ESTE archivo y restaura comprobando el sha1; nunca git). Base: 6 pass / 0 fail.
//   Z1. el CRON sin `estadoMedios` (Instagram y Messenger, de otra lectura)            → 5 / 1
//   Z2. `leerZernio` sin el 401 (la key mala llega como un error cualquiera)            → 5 / 1
//   Z3. `pideKeyZernio` sólo con «sin Zernio»                                           → 4 / 2
//   Z4. el 402 de vuelta al «Zernio no contestó» (sin su status ni su link)             → 5 / 1
//   Z5. `leerZernio` deja pasar cualquier link de pago (también `javascript:`)          → 5 / 1
//   Z6. la tarjeta ofrece «Conectar» sólo con Zernio conectado y sin cuenta             → 5 / 1
//   Z7. el OAuth se pide ANTES de guardar la key                                        → 5 / 1
// Restaurado: 6 / 0.
