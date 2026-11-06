// =============================================================================
// «Guardar en Spy»: lo que manda la extensión, lo que se interpreta y lo que NO se hace (3/11/2026)
// =============================================================================
// Martín decidió leer la Biblioteca de Anuncios «con un clic». Lo que este archivo cuida, en orden de
// cuánto cuesta equivocarse:
//   1. La extensión no pide un permiso de más: con un permiso de sitios Chrome la DESACTIVA hasta que cada
//      cliente lo acepte. Sólo `activeTab`, y ningún content script nuevo.
//   2. Lo que sale del navegador de la persona: nada de cookies, almacenamiento ni valores de formularios;
//      de un sitio, sólo direcciones. Y WhatsApp Web no se lee nunca, aunque lo pida una pantalla rota.
//   3. Lo leído de Meta no se comparte entre negocios ni se poda a los 30 días.
//   4. Lo que llega no es de fiar: el servidor baja la miniatura, y si no fuera sólo del CDN de Meta, un
//      token cualquiera le haría pedir lo que quiera.
//
// Los tokens de abajo tienen la FORMA medida en la Biblioteca real el 3/11/2026, en tres idiomas. Los
// ids, nombres y dominios son inventados.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  anunciosDe, anunciosDeQuien, esRedSocial, esSitioProhibido, fechasDe, leerCaptura, paginaMasVista, piezaDeAnuncio,
  SITIOS_PROHIBIDOS, sitioDe, type CapturaBiblioteca, type CapturaSitio, type Token,
} from '../lib/spy-captura';
import { esPublica } from '../lib/rutas-publicas';
import { NOMBRE_FUENTE, podarVencido } from '../lib/spy-reglas';
import { tiempoDePieza } from '../lib/spy-vista';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const plano = <T,>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

const CDN = 'https://scontent.fxxx1-1.fna.fbcdn.net/v/t39/';
const enEspanol: Token[] = [
  ['a', 'https://www.facebook.com/ads/library/', 'Biblioteca de anuncios de Meta'],
  ['t', '~4.000 resultados'],
  ['t', 'Activo'],
  ['t', 'Identificador de la biblioteca: 1000000000000001'],
  ['t', 'En circulación desde el 29 jul 2026'],
  ['t', 'Plataformas'],
  ['t', 'Menú'],
  ['t', 'Ver detalles del anuncio'],
  ['i', `${CDN}perfil.jpg?oh=firma`, 60, 60, 'Ana Ejemplo'],
  ['a', 'https://www.facebook.com/anaejemplo/', 'Ana Ejemplo'],
  ['t', 'Publicidad'],
  ['t', 'Primera línea del anuncio.'],
  ['t', 'Segunda línea, con un enlace:'],
  ['a', 'https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.ejemplo.com%2Fgratis', 'https://www.ejemplo.com/gratis'],
  ['t', 'Y sigue.'],
  ['a', 'https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.ejemplo.com%2Foferta%3Femail%3Dalguien%40correo.com', 'EJEMPLO.COM\nEl titular del anuncio\nLa descripción\nMás información'],
  ['i', `${CDN}creativo.jpg?oh=firma`, 480, 600, ''],
  ['t', 'Inactivo'],
  ['t', 'Identificador de la biblioteca: 1000000000000002'],
  ['t', '30 jun 2026 - 11 ago 2026'],
  ['t', 'Plataformas'],
  ['t', '12 anuncios usan este contenido y texto'],
  ['t', 'Menú'],
  ['t', 'Ver detalles del resumen'],
  ['a', 'https://www.facebook.com/otramarca/', 'Otra Marca'],
  ['t', 'Publicidad'],
  ['t', 'Un anuncio con video. Llama al ID: 1234567890123'],
  ['t', '0:00 / 1:28'],
  ['v', `${CDN}portada.jpg?oh=firma`],
  ['a', 'https://l.facebook.com/l.php?u=http%3A%2F%2Ffb.me%2F', ''],
  ['a', 'https://www.facebook.com/ads/library/api/', 'API de la biblioteca de anuncios'],
  ['a', 'https://www.facebook.com/privacy/center/', 'Privacidad'],
];

test('las fechas se leen en los tres idiomas medidos', () => {
  const dia = (s: string) => s.slice(0, 10);
  assert.deepEqual(fechasDe('Started running on Jul 29, 2026').map(dia), ['2026-07-29']);
  assert.deepEqual(fechasDe('Jul 1, 2026 - Aug 11, 2026').map(dia), ['2026-07-01', '2026-08-11']);
  assert.deepEqual(fechasDe('En circulación desde el 4 ago 2026').map(dia), ['2026-08-04']);
  assert.deepEqual(fechasDe('30 jun 2026 - 11 ago 2026').map(dia), ['2026-06-30', '2026-08-11']);
  assert.deepEqual(fechasDe('Veiculação iniciada em 29 de jul de 2026').map(dia), ['2026-07-29']);
  assert.deepEqual(fechasDe('30 de jun de 2026 a 11 de ago de 2026').map(dia), ['2026-06-30', '2026-08-11']);
  // Lo que no es una fecha no da una fecha: los días al aire saldrían de un número inventado.
  assert.deepEqual(fechasDe('Plataformas'), []);
  assert.deepEqual(fechasDe('12 anuncios usan este contenido'), []);
  assert.deepEqual(fechasDe('31 feb 2026'), []);
});

test('de lo dibujado salen los anuncios, con sus días y su destino', () => {
  const [a, b, ...resto] = anunciosDe(enEspanol);
  assert.equal(resto.length, 0, 'el pie de la Biblioteca no es un anuncio');
  assert.equal(a.id, '1000000000000001');
  assert.equal(a.desde?.slice(0, 10), '2026-07-29');
  assert.equal(a.hasta, null, 'sigue activo');
  assert.deepEqual(a.pagina, { nombre: 'Ana Ejemplo', handle: 'anaejemplo' });
  assert.equal(a.texto, 'Primera línea del anuncio.\nSegunda línea, con un enlace:\nhttps://www.ejemplo.com/gratis\nY sigue.');
  assert.equal(a.titulo, 'El titular del anuncio');
  assert.equal(a.destino, 'ejemplo.com');
  assert.match(a.miniatura ?? '', /creativo\.jpg/, 'la imagen del anuncio, no la foto de perfil de 60×60');

  assert.equal(b.hasta?.slice(0, 10), '2026-08-11', 'el inactivo dice cuándo terminó');
  assert.equal(b.texto, 'Un anuncio con video. Llama al ID: 1234567890123', 'ni el reloj del video ni el pie son parte del copy');
  assert.match(b.miniatura ?? '', /portada\.jpg/);
  assert.equal(b.destino, null, 'fb.me es el enlace del propio Meta, no su destino');
});

test('un número en el copy no abre un anuncio: hace falta la línea de la fecha', () => {
  // El copy de arriba ya dice «ID: 1234567890123». Y esto, en un anuncio solo, tampoco cuenta.
  assert.deepEqual(anunciosDe([['t', 'Identificador de la biblioteca: 1000000000000009'], ['t', 'Sin fecha'], ['t', 'Nada'], ['t', 'Nada'], ['t', 'Nada']]), []);
});

test('en inglés y portugués también', () => {
  const en = anunciosDe([['t', 'Active'], ['t', 'Library ID: 1000000000000003'], ['t', 'Started running on Oct 6, 2025'], ['a', 'https://www.facebook.com/marca/', 'Marca'], ['t', 'Sponsored'], ['t', 'Hello']]);
  assert.equal(en[0].id, '1000000000000003');
  assert.equal(en[0].texto, 'Hello');
  const pt = anunciosDe([['t', 'Ativo'], ['t', 'Identificação da biblioteca: 1000000000000004'], ['t', 'Veiculação iniciada em 4 de ago de 2026'], ['a', 'https://www.facebook.com/marca/', 'Marca'], ['t', 'Patrocinado'], ['t', 'Olá']]);
  assert.equal(pt[0].id, '1000000000000004');
  assert.equal(pt[0].texto, 'Olá');
});

test('el mismo anuncio dibujado dos veces es uno', () => {
  const uno: Token[] = [['t', 'Library ID: 1000000000000005'], ['t', 'Started running on Oct 6, 2025']];
  assert.equal(anunciosDe([...uno, ...uno]).length, 1);
});

test('una búsqueda por palabra trae las de cualquiera: a la ficha entran sólo las suyas', () => {
  const todos = anunciosDe(enEspanol);
  const porNombre = anunciosDeQuien(todos, { nombre: 'Ana Ejemplo' }, false);
  assert.deepEqual(porNombre.suyos.map((a) => a.id), ['1000000000000001']);
  assert.equal(porNombre.otros, 1);
  assert.equal(anunciosDeQuien(todos, { nombre: 'Otro nombre', landing_url: 'https://ejemplo.com/x' }, false).suyos.length, 1, 'por el dominio al que manda');
  assert.equal(anunciosDeQuien(todos, { nombre: 'Otro nombre', pagina_anuncios: 'OTRAMARCA' }, false).suyos.length, 1, 'por su Página');
  assert.equal(anunciosDeQuien(todos, { nombre: 'Nadie' }, false).suyos.length, 0);
  assert.equal(anunciosDeQuien(todos, { nombre: 'Nadie' }, true).suyos.length, 2, 'en la Página de un anunciante, todo es suyo');
});

test('la Página más vista, para «Agregar como competidor»', () => {
  const todos = anunciosDe([...enEspanol.slice(0, 3), ...enEspanol.slice(2)]);
  assert.equal(paginaMasVista(todos)?.nombre, 'Ana Ejemplo');
  assert.equal(paginaMasVista([]), null);
});

test('la pieza: el enlace se arma con el id, y entra como guardada desde el navegador', () => {
  const [a, b] = anunciosDe(enEspanol);
  const p = piezaDeAnuncio(a);
  assert.equal(p.url, 'https://www.facebook.com/ads/library/?id=1000000000000001');
  assert.equal(p.fuente, 'recorrido');
  assert.equal(p.canal, 'anuncios');
  assert.equal(p.dejoDeVerseEn, null);
  assert.equal(piezaDeAnuncio(b).dejoDeVerseEn?.slice(0, 10), '2026-08-11');
  // Verificado copiando el `u` entero a `destino`: 1 fallo.
  assert.doesNotMatch(JSON.stringify(p), /alguien|correo\.com/, 'el correo de la consulta de un destino no se guarda');
  assert.equal(NOMBRE_FUENTE.recorrido, 'Lo guardaste desde tu navegador');
});

test('un anuncio en video se guarda COMO video: la tarjeta lo decía dos veces y se tiraba (6/11/2026)', () => {
  // Medido el 6/11/2026: los 300 anuncios guardados entraron por acá (`fuente: 'recorrido'`), ninguno por Apify, y los 300
  // quedaron sin `medio`. Las dos señales estaban en lo dibujado: el token del `<video>` y el reloj del video.
  const [a, b] = anunciosDe(enEspanol);
  assert.equal(b.medio, 'video');
  assert.equal(piezaDeAnuncio(b).medio, 'video', 'y llega a la pieza que se guarda');
  assert.equal(a.medio, null, 'sin señal no se afirma «imagen»: una tarjeta que no cargó su video muestra sólo su portada');
  assert.equal(piezaDeAnuncio(a).medio, null);
  const cabeza: Token[] = [['t', 'Library ID: 1000000000000007'], ['t', 'Started running on Oct 6, 2025'], ['a', 'https://www.facebook.com/marca/', 'Marca'], ['t', 'Sponsored']];
  // El reloj solo alcanza (la tarjeta de un video que todavía no se dibujó como `<video>`), y no ensucia el copy.
  const [soloReloj] = anunciosDe([...cabeza, ['t', 'La promo de hoy'], ['t', '0:15'], ['i', `${CDN}c.jpg?oh=firma`, 480, 600, '']]);
  assert.equal(soloReloj.medio, 'video');
  assert.equal(soloReloj.texto, 'La promo de hoy');
  // Y el token del `<video>` solo también alcanza (una tarjeta sin el reloj a la vista).
  // ⚠️ Sin este caso, sacar la línea del token `'v'` daba CERO rojos: el anuncio de arriba trae las dos señales.
  const [soloVideo] = anunciosDe([...cabeza, ['v', `${CDN}portada.jpg?oh=firma`]]);
  assert.equal(soloVideo.medio, 'video');
  // Un token de video que no es del CDN de Meta no decide nada: lo manda un navegador.
  const [falso] = anunciosDe([...cabeza, ['v', 'https://malo.com/p.jpg']]);
  assert.equal(falso.medio, null);
  // Y una imagen sola no alcanza para decir «imagen»: queda en «no se sabe».
  const [conImagen] = anunciosDe([...cabeza, ['i', `${CDN}c.jpg?oh=firma`, 480, 600, '']]);
  assert.equal(conImagen.medio, null);
});

test('lo que llega no es de fiar: la miniatura sólo puede ser del CDN de Meta', () => {
  // El servidor la baja. Verificado sacando `esDelCdn`: 1 fallo.
  for (const mala of ['https://169.254.169.254/latest/meta-data.jpg', 'http://scontent.fbcdn.net/a.jpg', 'https://fbcdn.net.malo.com/a.jpg', 'https://malo.com/fbcdn.net/a.jpg']) {
    const [a] = anunciosDe([['t', 'Library ID: 1000000000000006'], ['t', 'Started running on Oct 6, 2025'], ['i', mala, 500, 500, ''], ['v', mala]]);
    assert.equal(a.miniatura, null, mala);
  }
});

test('leerCaptura arma todo de nuevo, y lo que no se puede usar no se guarda', () => {
  assert.equal(leerCaptura(null), null);
  assert.equal(leerCaptura('x'), null);
  assert.equal(leerCaptura({ modo: 'prohibido' }), null);
  assert.equal(leerCaptura({ modo: 'otro' }), null);
  // WhatsApp Web no entra aunque llegue. Verificado sacando `esSitioProhibido`: 1 fallo.
  for (const url of SITIOS_PROHIBIDOS.map((d) => `https://${d}/x`).concat('https://sub.hola-mako.com/x', 'http://localhost:3000/', 'http://192.168.0.1/')) {
    assert.equal(leerCaptura({ modo: 'sitio', url, recursos: [] }), null, url);
  }
  assert.equal(leerCaptura({ modo: 'sitio', url: 'javascript:alert(1)' }), null);
  const s = leerCaptura({ modo: 'sitio', url: 'https://ejemplo.com/', titulo: 7, recursos: ['https://a.com/x.js', 'javascript:alert(1)', 3, 'x'.repeat(3000)], otro: 'nada' }) as CapturaSitio;
  assert.deepEqual(s.recursos, ['https://a.com/x.js']);
  assert.equal(s.titulo, '');
  assert.equal('otro' in s, false);
  const b = leerCaptura({ modo: 'biblioteca', pagina: "1' or 1=1", id: '123456', tokens: [['t', 'hola'], ['z', 'x'], 'y', ['a', 3, 'z'], ['i', 'https://a', 'x', null, 1]] }) as CapturaBiblioteca;
  assert.equal(b.pagina, '', 'sólo un número');
  assert.equal(b.id, '123456');
  assert.deepEqual(b.tokens, [['t', 'hola'], ['a', null, 'z'], ['i', 'https://a', 0, 0, '']]);
});

test('una red no es «su sitio»: el píxel de instagram.com es de Instagram', () => {
  assert.equal(esRedSocial('https://www.instagram.com/alguien/'), true);
  assert.equal(esRedSocial('https://www.youtube.com/@x'), true);
  assert.equal(esRedSocial('https://ejemplo.com/'), false);
  assert.equal(esSitioProhibido('https://ejemplo.com/'), false);
  assert.match(leer('lib/spy-captura-db.ts'), /if \(esRedSocial\(c\.url\)\)/);
});

test('un sitio: píxeles de lo que CARGÓ y checkout de lo que enlaza', () => {
  const c: CapturaSitio = {
    modo: 'sitio', url: 'https://www.ejemplo.com/vsl?id=1', titulo: 'VSL',
    recursos: [
      'https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123',
      'https://connect.facebook.net/signals/config/987654321098765',
      'https://www.google-analytics.com/g/collect?tid=G-ZZ99YY88XX',
      'https://scripts.converteai.net/a/players/b/v4/player.js',
    ],
    scripts: [], iframes: ['https://player.vimeo.com/video/1'],
    // Un enlace a un artículo sobre Tag Manager no es Tag Manager.
    enlaces: ['https://blog.com/gtm.js?id=GTM-NOCUENTA', 'https://pay.hotmart.com/A123', 'https://wa.me/5491100000000'],
    formularios: ['https://ejemplo.com/enviar'],
  };
  const { ref, lectura, piezas } = sitioDe(c, new Date('2026-11-03'));
  assert.equal(ref, 'https://www.ejemplo.com/vsl', 'la llave de la fila va sin consulta');
  assert.deepEqual(lectura.pixeles.map((p) => p.proveedor).sort(), ['ga4', 'gtm', 'meta']);
  assert.deepEqual(lectura.pixeles.find((p) => p.proveedor === 'gtm')?.ids, ['GTM-ABCD123']);
  assert.deepEqual(lectura.checkouts, [{ nombre: 'Hotmart', url: 'https://pay.hotmart.com/A123' }]);
  assert.deepEqual(lectura.videos.sort(), ['VTurb', 'Vimeo']);
  assert.deepEqual(piezas.sort(), ['botones', 'formulario', 'link-whatsapp', 'video-vimeo']);
});

// ── El lector, como lo carga Chrome ─────────────────────────────────────────────────────────────

/** Un DOM de mentira: lo justo para que el script corra como un script clásico en otro contexto. */
function correrLector(href: string, extra: Record<string, unknown> = {}) {
  const u = new URL(href);
  return plano(runInNewContext(leer('extension/spy-leer.js'), {
    URL, URLSearchParams, Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    location: { href, hostname: u.hostname, pathname: u.pathname, search: u.search },
    performance: {
      getEntriesByType: () => [
        { name: 'https://www.facebook.com/tr?id=111122223333&ud%5Bem%5D=hashdelcorreo&fbp=fb.1.2.3&dl=https%3A%2F%2Fx.com%2F%3Femail%3Da%40b.com' },
        { name: 'https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123&l=dataLayer' },
        { name: 'https://www.google-analytics.com/g/collect?v=2&tid=G-ZZ99YY88XX&cid=123.456&uid=persona' },
        { name: 'data:image/png;base64,AAAA' },
      ],
    },
    document: {
      title: 'Su título',
      scripts: [{ src: 'https://a.com/s.js?token=secreto&sdkid=ABC' }, { src: '' }],
      forms: [{ getAttribute: () => '/enviar?email=a@b.com' }, { getAttribute: () => null }],
      querySelectorAll: (q: string) => (q === 'a[href]' ? [{ href: 'https://pay.hotmart.com/A1?off=x&email=a@b.com' }, { href: 'mailto:a@b.com' }] : [{ src: 'https://player.vimeo.com/video/1?h=x' }]),
      get cookie(): string { throw new Error('leyó las cookies'); },
      body: { nodeType: 1, tagName: 'BODY', childNodes: [] },
    },
    ...extra,
  }));
}

test('de un sitio sale sólo su título y direcciones, sin lo que traen en la consulta', () => {
  const c = correrLector('https://www.ejemplo.com/vsl?email=a@b.com&utm_source=x');
  assert.equal(c.modo, 'sitio');
  assert.equal(c.url, 'https://www.ejemplo.com/vsl');
  assert.equal(c.titulo, 'Su título');
  assert.deepEqual(c.recursos, [
    'https://www.facebook.com/tr?id=111122223333',
    'https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123',
    'https://www.google-analytics.com/g/collect?tid=G-ZZ99YY88XX',
  ]);
  assert.deepEqual(c.scripts, ['https://a.com/s.js?sdkid=ABC']);
  assert.deepEqual(c.enlaces, ['https://pay.hotmart.com/A1'], 'ni el mailto ni el correo de la consulta');
  assert.deepEqual(c.formularios, ['https://www.ejemplo.com/enviar']);
  assert.doesNotMatch(JSON.stringify(c), /a@b\.com|secreto|hashdelcorreo|persona|123\.456/);
  // Y lo que el servidor necesita de cada dirección sigue estando.
  const leida = sitioDe(leerCaptura(c) as CapturaSitio).lectura;
  assert.deepEqual(leida.pixeles.map((p) => p.proveedor).sort(), ['ga4', 'gtm', 'meta']);
});

test('WhatsApp Web y la propia app no se leen aunque alguien inyecte el lector', () => {
  // Verificado sacando el corte: 1 fallo.
  for (const u of ['https://web.whatsapp.com/', 'https://hola-mako.com/crm', 'https://labs.google/fx/tools/flow', 'https://flow.google.com/x']) {
    assert.deepEqual(correrLector(u), { modo: 'prohibido' }, u);
  }
});

test('en la Biblioteca lee lo dibujado, en orden, y salta lo que escribió la persona', () => {
  const texto = (t: string) => ({ nodeType: 3, nodeValue: t });
  const elemento = (tagName: string, childNodes: unknown[] = [], extra: Record<string, unknown> = {}) => ({
    nodeType: 1, tagName, childNodes, isContentEditable: false, checkVisibility: () => true, ...extra,
  });
  const body = elemento('BODY', [
    texto('Library ID: 1\u200b'),
    elemento('INPUT', [], { value: 'lo que buscó la persona' }),
    elemento('TEXTAREA', [texto('lo que escribió')]),
    elemento('SELECT', [elemento('OPTION', [texto('una opción')])]),
    elemento('DIV', [texto('editable')], { isContentEditable: true }),
    elemento('DIV', [texto('escondido')], { checkVisibility: () => false }),
    elemento('SCRIPT', [texto('{"fb_dtsg":"token"}')]),
    elemento('A', [texto('adentro')], { href: 'https://l.facebook.com/l.php?u=https%3A%2F%2Fa.com&h=tokendesesion', innerText: 'A.COM\n  Titular  \n\nBotón' }),
    elemento('IMG', [], { currentSrc: 'https://scontent.fbcdn.net/a.jpg?oh=firma', naturalWidth: 480, naturalHeight: 600, alt: '' }),
    elemento('IMG', [], { src: 'https://otro.com/a.jpg', naturalWidth: 480, naturalHeight: 600 }),
    elemento('VIDEO', [], { poster: 'https://scontent.fbcdn.net/p.jpg?oh=firma', src: 'https://video.fbcdn.net/v.mp4' }),
  ]);
  const c = correrLector('https://www.facebook.com/ads/library/?q=%22ejemplo.com%22&view_all_page_id=12345&fbclid=x', {
    document: { title: 't', body, scripts: [], forms: [], querySelectorAll: () => [] },
  });
  assert.equal(c.modo, 'biblioteca');
  assert.equal(c.busqueda, '"ejemplo.com"');
  assert.equal(c.pagina, '12345');
  assert.deepEqual(c.tokens, [
    ['t', 'Library ID: 1'],
    ['a', 'https://l.facebook.com/l.php?u=https%3A%2F%2Fa.com', 'A.COM\nTitular\nBotón'],
    ['i', 'https://scontent.fbcdn.net/a.jpg?oh=firma', 480, 600, ''],
    ['v', 'https://scontent.fbcdn.net/p.jpg?oh=firma'],
  ]);
});

test('el lector sólo lee: ni red, ni scroll, ni clics, ni lo guardado', () => {
  const s = sinComentarios(leer('extension/spy-leer.js'));
  for (const prohibido of [/\.cookie\b/, /localStorage/, /sessionStorage/, /indexedDB/, /\bfetch\(/, /XMLHttpRequest/, /sendBeacon/, /scroll/i, /\.click\(/, /\.focus\(/, /\.value\b(?!\s*\|\|)/, /innerHTML/, /appendChild|createElement|insertBefore|\.remove\(/, /chrome\./]) {
    const limpio = s.replace(/n\.nodeValue/g, '');
    assert.doesNotMatch(limpio, prohibido, `el lector no puede usar ${prohibido}`);
  }
  assert.ok(s.split('\n').every((l) => !l.includes('*/') && !l.includes('/*')), 'sin barra-asterisco: rompe los tests que quitan comentarios (AGENTS.md)');
});

// ── El desplegable ──────────────────────────────────────────────────────────────────────────────

type Reglas = {
  queHay(url: unknown): { tipo: string; pagina?: string; busqueda?: string; dominio?: string } | null;
  fichaDe(hay: unknown, lista: unknown): { id: number } | null;
  rotulo(f: unknown): string;
  detalle(h: unknown): string;
};
const reglas = (): Reglas => {
  const ctx: Record<string, unknown> = { URL };
  runInNewContext(leer('extension/spy-reglas.js'), ctx);
  assert.ok(ctx.MakoSpy, 'el script clásico no dejó `MakoSpy` en el global');
  return ctx.MakoSpy as Reglas;
};

test('qué se ofrece en cada pestaña: nada donde no corresponde', () => {
  const r = reglas();
  for (const u of ['chrome://extensions', 'about:blank', 'file:///C:/a.html', 'https://web.whatsapp.com/', 'https://hola-mako.com/crm', 'https://labs.google/fx', 'https://flow.google.com/', 'https://www.facebook.com/marca/', 'http://localhost:3000/', undefined, '']) {
    assert.equal(r.queHay(u), null, String(u));
  }
  assert.deepEqual(plano(r.queHay('https://www.ejemplo.com/vsl')), { tipo: 'sitio', dominio: 'ejemplo.com' });
  assert.deepEqual(plano(r.queHay('https://www.facebook.com/ads/library/?view_all_page_id=123&q=%22x.com%22')), { tipo: 'anuncios', pagina: '123', busqueda: 'x.com' });
  // Una red no promete «sus píxeles»: los de instagram.com son de Instagram.
  assert.equal(r.queHay('https://www.instagram.com/alguien/')?.tipo, 'red');
  assert.equal(r.detalle(r.queHay('https://www.instagram.com/alguien/')), 'Suma este perfil a tu lista');
});

test('«la ficha de X» sólo si es seguro que es de X', () => {
  const r = reglas();
  const lista = [{ id: 1, nombre: 'Ana Ejemplo', dominio: 'ejemplo.com', pagina: '123' }, { id: 2, nombre: 'Otra Marca', dominio: null, pagina: null }];
  const id = (u: string) => plano(r.fichaDe(r.queHay(u), lista))?.id ?? null;
  assert.equal(id('https://www.ejemplo.com/vsl'), 1);
  assert.equal(id('https://pagar.ejemplo.com/'), 1, 'un subdominio es del mismo');
  assert.equal(id('https://noejemplo.com/'), null, 'un dominio que sólo termina igual, no');
  assert.equal(id('https://www.facebook.com/ads/library/?view_all_page_id=123'), 1);
  assert.equal(id('https://www.facebook.com/ads/library/?q=%22ejemplo.com%22'), 1);
  assert.equal(id('https://www.facebook.com/ads/library/?q=otra%20marca'), 2);
  assert.equal(id('https://www.facebook.com/ads/library/?q=zapatillas'), null);
  assert.equal(r.rotulo({ nombre: 'Ana' }), 'Guardar en la ficha de Ana');
  assert.equal(r.rotulo(null), 'Agregar como competidor');
});

test('las tres listas de sitios prohibidos son la misma', () => {
  const lista = [...SITIOS_PROHIBIDOS].sort();
  const de = (archivo: string) => [...leer(archivo).matchAll(/web\\?\.whatsapp\\?\.com|hola-mako\\?\.com|labs\\?\.google|flow\\?\.google\\?\.com/g)].map((m) => m[0].replace(/\\/g, ''));
  assert.deepEqual([...new Set(de('extension/spy-reglas.js'))].sort(), lista);
  assert.deepEqual([...new Set(de('extension/spy-leer.js'))].sort(), lista);
});

test('abrir el desplegable no lee la página ni cuenta qué sitio se mira', () => {
  const p = sinComentarios(leer('extension/popup.js'));
  // Verificado mandando la pestaña en el pedido de la lista: 1 fallo.
  assert.match(p, /pedirSpy\(\{ accion: 'lista' \}, 2500\)/);
  const preparar = p.slice(p.indexOf('async function prepararSpy()'), p.indexOf('function abrirSpy()'));
  assert.doesNotMatch(preparar, /executeScript/, 'no se inyecta nada al abrir');
  // Sin `tab.url` es que Chrome no dio la pestaña: medido, `openPopup` no otorga `activeTab`.
  assert.match(preparar, /tab\?\.url \? MakoSpy\.queHay\(tab\.url\) : null/);
  // Y al guardar: una vez, en el mundo aislado, y sólo en el marco principal.
  const inyecta = p.match(/chrome\.scripting\.executeScript\(\{[^}]*\{[^}]*\}[^}]*\}\)/g)?.filter((x) => x.includes('spy-leer')) ?? [];
  assert.equal(inyecta.length, 1);
  assert.match(inyecta[0], /world: 'ISOLATED'/);
  assert.doesNotMatch(inyecta[0], /allFrames/);
  assert.doesNotMatch(p.slice(p.indexOf('const RUTA_SPY')), /innerHTML/, 'el nombre de una Página es de un tercero');
});

// ── El permiso, y lo que se promete ─────────────────────────────────────────────────────────────

test('el manifest suma sólo `activeTab`: un permiso de sitios desactiva la extensión a los clientes', () => {
  const m = JSON.parse(leer('extension/manifest.json'));
  assert.ok(m.permissions.includes('activeTab'));
  assert.deepEqual(m.permissions.sort(), ['activeTab', 'alarms', 'scripting', 'storage', 'webRequest']);
  // La lista de la 0.74.5, tal cual. Verificado sumando `<all_urls>`: 1 fallo.
  assert.deepEqual(m.host_permissions, ['https://hola-mako.com/*', 'https://labs.google/*', 'https://flow.google.com/*', 'https://aisandbox-pa.googleapis.com/*', 'https://web.whatsapp.com/*']);
  assert.equal(m.optional_host_permissions, undefined);
  const scripts = m.content_scripts.flatMap((c: { js: string[] }) => c.js);
  assert.deepEqual(scripts.filter((f: string) => /spy/.test(f)), [], 'el lector se inyecta con el clic: no es un content script');
  assert.equal(m.content_scripts.length, 5);
  assert.ok(m.description.length <= 132, `la tienda corta el resumen a 132 caracteres: tiene ${m.description.length}`);
});

test('la política de privacidad dice lo que hace esta versión', () => {
  const s = leer('app/privacidad/extension/page.tsx');
  assert.match(s, /Al guardar en Competitors Spy/);
  assert.match(s, /<strong>activeTab<\/strong>/);
  assert.match(s, /No envía valores de formularios, cookies ni/);
  assert.match(s, /facebook\.com\/ads\/library/);
  // La frase vieja afirmaba algo que ya no es cierto: la de ahora separa los permisos del clic.
  assert.doesNotMatch(s, /No accede a ningún sitio fuera de <code>labs\.google/);
});

// ── Lo que NO se hace con lo leído ──────────────────────────────────────────────────────────────

test('lo leído de Meta no se comparte, y una pestaña a medias no dice que nada se bajó', () => {
  const db = sinComentarios(leer('lib/spy-captura-db.ts'));
  assert.doesNotMatch(db, /spy-compartido|guardarLecturaCompartida|spy_lecturas_canal/, 'sería la transferencia a terceros que prohíben sus términos');
  assert.doesNotMatch(db, /marcarDejadas/, 'lo que no se dibujó todavía no es lo que se bajó');
  // Verificado sacando `dejoDeVerseEn` de `comun`: 1 fallo.
  assert.match(leer('lib/spy.ts'), /dejo_de_verse_en: v\.dejoDeVerseEn \?\? null/);
});

test('los anuncios no se podan a los 30 días; lo de YouTube sí', () => {
  const vieja = { texto_leido_en: '2026-01-01T00:00:00Z', metricas_leidas_en: '2026-01-01T00:00:00Z', titulo: 'T', texto: 'X', etiquetas: ['a'], analisis: {}, vistas: 5, megusta: 1, comentarios: 1 };
  const ahora = new Date('2026-11-03T00:00:00Z');
  const anuncio = podarVencido({ ...vieja, canal: 'anuncios' }, ahora);
  assert.equal(anuncio.texto, 'X');
  assert.equal(anuncio.titulo, 'T');
  const video = podarVencido({ ...vieja, canal: 'youtube' }, ahora);
  assert.equal(video.texto, null);
  assert.equal(video.titulo, null);
  assert.equal(video.vistas, null);
  // `map(podarVencido)` le pasaría el índice como `ahora`, y toda la ficha se caería al leerla.
  assert.doesNotMatch(leer('lib/spy.ts'), /\.map\(podarVencido\)/);
  // Y la columna del funnel no la toca nadie.
  assert.deepEqual(podarVencido({ ...vieja, canal: 'landing', funnel: { pagina: 1 } }, ahora).funnel, { pagina: 1 });
});

test('los días al aire de uno que terminó se cuentan hasta que terminó', () => {
  const t = tiempoDePieza({ publicada_en: '2026-06-30T00:00:00Z', visto_primera_vez: '2026-11-01T00:00:00Z', dejo_de_verse_en: '2026-08-11T00:00:00Z' }, new Date('2026-11-03T00:00:00Z'));
  assert.equal(t.dias, 42);
  assert.equal(t.sigue, false);
  // Un anuncio dice cuántos días lleva al aire; lo orgánico, hace cuánto se publicó. «a la vista» se fue el 4/11/2026: Martín
  // no lo entendía («Más tiempo a la vista… le pusiste nombres que no se entienden»).
  const tarjeta = leer('app/competitor-spy/TarjetaPieza.tsx');
  assert.match(tarjeta, /\{t\.dias\} d al aire/);
  assert.doesNotMatch(tarjeta.replace(/^\s*\/\/.*$/gm, ''), /a la vista/);
});

test('el texto ajeno se le pasa a un modelo marcado como ajeno', () => {
  assert.match(leer('lib/spy.ts'), /piezas: contenidoNoConfiable\(comoTexto, 'piezas_del_competidor'\)/);
  // Verificado sacando el `contenidoNoConfiable` de la API: 1 fallo.
  assert.match(leer('lib/api-mako/areas/spy.run.ts'), /out\.push\(contenidoNoConfiable\(lineas\.join\('\\n'\), 'piezas_del_competidor'\)\)/);
});

test('la ruta se autentica sola y no mira la cookie', () => {
  assert.equal(esPublica('/api/competitor-spy/extension'), true);
  // Exacta: abajo de /api/competitor-spy hay una ruta con sesión.
  assert.equal(esPublica('/api/competitor-spy/buscar'), false);
  const s = sinComentarios(leer('app/api/competitor-spy/extension/route.ts'));
  assert.match(s, /workspaceDeToken\(token\)/);
  assert.match(s, /runWithWorkspace\(ws,/);
  assert.doesNotMatch(s, /cookies\(|getRolWsEfectivo|getWorkspaceActual/);
  const db = sinComentarios(leer('lib/spy-captura-db.ts'));
  assert.doesNotMatch(db, /cookies\(|getRolWsEfectivo|getWorkspaceActual/);
});

test('ningún texto nombra lo que no se nombra', () => {
  for (const f of ['extension/popup.js', 'extension/spy-reglas.js', 'extension/spy-leer.js', 'app/competitor-spy/SuFunnel.tsx', 'app/privacidad/extension/page.tsx']) {
    assert.doesNotMatch(leer(f), /unfunnelizer/i, f);
  }
  assert.doesNotMatch(sinComentarios(leer('extension/popup.js')), /['"`][^'"`]*\bFB\b[^'"`]*['"`]/);
  assert.doesNotMatch(leer('app/competitor-spy/SuFunnel.tsx'), /\bFB\b/);
});

// «En su biblioteca de anuncios la buscó como su página [su web], cuando debió buscarla por su Instagram... Y darse cuenta si es o
// no es... Porque evidentemente no es» (Martín con Den Borg, 4/11/2026). Su web era beacons.page: cualquier anuncio que manda a
// Beacons contaba como suyo. Verificado rompiéndolo: con el dominio de antes (sin mirar si es una página de enlaces), cae.
test('un anuncio es suyo por su Página (su nombre corto o su @), nunca por mandar a una página de enlaces', () => {
  const ad = (id: string, pagina: string | null, handle: string | null, destino: string | null) =>
    ({ id, desde: null, hasta: null, pagina: pagina ? { nombre: pagina, handle } : null, texto: null, titulo: null, destino, miniatura: null });
  const den = { nombre: 'Den Borg - Estrategia de Marca Personal', instagram: 'den.borgg', landing_url: 'https://beacons.page/denborg' };
  const todos = [
    ad('1', 'Den Borg', null, 'beacons.page'),
    ad('2', 'Coach Cualquiera', null, 'beacons.page'),
    ad('3', 'Marca Personal Den', 'den.borgg', null),
    ad('4', 'Otra', null, 'denborg.com'),
  ];
  const r = anunciosDeQuien(todos, den, false);
  assert.deepEqual(r.suyos.map((a) => a.id), ['1', '3'], 'por su nombre corto y por su @; nunca por mandar a Beacons');
  assert.equal(r.otros, 2);
  // Con su web propia, mandar ahí sí lo dice.
  assert.deepEqual(anunciosDeQuien(todos, { ...den, landing_url: 'https://denborg.com/evento' }, false).suyos.map((a) => a.id), ['1', '3', '4']);
});
