// =============================================================================
// La copia idéntica de una página (28/10/2026): la foto del navegador → secciones «Diseño editable»
// =============================================================================
// Pedido de Martín (28/10/2026, ~09:40), sobre la réplica de respond.io: «esta horriblemente mal, no solo el diseño no se
// parece en nada, sino que tampoco los copy... Enfocate primero en replicar tal cual, tanto en diseño como copy y luego
// vemos de personalizarlo». Medido con sus 5 landings en un Chrome sin ventana (docs/hallazgos-editor-landing.md, «La
// copia idéntica»): las capturas lado a lado y el diff del texto están en C:/dev/revisiones/replica-tal-cual/.
//
// Lo que se vigila: el lector de CSS (la comilla escapada de Tailwind se comía dos tercios de la hoja de respond.io), la
// poda, los selectores del <html> y el <body>, el corte que abre lo grande, los envoltorios abiertos UNA vez en la página
// publicada y adentro del iframe en el editor, el saneo (lo vacío que esconde: `hidden=""`, `popover=""`), la política de
// la publicada con los orígenes de la copia, y los enchufes (el lector, la ruta, la pantalla).
//
// Probado rompiéndolo con los tests 1 a 13 (base 13 / 0; cada rotura, 12 / 1 con el test que la caza; el 14 se sumó después:
// vigila funciones que ya existían, las de las páginas de MaKo):
//   R32 el lector de CSS sin la barra afuera de un string .......... 1    R43 validar tira sinBase ......................... 11
//   R33 el corchete escapado vuelve a ser un atributo ............... 2    R44 la cara de antes de bajar, después de bajar .. 12
//   R34 la etiqueta se corta en el primer > ......................... 2    R45 replicar sin la copia idéntica ............... 13
//   R35 las clases propias del html/body no se sacan ................ 3    R46 la pantalla arranca en las partes de antes ... 13
//   R36 quedan los @keyframes que nadie nombra ...................... 4    R47 el \# escapado vuelve a empezar un id ........ 2
//   R37 lo grande no se abre si viene con un espaciador ............. 5    R48 el lector baja rápido con la foto ............ 12
//   R38 los envoltorios se abren en cada sección .................... 6    R49 lo que se vio no vuelve a verse .............. 12
//   R39 el editor sin la marca de la raíz ........................... 7    R50 el tope de 120 hojas ......................... 5
//   R40 el saneo vuelve a borrar hidden y popover ................... 8    R51 el vh del editor sin ventana fija ............ 7
//   R41 /api/ prohibido en cualquier dominio ........................ 9    R52 el vh fijo adentro de una clase escapada ..... 7
//   R42 la política sin los orígenes de la copia .................... 10
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clasesDe, contenidoDeCopiaIdentica, fichasDeHtml, partirParaCopia, piezasDeCss, podarCss, sanearInstantanea, selectorParaCopia,
  selectorVive, separarPorComas, sinDestinosAjenos, PARTIR_DESDE,
} from '../lib/editor-landing/copia-identica';
import { JS_ANTES_DE_BAJAR, JS_INSTANTANEA, JS_MIRAR_VISIBLES } from '../lib/editor-landing/copia-identica-script';
import {
  CSS_BASE_LIBRE, conVhFijo, cssDisenoLimpio, cssSinCargasAjenas, cssSinEscapes, documentoEditable, envoltoriosValidos, medioPermitido, referenciasDeCss,
  rotuloDeSeccion,
} from '../lib/editor-landing/html-editable';
import { htmlDePagina } from '../lib/editor-landing/render';
import { temaPorId } from '../lib/editor-landing/temas';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import { sanearConfig } from '../lib/editor-landing/validar';
import { NODO, TOPES, nuevoId, tarjeta, textoDe } from '../lib/editor-landing/doc';
import { conTextos, textosDeHtmlEditable } from '../lib/editor-landing/html-editable-textos';
import { armarDocumento, entornoActual, origenesDeMedios, politicaDeContenido } from '../lib/editor-landing/pagina-publica';
import { scriptLector } from '../lib/editor-landing/lector-script';
import { TIPO_MENSAJE_LECTURA, sanearMensajeLectura } from '../lib/editor-landing/lector';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
/** El saneo (server-only) en un node aparte: tests/_copia-identica-hijo.ts. */
const sanear = (e: Record<string, unknown>) => JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_copia-identica-hijo.ts'), JSON.stringify(e)], { cwd: RAIZ, encoding: 'utf8', timeout: 90_000 }));

test('1. el lector de CSS: comentarios, strings, la comilla escapada de Tailwind y los bloques anidados', () => {
  const css = String.raw`/* .x { } */ .a{color:red} .content-\[\'\'\]{content:''} @media (min-width:768px){.md\:flex{display:flex}} .c::after{content:"}"} @import url(x.css); .d{}`;
  const p = piezasDeCss(css);
  assert.deepEqual(p.map((x) => (x.tipo === 'regla' ? x.selector : x.tipo === 'at' ? `@${x.nombre}` : x.texto)), [
    '.a', String.raw`.content-\[\'\'\]`, '@media', '.c::after', '@import url(x.css)', '.d',
  ], 'la comilla escapada no abre un string: lo que sigue se sigue leyendo');
  assert.equal(p[3].tipo === 'regla' && p[3].cuerpo, 'content:"}"');
  assert.deepEqual(separarPorComas('a, b:is(c, d), [x="1,2"]'), ['a', 'b:is(c, d)', '[x="1,2"]']);
});

test('2. un selector vive si la copia tiene TODAS sus clases, ids y etiquetas (lo de adentro de :not y los atributos no cuentan)', () => {
  // El `>` adentro de una clase (`[&>*]:p-2`) no cierra la etiqueta, y un corchete o un paréntesis ESCAPADO es de la clase.
  // Un `\#` o un `\.` escapados tampoco empiezan un id ni una clase (tryholo.ai perdía sus fondos `bg-[#0A0B14]`).
  const f = fichasDeHtml('<div class="md:flex w-1/2 [&>*]:p-2 w-[calc(100%-2rem)] bg-[#0A0B14] p-[0.060rem] hero" id="top"><section><a href="#">x</a></section></div>');
  for (const s of [String.raw`.md\:flex`, String.raw`.w-1\/2`, String.raw`.\[\&\>\*\]\:p-2`, String.raw`.w-\[calc\(100\%-2rem\)\]`, String.raw`.bg-\[\#0A0B14\]`, String.raw`.p-\[0\.060rem\]`, '#top .hero', 'section > a:hover', '.hero:not(.nada)', '[data-x] .hero', '*', '.hero::before'])
    assert.equal(selectorVive(s, f), true, s);
  for (const s of ['.nada', '#otro', 'nav a', 'svg', '.hero .nada']) assert.equal(selectorVive(s, f), false, s);
});

test('3. los selectores del <html> y el <body> de la página: sus clases se cumplían, y entre el body y la copia hay cajas', () => {
  const h = clasesDe('w-mod-js dark-x');
  const b = clasesDe('home');
  assert.equal(selectorParaCopia('html.w-mod-js .x', h, b), 'html .x');
  assert.equal(selectorParaCopia('html.dark .x', h, b), 'html.dark .x', 'una clase que la página NO tenía queda: no se cumplía');
  assert.equal(selectorParaCopia('body.home > .wrap', h, b), 'body .wrap');
  assert.equal(selectorParaCopia('html > body.home .x', h, b), 'html body .x');
  assert.equal(selectorParaCopia(':root.w-mod-js', h, b), ':root');
  assert.equal(selectorParaCopia('.body .x', h, b), '.body .x', 'una clase sola la cumple la caja que envuelve las secciones');
});

test('4. la poda: se va lo que nada cumple, quedan las fuentes y los @keyframes que alguien nombra, sin @import', () => {
  const css = '@import url(x.css); @layer base, utilities; .vive{a:1} .muerta{a:1} .vive,.muerta{b:2} @media (max-width:600px){.muerta{c:3}} @media print{.vive{d:4}} @font-face{font-family:X;src:url(https://f.com/x.woff2)} @keyframes usada{to{opacity:1}} @keyframes sobra{to{opacity:0}} .vive{animation:usada 1s}';
  const r = podarCss(css, fichasDeHtml('<div class="vive"></div>'));
  assert.doesNotMatch(r.css, /@import|muerta|sobra|max-width:600px/);
  assert.match(r.css, /@layer base, utilities;/);
  assert.match(r.css, /\.vive\{b:2\}/);
  assert.match(r.css, /@media print\{\.vive\{d:4\}\}/);
  assert.match(r.css, /@font-face\{font-family:X;src:url\(https:\/\/f\.com\/x\.woff2\)\}/);
  assert.match(r.css, /@keyframes usada\{to\{opacity:1\}\}/);
  assert.equal(r.quitadas, 2);
});

/** Una página de prueba: el header, un <main> grande con tres secciones y el pie. */
const largo = (n: number) => `<p>${'texto largo de la sección '.repeat(n)}</p>`;
const fotoDePrueba = () => sanearInstantanea({
  url: 'https://competidor.com/', base: 'https://competidor.com/', titulo: 'La página',
  html: { clase: 'w-mod-js', estilo: '', lang: 'en' }, body: { clase: 'body', estilo: 'background:#000', fondo: '' },
  cuerpo: `<header class="top"><nav>menú principal de la página</nav></header><main class="flex gap-20"><section id="a">${largo(1500)}</section><section id="b">${largo(1500)}</section><section id="c">Una sección corta con texto</section></main><footer>pie de la página con texto</footer>`,
  hojas: [{ css: '.top{color:red}' }, { href: 'javascript:alert(1)' }], ancho: 1440, medidas: {},
});

test('5. el corte: lo que pasa de PARTIR_DESDE se abre (la caja pasa a envoltorio), y la caja del body va arriba de todo', () => {
  const f = fotoDePrueba();
  assert.ok(f);
  assert.equal(f.hojas.length, 1, 'una hoja sin css y con una dirección que no es http no viaja');
  assert.ok(f.cuerpo.length > PARTIR_DESDE);
  const s = partirParaCopia(f);
  const caja = '<div class="w-mod-js body" style="background:#000" data-gm-copia="body">';
  assert.deepEqual(s.map((x) => /^<(\w+)(?:\s+id="(\w)")?/.exec(x.html)?.slice(1).filter(Boolean).join('#')), ['header', 'section#a', 'section#b', 'section#c', 'footer']);
  assert.deepEqual(s.map((x) => x.envoltorios), [[caja], [caja, '<main class="flex gap-20">'], [caja, '<main class="flex gap-20">'], [caja, '<main class="flex gap-20">'], [caja]]);
  // Un espaciador delante de algo grande viaja pegado: igual se abre (reportei.com, 28/10/2026: 484 KB en una sección).
  const g = sanearInstantanea({ ...f, cuerpo: `<div class="espacio"></div><div id="grande"><section id="x">${largo(1500)}</section><section id="y">${largo(1500)}</section></div><footer>pie con texto suficiente</footer>` });
  const s2 = partirParaCopia(g!);
  assert.ok(s2.every((x) => x.html.length <= TOPES.htmlEditable), 'ninguna sección queda fuera del tope');
  assert.ok(s2.some((x) => x.envoltorios.includes('<div id="grande">')), 'la caja grande pasó a envoltorio de sus hijos');
  assert.equal(sanearInstantanea({ cuerpo: '' }), null);
  // Builder.io mete un <style> por bloque: respond.io tiene 208 hojas y un tope de 120 cortaba en silencio.
  assert.equal(sanearInstantanea({ cuerpo: '<p>x</p>', hojas: Array.from({ length: 300 }, (_, i) => ({ css: `.c${i}{}` })) })!.hojas.length, 300);
});

test('6. la página publicada abre cada envoltorio UNA vez alrededor de las secciones que lo comparten, sin cajas de MaKo en el medio', () => {
  const contenido = contenidoDeCopiaIdentica(partirParaCopia(fotoDePrueba()!));
  const pagina = contenido.paginas[0];
  pagina.doc.content.push(tarjeta([{ type: NODO.htmlEditable, attrs: { id: nuevoId('e'), html: '<p>mío</p>' } }]));
  const html = htmlDePagina(pagina, { ...CONFIG_DEFAULT, diseno: { css: '.top{color:red}', sinBase: true } }, temaPorId(CONFIG_DEFAULT.tema, []), { modo: 'publico' });
  assert.equal(html.split('data-gm-copia="body"').length - 1, 1, 'la caja del body, una vez');
  assert.equal(html.split('<main class="flex gap-20">').length - 1, 1, 'el <main>, una vez');
  assert.match(html, /data-gm-copia="body"><header class="top">[\s\S]*<\/header><main class="flex gap-20"><section id="a">[\s\S]*<section id="c">Una sección corta con texto<\/section><\/main><footer>[\s\S]*<\/footer><\/div>/);
  assert.match(html, /<\/footer><\/div><div class="gm-libre-seccion"[^>]*>[\s\S]*<p>mío<\/p>/, 'una sección propia cierra los envoltorios y va con su caja de siempre');
  assert.equal(html.split('gm-libre-seccion').length - 1, 1, 'las de la copia no llevan la caja de MaKo (un main > section dejaría de valer)');
});

test('7. el editor: la sección adentro de sus envoltorios, la raíz que se edita marcada, y la copia sin la base de Tailwind', () => {
  const d = documentoEditable('<section id="a">x</section>', '.a{}', { envoltorios: ['<div class="body">', '<main class="m">'], sinBase: true });
  assert.match(d, /<div class="gm-libre"><div class="body"><main class="m" data-gm-raiz><section id="a">x<\/section><\/main><\/div><\/div>/);
  assert.doesNotMatch(d, /@layer gm-libre-base/);
  assert.match(d, /\.gm-libre-seccion \{ display: contents; \}/);
  const normal = documentoEditable('<p>x</p>', '');
  assert.match(normal, /@layer gm-libre-base/);
  assert.ok(CSS_BASE_LIBRE.includes('@layer gm-libre-base') && CSS_BASE_LIBRE.includes('.gm-libre-seccion { display: contents; }'), 'la base de siempre no cambia');
  // El `vh` de una copia, contra una ventana fija en el iframe (si no, una sección de 110vh agranda el iframe sin fin:
  // closermood.com, 16.000 px); en un selector (la clase escapada de Tailwind) no se toca, y fuera de la copia tampoco.
  assert.equal(conVhFijo(String.raw`.h-\[calc\(100vh-2rem\)\]{height:100vh}`), String.raw`.h-\[calc\(100vh-2rem\)\]{height:calc(100 * 9px)}`);
  assert.equal(conVhFijo('.b{top:-50vh;height:calc(100svh - 2rem);width:3.5vw}'), '.b{top:calc(-50 * 9px);height:calc(calc(100 * 9px) - 2rem);width:3.5vw}');
  const conVh = documentoEditable('<div style="height:100vh">x</div>', '.a{min-height:110vh}', { sinBase: true });
  assert.match(conVh, /\.a\{min-height:calc\(110 \* 9px\)\}/);
  assert.match(conVh, /style="height:calc\(100 \* 9px\)"/);
  assert.match(documentoEditable('<div style="height:100vh">x</div>', '.a{min-height:110vh}'), /\.a\{min-height:110vh\}[\s\S]*style="height:100vh"/);
  assert.deepEqual(envoltoriosValidos(['<div class="x">', '<main>']), ['<div class="x">', '<main>']);
  for (const malo of [['<script>'], ['<iframe src="x">'], ['<div>', 3], Array(15).fill('<div>'), [], 'x', ['<div><b>']]) assert.equal(envoltoriosValidos(malo), null, JSON.stringify(malo));
});

test('8. el saneo: lo vacío que esconde se queda (hidden, popover), y un envoltorio pasa por la misma lista blanca', () => {
  const r = sanear({ html: '<div hidden="" class="a">x</div><div popover="" id="p">menú</div><dialog>cerrado</dialog><details><summary>s</summary>t</details>', envoltorios: ['<div class="a" onclick="alert(1)" style="color:red">', '<main id="m">'] });
  assert.match(r.html, /<div hidden="" class="a">x<\/div>/);
  assert.match(r.html, /<div popover="" id="p">menú<\/div>/);
  assert.match(r.html, /<dialog>cerrado<\/dialog>/);
  assert.deepEqual(r.envoltorios, ['<div class="a" style="color:red">', '<main id="m">']);
  assert.equal(sanear({ html: '', envoltorios: ['<div>', '<script>'] }).envoltorios, null);
  const contenido = contenidoDeCopiaIdentica([{ html: '<p onclick="x()">hola</p>', envoltorios: ['<section class="s" onmouseover="y()">'] }]);
  const c = sanear({ html: '', contenido }).contenido;
  const attrs = c.paginas[0].doc.content[0].content[0].attrs;
  assert.equal(attrs.html, '<p>hola</p>');
  assert.deepEqual(attrs.envoltorios, ['<section class="s">']);
});

test('9. un medio de otro sitio con /api/ en la ruta se deja (la cookie de MaKo sólo viaja a NUESTROS dominios), y el SVG en base64', () => {
  assert.equal(medioPermitido('https://assets1-proxy.respond.io/api/v1/image/assets%2Fx'), true);
  for (const propio of ['https://hola-mako.com/api/x', 'https://app.hola-mako.com/api/x', 'https://hola-mako.site/api/x', 'https://algo.vercel.app/api/x']) assert.equal(medioPermitido(propio), false, propio);
  assert.equal(medioPermitido('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), true);
  assert.equal(medioPermitido('data:image/svg+xml,<svg onload=alert(1)>'), false);
});

test('10. la política de la publicada deja pasar los orígenes de las imágenes, las fuentes y los videos de la copia', () => {
  const html = '<img src="https://img.cdn.com/a.png" srcset="https://img.cdn.com/a.png 1x, https://otra.com/b.png 2x"><video src="https://v.com/a.mp4" poster="https://p.com/x.jpg"></video><div style="background:url(&quot;https://bg.com/x.png&quot;)"></div><img src="http://inseguro.com/x.png">';
  const css = '@font-face{font-family:X;src:url("https://fuentes.com/x.woff2") format("woff2")} .a{background:url(https://bg2.com/y.png)}';
  const o = origenesDeMedios(html, css);
  assert.deepEqual([...o.imagenes].sort(), ['https://bg.com', 'https://bg2.com', 'https://img.cdn.com', 'https://otra.com', 'https://p.com']);
  assert.deepEqual(o.fuentes, ['https://fuentes.com']);
  assert.deepEqual(o.videos, ['https://v.com']);
  const p = politicaDeContenido({ entorno: entornoActual(), conPixel: false, conMeta: false, conDiseno: true, medios: o });
  assert.match(p, /img-src [^;]*https:\/\/img\.cdn\.com/);
  assert.match(p, /font-src [^;]*https:\/\/fuentes\.com/);
  assert.match(p, /media-src [^;]*https:\/\/v\.com/);
  assert.doesNotMatch(p, /inseguro/);
  const doc = armarDocumento({ html, config: CONFIG_DEFAULT, cssDiseno: css, workspaceId: 3, modo: 'vista', urlCanonica: 'https://hola-mako.site/x' });
  assert.match(doc, /img-src (?:(?!media-src).)*https:\/\/img\.cdn\.com/, 'en el <meta> de la página (escapado)');
  const sinDiseno = armarDocumento({ html, config: CONFIG_DEFAULT, workspaceId: 3, modo: 'vista', urlCanonica: 'https://hola-mako.site/x' });
  assert.doesNotMatch(sinDiseno, /img\.cdn\.com[^"]*;/, 'sin diseño editable la política no cambia');
});

test('11. la hoja del diseño: `sinBase` se guarda sólo en true, y una hoja de copia (hasta 600 KB) entra', () => {
  assert.deepEqual(sanearConfig({ diseno: { css: '.a{}', sinBase: true } }).config.diseno, { css: '.a{}', sinBase: true });
  assert.deepEqual(sanearConfig({ diseno: { css: '.a{}', sinBase: 'si' } }).config.diseno, { css: '.a{}' });
  assert.equal(TOPES.cssDiseno, 600_000);
  assert.equal(sanearConfig({ diseno: { css: `.a{color:red}${' '.repeat(300_000)}` } }).config.diseno?.css.length, 300_013);
});

test('12. la foto: compila, respeta las reglas de lo que se sirve, y el lector la saca ANTES de tocar nada cuando MaKo la pide', () => {
  assert.doesNotThrow(() => new Function(`return ${JS_INSTANTANEA}`));
  assert.ok(!JS_INSTANTANEA.includes('`') && !JS_INSTANTANEA.includes('${') && !JS_INSTANTANEA.includes('</'));
  const s = scriptLector('lecturaMedicion0001xyz', 'pixel', 'https://hola-mako.com');
  assert.ok(s && s.includes(JS_INSTANTANEA), 'el lector lleva la misma foto que mide el arnés');
  assert.doesNotThrow(() => new Function(s as string));
  assert.match(s as string, /conFoto = d\.foto === true;/);
  // La instantánea que corre el lector es la del fuente (desde el 9/11/2026 recibe `op`: «Replicar con la extensión»).
  const foto = (s as string).indexOf('foto = (' + JS_INSTANTANEA + ')();');
  assert.ok(foto > 0 && foto < (s as string).indexOf('tocando = true;\n      inicioToques'), 'la foto sale antes de los toques');
  // La cara de cada elemento ANTES de bajar (un header fijo cambia al bajar: Astra en reportei.com, la barra de respond.io).
  const antes = (s as string).indexOf('if (conFoto) { try { (' + JS_ANTES_DE_BAJAR + ')(); } catch (e) {} }');
  assert.ok(antes > 0 && antes < (s as string).indexOf('await bajarYSubir('), 'antes de bajar, no después');
  // Con la foto se baja DESPACIO (lo que se arma al verse mete su hoja: respond.io, 120 de 208 hojas a 60 ms por paso).
  assert.match(s as string, /await esperar\(conFoto \? 250 : 60\);/);
  assert.match(s as string, /conFoto = d\.foto === true; if \(conFoto\) TOPE = 40000;/);
  // Lo que se vio al bajar y se volvió a esconder (una aparición que se deshace al salir de pantalla: tryholo.ai) vuelve
  // a la cara con que se vio; la cara se anota en cada paso de la bajada.
  assert.ok((s as string).includes('var mirarVisibles = ' + JS_MIRAR_VISIBLES + ';'));
  assert.match(s as string, /await esperar\(conFoto \? 250 : 60\);\n\s*if \(conFoto\) mirarVisibles\(\);/);
  assert.match(JS_INSTANTANEA, /if \(enFijo\.has\(o\)\) volver\(o, c\);\n\s*else reaparecer\(o, c\);/);
  assert.match(JS_INSTANTANEA, /'opacity:' \+ v\.o \+ ' !important;visibility:visible !important;transform:' \+ v\.t \+ ' !important'/);
  assert.match(JS_INSTANTANEA, /if \(p === 'fixed' \|\| p === 'sticky'\)/);
  // El mensaje final: la foto viaja saneada; una sin cuerpo no viaja.
  const fin = (extra: Record<string, unknown>) => sanearMensajeLectura({ tipo: TIPO_MENSAJE_LECTURA, id: 'lecturaMedicion0001xyz', fase: 'fin', camino: 'pixel', titulo: 't', piezas: [], ms: 10, quieto: true, parcial: false, ...extra }, { id: 'lecturaMedicion0001xyz', url: 'https://competidor.com/' });
  const con = fin({ foto: { cuerpo: '<p>hola</p>', hojas: [], html: {}, body: {} } });
  assert.ok(con && con.fase === 'fin' && con.foto?.cuerpo === '<p>hola</p>');
  const sin = fin({});
  assert.ok(sin && sin.fase === 'fin' && !('foto' in sin));
  const mala = fin({ foto: { cuerpo: '' } });
  assert.ok(mala && mala.fase === 'fin' && !('foto' in mala));
});

test('13. los enchufes: la ruta y replicar llevan la foto, la pantalla arranca en la copia idéntica, y el editor edita lo de adentro', () => {
  const rep = fuente('lib/editor-landing/replicar.ts');
  assert.match(rep, /if \(receta\.via === 'fiel'\) return p\.foto !== undefined && p\.foto !== null \? replicarIdentica\(url, p\.foto, receta, avisar\) : replicarFiel\(url, receta\);/);
  assert.match(rep, /\{ \.\.\.receta\.config, diseno: \{ css: podada\.css, sinBase: true \} \}/);
  assert.match(rep, /rotulos\.forEach\(\(titulo, indice\) => avisar\(\{ fase: 'seccion', indice, titulo \}\)\);/);
  const ruta = fuente('app/api/landing-generator/replicar/route.ts');
  assert.match(ruta, /adaptar: b\.adaptar, foto: b\.foto \}, enviar\)/);
  assert.match(ruta, /adaptar: body\.adaptar, foto: body\.foto \}\)/);
  const pantalla = fuente('app/web-generator/crear/Replicar.tsx');
  assert.match(pantalla, /useState<PartesReplica>\(\(\) => \(adaptarInicial \? PARTES_ADAPTAR : PARTES_TODAS\)\)/);
  assert.match(pantalla, /useState<FormatoReplicar>\(\(\) => \(sonTodas\(partes\) \? 'web' :/);
  // Sin la foto de la extensión (9/11/2026, `conFotoExt`), la ventana de la foto se abre en el clic de «Replicar».
  assert.match(pantalla, /replicarLeida\(formato, formato === 'web' && !conFotoExt \? abrirEnElClic\(\) : undefined\)/);
  assert.match(pantalla, /leerEnNavegador\(url, \{ foto: true,/);
  assert.match(fuente('lib/editor-landing/lector-navegador.ts'), /fase: 'dale', \.\.\.\(opciones\.foto \? \{ foto: true \} : \{\}\)/);
  const vista = fuente('app/web-generator/editor/nodos/HtmlEditableVista.tsx');
  assert.match(vista, /const raiz = \(\) => documento\(\)\?\.querySelector\('\[' \+ ATTR_RAIZ_EDITABLE \+ '\]'\) \?\? documento\(\)\?\.querySelector\('\.' \+ CLASE_LIBRE\) \?\? null;/);
  assert.match(vista, /const medir = useCallback\(\(\) => \{\n\s*const r = cajaLibre\(\) as HTMLElement \| null;/);
  assert.match(fuente('app/web-generator/editor/extensiones/nodos.ts'), /attrsSinParseo\(\{ \.\.\.attrsHtmlEditable\(\{\}\), envoltorios: null \}\)/);
});

test('14. cada texto de la copia se ubica por su sección y se cambia solo («cambiá el título del hero»), y el chat lo LEE', () => {
  // Martín (28/10, ~09:50): la personalización viene después, por prompts sobre la copia. La sección de una copia se llama
  // por su primer título, el chat del editor lee sus textos (`textoDe`, como en las páginas de MaKo) y `conTextos` cambia
  // uno sin rehacer la sección (medido con la copia real de respond.io: 12 textos en el hero, cambió sólo el título).
  const html = '<section class="hero"><span class="pill">New</span><h1 class="t">Customers ask on chat.</h1><p>Most platforms can\'t.</p><a class="btn" href="#">Start Free Trial</a></section>';
  const t = tarjeta([{ type: NODO.htmlEditable, attrs: { id: nuevoId('e'), html, envoltorios: ['<div class="body">', '<main>'] } }]);
  assert.equal(rotuloDeSeccion(t), 'Customers ask on chat.');
  assert.match(textoDe(t), /Customers ask on chat\.[\s\S]*Most platforms can't\.[\s\S]*Start Free Trial/);
  const textos = textosDeHtmlEditable(html);
  assert.deepEqual(textos, ['New', 'Customers ask on chat.', "Most platforms can't.", 'Start Free Trial']);
  const otro = conTextos(html, textos.map((x, i) => (i === 1 ? 'Todos tus chats en un solo lugar' : x)));
  assert.equal(otro, html.replace('Customers ask on chat.', 'Todos tus chats en un solo lugar'), 'sólo el título; la sección, igual');
});

// ── La verificación de 5004dba08 (Cerebro, 28/10/2026: C:/dev/revisiones/2810-verificacion-5004dba08.md) ──────────────
// El iframe del editor es del MISMO origen que la app: lo que la copia pida a nuestros dominios sale con la sesión de quien
// edita. Las cargas son las del informe (sus scripts: C:/dev/revisiones/scratch-5004/).
const BS = String.fromCharCode(92);

test('15. el CSS se mira como lo lee el navegador: escapes, image-set, var(), y lo legítimo sigue (ALTO 1)', () => {
  for (const malo of [
    `.a{background-image:${BS}75 rl(/api/x)}`, `.b{cursor:u${BS}rl(/api/c),auto}`, '.c{background-image:image-set("/api/x" 1x)}',
    `@font-face{font-family:x;src:u${BS}rl(/api/f) format("woff2")}`, `@${BS}69mport url(https://evil.example/x.css);`,
    '.d{--u:"/api/x";background:image-set(var(--u) 1x)}', '.e{background:cross-fade(url(https://hola-mako.com/api/x), url(https://cdn.x.com/a.png))}',
    '.f{width:expression(alert(1))}',
  ]) assert.doesNotMatch(cssDisenoLimpio(malo), /(?:url|image-set|cross-fade)\([^)]*\/api|\\75|u\\rl|evil\.example|image-set\(var|expression/, malo);
  // (un string suelto en una variable, `--u:"/api/x"`, no pide nada: lo que lo usa como dirección es lo que se va)
  const bueno = `.g{fill:url(#grad)} .h{background:url(https://cdn.x.com/a.png)} .q::before{content:"${BS}201C"} @font-face{font-family:I;src:url(https://fonts.gstatic.com/i.woff2)} .i{background:image-set("https://cdn.x.com/a.png" 1x)} .s{--svg:url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")} @font-face{font-family:F;src:url("data:application/font-woff;charset=utf-8;base64,d09G")}`;
  assert.equal(cssDisenoLimpio(bueno), bueno, 'lo legítimo vuelve byte por byte (el gradiente, una imagen, un ícono en data:, una fuente)');
  assert.equal(cssSinEscapes(`${BS}75 rl(${BS}2f api)`), 'url(/api)');
  assert.deepEqual(referenciasDeCss('a{background:image-set("x.png" 1x, url(y.png) 2x)}'), ['y.png', 'x.png']);
  assert.equal(referenciasDeCss('a{background:image-set(attr(data-x) 1x)}'), null);
  assert.equal(cssSinCargasAjenas(`.a{color:red;background:u${BS}rl(/api/x);margin:0}`), '.a{color:red;;margin:0}');
});

test('16. el saneo: style y SVG con la misma vara, cualquier target sin opener, y sin raíz propia (ALTO 1 y 2, bajo)', () => {
  const r = sanear({
    html: `<div style="background-image:image-set('https://hola-mako.com/api/ads-manager/ad-aprobacion?ids=1' 1x)">a</div><div style="background:u${BS}rl(https://hola-mako.com/api/y)">b</div><svg><rect mask="url(https://hola-mako.com/api/x)" fill="url(#g)" clip-path="url(/api/z#c)"/></svg><a href="https://evil.example/" target="_BLANK" rel="opener">x</a><a href="https://ok.example/" target="pwn">y</a><div data-gm-raiz><p>z</p></div>`,
    envoltorios: [`<div style="background:u${BS}rl(/api/x)" data-gm-raiz>`],
  });
  assert.doesNotMatch(r.html, /\/api\//);
  assert.match(r.html, /fill="url\(#g\)"/, 'el gradiente de un SVG queda');
  assert.equal((r.html.match(/rel="noopener noreferrer"/g) ?? []).length, 2);
  assert.doesNotMatch(r.html + JSON.stringify(r.envoltorios), /rel="opener"|data-gm-raiz|\/api\//);
});

test('17. el iframe del editor de una copia lleva SU política (sus orígenes, nunca los nuestros) y no manda referrer; la publicada tampoco (ALTO 1, MEDIO 3)', () => {
  const d = documentoEditable(`<div style="background:${BS}75 rl(/api/x)"><img src="https://cdn.x.com/a.png"><img src="https://hola-mako.com/vsl-assets/x.png"></div>`, '.a{background:url(https://img.y.com/b.png)}', { sinBase: true });
  const csp = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(d)?.[1] ?? '';
  assert.match(csp, /img-src data: blob: [^;]*https:\/\/cdn\.x\.com/);
  assert.match(csp, /https:\/\/img\.y\.com/);
  assert.doesNotMatch(csp, /hola-mako|'self'|\*/, 'ni nuestros dominios ni comodines');
  assert.ok(d.indexOf('Content-Security-Policy') < d.indexOf('<style'), 'la política antes que cualquier cosa que cargue');
  assert.match(d, /<meta name="referrer" content="no-referrer">/);
  assert.doesNotMatch(documentoEditable('<p>x</p>', ''), /Content-Security-Policy|referrer/, 'un diseño de MaKo, como siempre');
  const pub = armarDocumento({ html: '<img src="https://rastreo.example/px.gif">', config: CONFIG_DEFAULT, cssDiseno: '.a{}', workspaceId: 3, modo: 'vista', urlCanonica: 'https://hola-mako.site/x' });
  assert.match(pub, /<meta name="referrer" content="no-referrer">/);
  // Un host con «;» no entra a la política (partía sus directivas).
  assert.deepEqual(origenesDeMedios('<img src="https://a;script-src.example/x.png"><img src="https://ok.example/y.png">', '').imagenes, ['https://ok.example']);
});

test('18. la copia no lleva a la otra: sus enlaces a «#», su agenda fuera (con su lugar), y la capa viva recortada (bajo, MEDIO 4)', () => {
  const r = sinDestinosAjenos('<iframe src="https://calendly.com/competidor/30min" referrerpolicy="unsafe-url" name="pwn" style="height:600px"></iframe><div data-calendly="https://calendly.com/x/y"></div><a href="https://app.competidor.com/signup">Probar</a><a href="#planes">Planes</a><iframe src="https://meetings.hubspot.com/competidor/demo"></iframe><iframe src="https://www.youtube.com/embed/x"></iframe>');
  assert.equal(r.agendas, 3);
  assert.equal(r.enlaces, 1);
  assert.doesNotMatch(r.html, /src="https:\/\/(?:calendly\.com|meetings\.hubspot)|data-calendly|competidor\.com\/signup|unsafe-url/);
  assert.match(r.html, /<div style="height:600px" data-gm-agenda-original="calendly\.com"><\/div>/, 'su lugar queda, marcado');
  assert.match(r.html, /href="#planes"/);
  assert.match(r.html, /youtube\.com\/embed/, 'un video no es una agenda');
  const rep = fuente('lib/editor-landing/replicar.ts');
  assert.match(rep, /const d = sinDestinosAjenos\(limpio\);/);
  const vista = fuente('app/web-generator/editor/nodos/HtmlEditableVista.tsx');
  assert.match(vista, /const lugar = \(el: Element\) => \{\n\s*const r = recortarALaCaja\(el\.getBoundingClientRect\(\)\);/);
  assert.match(vista, /return \{ x, y, w: Math\.min\(ancho, r\.right\) - x, h: Math\.min\(alto, r\.bottom\) - y \};/);
});
