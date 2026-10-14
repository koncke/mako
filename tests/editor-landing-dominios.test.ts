// =============================================================================
// editor-landing-dominios — el dominio propio de una landing (tanda 2, T7)
// =============================================================================
// Pedido de Martín (11/10/2026), punto 10: publicar «con una URL creada por MaKo […] o la opción de
// traer tu dominio». Diseño: docs/diseno-editor-landing.md → T7.
//
// Lo que se EJECUTA: lo puro de lib/editor-landing/dominios-reglas.ts (normalizar y validar, los
// hosts de MaKo, los registros DNS, el veredicto, la decisión por host) y el PROXY DE VERDAD
// (`proxy(new NextRequest(...))`) con VERCEL_ENV=production. Lo que se LEE como fuente (sin
// comentarios): que el único DELETE a Vercel pase por el guard en positivo (lib/editor-landing/
// dominios.ts habla con Vercel y con la base: server-only), y que el CHECK de la migración 0263
// acepte exactamente lo mismo que `DOMINIO_RE`.
//
// Probado ROMPIÉNDOLO (11/10/2026) con scratchpad/t7/roturas.cjs, que rompe UNA regla por vez en una
// COPIA del árbol (proxy.ts lo sirve el dev server compartido: romperlo en el worktree tumbaría la app
// de los otros paquetes). Todo en su lugar: 15 pass / 0 fail. Cada rotura:
//   · decidirHost sin mirar esHostDeMako                         → 13 / 2 «decidirHost…», «los hosts de MaKo…»
//   · decidirHost sin el corte de /api                           → 13 / 2 «decidirHost…», «nada de la app ni de /api»
//   · seguir() sin borrar la cabecera del dominio                → 14 / 1 «…no se puede mandar a mano»
//   · el dominio propio DESPUÉS del cartel de mudanza            → 13 / 2 (los dos del proxy en un dominio de cliente)
//   · el CNAME con el punto final de Vercel                      → 14 / 1 «registros: un subdominio…»
//   · puedeSoltarseDeVercel devolviendo true a cualquier texto   → 14 / 1 «soltar de Vercel…»
//   · quitarDeVercel sin el guard                                → 14 / 1 «el ÚNICO DELETE…»
//   · el CHECK de la 0263 con un TLD de hasta 6 letras           → 14 / 1 «el CHECK de la migración…»
//   · estaVerificado sin el TXT de MaKo                          → 14 / 1 «verificado: las cuatro…»
// Restaurado: 15 / 0.
//
// Revisión de la tanda 2 (12/10/2026): la marca de Vercel, el reclamo pendiente que vence, el HSTS sólo
// en MaKo y la página del dominio atada a su docId. Rotas UNA por vez con un arnés que restaura de
// MEMORIA (sha256 igual después), corriendo este archivo. Base: 25 / 0.
//   · puedeSoltarseDeVercel sin la marca                         → 24 / 1 «soltar de Vercel…»
//   · pendienteVencido con > en vez de >=                         → 24 / 1 «un pendiente vence…»
//   · quitarle el reclamo a un VERIFICADO                         → 24 / 1 «quitarle el dominio…»
//   · un TXT que no se pudo leer (null) cuenta como prueba        → 24 / 1 «quitarle el dominio…»
//   · el tope cuenta los pendientes vencidos                      → 24 / 1 «el tope por negocio…»
//   · el patrón de hosts sin escapar los puntos                   → 24 / 1 «el patrón de los hosts…»
//   · el dominio ocupado sin la salida del TXT                    → 24 / 1 «el dominio ocupado…»
//   · HSTS de vuelta en el bloque global de next.config           → 24 / 1 «next.config.ts: HSTS…»
//   · agregarAVercel sin leer antes (marca sobre lo que ya estaba) → 24 / 1 «agregar a Vercel…»
//   · quitarDominio con la marca siempre en true                  → 24 / 1 «el ÚNICO DELETE…»
//   · reclamar sin el tope                                        → 24 / 1 «el tope por negocio…»
//   · el compare-and-set sin la fecha del reclamo                 → 24 / 1 «el tope por negocio…»
//   · la 0263 sin atar la fecha del reclamo en el CHECK           → 24 / 1 «la 0263 ata las cinco…»
//   · la página del dominio sin comparar el docId                 → 24 / 1 «la página en el dominio…»
// Restaurado: 25 / 0.
//
// Tanda 4 (14/10/2026, hola-mako.site): base 25 / 0. Rota con el arnés de editor-landing-origen:
//   · esHostDeMako sin hola-mako.site                             → 22 / 3 «validar…», «soltar de Vercel…», «los hosts de MaKo…»
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import {
  DOMINIO_RE, HEADER_DOMINIO, PATRON_HOSTS_DE_MAKO, PLAZO_PENDIENTE_MS, RUTA_DOMINIO, TOPE_PENDIENTES, apexDe, decidirHost,
  esHostDeMako, estaVerificado, etiquetaDns, motivoDominioInvalido, motivoParaQuitarReclamo, normalizarDominio,
  pendienteVencido, pendientesVigentes, puedeSoltarseDeVercel, queFalta, registrosDns, textoDominioOcupado,
  type Comprobacion, type EntradaRegistros,
} from '../lib/editor-landing/dominios-reglas';
import { WS_HEADER } from '../lib/ws-tab';
import { proxy } from '../proxy';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── Normalizar y validar ─────────────────────────────────────────────────────────

test('normalizar: lo que se escribe, como un host', () => {
  assert.equal(normalizarDominio('https://Promo.TuNegocio.com/oferta?x=1'), 'promo.tunegocio.com');
  assert.equal(normalizarDominio('  tunegocio.com.  '), 'tunegocio.com');
  assert.equal(normalizarDominio('tunegocio.com:8080'), 'tunegocio.com');
  assert.equal(normalizarDominio('www.tunegocio.com'), 'www.tunegocio.com', 'el www NO se saca: es el subdominio que se carga');
  assert.equal(normalizarDominio('café.com'), 'xn--caf-dma.com', 'acentos → punycode');
  assert.equal(normalizarDominio(''), null);
  assert.equal(normalizarDominio(null), null);
  assert.equal(normalizarDominio('no es un dominio'), null);
});

test('validar: un dominio de cliente sí; MaKo, IPs y basura no', () => {
  for (const d of ['tunegocio.com', 'promo.tunegocio.com', 'www.tunegocio.com.mx', 'xn--caf-dma.com', 'a1-b.co']) {
    assert.equal(motivoDominioInvalido(d), null, d);
  }
  // hola-mako.site (tanda 4): sin esto, un admin lo «conectaba» a su landing (Vercel ya lo tiene).
  for (const d of ['hola-mako.com', 'www.hola-mako.com', 'promo.hola-mako.com', 'makodigital.app', 'www.makodigital.app', 'vercel.app', 'dashboard-marketing-six.vercel.app', 'hola-mako.site', 'www.hola-mako.site', 'promo.hola-mako.site']) {
    assert.equal(motivoDominioInvalido(d), 'Ese dominio es de MaKo', d);
  }
  for (const d of ['localhost', '192.168.0.1', '-malo.com', 'malo-.com', 'a..b.com', '*.tunegocio.com', 'sin-tld', 'x.c']) {
    assert.equal(motivoDominioInvalido(d), 'No es un dominio válido', d);
  }
  assert.equal(motivoDominioInvalido(null), 'Escribe tu dominio');
});

test('el CHECK de la migración 0263 acepta exactamente lo que acepta DOMINIO_RE', () => {
  const sql = leer('supabase/migrations/0263_landing_dominios.sql');
  const m = /dominio ~ '([^']+)'/.exec(sql);
  assert.ok(m, 'no encontré el patrón del CHECK en la 0263');
  const largo = /length\(dominio\) between (\d+) and (\d+)/.exec(sql);
  assert.ok(largo, 'no encontré el tope de largo del CHECK');
  const reSql = new RegExp(m[1]);
  const [min, max] = [Number(largo[1]), Number(largo[2])];
  const casos = [
    'tunegocio.com', 'promo.tunegocio.com', 'www.tunegocio.com.mx', 'xn--caf-dma.com', 'a1-b.co', 'ejemplo.photography',
    'localhost', '192.168.0.1', '-malo.com', 'malo-.com', 'a..b.com', '*.tunegocio.com', 'x.c', 'MAYUS.com',
    `${'a'.repeat(63)}.com`, `${'a'.repeat(64)}.com`, `${'abcd.'.repeat(50)}com`, `${'abcd.'.repeat(51)}com`,
  ];
  for (const c of casos) {
    const enSql = c.length >= min && c.length <= max && reSql.test(c);
    assert.equal(enSql, DOMINIO_RE.test(c), `difieren en «${c.length > 40 ? c.slice(0, 40) + '…' : c}»`);
  }
});

test('soltar de Vercel: sólo un dominio de cliente QUE MAKO AGREGÓ, nunca uno de MaKo (el guard en positivo)', () => {
  for (const d of ['hola-mako.com', 'www.hola-mako.com', 'makodigital.app', 'dashboard-marketing-six.vercel.app', 'hola-mako.site', 'www.hola-mako.site', '', null, undefined, 'localhost']) {
    assert.equal(puedeSoltarseDeVercel(d, true), false, String(d));
  }
  assert.equal(puedeSoltarseDeVercel('promo.tunegocio.com', true), true);
  // Revisión de la tanda 2: lo que ya estaba en el proyecto (un 409, o un dominio de MaKo fuera de la
  // lista) no lleva la marca, y sin la marca no se suelta, por más válido que sea.
  for (const marca of [false, null, undefined]) assert.equal(puedeSoltarseDeVercel('promo.tunegocio.com', marca), false, String(marca));
});

test('el ÚNICO DELETE a Vercel pasa por el guard, con lo que guarda la fila (el dominio y su marca)', () => {
  const src = sinComentarios(leer('lib/editor-landing/dominios.ts'));
  assert.equal((src.match(/method: 'DELETE'/g) ?? []).length, 1, 'un solo DELETE');
  const ini = src.indexOf('async function quitarDeVercel(');
  assert.ok(ini > 0, 'existe quitarDeVercel');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.ok(cuerpo.length > 50 && cuerpo.length < 900, `el recorte mide ${cuerpo.length}`);
  const iGuard = cuerpo.indexOf('if (!puedeSoltarseDeVercel(d, agregadoPorMako)) throw');
  const iDelete = cuerpo.indexOf("method: 'DELETE'");
  assert.ok(iGuard > 0 && iGuard < iDelete, 'el guard va ANTES del DELETE');
  // quitarDominio le pasa la columna de la fila y SU marca, nunca algo del body.
  const q = src.slice(src.indexOf('export async function quitarDominio('));
  assert.match(q.slice(0, 900), /const d = fila\.dominio;/);
  assert.match(q.slice(0, 900), /const marca = fila\.dominio_agregado_por_mako === true;\s*if \(puedeSoltarseDeVercel\(d, marca\)\) await quitarDeVercel\(configVercel\(\), d, marca\);/);
});

test('agregar a Vercel: se LEE antes del POST, y la marca se pone sólo si este pedido lo agregó', () => {
  const src = sinComentarios(leer('lib/editor-landing/dominios.ts'));
  const ini = src.indexOf('async function agregarAVercel(');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.ok(cuerpo.length > 100 && cuerpo.length < 900, `el recorte mide ${cuerpo.length}`);
  const iLee = cuerpo.indexOf('if (await leerEnVercel(c, d)) return false;');
  const iPost = cuerpo.indexOf("method: 'POST'");
  assert.ok(iLee > 0 && iLee < iPost, 'lo que ya estaba en el proyecto no es nuestro: se lee ANTES del POST');
  assert.match(cuerpo, /if \(\(r\.status === 200 \|\| r\.status === 201\) && leerDominioDeProyecto\(r\.json\)\) return true;/);
  assert.match(cuerpo, /if \(r\.status === 409 && \(await leerEnVercel\(c, d\)\)\) return false;/);
  const con = src.slice(src.indexOf('export async function conectarDominio('), src.indexOf('async function reclamar('));
  assert.match(con, /agrego = await agregarAVercel\(c, d\);/);
  assert.match(con, /if \(agrego && !marca\) \{[\s\S]{0,160}?\.update\(\{ dominio_agregado_por_mako: true \}\)/);
  assert.equal((src.match(/dominio_agregado_por_mako: true/g) ?? []).length, 1, 'un solo lugar pone la marca');
});

// ── El reclamo pendiente (revisión de la tanda 2, MEDIA) ─────────────────────────

test('un pendiente vence a las 72 h; sin fecha legible no vence (lo conservador)', () => {
  const ahora = Date.parse('2026-10-12T12:00:00Z');
  assert.equal(PLAZO_PENDIENTE_MS, 72 * 3_600_000);
  assert.equal(pendienteVencido(new Date(ahora - PLAZO_PENDIENTE_MS).toISOString(), ahora), true, 'justo a las 72 h');
  assert.equal(pendienteVencido(new Date(ahora - PLAZO_PENDIENTE_MS + 60_000).toISOString(), ahora), false, 'un minuto antes');
  for (const f of [null, undefined, '', 'ayer']) assert.equal(pendienteVencido(f, ahora), false, String(f));
});

test('quitarle el dominio a otra landing: sólo a un PENDIENTE, vencido o probado con el TXT propio', () => {
  const ahora = Date.parse('2026-10-12T12:00:00Z');
  const viejo = new Date(ahora - PLAZO_PENDIENTE_MS - 1).toISOString();
  const nuevo = new Date(ahora - 3_600_000).toISOString();
  assert.equal(motivoParaQuitarReclamo({ estado: 'pendiente', reclamadoAt: viejo }, ahora, null), 'vencido');
  assert.equal(motivoParaQuitarReclamo({ estado: 'pendiente', reclamadoAt: nuevo }, ahora, true), 'txt');
  for (const txt of [false, null]) assert.equal(motivoParaQuitarReclamo({ estado: 'pendiente', reclamadoAt: nuevo }, ahora, txt), null, `txt ${txt}`);
  // Uno verificado se está sirviendo: no se le quita a nadie, ni vencido ni con el TXT.
  for (const txt of [true, false, null]) assert.equal(motivoParaQuitarReclamo({ estado: 'verificado', reclamadoAt: viejo }, ahora, txt), null);
  assert.equal(motivoParaQuitarReclamo({ estado: null, reclamadoAt: viejo }, ahora, true), null);
});

test('el tope por negocio cuenta los pendientes que todavía reservan (los vencidos y los verificados no)', () => {
  const ahora = Date.parse('2026-10-12T12:00:00Z');
  const nuevo = new Date(ahora - 3_600_000).toISOString();
  const viejo = new Date(ahora - PLAZO_PENDIENTE_MS - 1).toISOString();
  const filas = [
    { dominio_estado: 'pendiente', dominio_reclamado_at: nuevo }, { dominio_estado: 'pendiente', dominio_reclamado_at: nuevo },
    { dominio_estado: 'pendiente', dominio_reclamado_at: viejo }, { dominio_estado: 'verificado', dominio_reclamado_at: nuevo },
    { dominio_estado: null, dominio_reclamado_at: null },
  ];
  assert.equal(pendientesVigentes(filas, ahora), 2);
  assert.equal(TOPE_PENDIENTES, 5);
  // El tope va ANTES de reclamar, y un 23505 sólo se resuelve con el compare-and-set sobre ESE reclamo.
  const src = sinComentarios(leer('lib/editor-landing/dominios.ts'));
  const rec = src.slice(src.indexOf('async function reclamar('), src.indexOf('async function quitarReclamoAjeno('));
  const iTope = rec.indexOf('if (vigentes >= TOPE_PENDIENTES) return falla(');
  const iUpdate = rec.indexOf('.update({ dominio: d,');
  assert.ok(iTope > 0 && iTope < iUpdate, 'el tope antes del reclamo');
  assert.match(rec, /\.update\(\{ dominio: d, dominio_estado: 'pendiente', dominio_verificado_at: null, dominio_reclamado_at: new Date\(\)\.toISOString\(\), dominio_agregado_por_mako: marcaHeredada \}\)/);
  const aj = src.slice(src.indexOf('async function quitarReclamoAjeno('), src.indexOf('export async function quitarDominio('));
  assert.match(aj, /const motivo = motivoParaQuitarReclamo\(/);
  assert.match(aj, /if \(!motivo\) return falla\(textoDominioOcupado\(/);
  assert.match(aj, /update\(SIN_DOMINIO\)\.eq\('id', ajeno\.id\)\.eq\('dominio', d\)\.eq\('dominio_estado', 'pendiente'\)/);
  assert.match(aj, /q\.eq\('dominio_reclamado_at', ajeno\.dominio_reclamado_at\)/);
});

test('el dominio ocupado: a un pendiente se le dice cómo probar que es suyo; a un verificado, no', () => {
  const t = textoDominioOcupado('promo.tunegocio.com', 'pendiente', 'mako-verificacion=abc');
  assert.match(t, /TXT «_mako\.promo» con el valor «mako-verificacion=abc»/);
  assert.equal(textoDominioOcupado('promo.tunegocio.com', 'verificado', 'mako-verificacion=abc'), 'Ese dominio ya está en otra landing.');
});

test('la 0263 ata las cinco columnas en su CHECK, y la marca nace en false', () => {
  const sql = leer('supabase/migrations/0263_landing_dominios.sql').replace(/^--.*$/gm, '');
  assert.match(sql, /add column if not exists dominio_reclamado_at timestamptz/);
  assert.match(sql, /add column if not exists dominio_agregado_por_mako boolean not null default false/);
  assert.match(sql, /\(dominio is null\) = \(dominio_reclamado_at is null\)/);
  assert.match(sql, /\(dominio is not null or not dominio_agregado_por_mako\)/);
  // Lo que deja una landing sin dominio escribe las cinco juntas (si no, el CHECK rechaza la fila).
  const src = sinComentarios(leer('lib/editor-landing/dominios.ts'));
  assert.match(src, /const SIN_DOMINIO = \{ dominio: null, dominio_estado: null, dominio_verificado_at: null, dominio_reclamado_at: null, dominio_agregado_por_mako: false \} as const;/);
  assert.doesNotMatch(src, /update\(\{ dominio: null/, 'nadie limpia a mano una parte de las cinco');
});

// ── HSTS sólo en los hosts de MaKo (revisión de la tanda 2, MEDIA) ───────────────

test('el patrón de los hosts de MaKo (como lo compila Next: ^(…)$, sin puerto)', () => {
  const re = new RegExp(`^${PATRON_HOSTS_DE_MAKO}$`);
  for (const h of ['hola-mako.com', 'www.hola-mako.com', 'promo.hola-mako.com', 'makodigital.app', 'www.makodigital.app']) assert.ok(re.test(h), h);
  for (const h of ['tunegocio.com', 'promo.tunegocio.com', 'hola-mako.com.evil.tld', 'nohola-mako.com', 'hola-makoxcom', 'makodigitalxapp', 'evil.tld/hola-mako.com']) {
    assert.equal(re.test(h), false, h);
  }
  assert.doesNotMatch(PATRON_HOSTS_DE_MAKO, /\((?!\?:)/, 'sólo grupos sin captura');
});

test('next.config.ts: HSTS sólo en el bloque con `has` del host de MaKo, nunca en el global', () => {
  const cfg = sinComentarios(leer('next.config.ts'));
  assert.equal((cfg.match(/Strict-Transport-Security/g) ?? []).length, 1, 'un solo lugar');
  const global = cfg.slice(cfg.indexOf("source: '/:path*'"), cfg.indexOf('],', cfg.indexOf("source: '/:path*'")));
  assert.doesNotMatch(global, /Strict-Transport-Security/);
  assert.match(cfg, /\{\s*source: '\/:path\*',\s*has: \[\{ type: 'host', value: PATRON_HOSTS_DE_MAKO \}\],\s*headers: \[\{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' \}\],\s*\}/);
  assert.match(cfg, /import \{ PATRON_HOSTS_DE_LA_APP, PATRON_HOSTS_DE_MAKO \} from "\.\/lib\/editor-landing\/dominios-reglas";/);
});

test('dominios-reglas.ts sólo importa ./doc y ./origen-landings (lo cargan next.config.ts, proxy.ts y el navegador)', () => {
  const src = sinComentarios(leer('lib/editor-landing/dominios-reglas.ts'));
  assert.deepEqual([...src.matchAll(/^import[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]), ['./doc', './origen-landings']);
  assert.doesNotMatch(src, /server-only|['"]node:|require\(/);
  // Tanda 4: origen-landings.ts entra al arranque de Next por acá; sólo puede traer lo puro.
  const origen = sinComentarios(leer('lib/editor-landing/origen-landings.ts'));
  assert.deepEqual([...origen.matchAll(/^import[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]), ['./doc', './html-libre']);
  assert.doesNotMatch(origen, /server-only|['"]node:|require\(|process\.env/);
});

test('la página en el dominio: sólo la landing de ESE dominio (la caché host → slug no sirve la de otro)', () => {
  const src = sinComentarios(leer('app/api/landing-generator/dominio/route.ts'));
  assert.match(src, /encontrado = await landingDeDominio\(host\);/);
  assert.match(src, /const \{ slug, docId \} = encontrado;/);
  assert.match(src, /if \(!sitio \|\| sitio\.docId !== docId\) return null;/);
});

// ── Los hosts de MaKo y la decisión del proxy ────────────────────────────────────

test('los hosts de MaKo: el canónico, los viejos y los deploys', () => {
  for (const h of ['hola-mako.com', 'www.hola-mako.com', 'makodigital.app', 'dashboard-marketing-six.vercel.app', 'mako-git-x-equipo.vercel.app', 'hola-mako.site', 'www.hola-mako.site']) assert.equal(esHostDeMako(h), true, h);
  for (const h of ['tunegocio.com', 'hola-mako.com.evil.tld', 'nohola-mako.com', 'vercel.app.evil.tld', 'hola-mako.site.evil.tld', 'nohola-mako.site']) assert.equal(esHostDeMako(h), false, h);
});

test('decidirHost: en un dominio de cliente, sólo la landing', () => {
  const D = 'promo.tunegocio.com';
  const casos: [string | null, string, string, ReturnType<typeof decidirHost>][] = [
    ['hola-mako.com', '/crm', 'GET', { tipo: 'app' }],
    ['www.hola-mako.com', '/', 'GET', { tipo: 'app' }],
    ['makodigital.app', '/crm', 'GET', { tipo: 'app' }],
    ['dashboard-marketing-six.vercel.app', '/api/cron/x', 'GET', { tipo: 'app' }],
    ['', '/', 'GET', { tipo: 'app' }],
    [null, '/', 'GET', { tipo: 'app' }],
    ['1.2.3.4', '/', 'GET', { tipo: 'app' }],
    // hola-mako.site (tanda 4) no es de un cliente: medido en producción el 14/10/2026, el proxy lo
    // reescribía a la ruta del dominio propio y contestaba 404 (`X-Matched-Path: /api/landing-generator/dominio`).
    ['hola-mako.site', '/mi-landing', 'GET', { tipo: 'app' }],
    [D, '/', 'GET', { tipo: 'sitio', ruta: '' }],
    [`${D}:443`, '/gracias', 'HEAD', { tipo: 'sitio', ruta: 'gracias' }],
    ['PROMO.TuNegocio.com', '/Gracias', 'GET', { tipo: 'minusculas', destino: '/gracias' }],
    [D, '/crm/12', 'GET', { tipo: 'no-existe' }],
    [D, '/api/track/optin', 'POST', { tipo: 'no-existe' }],
    [D, '/api/cron/landing', 'GET', { tipo: 'no-existe' }],
    [D, '/api/webhooks/meta-leads', 'POST', { tipo: 'no-existe' }],
    [D, '/l/html/12/bloque-1', 'GET', { tipo: 'pasar' }],
    [D, '/l/html/12/bloque-1', 'POST', { tipo: 'metodo' }],
    [D, '/', 'POST', { tipo: 'metodo' }],
    [D, '/l/mi-landing', 'GET', { tipo: 'no-existe' }],
    [D, '/robots.txt', 'GET', { tipo: 'no-existe' }],
    [D, '/ab', 'GET', { tipo: 'no-existe' }],
  ];
  for (const [host, ruta, metodo, esperado] of casos) assert.deepEqual(decidirHost(host, ruta, metodo), esperado, `${host} ${metodo} ${ruta}`);
});

// ── Registros DNS y veredicto ────────────────────────────────────────────────────

const base = (extra: Partial<EntradaRegistros>): EntradaRegistros => ({
  dominio: 'promo.tunegocio.com', valorTxtMako: 'mako-verificacion=abc', apunta: false, vercel: true, mako: null, ...extra,
});

test('registros: un subdominio lleva CNAME (sin el punto final) y el TXT de MaKo con su etiqueta', () => {
  const r = registrosDns(base({ apex: 'tunegocio.com', cname: '2db067c06ef29ee8.vercel-dns-016.com.' }));
  assert.deepEqual(r.map((x) => [x.tipo, x.nombre, x.valor, x.listo]), [
    ['CNAME', 'promo', '2db067c06ef29ee8.vercel-dns-016.com', false],
    ['TXT', '_mako.promo', 'mako-verificacion=abc', null],
  ]);
});

test('registros: la raíz lleva un A por IP, y el TXT de Vercel si lo pide', () => {
  const r = registrosDns(base({
    dominio: 'tunegocio.com', apex: 'tunegocio.com', ipv4: ['216.150.1.1', '216.150.16.1'], vercel: false,
    verificacionVercel: [{ tipo: 'TXT', dominio: '_vercel.tunegocio.com', valor: 'vc-domain-verify=tunegocio.com,123' }],
  }));
  assert.deepEqual(r.map((x) => [x.tipo, x.nombre, x.valor, x.para]), [
    ['A', '@', '216.150.1.1', 'apuntar'],
    ['A', '@', '216.150.16.1', 'apuntar'],
    ['TXT', '_vercel', 'vc-domain-verify=tunegocio.com,123', 'vercel'],
    ['TXT', '_mako', 'mako-verificacion=abc', 'mako'],
  ]);
});

test('registros: sin lo que recomienda Vercel, sus valores genéricos; sin apex, el de segundo nivel', () => {
  const r = registrosDns(base({ dominio: 'promo.tunegocio.com.mx' }));
  assert.deepEqual(r.map((x) => [x.tipo, x.nombre, x.valor]), [['CNAME', 'promo', 'cname.vercel-dns.com'], ['TXT', '_mako.promo', 'mako-verificacion=abc']]);
  const raiz = registrosDns(base({ dominio: 'tunegocio.com' }));
  assert.deepEqual(raiz[0], { tipo: 'A', nombre: '@', valor: '76.76.21.21', listo: false, para: 'apuntar' });
  assert.equal(apexDe('a.b.tunegocio.com.ar'), 'tunegocio.com.ar');
  assert.equal(apexDe('promo.tunegocio.io'), 'tunegocio.io');
  assert.equal(etiquetaDns('tunegocio.com', 'tunegocio.com'), '@');
  assert.equal(etiquetaDns('_mako.a.b.tunegocio.com', 'tunegocio.com'), '_mako.a.b');
});

test('verificado: las cuatro en true estricto; un «no pude leer» no verifica', () => {
  const ok: Comprobacion = { enVercel: true, vercel: true, apunta: true, mako: true };
  assert.equal(estaVerificado(ok), true);
  for (const k of ['vercel', 'apunta', 'mako'] as const) {
    assert.equal(estaVerificado({ ...ok, [k]: null }), false, `${k} null`);
    assert.equal(estaVerificado({ ...ok, [k]: false }), false, `${k} false`);
  }
  assert.equal(estaVerificado({ ...ok, enVercel: false }), false);
});

test('qué falta: una frase, y un verificado no vuelve atrás (sólo avisa)', () => {
  const ok: Comprobacion = { enVercel: true, vercel: true, apunta: true, mako: true };
  assert.equal(queFalta(ok, false), null);
  assert.equal(queFalta({ ...ok, mako: false }, false), 'Faltan registros DNS');
  assert.equal(queFalta({ ...ok, apunta: null }, false), 'No pude leer el DNS');
  assert.equal(queFalta({ ...ok, enVercel: false }, true), 'Hay que conectarlo de nuevo');
  assert.equal(queFalta({ ...ok, apunta: false, mako: null }, true), 'El DNS ya no apunta a MaKo');
  assert.equal(queFalta({ ...ok, mako: null }, true), null, 'verificado: el TXT ya se probó');
});

// ── El proxy de verdad ───────────────────────────────────────────────────────────

function pedir(url: string, metodo = 'GET', headers: Record<string, string> = {}) {
  const u = new URL(url);
  return proxy(new NextRequest(url, { method: metodo, headers: { host: u.host, ...headers } }));
}
const pasa = (r: Response) => r.headers.get('x-middleware-next') === '1';
const sobrescritas = (r: Response) => (r.headers.get('x-middleware-override-headers') ?? '').split(',').map((s) => s.trim());

function enProduccion<T>(f: () => T): T {
  const antes = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = 'production';
  try { return f(); } finally { if (antes === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = antes; }
}

test('proxy: un dominio de cliente se reescribe a la ruta interna, con el dominio puesto por el proxy', () => {
  enProduccion(() => {
    const r = pedir('https://promo.tunegocio.com/gracias?utm_source=fb', 'GET', { [HEADER_DOMINIO]: 'otro-ajeno.com', [WS_HEADER]: '7' });
    const destino = new URL(r.headers.get('x-middleware-rewrite') ?? 'http://x/');
    assert.equal(destino.pathname, RUTA_DOMINIO);
    assert.equal(destino.searchParams.get('ruta'), 'gracias');
    assert.equal(r.headers.get(`x-middleware-request-${HEADER_DOMINIO}`), 'promo.tunegocio.com', 'el dominio lo pone el proxy, pisando el del pedido');
    assert.ok(!sobrescritas(r).includes(WS_HEADER), 'el header del workspace no viaja');

    const inicio = pedir('https://promo.tunegocio.com/');
    assert.equal(new URL(inicio.headers.get('x-middleware-rewrite') ?? 'http://x/').searchParams.get('ruta'), '');
  });
});

test('proxy: en un dominio de cliente, nada de la app ni de /api; el HTML libre pasa', () => {
  enProduccion(() => {
    const may = pedir('https://promo.tunegocio.com/Gracias?utm_source=fb');
    assert.equal(may.status, 308);
    assert.equal(may.headers.get('location'), 'https://promo.tunegocio.com/gracias?utm_source=fb');
    assert.equal(pedir('https://promo.tunegocio.com/crm/12').status, 404);
    assert.equal(pedir('https://promo.tunegocio.com/api/webhooks/meta-leads', 'POST').status, 404, 'tampoco las exentas de la mudanza');
    assert.equal(pedir('https://promo.tunegocio.com/api/cron/landing').status, 404);
    assert.equal(pedir('https://promo.tunegocio.com/', 'POST').status, 405);
    const html = pedir('https://promo.tunegocio.com/l/html/12/bloque-1');
    assert.ok(pasa(html), 'el HTML libre pasa');
    assert.equal(html.headers.get(`x-middleware-request-${HEADER_DOMINIO}`), 'promo.tunegocio.com');
  });
});

test('proxy: los hosts de MaKo siguen como siempre, y la cabecera del dominio no se puede mandar a mano', () => {
  enProduccion(() => {
    assert.equal(pedir('https://makodigital.app/crm').status, 410, 'un dominio viejo de MaKo sigue mudándose');
    assert.equal(pedir('https://dashboard-marketing-six.vercel.app/').status, 410);
    const raiz = pedir('https://hola-mako.com/', 'GET', { [HEADER_DOMINIO]: 'promo.tunegocio.com' });
    assert.ok(pasa(raiz));
    assert.ok(!sobrescritas(raiz).includes(HEADER_DOMINIO), 'seguir() borra la cabecera del dominio');
  });
  // Fuera de producción (preview, local) el proxy no mira el host: como la mudanza.
  const local = pedir('https://promo.tunegocio.com/');
  assert.equal(local.headers.get('x-middleware-rewrite'), null);
});
