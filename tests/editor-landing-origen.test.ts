// =============================================================================
// editor-landing-origen — las landings en hola-mako.site (tanda 4, 14/10/2026)
// =============================================================================
// Decisión de Martín (14/10/2026): «Las landings enteras, como gamma.site». Una landing publicada vive
// en `https://hola-mako.site/<slug>`; la APP sigue en hola-mako.com; el dominio propio de un cliente,
// como antes. Diseño y hallazgos: docs/diseno-editor-landing.md («Tanda 4») y
// docs/hallazgos-editor-landing.md («Tanda 4: las landings en hola-mako.site y el dominio del cliente»).
//
// Lo que se EJECUTA:
//   · el módulo puro (lib/editor-landing/origen-landings.ts + `tipoDeHost` de dominios-reglas.ts):
//     «¿qué host es?» (app / landings / propio) y «¿a qué ruta interna va este pedido?»;
//   · la base vigente (lib/app-url.ts) con y sin VERCEL_ENV=production, y que TIRA en el navegador;
//   · el PROXY DE VERDAD (`proxy(new NextRequest(...))`) en hola-mako.site, en hola-mako.com y en local;
//   · la configuración de next.config.ts EVALUADA (cada redirección y reescritura con el host de la app)
//     y los patrones de host compilados como los compila Next (`^(…)$`);
//   · el documento publicado: lo que una landing le pide a su PROPIO host (sólo el HTML libre).
// Lo que se LEE como fuente (sin comentarios): que next.config.ts ponga el host a la lista ENTERA, y
// que nadie arme la URL de una landing a mano.
//
// PROBADO ROMPIÉNDOLO: al pie, con números.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { tryToParsePath } from 'next/dist/lib/try-to-parse-path';

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://proyecto.supabase.co';
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'secreto-de-prueba-de-las-landings-0123456789abcdef';

import {
  HOST_LANDINGS, ORIGEN_LANDINGS, RUTA_PAGAR_LANDING, SUBRUTAS_FIJAS, baseLandingsPara, basesLandingsPara, decidirLEnApp, decidirLandings,
  esHostDeLandings, origenDelMismoHost, redireccionEnElHost, slugDeUrlLanding, urlLandingEn, urlVistaEn, type DecisionLandings,
} from '../lib/editor-landing/origen-landings';
import { SEGMENTO_PAGO, productoDeSegmento } from '../lib/editor-landing/pago-landing';
import { RUTA_POST_PAGO } from '../lib/editor-landing/pago-pedido';
import {
  HEADER_DOMINIO, PATRON_HOSTS_DE_LA_APP, PATRON_HOSTS_DE_MAKO, decidirHost, tipoDeHost, urlLandingVigente,
} from '../lib/editor-landing/dominios-reglas';
import { normalizarUrl as normalizarUrlPagina } from '../lib/landing-paginas';
import { normalizarUrl as normalizarUrlAnalisis } from '../lib/landing-url';
import { APP_BASE_URL, baseLandings, basesLandings, urlPublicaLanding, urlVistaLanding } from '../lib/app-url';
import { CABECERAS_HTML_LIBRE, CABECERAS_PAGINA_AFUERA } from '../lib/editor-landing/html-libre';
import { armarDocumento, responderPublico, type LecturaPublica } from '../lib/editor-landing/pagina-publica';
import { htmlDeFragmento } from '../lib/editor-landing/render';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import { NODO, SLUG_RE, SLUGS_RESERVADOS, type JsonNodo } from '../lib/editor-landing/doc';
import { SESSION_COOKIE, crearToken } from '../lib/auth-session';
import { WS_HEADER } from '../lib/ws-tab';
import { config as configProxy, proxy } from '../proxy';
import nextConfig from '../next.config';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TOKEN = 'A'.repeat(21) + '_-' + 'b'.repeat(20); // 43, la forma de `vistaTokenValido`

function conEntorno<T>(valor: string | undefined, f: () => T): T {
  const antes = process.env.VERCEL_ENV;
  if (valor === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = valor;
  try { return f(); } finally { if (antes === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = antes; }
}

// ── 1 · ¿Qué host es? ───────────────────────────────────────────────────────────

test('tipoDeHost: hola-mako.site (y sus subdominios) son las landings; un dominio ajeno, propio; lo demás, la app', () => {
  assert.equal(HOST_LANDINGS, 'hola-mako.site');
  for (const h of ['hola-mako.site', 'HOLA-MAKO.SITE', 'hola-mako.site:443', 'www.hola-mako.site', 'promo.hola-mako.site', 'hola-mako.site.']) {
    assert.equal(tipoDeHost(h), 'landings', h);
  }
  for (const h of ['tunegocio.com', 'promo.tunegocio.com', 'hola-mako.site.evil.tld', 'nohola-mako.site', 'hola-mako.sites']) {
    assert.equal(tipoDeHost(h), 'propio', h);
  }
  for (const h of ['hola-mako.com', 'www.hola-mako.com', 'makodigital.app', 'mako-git-x.vercel.app', 'localhost', 'localhost:3000', '192.168.0.10', '', null, undefined]) {
    assert.equal(tipoDeHost(h), 'app', String(h));
  }
  assert.equal(esHostDeLandings('hola-mako.site'), true);
  assert.equal(esHostDeLandings('xhola-mako.site'), false);
  // El dominio propio no atiende hola-mako.site: lo atiende `decidirLandings` antes.
  assert.deepEqual(decidirHost('hola-mako.site', '/', 'GET'), { tipo: 'app' });
});

// ── 2 · ¿A qué ruta interna va este pedido? (hola-mako.site) ────────────────────

test('decidirLandings: las landings, su borrador y su HTML libre; la raíz manda a MaKo; nada de la app', () => {
  const casos: [string, string, DecisionLandings][] = [
    ['/mi-landing', 'GET', { tipo: 'reescribir', destino: '/l/mi-landing' }],
    ['/mi-landing/gracias', 'HEAD', { tipo: 'reescribir', destino: '/l/mi-landing/gracias' }],
    // `/todo` y `/leads` son slugs válidos: con las redirecciones de next.config SIN host se iban a la app.
    ['/todo', 'GET', { tipo: 'reescribir', destino: '/l/todo' }],
    ['/leads', 'GET', { tipo: 'reescribir', destino: '/l/leads' }],
    [`/vista/${TOKEN}`, 'GET', { tipo: 'reescribir', destino: `/l/vista/${TOKEN}` }],
    [`/vista/${TOKEN}/gracias`, 'GET', { tipo: 'reescribir', destino: `/l/vista/${TOKEN}/gracias` }],
    // Mayúsculas: 308 en el MISMO host (el bloque y el token conservan las suyas: no son slugs).
    ['/Mi-Landing', 'GET', { tipo: 'redirigir', destino: '/mi-landing' }],
    ['/Mi-Landing/Gracias', 'GET', { tipo: 'redirigir', destino: '/mi-landing/gracias' }],
    ['/mi-landing/Gracias', 'GET', { tipo: 'redirigir', destino: '/mi-landing/gracias' }],
    [`/vista/${TOKEN}/Gracias`, 'GET', { tipo: 'redirigir', destino: `/vista/${TOKEN}/gracias` }],
    // La dirección de la app (/l/…) es la de acá sin el /l.
    ['/l/mi-landing/gracias', 'GET', { tipo: 'redirigir', destino: '/mi-landing/gracias' }],
    ['/l', 'GET', { tipo: 'redirigir', destino: '/' }],
    ['/l/', 'GET', { tipo: 'redirigir', destino: '/' }],
    [`/l/vista/${TOKEN}`, 'GET', { tipo: 'redirigir', destino: `/vista/${TOKEN}` }],
    // Lo que queda después de /l se decide como una dirección directa: mayúsculas en UN salto, y
    // nada que no sea una landing. `//evil.com` en una Location es OTRO host (la redirección abierta
    // de la revisión de la tanda 4); `/l/\evil.com` llega al proxy como `/l//evil.com`.
    ['/l/Mi-Landing', 'GET', { tipo: 'redirigir', destino: '/mi-landing' }],
    ['/l/l/mi-landing', 'GET', { tipo: 'redirigir', destino: '/mi-landing' }],
    ['/l//evil.com', 'GET', { tipo: 'no-existe' }],
    ['/l//evil.com/x', 'HEAD', { tipo: 'no-existe' }],
    ['/l/\\evil.com', 'GET', { tipo: 'no-existe' }],
    ['/l/l//evil.com', 'GET', { tipo: 'no-existe' }],
    ['/l/%2F%2Fevil.com', 'GET', { tipo: 'no-existe' }],
    ['/l/api/track/optin', 'GET', { tipo: 'no-existe' }],
    ['/l/crm/12', 'GET', { tipo: 'no-existe' }],
    // Lo que la página le pide a su propio host.
    ['/l/html/12/h1abc', 'GET', { tipo: 'pasar' }],
    ['/l/html/12/h1abc', 'POST', { tipo: 'metodo' }],
    // El paso de pago (integración de la tanda 4): `/<slug>/pagar/<productoId>` se reescribe al paso;
    // el id es el de un PRODUCTO (dígitos, sin ceros adelante). Lo que no tiene esa forma, 404.
    ['/mi-landing/pagar/12', 'GET', { tipo: 'reescribir', destino: '/l/mi-landing/pagar/12' }],
    ['/mi-landing/pagar/12', 'HEAD', { tipo: 'reescribir', destino: '/l/mi-landing/pagar/12' }],
    ['/Mi-Landing/pagar/12', 'GET', { tipo: 'redirigir', destino: '/mi-landing/pagar/12' }],
    ['/l/mi-landing/pagar/12', 'GET', { tipo: 'redirigir', destino: '/mi-landing/pagar/12' }],
    ['/mi-landing/pagar/12', 'POST', { tipo: 'metodo' }],
    ['/mi-landing/pagar/bloque_1-A', 'GET', { tipo: 'no-existe' }],
    ['/mi-landing/pagar/012', 'GET', { tipo: 'no-existe' }],
    ['/mi-landing/pagar/12345678901', 'GET', { tipo: 'no-existe' }],
    ['/Mi-Landing/pagar/AbC', 'GET', { tipo: 'no-existe' }],
    // Su POST, sin Origin (la ruta lo exige y contesta 403): el proxy no decide por ella.
    ['/api/landing-generator/pagar', 'POST', { tipo: 'pasar' }],
    ['/api/landing-generator/pagar', 'GET', { tipo: 'no-existe' }],
    ['/api/landing-generator/pagar/x', 'POST', { tipo: 'no-existe' }],
    ['/l/api/landing-generator/pagar', 'POST', { tipo: 'metodo' }],
    ['/', 'GET', { tipo: 'raiz' }],
    // Nada de /api (el Pixel y /api/track van ABSOLUTOS a hola-mako.com) ni de la app.
    ['/api/track/optin', 'POST', { tipo: 'no-existe' }],
    ['/api/cron/landing', 'GET', { tipo: 'no-existe' }],
    ['/api/landing-generator', 'POST', { tipo: 'no-existe' }],
    ['/api', 'GET', { tipo: 'no-existe' }],
    ['/mi-landing', 'POST', { tipo: 'metodo' }],
    ['/', 'POST', { tipo: 'metodo' }],
    ['/crm/12', 'GET', { tipo: 'no-existe' }],
    ['/mi-landing/otra/cosa', 'GET', { tipo: 'no-existe' }],
    ['/mi-landing/constructor/x', 'GET', { tipo: 'no-existe' }],
    ['/mi-landing/pagar/no vale', 'GET', { tipo: 'no-existe' }],
    ['/mi-landing/pagar/a/b', 'GET', { tipo: 'no-existe' }],
    ['/mi-landing/a/b/c', 'GET', { tipo: 'no-existe' }],
    ['/mi-landing/', 'GET', { tipo: 'no-existe' }],
    ['/vista', 'GET', { tipo: 'no-existe' }],
    ['/vista/corto', 'GET', { tipo: 'no-existe' }],
    ['/html/12/h1abc', 'GET', { tipo: 'no-existe' }],
    ['/ab', 'GET', { tipo: 'no-existe' }],
    ['/robots.txt', 'GET', { tipo: 'no-existe' }],
    ['/_next/static/x.js', 'GET', { tipo: 'no-existe' }],
  ];
  for (const [ruta, metodo, esperado] of casos) assert.deepEqual(decidirLandings(ruta, metodo), esperado, `${metodo} ${ruta}`);
  // Una sub-ruta fija se declara el día que su carpeta existe (`pagar` se declaró antes: revisión de la tanda 4).
  for (const k of Object.keys(SUBRUTAS_FIJAS)) assert.ok(existsSync(join(RAIZ, 'app', 'l', '[slug]', k)), `SUBRUTAS_FIJAS declara «${k}» y no hay app/l/[slug]/${k}`);
  // `pagar` está escrito a mano acá (el proxy no puede importar pago-landing.ts): el MISMO segmento y la
  // MISMA forma del id que el botón y el paso.
  assert.equal(Object.keys(SUBRUTAS_FIJAS).includes(SEGMENTO_PAGO), true, 'el segmento del botón no está en SUBRUTAS_FIJAS');
  for (const id of ['1', '12', '9999999999', '0', '012', '12345678901', '1a', 'abc', '', '-1']) {
    assert.equal(SUBRUTAS_FIJAS[SEGMENTO_PAGO].test(id), productoDeSegmento(id) !== null, `forma del id «${id}»`);
  }
  assert.equal(RUTA_PAGAR_LANDING, RUTA_POST_PAGO, 'adonde postea el paso es lo que el proxy deja pasar');
});

test('el POST del pago en hola-mako.site: pasa SÓLO con un Origin ausente o de ese mismo host', () => {
  const host = 'hola-mako.site';
  const con = (origin: string | null, h = host) => decidirLandings(RUTA_PAGAR_LANDING, 'POST', { origin, host: h });
  for (const o of [null, '', 'https://hola-mako.site', 'https://hola-mako.site/', 'HTTPS://HOLA-MAKO.SITE']) assert.deepEqual(con(o), { tipo: 'pasar' }, String(o));
  for (const o of ['https://evil.com', 'http://hola-mako.site', 'https://hola-mako.site:8443', 'https://hola-mako.site.evil.com', 'https://x.hola-mako.site', 'null', 'https://hola-mako.com']) {
    assert.deepEqual(con(o), { tipo: 'prohibido' }, o);
  }
  assert.deepEqual(con('https://promo.hola-mako.site', 'promo.hola-mako.site'), { tipo: 'pasar' }, 'un subdominio, con el suyo');
  assert.deepEqual(con('https://hola-mako.site', ''), { tipo: 'prohibido' }, 'sin host no hay con qué comparar');
  assert.equal(origenDelMismoHost(undefined, host), true);
});

test('redireccionEnElHost: un 308 nunca sale del host del pedido (`//otro.com` es OTRO host en una Location)', () => {
  assert.equal(redireccionEnElHost('/mi-landing', '?utm_source=fb', 'hola-mako.site'), 'https://hola-mako.site/mi-landing?utm_source=fb');
  assert.equal(redireccionEnElHost('/', '', 'promo.tunegocio.com'), 'https://promo.tunegocio.com/');
  // Raro pero del mismo host: se queda.
  assert.equal(redireccionEnElHost('/%2F%2Fevil.com', '', 'hola-mako.site'), 'https://hola-mako.site/%2F%2Fevil.com');
  for (const d of ['//evil.com', '//evil.com/x', '/\\evil.com', '\\\\evil.com', 'https://evil.com/', 'evil.com', '', '//hola-mako.site.evil.com']) {
    assert.equal(redireccionEnElHost(d, '?a=1', 'hola-mako.site'), null, JSON.stringify(d));
  }
  assert.equal(redireccionEnElHost('/x', '', ''), null, 'sin host no hay a dónde');
});

test('decidirLEnApp: en la app, /l/<…> se muda a hola-mako.site con la query; /l/html deja de servirse', () => {
  assert.deepEqual(decidirLEnApp('/l/mi-landing', '?utm_source=fb&fbclid=1'), { tipo: 'mudar', destino: 'https://hola-mako.site/mi-landing?utm_source=fb&fbclid=1' });
  assert.deepEqual(decidirLEnApp('/l/mi-landing/gracias', ''), { tipo: 'mudar', destino: 'https://hola-mako.site/mi-landing/gracias' });
  assert.deepEqual(decidirLEnApp(`/l/vista/${TOKEN}`, ''), { tipo: 'mudar', destino: `https://hola-mako.site/vista/${TOKEN}` });
  assert.deepEqual(decidirLEnApp('/l', ''), { tipo: 'mudar', destino: 'https://hola-mako.site/' });
  assert.deepEqual(decidirLEnApp('/l/html/12/h1abc', ''), { tipo: 'no-existe' });
  assert.deepEqual(decidirLEnApp('/l/html', ''), { tipo: 'no-existe' });
  for (const p of ['/web-generator', '/landing-generator', '/login', '/', '/lx/a', '/api/l/x']) assert.deepEqual(decidirLEnApp(p, ''), { tipo: 'seguir' }, p);
  // Ida y vuelta: lo que la app manda a hola-mako.site es lo que hola-mako.site reescribe a la MISMA ruta interna.
  for (const interna of ['/l/mi-landing', '/l/mi-landing/gracias', `/l/vista/${TOKEN}/gracias`, '/l/mi-landing/pagar/12']) {
    const d = decidirLEnApp(interna, '');
    assert.equal(d.tipo, 'mudar');
    const u = new URL((d as { destino: string }).destino);
    assert.equal(u.host, HOST_LANDINGS);
    assert.deepEqual(decidirLandings(u.pathname, 'GET'), { tipo: 'reescribir', destino: interna }, interna);
  }
});

// ── 3 · La base y las URLs ──────────────────────────────────────────────────────

test('la base: hola-mako.site en producción, <app>/l en local y en los previews; las dos para reconocer', () => {
  assert.equal(ORIGEN_LANDINGS, 'https://hola-mako.site');
  assert.equal(baseLandingsPara({ produccion: true, appBaseUrl: 'https://hola-mako.com' }), 'https://hola-mako.site');
  assert.equal(baseLandingsPara({ produccion: false, appBaseUrl: 'http://localhost:3000/' }), 'http://localhost:3000/l');
  assert.deepEqual(basesLandingsPara({ produccion: true, appBaseUrl: 'https://hola-mako.com' }), ['https://hola-mako.site', 'https://hola-mako.com/l']);
  assert.deepEqual(basesLandingsPara({ produccion: false, appBaseUrl: 'https://x.vercel.app' }), ['https://x.vercel.app/l']);
  assert.equal(urlLandingEn('https://hola-mako.site/', 'oferta'), 'https://hola-mako.site/oferta');
  assert.equal(urlLandingEn('http://localhost:3000/l', 'oferta', 'gracias'), 'http://localhost:3000/l/oferta/gracias');
  assert.equal(urlVistaEn('https://hola-mako.site', TOKEN), `https://hola-mako.site/vista/${TOKEN}`);
  const bases = ['https://hola-mako.site', 'https://hola-mako.com/l'];
  assert.equal(slugDeUrlLanding('https://hola-mako.site/oferta/gracias?utm=1', bases), 'oferta');
  assert.equal(slugDeUrlLanding('https://www.hola-mako.com/l/oferta', bases), 'oferta');
  assert.equal(slugDeUrlLanding('https://hola-mako.com/oferta', bases), null, 'la app sin /l no es una landing');
  assert.equal(slugDeUrlLanding('https://hola-mako.site/vista', bases), null, 'un reservado no es un slug');
  assert.equal(slugDeUrlLanding('https://otra.com/oferta', bases), null);
  assert.equal(slugDeUrlLanding(null, bases), null);
});

test('urlLandingVigente: la página de antes de la mudanza es la de hoy (para comparar, las DOS puntas)', () => {
  const casos: [string, string][] = [
    ['https://hola-mako.com/l/mi-oferta', 'https://hola-mako.site/mi-oferta'],
    ['https://www.hola-mako.com/l/mi-oferta/gracias?plan=pro', 'https://hola-mako.site/mi-oferta/gracias?plan=pro'],
    ['http://hola-mako.com/l/mi-oferta', 'https://hola-mako.site/mi-oferta'],
    ['https://makodigital.app/l/mi-oferta', 'https://hola-mako.site/mi-oferta'],
  ];
  for (const [vieja, hoy] of casos) assert.equal(urlLandingVigente(vieja), hoy, vieja);
  // Todo lo demás, tal cual: la de hoy, un cliente, local, un preview, el HTML libre, el borrador,
  // mayúsculas, más segmentos, otro puerto, un host parecido, lo que no es una URL.
  for (const igual of [
    'https://hola-mako.site/mi-oferta', 'https://tunegocio.com/l/mi-oferta', 'http://localhost:3000/l/mi-oferta',
    'https://mako-git-x.vercel.app/l/mi-oferta', 'https://hola-mako.com/l/html/12/h1abc', `https://hola-mako.com/l/vista/${TOKEN}`,
    'https://hola-mako.com/l/Mi-Oferta', 'https://hola-mako.com/l/mi-oferta/pagar/b1', 'https://hola-mako.com:8443/l/mi-oferta',
    'https://hola-mako.com.evil.tld/l/mi-oferta', 'https://app.hola-mako.com/l/mi-oferta', 'https://hola-mako.com/crm', 'https://hola-mako.com/l', 'no es una url',
  ]) assert.equal(urlLandingVigente(igual), igual, igual);
  // El caso de la revisión, con los normalizadores DE VERDAD de cada consumidor: la página que el negocio
  // declaró antes de la mudanza (`landing.config`, lib/landing-paginas) y la que manda el Pixel hoy;
  // la URL que analiza el Diagnóstico (lib/landing-url) y una visita medida antes.
  const declarada = normalizarUrlPagina('https://hola-mako.com/l/mi-oferta/gracias');
  const pixelHoy = normalizarUrlPagina('https://hola-mako.site/mi-oferta/gracias?utm_source=fb&fbclid=1');
  assert.ok(declarada && pixelHoy);
  assert.notEqual(declarada, pixelHoy, 'el control: sin traducir no coinciden');
  assert.equal(urlLandingVigente(declarada), urlLandingVigente(pixelHoy));
  assert.equal(urlLandingVigente(normalizarUrlAnalisis('https://www.hola-mako.com/l/mi-oferta/')), urlLandingVigente(normalizarUrlAnalisis('https://hola-mako.site/mi-oferta?utm_source=fb')));
});

test('lib/app-url.ts: la base VIGENTE sale de VERCEL_ENV, y en el navegador tira (ahí no se sabe el entorno)', () => {
  conEntorno('production', () => {
    assert.equal(baseLandings(), 'https://hola-mako.site');
    assert.deepEqual(basesLandings(), ['https://hola-mako.site', `${APP_BASE_URL}/l`]);
    assert.equal(urlPublicaLanding('oferta', 'gracias'), 'https://hola-mako.site/oferta/gracias');
    assert.equal(urlVistaLanding(TOKEN), `https://hola-mako.site/vista/${TOKEN}`);
  });
  for (const env of [undefined, 'preview', 'development']) {
    conEntorno(env, () => {
      assert.equal(baseLandings(), `${APP_BASE_URL}/l`, String(env));
      assert.deepEqual(basesLandings(), [`${APP_BASE_URL}/l`]);
      assert.equal(urlPublicaLanding('oferta'), `${APP_BASE_URL}/l/oferta`);
    });
  }
  const g = globalThis as { window?: unknown };
  g.window = {};
  try {
    assert.throws(() => baseLandings(), /se calcula en el server/);
    assert.throws(() => urlPublicaLanding('oferta'), /se calcula en el server/);
  } finally { delete g.window; }
});

test('la página publicada: canónica y og:url en hola-mako.site; el Pixel sigue ABSOLUTO a hola-mako.com', async () => {
  const lectura: LecturaPublica = {
    workspaceId: 7, titulo: 'Oferta',
    foto: { css: '', fuentes: null, sitio: { ...CONFIG_DEFAULT.sitio }, temaId: null, animaciones: true },
    pagina: { html: '<div class="gm-doc"></div>', titulo: 'Oferta', descripcion: '' },
  };
  const r = await responderPublico(new Request('https://hola-mako.site/l/oferta/gracias'), { tipo: 'pagina', slug: 'oferta', ruta: 'gracias' }, {
    leer: async () => lectura,
    tokenPixel: async () => `mko_${'a1'.repeat(16)}`,
    entorno: { appBaseUrl: 'https://hola-mako.com', prefijoBucket: null, baseLandings: 'https://hola-mako.site' },
  });
  const html = await r.text();
  assert.equal(r.status, 200);
  assert.match(html, /<meta property="og:url" content="https:\/\/hola-mako.site\/oferta\/gracias">/);
  assert.match(html, /<script src="https:\/\/hola-mako.com\/m\.js\?id=mko_/, 'el cargador del Pixel va a la app, no al host de la landing');
  const vista = await responderPublico(new Request(`https://hola-mako.site/l/vista/${TOKEN}`), { tipo: 'vista', token: TOKEN }, {
    leer: async () => lectura,
    entorno: { appBaseUrl: 'https://hola-mako.com', prefijoBucket: null, baseLandings: 'https://hola-mako.site' },
  });
  assert.match(await vista.text(), new RegExp(`<meta property="og:url" content="https://hola-mako.site/vista/${TOKEN}">`));
});

test('lo que una landing publicada le pide a SU host: sólo el HTML libre (ni /_next, ni el Pixel, ni fuentes)', () => {
  // Medición del punto 6 del pedido: antes de bloquear estáticos en un host que no es la app, qué pide
  // de verdad la página. Todo es absoluto (hola-mako.com, Google Fonts, el bucket, Meta) salvo el
  // iframe del «HTML personalizado», relativo a propósito. Lo que el navegador pide SOLO —/favicon.ico
  // si no hay favicon— no está en el documento: queda dicho en los hallazgos.
  const sec: JsonNodo = { type: NODO.tarjeta, attrs: { id: 't1' }, content: [{ type: NODO.htmlLibre, attrs: { id: 'h1abc', html: '<p>hola</p>' } }] };
  const cuerpo = htmlDeFragmento(sec, { modo: 'publico', htmlLibre: { docId: 12 } });
  const prefijo = 'https://proy.supabase.co/storage/v1/object/public/landing-imagenes/';
  const doc = armarDocumento({
    html: cuerpo, workspaceId: 7, modo: 'publico', urlCanonica: 'https://hola-mako.site/oferta',
    config: { ...CONFIG_DEFAULT, sitio: { ...CONFIG_DEFAULT.sitio, favicon: `${prefijo}7/f.png`, metaPixelId: '123456789012345' } },
    fuentes: 'https://fonts.googleapis.com/css2?family=Inter', tokenPixel: `mko_${'a1'.repeat(16)}`,
  }, { appBaseUrl: 'https://hola-mako.com', prefijoBucket: prefijo, baseLandings: 'https://hola-mako.site' });
  const pedidos = [...doc.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.ok(pedidos.length >= 5, `el documento pide ${pedidos.length} cosas: esto no leyó el documento`);
  const relativos = pedidos.filter((u) => !/^(?:https:|data:|#)/.test(u));
  assert.deepEqual(relativos, ['/l/html/12/h1abc'], 'lo único relativo es el HTML libre');
  assert.doesNotMatch(doc, /\/_next\//);
});

// ── 4 · El proxy de verdad ──────────────────────────────────────────────────────

function pedir(url: string, metodo = 'GET', headers: Record<string, string> = {}) {
  const u = new URL(url);
  return proxy(new NextRequest(url, { method: metodo, headers: { host: u.host, ...headers } }));
}
const pasa = (r: Response) => r.headers.get('x-middleware-next') === '1';
const sobrescritas = (r: Response) => (r.headers.get('x-middleware-override-headers') ?? '').split(',').map((s) => s.trim());
// `mfa`: desde el 2FA (14/10/2026) un token de admin sin segundo factor no es una sesión.
const sesionAdmin = () => `${SESSION_COOKIE}=${crearToken({ sub: 'u1', email: 'admin@mako.test', nombre: 'Admin', rol: 'admin', mfa: 'totp' })}`;

test('proxy en hola-mako.site: reescribe a app/l sin el workspace ni el dominio, y NO lee la sesión (en cualquier entorno)', () => {
  for (const env of ['production', undefined]) {
    conEntorno(env, () => {
      const cookie = sesionAdmin();
      // El control: la MISMA sesión en la app SÍ pone el workspace del ?ws= (la cookie es buena).
      const app = pedir('https://hola-mako.com/crm?ws=7', 'GET', { cookie });
      assert.equal(app.headers.get(`x-middleware-request-${WS_HEADER}`), '7', 'el control: en la app la sesión de admin elige el workspace');

      const r = pedir('https://hola-mako.site/mi-landing/gracias?utm_source=fb&ws=7', 'GET', { cookie, [WS_HEADER]: '9', [HEADER_DOMINIO]: 'otro.com' });
      const destino = new URL(r.headers.get('x-middleware-rewrite') ?? 'http://x/');
      assert.equal(destino.pathname, '/l/mi-landing/gracias', String(env));
      assert.equal(destino.searchParams.get('utm_source'), 'fb', 'la query viaja (los utm_* son la atribución)');
      assert.ok(!sobrescritas(r).includes(WS_HEADER), 'el workspace no viaja, ni el que manda el pedido ni el del ?ws=');
      assert.ok(!sobrescritas(r).includes(HEADER_DOMINIO), 'la cabecera del dominio propio no se puede mandar a mano');
      assert.equal(r.headers.get(`x-middleware-request-${WS_HEADER}`), null);

      const html = pedir('https://hola-mako.site/l/html/12/h1abc', 'GET', { [WS_HEADER]: '9' });
      assert.ok(pasa(html), 'el HTML libre pasa');
      assert.ok(!sobrescritas(html).includes(WS_HEADER));
      // El paso de pago se reescribe igual que una página (sin workspace ni dominio).
      const paso = pedir('https://hola-mako.site/mi-landing/pagar/12', 'GET', { cookie, [WS_HEADER]: '9', [HEADER_DOMINIO]: 'otro.com' });
      assert.equal(new URL(paso.headers.get('x-middleware-rewrite') ?? 'http://x/').pathname, '/l/mi-landing/pagar/12');
      assert.ok(!sobrescritas(paso).includes(WS_HEADER) && !sobrescritas(paso).includes(HEADER_DOMINIO));
      // Su POST: con el Origin del host pasa (sin workspace); con el de otro sitio, 403; ningún otro POST.
      const post = pedir('https://hola-mako.site/api/landing-generator/pagar', 'POST', { cookie, origin: 'https://hola-mako.site', [WS_HEADER]: '9' });
      assert.ok(pasa(post), 'el POST del pago con el Origin de hola-mako.site pasa');
      assert.ok(!sobrescritas(post).includes(WS_HEADER), 'el POST del pago no lleva workspace');
      assert.equal(pedir('https://hola-mako.site/api/landing-generator/pagar', 'POST', { origin: 'https://evil.com' }).status, 403, 'con el Origin de otro sitio, 403');
      assert.equal(pedir('https://hola-mako.site/api/landing-generator', 'POST', { cookie, origin: 'https://hola-mako.site' }).status, 404, 'ningún otro POST de /api');
    });
  }
});

test('proxy en hola-mako.site: la raíz a MaKo, mayúsculas y /l/… en el mismo host, y nada de la app', () => {
  const raiz = pedir('https://hola-mako.site/');
  assert.equal(raiz.status, 307);
  assert.equal(raiz.headers.get('location'), 'https://hola-mako.com/');
  const may = pedir('https://hola-mako.site/Mi-Landing?utm_source=fb');
  assert.equal(may.status, 308);
  assert.equal(may.headers.get('location'), 'https://hola-mako.site/mi-landing?utm_source=fb');
  const viejo = pedir('https://hola-mako.site/l/mi-landing?utm_source=fb');
  assert.equal(viejo.status, 308);
  assert.equal(viejo.headers.get('location'), 'https://hola-mako.site/mi-landing?utm_source=fb');
  for (const [u, m, s] of [
    ['https://hola-mako.site/crm/12', 'GET', 404], ['https://hola-mako.site/api/track/optin', 'POST', 404],
    ['https://hola-mako.site/api/cron/landing', 'GET', 404], ['https://hola-mako.site/admin', 'GET', 404],
    ['https://hola-mako.site/mi-landing', 'POST', 405], ['https://hola-mako.site/login?next=/crm', 'GET', 404],
  ] as const) {
    const r = pedir(u, m);
    assert.equal(r.status, s, `${m} ${u}`);
    assert.notEqual(r.headers.get('location'), 'https://hola-mako.com/login', 'nunca el login de la app');
  }
  // `/login` es un slug válido de 5 letras: se reescribe a la landing «login»… que no puede existir (reservado).
  assert.equal(decidirLandings('/login', 'GET').tipo, 'no-existe');
  // La redirección abierta de la revisión: ninguna de estas sale de hola-mako.site (404, sin Location).
  for (const u of ['https://hola-mako.site/l//evil.com', 'https://hola-mako.site/l/\\evil.com', 'https://hola-mako.site/l/l//evil.com', 'https://hola-mako.site//evil.com']) {
    const r = pedir(u);
    assert.equal(r.status, 404, u);
    assert.equal(r.headers.get('location'), null, u);
  }
});

test('proxy en la app: en producción /l/<…> → 308 a hola-mako.site y /l/html → 404; en local, como siempre', () => {
  conEntorno('production', () => {
    const r = pedir('https://hola-mako.com/l/mi-landing/gracias?utm_source=fb');
    assert.equal(r.status, 308);
    assert.equal(r.headers.get('location'), 'https://hola-mako.site/mi-landing/gracias?utm_source=fb');
    const v = pedir(`https://www.hola-mako.com/l/vista/${TOKEN}`);
    assert.equal(v.headers.get('location'), `https://hola-mako.site/vista/${TOKEN}`);
    assert.equal(pedir('https://hola-mako.com/l/html/12/h1abc').status, 404, 'el HTML de un cliente no se sirve bajo hola-mako.com');
    // Un host viejo de MaKo también manda la landing a su lugar (antes que el cartel de mudanza).
    assert.equal(pedir('https://makodigital.app/l/mi-landing').headers.get('location'), 'https://hola-mako.site/mi-landing');
    assert.equal(pedir('https://makodigital.app/crm').status, 410, 'lo demás de un host viejo sigue mudándose');
    // El dominio de un cliente sigue con lo suyo (la ruta interna), no con la mudanza.
    assert.ok(pedir('https://promo.tunegocio.com/').headers.get('x-middleware-rewrite'));
    // La cadena que arrancaba en la app (`/l/l//evil.com` → hola-mako.site/l//evil.com → evil.com):
    // el primer salto queda en hola-mako.site y el segundo es un 404.
    const ida = pedir('https://hola-mako.com/l/l//evil.com');
    const salto = new URL(ida.headers.get('location') ?? 'http://x/');
    assert.equal(salto.host, HOST_LANDINGS);
    const vuelta = pedir(salto.toString());
    assert.equal(vuelta.status, 404);
    assert.equal(vuelta.headers.get('location'), null);
  });
  conEntorno(undefined, () => {
    const local = pedir('http://localhost:3000/l/mi-landing');
    assert.ok(pasa(local), 'en local /l sigue sirviendo');
    assert.ok(pasa(pedir('http://localhost:3000/l/html/12/h1abc')));
  });
  conEntorno('preview', () => assert.ok(pasa(pedir('https://mako-git-x.vercel.app/l/mi-landing')), 'un preview no tiene hola-mako.site'));
});

test('un prefijo que el matcher del proxy saltea no puede ser un slug (en hola-mako.site el slug es el primer segmento)', () => {
  const m = String(configProxy.matcher[0]);
  const ini = m.indexOf('(?!');
  assert.ok(ini > 0, 'no encontré el lookahead del matcher');
  const alternativas = m.slice(ini + 3, m.indexOf('|.*\\.', ini)).split('|');
  const conBarra = alternativas.filter((a) => a.endsWith('/')).map((a) => a.slice(0, -1));
  assert.ok(conBarra.includes('cono-tx') && conBarra.includes('cono-doc'), `leí ${JSON.stringify(alternativas)}: esto no leyó el matcher`);
  for (const a of alternativas) {
    const seg = a.split('/')[0];
    if (SLUG_RE.test(seg)) assert.ok(SLUGS_RESERVADOS.has(seg), `«${seg}» es un slug válido que el proxy no ve: sus páginas no se reescribirían`);
  }
  // Comparar el TEXTO de cada alternativa no ve sus comodines: `favicon.ico` sin escapar dejaba afuera
  // `favicon-ico-promo` (revisión de la tanda 4). Acá el matcher se COMPILA como lo compila Next
  // (`tryToParsePath`, lo mismo que usa `getMiddlewareMatchers`) y se prueba con slugs que se parecen a
  // cada alternativa: todo slug que se puede publicar tiene que pasar por el proxy, con y sin página.
  const re = new RegExp(tryToParsePath(m).regexStr ?? '^$');
  assert.ok(re.test('/mi-landing') && !re.test('/_next/static/x.js') && !re.test('/cono-tx/a.json'), 'el control: esto no compiló el matcher');
  const muestras = new Set(['favicon-ico', 'faviconxico-promo', 'favicon-ico-promo', 'vertical', 'cono-txt', 'cono-docs']);
  for (const a of alternativas) {
    const base = a.replace(/\\/g, '').replace(/\/$/, '');
    for (const s of [base, base.replace(/[^a-z0-9-]/g, '-'), base.replace(/[^a-z0-9-]/g, 'x'), `${base.replace(/[^a-z0-9-]/g, '-')}-promo`, `${base.replace(/[^a-z0-9-]/g, 'x')}x`]) {
      muestras.add(s.replace(/^-+|-+$/g, ''));
    }
  }
  const vistas: string[] = [];
  for (const s of muestras) {
    if (!SLUG_RE.test(s) || SLUGS_RESERVADOS.has(s)) continue;
    vistas.push(s);
    for (const p of [`/${s}`, `/${s}/gracias`]) assert.ok(re.test(p), `«${p}» es una landing que se puede publicar y el proxy no la ve`);
  }
  assert.ok(vistas.includes('favicon-ico') && vistas.length >= 10, `probé ${JSON.stringify(vistas)}`);
});

// ── 5 · next.config.ts ──────────────────────────────────────────────────────────

const compilado = (p: string) => new RegExp(`^${p}$`);

test('los patrones de host: la app (con localhost, IPs y previews) y MaKo (para el HSTS); hola-mako.site en ninguno', () => {
  const app = compilado(PATRON_HOSTS_DE_LA_APP);
  const mako = compilado(PATRON_HOSTS_DE_MAKO);
  for (const h of ['hola-mako.com', 'www.hola-mako.com', 'makodigital.app', 'dashboard-marketing-six.vercel.app', 'mako-git-x-equipo.vercel.app', 'localhost', '127.0.0.1', '192.168.0.10']) {
    assert.ok(app.test(h), `la app: ${h}`);
  }
  for (const h of ['hola-mako.site', 'www.hola-mako.site', 'tunegocio.com', 'promo.tunegocio.com', 'localhost.tunegocio.com', 'hola-mako.com.evil.tld', 'vercel.app.evil.tld', 'evilvercel.app', '1.2.3.4.evil.tld']) {
    assert.equal(app.test(h), false, `no es la app: ${h}`);
  }
  for (const h of ['hola-mako.site', 'localhost', '127.0.0.1', 'mako-git-x.vercel.app']) assert.equal(mako.test(h), false, `sin el HSTS de MaKo: ${h}`);
  assert.ok(mako.test('hola-mako.com'));
  assert.doesNotMatch(PATRON_HOSTS_DE_LA_APP, /\((?!\?:)/, 'sólo grupos sin captura (uno con captura le pone `host` a los parámetros)');
});

test('next.config.ts EVALUADO: cada redirección y reescritura lleva el host de la app; el HSTS, el de MaKo; /l/html, ninguno', async () => {
  const redirects = await nextConfig.redirects!();
  assert.ok(redirects.length >= 10, `hay ${redirects.length} redirecciones: esto no leyó la lista`);
  const esperado = [{ type: 'host', value: PATRON_HOSTS_DE_LA_APP }];
  for (const r of redirects) assert.deepEqual(r.has, esperado, `la redirección ${r.source} corre en cualquier host`);
  const rew = await nextConfig.rewrites!();
  const lista = Array.isArray(rew) ? rew : [...rew.beforeFiles ?? [], ...rew.afterFiles ?? [], ...rew.fallback ?? []];
  assert.ok(lista.length >= 1);
  for (const r of lista) assert.deepEqual(r.has, esperado, `la reescritura ${r.source} corre en cualquier host`);
  // Como las aplica Next: en hola-mako.site y en un dominio de cliente, ninguna; en la app, todas.
  for (const h of ['hola-mako.site', 'tunegocio.com']) assert.equal(redirects.filter((r) => r.has!.every((x) => compilado(x.value!).test(h))).length, 0, h);
  assert.equal(redirects.filter((r) => r.has!.every((x) => compilado(x.value!).test('hola-mako.com'))).length, redirects.length);

  const headers = await nextConfig.headers!();
  const hsts = headers.filter((b) => b.headers.some((h) => h.key === 'Strict-Transport-Security'));
  assert.equal(hsts.length, 1);
  assert.deepEqual(hsts[0].has, [{ type: 'host', value: PATRON_HOSTS_DE_MAKO }]);
  const iGlobal = headers.findIndex((b) => b.source === '/:path*' && !b.has);
  const iHtml = headers.findIndex((b) => b.source === '/l/html/:path*');
  assert.ok(iGlobal >= 0 && iHtml > iGlobal, 'las cabeceras del HTML libre van DESPUÉS del bloque global (gana el último)');
  assert.equal(headers[iHtml].has, undefined, 'el HTML libre se sirve en hola-mako.site y en el dominio del cliente: sin host');
  assert.deepEqual(headers[iHtml].headers, [...CABECERAS_HTML_LIBRE]);
  // La página de afuera con SU política (verificación de la tanda 7: la del bloque deja salir ventanas del sandbox).
  // PROBADO ROMPIÉNDOLO (15/10/2026): el bloque de la página del Diagnóstico de vuelta en CABECERAS_HTML_LIBRE → éste y
  // «next.config.ts pone…» de editor-landing-htmllibre en rojo (106 / 2 los cuatro archivos juntos).
  const iAfuera = headers.findIndex((b) => b.source === '/api/landing-generator/diagnostico/pagina');
  assert.ok(iAfuera > iGlobal, 'la página de afuera va DESPUÉS del bloque global');
  assert.deepEqual(headers[iAfuera].headers, [...CABECERAS_PAGINA_AFUERA]);
});

test('next.config.ts (fuente, sin comentarios): el host se pone a la lista ENTERA, por bloque', () => {
  const cfg = sinComentarios(leer('next.config.ts'));
  assert.match(cfg, /const EN_LA_APP = \[\{ type: 'host' as const, value: PATRON_HOSTS_DE_LA_APP \}\];/);
  assert.match(cfg, /const enLaApp = <T extends object>\(r: T\) => \(\{ \.\.\.r, has: EN_LA_APP \}\);/);
  const bloque = (ini: string, fin: string) => { const i = cfg.indexOf(ini); const j = cfg.indexOf(fin, i); assert.ok(i > 0 && j > i, `no encontré ${ini}`); return cfg.slice(i, j); };
  const red = bloque('async redirects() {', 'async headers() {');
  assert.match(red, /\]\.map\(enLaApp\);\s*\},\s*$/, 'redirects() no termina con .map(enLaApp)');
  assert.equal((red.match(/return \[/g) ?? []).length, 1, 'redirects() tiene un solo return (uno sin el host se escaparía)');
  const rew = bloque('async rewrites() {', 'async redirects() {');
  assert.match(rew, /\]\.map\(enLaApp\);\s*\},\s*$/, 'rewrites() no termina con .map(enLaApp)');
  assert.doesNotMatch(cfg, /beforeFiles|afterFiles|fallback:/, 'una reescritura en otra fase no pasa por enLaApp');
});

// ── 6 · Nadie arma la URL de una landing a mano ─────────────────────────────────

test('la URL pública de una landing sale de UN lugar: nadie usa la ruta interna ni lee el entorno en el navegador', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib', 'proxy.ts'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(archivos.length > 300, `barrí ${archivos.length} archivos: git ls-files no contestó`);
  assert.ok(archivos.includes('lib/editor-landing/origen-landings.ts'), 'git add -N de lo nuevo antes de correr esto');
  const PERMITIDOS_PREFIJO = new Set(['lib/editor-landing/doc.ts', 'lib/editor-landing/origen-landings.ts', 'lib/editor-landing/pagina-publica.ts']);
  const malos: string[] = [];
  for (const f of archivos) {
    let src: string;
    try { src = sinComentarios(leer(f)); } catch { continue; }
    // `rutaInternaL` de doc.ts es la ruta INTERNA (/l/<slug>): sólo el 308 a minúsculas de pagina-publica.
    // `urlPublica` era su nombre antes de la mudanza: una rama vieja que lo importe ya no compila, y acá
    // además se nombra (revisión de la tanda 4: la API de MaKo seguía armando hola-mako.com/l/<slug>).
    // Adentro de lib/editor-landing se importa como './doc': el patrón de afuera no lo ve (medido al romperlo).
    const deDoc = f.startsWith('lib/editor-landing/')
      ? /import\s*\{([^}]*)\}\s*from\s*'(?:[^']*editor-landing\/doc|\.\/doc)'/g
      : /import\s*\{([^}]*)\}\s*from\s*'[^']*editor-landing\/doc'/g;
    for (const [, nombres] of src.matchAll(deDoc)) {
      if (/\burlPublica\b/.test(nombres)) malos.push(`${f}: importa urlPublica (la dirección de antes de la mudanza)`);
      if (/\brutaInternaL\b/.test(nombres) && f !== 'lib/editor-landing/pagina-publica.ts') malos.push(`${f}: importa rutaInternaL`);
    }
    if (/\bPREFIJO_PUBLICO\b/.test(src) && !PERMITIDOS_PREFIJO.has(f)) malos.push(`${f}: arma con PREFIJO_PUBLICO`);
    if (/[`'"]\/l\/(?:\$\{|[`'"]\s*\+)/.test(src)) malos.push(`${f}: arma «/l/…» a mano`);
    if (/hola-mako\.(?:com|site)\/l\/\$\{|hola-mako\.site\/\$\{/.test(src)) malos.push(`${f}: escribe el dominio de las landings a mano`);
    // Un componente cliente no sabe el entorno: la base le llega del server.
    if (/^\s*['"]use client['"]/.test(src) && /\b(?:baseLandings|basesLandings|urlPublicaLanding|urlVistaLanding)\s*\(/.test(src)) malos.push(`${f}: calcula la base en el navegador`);
  }
  assert.deepEqual(malos, []);
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (14/10/2026) con un arnés que rompe UNA cosa por vez en el worktree, corre el
// archivo y restaura DE MEMORIA (sha256 igual después). Base: 14 pass / 0 fail (15 con el del matcher).
//   · decidirLandings sin el corte de /api                   → 12 / 2 «decidirLandings…», «proxy en hola-mako.site: la raíz…»
//   · SUBRUTAS_FIJAS sin hasOwnProperty («constructor»)      → 13 / 1 «decidirLandings…»
//   · decidirLEnApp mudando /l/html en vez del 404           → 12 / 2 «decidirLEnApp…», «proxy en la app…»
//   · esHostDeLandings sólo el apex                           → 13 / 1 «tipoDeHost…»
//   · proxy sin la rama de hola-mako.site                     → 12 / 2 (los dos «proxy en hola-mako.site…»)
//   · respuestaLandings sin borrar el header del workspace    → 13 / 1 «proxy en hola-mako.site: reescribe…»
//   · respuestaLEnApp sin mirar VERCEL_ENV                    → 13 / 1 «proxy en la app…»
//   · las redirecciones sin .map(enLaApp)                     → 12 / 2 «next.config.ts EVALUADO…», «…(fuente, sin comentarios)…»
//   · PATRON_HOSTS_DE_LA_APP sin localhost                    → 13 / 1 «los patrones de host…»
//   · el HSTS con el patrón de la app (localhost con HSTS)    → 13 / 1 «next.config.ts EVALUADO…»
//   · baseLandings sin la guarda del navegador                → 13 / 1 «lib/app-url.ts…»
//   · baseLandings con NODE_ENV en vez de VERCEL_ENV          → 13 / 1 «lib/app-url.ts…»
//   · la canónica armada con la base de la app                → 13 / 1 «la página publicada…»
//   · «Copiar enlace» con `'/l/' + d.slug` (Inicio.tsx)       → 13 / 1 «la URL pública de una landing sale de UN lugar…»
//   · DialogoPublicar ('use client') llamando baseLandings()  → 13 / 1 «la URL pública…»
//   · `cono-doc` fuera de SLUGS_RESERVADOS                    → 14 / 1 «un prefijo que el matcher del proxy saltea…»
// Lo que este archivo NO ve y ven otros: esHostDeMako sin hola-mako.site (14 / 0 acá; 22 / 3 en
// editor-landing-dominios), el prefiltro y urlsAMedir (editor-landing-server), docDeUrl (editor-landing-panel).
//
// PROBADO ROMPIÉNDOLO OTRA VEZ (14/10/2026, los arreglos de la revisión adversarial), con el mismo
// arnés (sha256 igual después de cada una). Base: 17 pass / 0 fail.
//   · `/l/<…>` sin decidir lo que queda (la línea de antes)   → 15 / 2 «decidirLandings…», «proxy en hola-mako.site: la raíz…»
//   · redireccionEnElHost sin comparar el host               → 16 / 1 «redireccionEnElHost…»
//   · las dos juntas (la redirección abierta entera)         → 13 / 4 «decidirLandings…», «redireccionEnElHost…»,
//     «proxy en hola-mako.site: la raíz…», «proxy en la app…» (la cadena `hola-mako.com/l/l//evil.com`)
//     ⚠️ Son dos capas a propósito: con sólo la segunda rota el proxy sigue en 404; con sólo la primera,
//     el 308 queda en hola-mako.site (`/l/l//evil.com` → `/l//evil.com`) y la segunda corta el salto a evil.com.
//   · `favicon.ico` sin escapar en el matcher                → 16 / 1 «un prefijo que el matcher del proxy saltea…»
//     (la versión anterior de ese test, que comparaba el TEXTO de cada alternativa, daba verde con el comodín)
//   · `pagar` de vuelta en SUBRUTAS_FIJAS                     → 16 / 1 «decidirLandings…»
//   · el POST del pago pasando otra vez                       → 15 / 2 «decidirLandings…», «proxy en hola-mako.site: reescribe…»
//   · urlLandingVigente traduciendo cualquier host            → 16 / 1 «urlLandingVigente…»
//   · urlLandingVigente sin sacar el `www.`                   → 16 / 1 «urlLandingVigente…»
//   · pagina-publica importando `urlPublica` desde './doc'    → 16 / 1 «la URL pública…» (con el patrón de antes: 17 / 0,
//     el guard sólo miraba `…editor-landing/doc` y adentro de lib/editor-landing se importa como './doc')
//   · Inicio.tsx importando `urlPublica` / `rutaInternaL`     → 16 / 1 cada una «la URL pública…»
//
// INTEGRACIÓN CON EL PAGO (14/10/2026): `pagar` vuelve a SUBRUTAS_FIJAS (su carpeta ya existe) y el POST
// de /api/landing-generator/pagar pasa en hola-mako.site sólo con un Origin ausente o del mismo host.
// Mismo arnés, corriendo ESTE archivo con tests/editor-landing-pago.test.ts (base 37 / 0):
//   · SUBRUTAS_FIJAS sin `pagar` (como lo dejó la rama dom)   → 32 / 5 (tres acá, dos en el pago)
//   · `pagar` con la forma de un id de bloque                 → 36 / 1 «decidirLandings…»
//   · sin el pase del POST del pago                           → 33 / 4
//   · el POST del pago pasa con cualquier Origin              → 34 / 3
//   · el proxy no le pasa el Origin a decidirLandings         → 35 / 2 «proxy en hola-mako.site: reescribe…» y el recorrido del pago
//   · el proxy sin el caso 'prohibido' (cae al 404)           → 35 / 2 (los mismos)
// =============================================================================
