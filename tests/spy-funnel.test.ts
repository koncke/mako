// =============================================================================
// Competitors Spy: píxeles, checkout y video de la web de un competidor (3/11/2026)
// =============================================================================
// Los fragmentos de abajo son la forma en que cada proveedor pide instalar lo suyo, con ids inventados.
// Lo que cuida este archivo, en orden de cuánto cuesta equivocarse:
//   1. un id escrito en un texto no es un píxel: un tutorial no puede llenar la ficha de datos falsos;
//   2. la lectura de un lector no borra lo que vio el otro;
//   3. lo que llega a un `href` es siempre `https://`;
//   4. `HOSTS_VIDEO` no se toca, porque es el flujo del Pixel de los clientes.
//
// Verificado rompiéndolo el 3/11/2026 (ver cada test): sacar `sinLoQueNoCorre`, sacar `esRelleno`, hacer
// que `conLectura` pise todo y aflojar el `https://` de `lecturaDe` dan 1 fallo cada uno.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RE_CHECKOUT } from '../lib/landing-conversion';
import { analizarHtml, HOSTS_VIDEO } from '../lib/landing-analisis';
import {
  conLectura, enlaceSusAnuncios, funnelDeFila, funnelDeLasPaginas, funnelEnPalabras, funnelUnido, leerFunnel, piezasDeVideoEn, type LecturaFunnel,
} from '../lib/spy-funnel';

const ids = (l: LecturaFunnel, p: string) => l.pixeles.find((x) => x.proveedor === p)?.ids;
const hay = (l: LecturaFunnel, p: string) => l.pixeles.some((x) => x.proveedor === p);
const leer = (repo: string) => readFileSync(new URL(`../${repo}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('cada píxel se lee de la forma en que el proveedor pide instalarlo', () => {
  const l = leerFunnel({
    html: `<html><head>
      <script>!function(f,b,e,v){}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '1869323014511830');fbq('track','PageView');</script>
      <noscript><img src="https://www.facebook.com/tr?id=2222333344445555&ev=PageView&noscript=1"/></noscript>
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-AB12CD34EF"></script>
      <script>gtag('config', 'AW-16543210987');</script>
      <script>(function(w,d,s,l,i){})(window,document,'script','dataLayer','GTM-K7P2QXL');</script>
      <script>ttq.load('CABCDEFGH1234567890I');</script>
      <script>window._tfa=window._tfa||[];window._tfa.push({notify:'event',name:'page_view',id:1654321});</script>
    </head></html>`,
  });
  assert.deepEqual(ids(l, 'meta')?.sort(), ['1869323014511830', '2222333344445555']);
  assert.deepEqual(ids(l, 'ga4'), ['G-AB12CD34EF']);
  assert.deepEqual(ids(l, 'google-ads'), ['AW-16543210987']);
  assert.deepEqual(ids(l, 'gtm'), ['GTM-K7P2QXL']);
  assert.deepEqual(ids(l, 'tiktok'), ['CABCDEFGH1234567890I']);
  assert.deepEqual(ids(l, 'taboola'), ['1654321']);
});

test('lo que vio el navegador se lee con los mismos patrones: las direcciones que cargó', () => {
  const l = leerFunnel({
    html: [
      'https://www.googletagmanager.com/gtm.js?l=dl&id=GTM-AAAA111',
      'https://connect.facebook.net/signals/config/987654321098765',
      'https://www.google-analytics.com/g/collect?tid=G-ZZ99YY88XX',
      'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/765432109/',
      'https://www.google.com/ccm/collect?tid=AW-112233445',
      'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CTIKTOK1234567890AB',
      'https://cdn.taboola.com/libtrc/unip/1777777/tfa.js',
    ].join('\n'),
  });
  assert.deepEqual(ids(l, 'gtm'), ['GTM-AAAA111']);
  assert.deepEqual(ids(l, 'meta'), ['987654321098765']);
  assert.deepEqual(ids(l, 'ga4'), ['G-ZZ99YY88XX']);
  assert.deepEqual(ids(l, 'google-ads')?.sort(), ['AW-112233445', 'AW-765432109']);
  assert.deepEqual(ids(l, 'tiktok'), ['CTIKTOK1234567890AB']);
  assert.deepEqual(ids(l, 'taboola'), ['1777777']);
});

test('se ve que carga el píxel aunque no se vea la cuenta: es «lo tiene», no «no lo tiene»', () => {
  const l = leerFunnel({ html: '<script src="https://connect.facebook.net/en_US/fbevents.js"></script>' });
  assert.deepEqual(l.pixeles, [{ proveedor: 'meta', ids: [] }]);
});

test('un id escrito en un texto no es un píxel', () => {
  // Una página que ENSEÑA a instalar un píxel. Verificado sacando `sinLoQueNoCorre`: 1 fallo.
  const tutorial = leerFunnel({
    html: `<article><pre>fbq('init', '555566667777888');</pre>
      <code>gtag('config', 'G-QW12ER34TY');</code>
      <!-- <script>ttq.load('CCOMENTADO1234567890');</script> -->
      <p>El id se ve así: GTM-ABC1234 o G-ABC123456, y el de Google Ads, AW-123123123.</p>
      <textarea>'dataLayer','GTM-TEXTAREA1'</textarea></article>`,
  });
  assert.deepEqual(tutorial.pixeles, []);

  // El relleno de una plantilla sin configurar. Verificado sacando `esRelleno`: 1 fallo.
  const relleno = leerFunnel({
    html: `<script>fbq('init', '000000000000000');fbq('init', '123456789012');gtag('config','G-XXXXXXXXXX');
      (function(){})(window,document,'script','dataLayer','GTM-XXXXXX');gtag('config','AW-1234567890');</script>`,
  });
  assert.deepEqual(relleno.pixeles, []);

  // El widget de quien PUBLICA notas de Taboola no es el píxel de quien anuncia.
  assert.equal(hay(leerFunnel({ html: '<script src="https://cdn.taboola.com/libtrc/unsitio/loader.js"></script>' }), 'taboola'), false);
});

test('el checkout pide el camino, y se guarda sin la consulta', () => {
  const l = leerFunnel({
    html: `<a href="https://pay.hotmart.com/A123456B?off=abc&email=alguien@correo.com">Comprar</a>
      <a href="https://buy.stripe.com/test_abc123">Pagar</a>
      <a href="https://otro.com/pay.hotmart.com/NOES">no</a>
      <a href="https://hotmart.com">solo el dominio</a>`,
  });
  assert.deepEqual(l.checkouts, [
    { nombre: 'Stripe', url: 'https://buy.stripe.com/test_abc123' },
    { nombre: 'Hotmart', url: 'https://pay.hotmart.com/A123456B' },
  ]);
  assert.doesNotMatch(JSON.stringify(l), /alguien@correo/);
});

test('el checkout se lee también escapado: así viene en un __NEXT_DATA__ o en un bundle', () => {
  const l = leerFunnel({ html: '<script>{"href":"https:\\/\\/pay.kiwify.com.br\\/AbC123"}</script>', bundle: 'x="https:\\u002F\\u002Fmpago.la\\u002F1a2b3c"' });
  assert.deepEqual(l.checkouts.map((c) => c.url).sort(), ['https://mpago.la/1a2b3c', 'https://pay.kiwify.com.br/AbC123']);
});

test('todo host que el Pixel reconoce como checkout, Spy también', () => {
  // Si `RE_CHECKOUT` suma una pasarela y acá no, el mismo sitio «cobra» en una pantalla y en la otra no.
  for (const u of ['https://buy.stripe.com/a1', 'https://checkout.stripe.com/c/pay/a1', 'https://pay.hotmart.com/A1', 'https://mpago.la/a1', 'https://link.mercadopago.com/a1', 'https://link.mercadopago.com.ar/a1', 'https://www.mercadopago.com.mx/checkout/v1/a1']) {
    assert.match(u, RE_CHECKOUT, `${u} ya no es un checkout para el Pixel: actualizá la lista`);
    assert.equal(leerFunnel({ html: `<a href="${u}">x</a>` }).checkouts.length, 1, u);
  }
});

test('VTurb y Vidalytics se ven en su embed, que vive adentro de un <script>', () => {
  const vturb = leerFunnel({ html: `<vturb-smartplayer id="vid-1"></vturb-smartplayer><script>var s=document.createElement("script");s.src="https://scripts.converteai.net/abc/players/def/v4/player.js";</script>` });
  assert.deepEqual(vturb.videos, ['VTurb']);
  const vida = leerFunnel({ html: `<div id="vidalytics_embed_XyZ"></div><script>(function(){ var u='https://fast.vidalytics.com/embeds/a/b/'; })();</script>` });
  assert.deepEqual(vida.videos, ['Vidalytics']);
});

test('los videos que ya se conocen salen de las piezas del analizador, con su nombre corto', () => {
  const html = '<iframe src="https://player-vz-abc.tv.pandavideo.com.br/embed/?v=1"></iframe><video src="a.mp4"></video>';
  const piezas = [...analizarHtml('https://x.com', html).piezas];
  assert.deepEqual(leerFunnel({ html, piezas }).videos.sort(), ['Panda', 'Video propio']);
});

test('en el navegador, lo cargado dice qué video hay sin pasar por el analizador', () => {
  assert.deepEqual(piezasDeVideoEn('https://player.vimeo.com/video/1\nhttps://fast.wistia.net/embed/x').sort(), ['video-vimeo', 'video-wistia']);
  assert.deepEqual(piezasDeVideoEn('https://ejemplo.com/app.js'), []);
});

test('HOSTS_VIDEO no se toca para esto: sumarle un host le manda avisos falsos a los clientes', () => {
  assert.equal(HOSTS_VIDEO.some((h) => /vturb|vidalytics|converteai/i.test(`${h.reHtml} ${h.reBundle} ${h.nombre}`)), false);
});

test('el Pixel de MaKo no se delata: un competidor con nuestro código no sale con nada', () => {
  const s = leer('lib/landing-token.ts');
  const desde = s.indexOf('return `<script>');
  assert.ok(desde > 0, 'no encontré el template del snippet');
  const snippet = s.slice(desde + 8, s.indexOf('</script>`;', desde) + 9);
  const l = leerFunnel({ html: snippet });
  assert.deepEqual({ pixeles: l.pixeles, checkouts: l.checkouts, videos: l.videos }, { pixeles: [], checkouts: [], videos: [] });
});

test('una lectura no borra lo que vio el otro lector', () => {
  // El servidor no ve lo que carga Tag Manager; el navegador no ve lo que frena un bloqueador.
  // Verificado haciendo que `conLectura` pise el otro lugar: 1 fallo.
  const delServidor = leerFunnel({ html: `<script>fbq('init','111122223333');</script><a href="https://pay.hotmart.com/A1">x</a>`, ahora: new Date('2026-11-01') });
  const delNavegador = leerFunnel({ html: 'https://www.google-analytics.com/g/collect?tid=G-AB12CD34EF', ahora: new Date('2026-11-02') });
  const f = conLectura(conLectura(null, 'navegador', delNavegador), 'pagina', delServidor);
  assert.deepEqual(f.navegador, delNavegador);
  const u = funnelUnido(f);
  assert.deepEqual(u.pixeles.map((p) => p.proveedor), ['meta', 'ga4'], 'en orden fijo');
  assert.equal(u.checkouts.length, 1);
  // Y la misma lectura sí reemplaza a la suya: un píxel que sacó no tiene que quedar para siempre.
  const otraVez = conLectura(f, 'pagina', leerFunnel({ html: '<p>hola</p>' }));
  assert.deepEqual(funnelUnido(otraVez).pixeles.map((p) => p.proveedor), ['ga4']);
});

test('varias páginas guardadas se dibujan juntas, y se sabe si ya miró un navegador', () => {
  assert.equal(funnelDeLasPaginas([null, undefined, {}]), null, 'ninguna leída no es «no tiene nada»');
  const vsl = conLectura(null, 'pagina', leerFunnel({ html: `<script>fbq('init','111122223333');</script>` }));
  const venta = conLectura(null, 'navegador', leerFunnel({ html: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123', piezas: ['video-vimeo'] }));
  const u = funnelDeLasPaginas([vsl, null, venta]);
  assert.deepEqual(u?.pixeles.map((p) => p.proveedor), ['meta', 'gtm']);
  assert.deepEqual(u?.videos, ['Vimeo']);
  assert.equal(u?.vioElNavegador, true);
  assert.equal(funnelDeLasPaginas([vsl])?.vioElNavegador, false);
});

test('la columna se lee sin creerle: nada de lo que sale de acá puede ejecutarse en un href', () => {
  assert.equal(funnelDeFila(null), null);
  assert.equal(funnelDeFila('algo'), null);
  assert.equal(funnelDeFila({ otra: 1 }), null);
  const f = funnelDeFila({
    pagina: {
      pixeles: [{ proveedor: 'meta', ids: ['1', 2] }, { proveedor: 'inventado', ids: ['x'] }],
      checkouts: [{ nombre: 'Mala', url: 'javascript:alert(1)' }, { nombre: 'Http', url: 'http://x.com/a' }, { nombre: 'Buena', url: 'https://x.com/a' }],
      videos: ['VTurb', 3],
    },
  });
  // Verificado aflojando el `https://`: 1 fallo.
  assert.deepEqual(f?.pagina?.checkouts, [{ nombre: 'Buena', url: 'https://x.com/a' }]);
  assert.deepEqual(f?.pagina?.pixeles, [{ proveedor: 'meta', ids: ['1'] }]);
  assert.deepEqual(f?.pagina?.videos, ['VTurb']);
  assert.equal(f?.navegador, null);
});

test('en palabras, para MaKo: sin líneas vacías', () => {
  const f = conLectura(null, 'pagina', leerFunnel({ html: `<script>fbq('init','111122223333');</script><a href="https://pay.hotmart.com/A1">x</a>`, piezas: ['video-vimeo'] }));
  assert.deepEqual(funnelEnPalabras(f), ['Píxeles: Meta (111122223333)', 'Cobra con: Hotmart', 'Video: Vimeo']);
  assert.deepEqual(funnelEnPalabras(conLectura(null, 'pagina', leerFunnel({ html: '' }))), []);
});

test('«Ver sus anuncios» va a su Página si la sabemos, y si no, busca su dominio', () => {
  const conPagina = new URL(enlaceSusAnuncios({ pagina_anuncios: '123456789', landing_url: 'https://www.ejemplo.com/x', pais: 'ar' }));
  assert.equal(conPagina.searchParams.get('view_all_page_id'), '123456789');
  assert.equal(conPagina.searchParams.get('search_type'), 'page');
  assert.equal(conPagina.searchParams.get('country'), 'AR');
  const conDominio = new URL(enlaceSusAnuncios({ landing_url: 'https://www.ejemplo.com/x' }));
  // Medido: sin la frase exacta, un dominio se parte en dos palabras y trae ~24.000 anuncios de cualquiera.
  assert.equal(conDominio.searchParams.get('q'), '"ejemplo.com"');
  assert.equal(conDominio.searchParams.get('search_type'), 'keyword_exact_phrase');
  assert.equal(conDominio.searchParams.get('country'), 'ALL', 'sin país no se adivina: un país equivocado da una lista vacía');
  assert.equal(new URL(enlaceSusAnuncios({ nombre: 'Sofía Contreras' })).searchParams.get('q'), '"Sofía Contreras"');
  // `pagina_anuncios` también puede ser un nombre viejo: eso no va como id.
  assert.equal(new URL(enlaceSusAnuncios({ pagina_anuncios: 'Su Página', nombre: 'X' })).searchParams.get('view_all_page_id'), null);
});

test('la columna es propia y sólo agrega: `etiquetas` la poda a los 30 días', () => {
  const sql = leer('supabase/migrations/0373_spy_funnel.sql').replace(/--.*$/gm, '');
  assert.match(sql, /add column if not exists funnel jsonb/);
  assert.doesNotMatch(sql, /\bdrop\b|\bupdate\b|\bdelete\b|\btruncate\b/i);
});

test('mirarCompetidor lo guarda sólo después de una lectura buena, y un fallo no se lleva las piezas', () => {
  const s = leer('lib/spy.ts');
  const bloque = s.slice(s.indexOf('// ── La landing: lo que ya hace'), s.indexOf("const db = await getTenantDb();\n  await db.from('spy_competidores').update({\n    mirado_en"));
  const corte = bloque.indexOf('if (!m.analisis.ok)');
  // `landing` y no `c.landing_url` desde el 4/11/2026: el sitio puede salir de la descripción de su canal o de su bio.
  const guarda = bloque.indexOf("await guardarFunnel(competidorId, landing, 'pagina'");
  assert.ok(corte > 0 && guarda > corte, 'el funnel se escribe después de la puerta de «no pude leer»');
  // Dentro de `guardarVistas` haría fallar la landing entera si la columna todavía no llegó.
  const gv = s.slice(s.indexOf('export async function guardarVistas('), s.indexOf('export async function marcarDejadas('));
  assert.doesNotMatch(gv, /funnel/);
});

test('la pantalla la dibuja desde la fila de la landing y con el enlace', () => {
  const s = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(s, /<SuFunnel filas=\{piezas\.filter\(\(p\) => p\.canal === 'landing'\)\.map\(\(p\) => p\.funnel\)\} \/>/);
  assert.match(s, /href=\{enlaceSusAnuncios\(c\)\}[^>]*rel="noreferrer noopener"[^>]*>Ver sus anuncios</);
  // Sin leer: nada. Leída y sin nada: «no se ve», que no es «no tiene».
  const f = leer('app/competitor-spy/SuFunnel.tsx');
  assert.match(f, /if \(!u\) return null;/);
  assert.match(f, /Desde afuera no se ve/);
});

// Martín, 4/11/2026: «la buscó como su página [su web], cuando debió buscarla por su Instagram, todo el mundo publicita con su cuenta
// personal, o de última con el nombre del negocio». Verificado rompiéndolo: con el dominio primero, la búsqueda de Den Borg es
// "beacons.page" (54 anuncios de cualquiera) y cae.
test('«Ver sus anuncios» busca su nombre (o su @), nunca una página de enlaces', () => {
  const q = (c: Parameters<typeof enlaceSusAnuncios>[0]) => new URL(enlaceSusAnuncios(c)).searchParams.get('q');
  assert.equal(q({ nombre: 'Den Borg - Estrategia de Marca Personal', instagram: 'den.borgg', landing_url: 'https://beacons.page/denborg' }), '"Den Borg"');
  assert.equal(q({ nombre: '', instagram: '@den.borgg', landing_url: 'https://beacons.page/denborg' }), '"den.borgg"');
  assert.equal(q({ nombre: '', instagram: null, landing_url: 'https://linktr.ee/alguien' }), '""', 'una página de enlaces no es su web');
  assert.equal(q({ nombre: '', landing_url: 'https://www.acquisition.com/x' }), '"acquisition.com"', 'sin nombre ni @, su web propia');
});
