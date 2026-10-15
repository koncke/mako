// =============================================================================
// Replicar con el ESTILO de la original: colores, fuentes e imágenes (tanda 6, decisión d)
// =============================================================================
// Decisión de Martín (14/10/2026, docs/relevo/landing-generator.md, «Tanda 6» punto d): «Replicar en el
// editor» pregunta 3 formatos, y «al replicar como landing se COPIA el estilo (colores y fuentes leídos
// en el navegador → tema propio; imágenes al bucket), nada de fotos de stock».
//
// Lo que fija este archivo (lib/editor-landing/estilo-original.ts, estilo-aplicar.ts, el lector y los
// enchufes de replicar.ts):
//   1. los colores de CSS que devuelve un navegador (rgb, hsl, oklch de Tailwind 4, el HSL pelado de
//      shadcn) → #hex, y lo transparente afuera; los degradados en la única forma que acepta un tema;
//   2. las fuentes: la MISMA del catálogo si está, si no la más parecida; el catálogo nuevo con pesos;
//   3. el saneo de lo que manda una página ajena (forma, topes, URLs que no son imágenes);
//   4. el estilo sacado del HTML (variables, Google Fonts, theme-color, fondos, imágenes) y de una app de
//      Tailwind/shadcn (el modo oscuro NO cuenta);
//   5. el tema propio: legible (el contraste corregido hacia el más cercano), con un id estable;
//   6. qué sección es cuál (por el título) y dónde va cada imagen y cada fondo; la imagen que no se copió
//      deja el marcador;
//   7. el lector manda el estilo y el server lo recibe; replicar.ts lo enchufa.
//
// LO QUE NO SE PUEDE PROBAR ACÁ (no hay navegador en node:test) se midió el 14/10/2026: `leerEstilo` del
// lector en Chromium headless sobre una landing de prueba servida por http (fondo oscuro, palabra del
// título con degradado, botón píldora, una sección clara en oklch, imagen de fondo en el hero, un logo):
// salieron fondo #0b1020, acento #38bdf8 (el degradado de la palabra), botón #2563eb «xl», Fraunces /
// Plus Jakarta Sans, la sección clara #fafafa y las 4 imágenes cada una con su parte (el logo afuera).
// Y el camino del server contra páginas públicas (sólo lectura por HTTP): webflow.com dio botón y acento
// #146ef5 y 44 títulos (60 antes de saltear el <nav>: su megamenú los llenaba), wordpress.org fondos de
// sección #f6f6f6/#1e1e1e y EB Garamond / Inter exactas.
//
// PROBADO ROMPIÉNDOLO (14/10/2026): ver el bloque «ROTURAS» al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PARECIDAS, TOPES_ESTILO, colorCss, colorDeFondoCss, colorLegible, degradadoCss, estiloDeHtml, estiloDeLectura,
  familiaCss, familiasGoogle, fuenteDelCatalogo, hojasDeHtml, sanearEstilo, temaDeEstilo, type EstiloOriginal,
} from '../lib/editor-landing/estilo-original';
import {
  TOPES_IMAGENES_REPLICA, aplicarEstilo, asignarSecciones, imagenesParaSubir, imagenesQueFaltan, partesDeCadaSeccion,
} from '../lib/editor-landing/estilo-aplicar';
import { FUENTES, contraste, sanearTemaPropio, temaPorId, urlFuentes } from '../lib/editor-landing/temas';
import { aLecturaDelServer, sanearMensajeLectura } from '../lib/editor-landing/lector';
import { JS_LECTOR } from '../lib/editor-landing/lector-script';
import { sanearLectura } from '../lib/editor-landing/lectura-reglas';
import { ATTRS_TARJETA_DEFAULT, type JsonNodo } from '../lib/editor-landing/doc';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const URL_L = 'https://www.ejemplo.com/oferta';

// ── 1. Los colores ────────────────────────────────────────────────────────────

test('colorCss: lo que devuelve un navegador → #hex; lo transparente y lo que no es un color, null', () => {
  assert.equal(colorCss('#FFF'), '#ffffff');
  assert.equal(colorCss('#2563eb'), '#2563eb');
  assert.equal(colorCss('#2563ebcc'), '#2563eb', 'con alfa alta, el color');
  assert.equal(colorCss('#2563eb33'), null, 'con alfa baja no es un fondo');
  assert.equal(colorCss('rgb(37, 99, 235)'), '#2563eb');
  assert.equal(colorCss('rgb(37 99 235 / 0.9)'), '#2563eb');
  assert.equal(colorCss('rgba(0, 0, 0, 0)'), null, 'el «transparent» computado');
  assert.equal(colorCss('transparent'), null);
  assert.equal(colorCss('hsl(221.2 83.2% 53.3%)'), '#2563eb');
  assert.equal(colorCss('hsl(0, 0%, 100%)'), '#ffffff');
  assert.equal(colorCss('oklch(0.985 0 0)'), '#fafafa', 'Tailwind 4 / shadcn nuevo: Chrome lo deja en oklch');
  assert.equal(colorCss('oklch(0.546 0.245 262.881)'), '#155dfc', 'blue-600 de Tailwind 4');
  assert.equal(colorCss('oklch(54.6% 0.245 262.881 / 0.2)'), null);
  assert.equal(colorCss('221.2 83.2% 53.3%'), null, 'el HSL pelado sólo como variable');
  assert.equal(colorCss('221.2 83.2% 53.3%', { tupla: true }), '#2563eb', 'shadcn: hsl(var(--primary))');
  assert.equal(colorCss('37 99 235', { tupla: true }), '#2563eb');
  assert.equal(colorCss('White'), '#ffffff');
  assert.equal(colorCss('red;}</style><script>'), null);
  assert.equal(colorCss('var(--x)'), null);
  assert.equal(colorCss(42), null);
});

test('degradadoCss: la única forma que acepta un tema (grados, #hex, %), o null', () => {
  assert.equal(degradadoCss('linear-gradient(to right, rgb(56, 189, 248), rgb(129, 140, 248))'), 'linear-gradient(90deg, #38bdf8, #818cf8)');
  assert.equal(
    degradadoCss('linear-gradient(to right in oklab, oklch(0.546 0.245 262.881) 0%, oklch(0.985 0 0) 100%)'),
    'linear-gradient(90deg, #155dfc 0%, #fafafa 100%)', 'Tailwind 4 interpola «in oklab»',
  );
  assert.equal(degradadoCss('linear-gradient(135deg, #111 10px, #222 50%)'), 'linear-gradient(135deg, #111111, #222222 50%)', 'una posición en px se suelta');
  assert.equal(degradadoCss('url(a.png), linear-gradient(-90deg, red, blue)'), 'linear-gradient(270deg, #ff0000, #0000ff)', 'la primera capa con degradado');
  assert.equal(degradadoCss('linear-gradient(90deg, rgba(0,0,0,0), #fff)'), null, 'un color transparente: no se puede escribir');
  assert.equal(degradadoCss('radial-gradient(#fff, #000)'), null);
  assert.equal(degradadoCss('linear-gradient(#fff)'), null, 'un solo color no es un degradado');
  assert.equal(colorDeFondoCss('linear-gradient(90deg, #ff0000, #0000ff)'), '#ff0000', 'el fondo de un degradado: su primer color');
  assert.equal(colorDeFondoCss('#0f172a url(/x.png) no-repeat center'), '#0f172a', 'el atajo `background`');
});

// ── 2. Las fuentes ────────────────────────────────────────────────────────────

test('fuentes: la MISMA del catálogo si está; si no, la más parecida; next/font y las genéricas', () => {
  assert.equal(familiaCss('"Plus Jakarta Sans", ui-sans-serif, sans-serif'), 'Plus Jakarta Sans');
  assert.equal(familiaCss('__Inter_d65c78, __Inter_Fallback_d65c78'), 'Inter', 'next/font');
  assert.equal(familiaCss('ui-sans-serif, system-ui, "Apple Color Emoji"'), 'ui-sans-serif', 'sólo genéricas: la primera');
  assert.deepEqual(fuenteDelCatalogo('poppins'), { familia: 'Poppins', exacta: true }, 'sin importar mayúsculas');
  assert.deepEqual(fuenteDelCatalogo('Mulish'), { familia: 'Mulish', exacta: true }, 'una de las 47 sumadas a FUENTES');
  assert.deepEqual(fuenteDelCatalogo('Source Sans Pro'), { familia: 'Source Sans 3', exacta: false });
  assert.deepEqual(fuenteDelCatalogo('Helvetica Neue'), { familia: 'Arimo', exacta: false }, 'Arimo tiene las medidas de Arial');
  assert.deepEqual(fuenteDelCatalogo('Gilroy'), { familia: 'Plus Jakarta Sans', exacta: false });
  assert.deepEqual(fuenteDelCatalogo('Roboto Flex'), { familia: 'Roboto', exacta: false }, 'una del catálogo con el mismo comienzo');
  assert.deepEqual(fuenteDelCatalogo('Mi Serif Comercial'), { familia: 'Source Serif 4', exacta: false });
  assert.deepEqual(fuenteDelCatalogo('Fuente Rara'), { familia: 'Inter', exacta: false });
  assert.equal(fuenteDelCatalogo(null), null);
  for (const [k, f] of Object.entries(PARECIDAS)) assert.ok(FUENTES[f], `PARECIDAS.${k} → «${f}» no está en el catálogo`);
});

test('el catálogo de fuentes que creció: pesos ordenados y la hoja de Google Fonts los pide', () => {
  const nuevas = ['Barlow', 'Mulish', 'Karla', 'Figtree', 'Lexend', 'Ubuntu', 'PT Sans', 'Roboto Slab', 'EB Garamond', 'Caveat', 'Roboto Mono'];
  for (const f of nuevas) {
    const d = FUENTES[f];
    assert.ok(d, `${f} no está`);
    assert.deepEqual([...d.pesos], [...d.pesos].sort((a, b) => a - b), `${f}: pesos sin orden`);
  }
  // PT Sans sólo publica 400 y 700 (medido): un 300 tumbaría la hoja ENTERA.
  assert.deepEqual([...FUENTES['PT Sans'].pesos], [400, 700]);
  const t = sanearTemaPropio({ id: 'x', nombre: 'x', base: 'commons', cambios: { fuentes: { titulo: { familia: 'PT Sans', peso: 300 } } } })!;
  assert.match(urlFuentes([temaPorId('ws:x', [t])]), /family=PT\+Sans:wght@400(;700)?&/, 'un peso que no existe se lleva al más cercano publicado');
});

// ── 3. El saneo de lo que manda la página ─────────────────────────────────────

/** Lo que mandó `leerEstilo` en Chromium sobre la landing de prueba (ver la cabecera), congelado. */
const LEIDO = {
  fondo: 'rgb(11, 16, 32)', texto: 'rgb(203, 213, 225)', titulo: 'rgb(255, 255, 255)', tituloDegradado: '',
  acento: 'linear-gradient(to right, rgb(56, 189, 248), rgb(129, 140, 248))', enlace: 'rgb(56, 189, 248)',
  boton: 'rgb(37, 99, 235)', botonDegradado: '', botonTexto: 'rgb(255, 255, 255)', radioBoton: 9999, altoBoton: 49,
  fuenteTitulo: 'Fraunces, serif', fuenteCuerpo: '"Plus Jakarta Sans", ui-sans-serif, sans-serif', pesoTitulo: '800', pesoCuerpo: '400',
  secciones: [
    { titulo: 'Crece tu negocio hoy', fondo: 'rgb(11, 16, 32)' },
    { titulo: 'Cómo trabajamos', fondo: 'oklch(0.985 0 0)' },
    { titulo: 'Resultados', fondo: 'rgb(11, 16, 32)' },
  ],
  imagenes: [
    { url: 'https://cdn.ejemplo.com/fondo.jpg', seccion: 0, fondo: true, ancho: 1585, alto: 480 },
    { url: 'https://cdn.ejemplo.com/foto-1.jpg', seccion: 1, fondo: false, ancho: 420, alto: 280 },
    { url: 'https://cdn.ejemplo.com/foto-2.jpg', seccion: 2, fondo: false, ancho: 420, alto: 280 },
    { url: 'https://cdn.ejemplo.com/foto-3.jpg', seccion: 2, fondo: false, ancho: 420, alto: 280 },
  ],
};

test('sanearEstilo: lo crudo del navegador → #hex y familias; dos veces da lo mismo', () => {
  const e = sanearEstilo(LEIDO);
  assert.ok(e);
  assert.equal(e.fondo, '#0b1020');
  assert.equal(e.acento, '#38bdf8', 'el acento con degradado: su primer color');
  assert.equal(e.boton, '#2563eb');
  assert.equal(e.fuenteTitulo, 'Fraunces');
  assert.equal(e.fuenteCuerpo, 'Plus Jakarta Sans');
  assert.equal(e.pesoTitulo, 800);
  assert.deepEqual(e.secciones.map((s) => s.fondo), ['#0b1020', '#fafafa', '#0b1020']);
  assert.deepEqual(sanearEstilo(JSON.parse(JSON.stringify(e))), e, 'no es idempotente: el server lo vuelve a sanear');
  assert.equal(sanearEstilo(null), null);
  assert.equal(sanearEstilo({ fondo: 'transparent', secciones: [] }), null, 'nada usable = sin estilo');
});

test('sanearEstilo: topes y lo que no es una imagen de la página', () => {
  const muchas = Array.from({ length: 100 }, (_, i) => ({ url: `https://cdn.ejemplo.com/f${i}.jpg`, seccion: i % 70, fondo: false, ancho: 400, alto: 300 }));
  const secciones = Array.from({ length: 80 }, (_, i) => ({ titulo: `Título ${i} ` + 'x'.repeat(300), fondo: '#fff' }));
  const e = sanearEstilo({ fondo: '#fff', secciones, imagenes: [
    { url: 'javascript:alert(1)', seccion: 0 },
    { url: 'data:image/png;base64,AAAA', seccion: 0 },
    { url: 'https://cdn.ejemplo.com/logo.svg', seccion: 0 },
    { url: 'https://www.facebook.com/tr?id=1&ev=PageView', seccion: 0 },
    { url: 'https://cdn.ejemplo.com/con espacio.jpg', seccion: 0 },
    ...muchas,
  ] })!;
  assert.equal(e.secciones.length, TOPES_ESTILO.secciones);
  assert.ok(e.secciones.every((s) => s.titulo.length <= TOPES_ESTILO.titulo));
  assert.equal(e.imagenes.length, TOPES_ESTILO.imagenes);
  assert.ok(e.imagenes.every((i) => i.url.startsWith('https://cdn.ejemplo.com/f')), 'se colaron URLs que no son imágenes de la página');
  assert.ok(e.imagenes.every((i) => i.seccion < TOPES_ESTILO.secciones), 'una imagen de una parte fuera del tope no tiene a dónde ir');
});

// ── 4. El estilo sacado del HTML ──────────────────────────────────────────────

const HTML_SSR = `<!doctype html><html><head>
<meta name="theme-color" content="#e11d48">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Playfair+Display:wght@700&display=swap">
<link rel="stylesheet" href="/wp-content/themes/x/estilo.css">
<link rel="stylesheet" href="https://cdn.otro.com/font-awesome.min.css">
<meta property="og:image" content="/og.jpg">
<style>
:root{--e-global-color-primary:#E11D48;--e-global-color-text:#333333}
body{background-color:#fffaf5;color:var(--e-global-color-text);font-family:"Montserrat",sans-serif}
h1{font-family:'Playfair Display',serif;font-weight:700;color:#1a1a1a}
.btn-cta{background:var(--e-global-color-primary);color:#fff;border-radius:50px}
@media (prefers-color-scheme: dark){body{background-color:#000;color:#fff}}
</style></head><body>
<nav><h3>Menú del sitio</h3><img src="/menu-foto.jpg" width="400" height="300"></nav>
<header><img src="/logo.png" class="site-logo" alt="Logo"></header>
<section style="background-color:#0f172a"><h1>Tu negocio, <em>al siguiente nivel</em></h1>
<img srcset="/hero-480.jpg 480w, /hero-1200.jpg 1200w" src="/hero-480.jpg" alt="hero">
<a class="btn-cta" href="#agenda">Agenda</a></section>
<section><h2>Lo que hacemos</h2><img data-src="/servicio.webp" src="data:image/gif;base64,R0lGOD" width="600" height="400">
<img src="https://www.facebook.com/tr?id=1" width="1" height="1"><a class="btn-cta" href="#agenda">Agenda</a></section>
<section class="banda"><div style="background-image:url('/banda.jpg')"><h2>Testimonios</h2></div></section>
</body></html>`;

test('estiloDeHtml: variables, Google Fonts, theme-color, fondos de sección e imágenes (sin el <nav>)', () => {
  const e = estiloDeHtml(HTML_SSR, URL_L);
  assert.equal(e.fondo, '#fffaf5');
  assert.equal(e.texto, '#333333', 'resuelve var(--e-global-color-text)');
  assert.equal(e.titulo, '#1a1a1a');
  assert.equal(e.fuenteTitulo, 'Playfair Display');
  assert.equal(e.fuenteCuerpo, 'Montserrat');
  assert.equal(e.boton, '#e11d48', 'el botón que más se repite, con su clase');
  assert.equal(e.botonTexto, '#ffffff');
  assert.equal(e.radioBoton, 50);
  assert.equal(e.acento, '#e11d48', 'Elementor: el primary');
  assert.deepEqual(e.secciones.map((s) => [s.titulo, s.fondo]), [
    ['Tu negocio, al siguiente nivel', '#0f172a'],
    ['Lo que hacemos', '#fffaf5'],
    ['Testimonios', '#fffaf5'],
  ], 'el título del <nav> no es una parte de la página; detrás de un título sin fondo propio, el de la página (y el modo oscuro no lo pisa)');
  assert.deepEqual(e.imagenes.map((i) => [i.url, i.seccion, i.fondo]), [
    ['https://www.ejemplo.com/hero-1200.jpg', 0, false],
    ['https://www.ejemplo.com/servicio.webp', 1, false],
    ['https://www.ejemplo.com/banda.jpg', 2, true],
  ], 'el srcset más grande, el data-src del lazy, la imagen de fondo con SU título; sin logo, sin píxel, sin el <nav>');
  assert.deepEqual(hojasDeHtml(HTML_SSR, URL_L), ['https://www.ejemplo.com/wp-content/themes/x/estilo.css'], 'sus hojas, no las de íconos ni Google Fonts');
  assert.deepEqual(familiasGoogle(HTML_SSR), ['Montserrat', 'Playfair Display']);
  const sinImg = estiloDeHtml('<html><head><meta property="og:image" content="/og.jpg"></head><body><h1>Hola</h1></body></html>', URL_L);
  assert.deepEqual(sinImg.imagenes.map((i) => i.url), ['https://www.ejemplo.com/og.jpg'], 'sin <img>, el og:image');
});

const HTML_APP = '<!doctype html><html lang="es"><head><script type="module" crossorigin src="/assets/index-a1.js"></script><link rel="stylesheet" crossorigin href="/assets/index-b2.css"></head><body><div id="root"></div></body></html>';
const CSS_APP = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
@layer base{:root{--background:40 33% 98%;--foreground:222 47% 11%;--primary:24 95% 53%;--primary-foreground:0 0% 100%;--accent:210 40% 96%;--radius:.75rem}
.dark{--background:222 47% 11%;--foreground:210 40% 98%;--primary:24 95% 60%}}
@layer base{body{background-color:hsl(var(--background));color:hsl(var(--foreground));font-family:Outfit,sans-serif}}
.bg-primary{background-color:hsl(var(--primary))}`;

test('estiloDeHtml: una app de Tailwind/shadcn (el HTML vacío y la hoja): las variables de :root, no las de .dark', () => {
  assert.deepEqual(hojasDeHtml(HTML_APP, URL_L), ['https://www.ejemplo.com/assets/index-b2.css']);
  const e = estiloDeHtml(HTML_APP, URL_L, [CSS_APP]);
  assert.equal(e.fondo, colorCss('hsl(40 33% 98%)'));
  assert.equal(e.texto, colorCss('hsl(222 47% 11%)'));
  assert.equal(e.boton, colorCss('hsl(24 95% 53%)'), 'sin botones en el HTML: el --primary');
  assert.equal(e.botonTexto, '#ffffff');
  assert.equal(e.acento, colorCss('hsl(24 95% 53%)'), 'en shadcn --accent es un gris de fondo: el acento es el primary');
  assert.equal(e.radioBoton, 12);
  assert.equal(e.fuenteCuerpo, 'Outfit');
});

// ── 5. El tema propio ─────────────────────────────────────────────────────────

test('colorLegible: corrige hacia el legible MÁS CERCANO, del lado que menos cambia', () => {
  const gris = colorLegible('#9ca3af', '#ffffff', 4.5);
  assert.ok(contraste(gris, '#ffffff') >= 4.5);
  assert.ok(contraste(gris, '#ffffff') < 5.2, `${gris}: se corrió de más`);
  const sobreOscuro = colorLegible('#4b5563', '#111827', 4.5);
  assert.ok(contraste(sobreOscuro, '#111827') >= 4.5);
  assert.ok(parseInt(sobreOscuro.slice(1, 3), 16) > 0x4b, 'sobre un fondo oscuro se aclara');
  assert.ok(contraste(sobreOscuro, '#111827') < 5.5, `${sobreOscuro}: se fue al blanco, no al legible más cercano`);
  assert.equal(colorLegible('#111111', '#ffffff', 4.5), '#111111', 'lo que ya se lee no se toca');
});

test('temaDeEstilo: un tema propio legible, con la fuente del catálogo y un id estable', () => {
  const e = sanearEstilo(LEIDO)!;
  const t = temaDeEstilo(e, URL_L)!;
  assert.ok(t);
  assert.match(t.id, /^copia-ejemplo-com-[0-9a-f]{6}$/);
  assert.ok(t.id.length <= 40, 'ID_PROPIO de temas.ts admite 40');
  assert.equal(t.nombre, 'Estilo de ejemplo.com');
  assert.equal(t.base, 'onyx', 'una página oscura arma sobre un tema oscuro');
  assert.deepEqual(sanearTemaPropio(t), t, 'el tema no pasa su propio saneo');
  assert.equal(temaDeEstilo(sanearEstilo(JSON.parse(JSON.stringify(LEIDO))), URL_L)?.id, t.id, 'el mismo estilo, otro id: se duplicaría al replicar dos veces');
  const tema = temaPorId(`ws:${t.id}`, [t]);
  assert.equal(tema.grupo, 'oscuro');
  assert.equal(tema.fondo, '#0b1020');
  assert.equal(tema.tarjeta.fondo, '#0b1020', 'la tarjeta del color de la página: las secciones pegadas como en el original');
  assert.equal(tema.colores.boton, '#2563eb');
  assert.equal(tema.colores.acento, '#38bdf8');
  assert.equal(tema.redondez.boton, 'xl', 'botón píldora');
  assert.deepEqual([tema.fuentes.titulo, tema.fuentes.cuerpo], [{ familia: 'Fraunces', peso: 800 }, { familia: 'Plus Jakarta Sans', peso: 400 }]);
  assert.ok(contraste(tema.colores.texto, '#0b1020') >= 4.5);

  // Un par ilegible se corrige; un botón blanco sobre blanco cae al acento.
  const malo = temaPorId('ws:m', [temaDeEstilo({ ...e, fondo: '#ffffff', texto: '#c0c0c0', titulo: '#dddddd', boton: '#fefefe', botonTexto: '#ffffff', acento: '#e11d48', secciones: [], imagenes: [] }, 'https://x.com')!].map((x) => ({ ...x, id: 'm' })));
  assert.ok(contraste(malo.colores.texto, '#ffffff') >= 4.5, 'texto ilegible');
  assert.ok(contraste(malo.colores.titulo, '#ffffff') >= 3, 'título ilegible');
  assert.equal(malo.colores.boton, '#e11d48', 'un botón que no se distingue del fondo');
  assert.ok(contraste(malo.colores.botonTexto, malo.colores.boton) >= 3);
  assert.equal(temaDeEstilo(null, URL_L), null);
  assert.equal(temaDeEstilo({ ...e, fondo: null, texto: null, titulo: null, acento: null, boton: null, botonDegradado: null, fuenteCuerpo: null, fuenteTitulo: null }, URL_L), null, 'sólo imágenes: sin tema');
});

// ── 6. Qué sección es cuál, y dónde va cada cosa ──────────────────────────────

test('asignarSecciones: por el título, en orden, y el hueco exacto del medio', () => {
  const orig = ['Crece tu negocio hoy', 'Cómo trabajamos', 'Resultados', 'Preguntas frecuentes', 'Agenda tu llamada'].map((titulo) => ({ titulo }));
  assert.deepEqual(asignarSecciones([{ titulo: 'Crece tu negocio hoy' }, { titulo: 'Sección' }, { titulo: 'resultados' }, { titulo: 'Preguntas Frecuentes' }], orig), [0, 1, 2, 3]);
  assert.deepEqual(asignarSecciones([{ titulo: 'Cómo trabajamos contigo' }, { titulo: 'Algo inventado' }], orig), [1, null], 'contiene al otro; lo que no está, null');
  assert.deepEqual(asignarSecciones([{ titulo: 'Agenda tu llamada' }, { titulo: 'Crece tu negocio hoy' }], orig), [4, null], 'nunca para atrás');
  const largo = Array.from({ length: 30 }, (_, i) => ({ titulo: `Menú ${i}` })).concat(orig);
  assert.deepEqual(asignarSecciones([{ titulo: 'Crece tu negocio hoy' }], largo), [30], 'la primera se busca en todo el original');
  assert.deepEqual(partesDeCadaSeccion([0, null, 3], 5), [[0, 1, 2], [], [3, 4]], 'una diapositiva se queda con las partes que condensa');
});

const bucket = (u: string) => `https://almacen.ejemplo.com/landing-imagenes/3/${u.split('/').pop()}`;
const tarjeta = (attrs: Record<string, unknown>, content: JsonNodo[] = [{ type: 'paragraph' }]): JsonNodo =>
  ({ type: 'tarjeta', attrs: { ...ATTRS_TARJETA_DEFAULT, id: `t${Math.random()}`, ...attrs }, content });
const galeria = (n: number): JsonNodo => ({
  type: 'optimizado', attrs: { variante: 'galeria', columnas: 3, mostrarIconos: false },
  content: Array.from({ length: n }, () => ({ type: 'optimizadoItem', attrs: { icono: null, imagenSrc: null, valor: '', destacado: false }, content: [{ type: 'paragraph' }] })),
});

test('aplicarEstilo: cada imagen a SU sección, los fondos distintos, y la que falló deja el marcador', () => {
  const e = sanearEstilo(LEIDO)!;
  const asig = [0, 1, 2, null];
  const tarjetas = [
    tarjeta({ diseno: 'sin' }),
    tarjeta({ diseno: 'derecha', imagenSrc: null, fondo: 'acento' }),
    tarjeta({ diseno: 'arriba', imagenSrc: null }, [galeria(2)]),
    tarjeta({ diseno: 'izquierda', imagenSrc: null }),
  ];
  const antes = JSON.stringify(tarjetas);
  // foto-3 «no se pudo copiar»: no está en las subidas.
  const subidas = new Map(['https://cdn.ejemplo.com/fondo.jpg', 'https://cdn.ejemplo.com/foto-1.jpg', 'https://cdn.ejemplo.com/foto-2.jpg'].map((u) => [u, bucket(u)]));
  const r = aplicarEstilo(tarjetas, asig, e, subidas, { fondoTema: '#0b1020' });
  assert.equal(JSON.stringify(tarjetas), antes, 'mutó la entrada');
  const [a, b, c, d] = r.tarjetas.map((t) => t.attrs!);
  assert.deepEqual([a.diseno, a.superposicion, a.imagenSrc], ['fondo', 'oscura', bucket('fondo.jpg')], 'el hero sin imagen: su imagen de fondo, con la superposición oscura');
  assert.equal(b.imagenSrc, bucket('foto-1.jpg'));
  assert.deepEqual([b.fondo, b.fondoColor], ['color', '#fafafa'], 'la sección clara del original conserva su fondo');
  assert.deepEqual([a.fondo, a.fondoColor], ['tema', null], 'la del color de la página va con el tema');
  assert.equal(c.imagenSrc, bucket('foto-2.jpg'));
  const items = r.tarjetas[2].content![0].content!.map((x) => x.attrs!.imagenSrc);
  assert.deepEqual(items, [null, null], 'foto-3 no se copió: los ítems quedan con su marcador, nunca con la URL del tercero');
  assert.equal(d.imagenSrc, null, 'una sección sin asignar no recibe una imagen ajena');
  assert.equal(r.imagenes, 3);
  assert.equal(r.fondos, 1);
  const sinTema = aplicarEstilo(tarjetas, asig, e, subidas, { fondoTema: null });
  assert.deepEqual([sinTema.tarjetas[1].attrs!.fondo, sinTema.tarjetas[1].attrs!.fondoColor], ['acento', null], 'sin tema copiado, los fondos de la IA no se tocan');
  assert.ok(!JSON.stringify(r.tarjetas).includes('cdn.ejemplo.com'), 'una URL del tercero llegó al documento');
  // Si la primera de una sección no se copió, va la siguiente que sí (el hueco no queda vacío por eso).
  const sinFoto2 = new Map(['https://cdn.ejemplo.com/foto-3.jpg'].map((u) => [u, bucket(u)]));
  assert.equal(aplicarEstilo(tarjetas, asig, e, sinFoto2, { fondoTema: '#0b1020' }).tarjetas[2].attrs!.imagenSrc, bucket('foto-3.jpg'));
});

test('las imágenes a subir: la primera de cada sección ya, el resto sólo si hay huecos, con topes', () => {
  const e = sanearEstilo(LEIDO)!;
  const asig = [0, 1, 2];
  const { primeras, resto } = imagenesParaSubir(asig, e);
  assert.deepEqual(primeras, ['https://cdn.ejemplo.com/fondo.jpg', 'https://cdn.ejemplo.com/foto-1.jpg', 'https://cdn.ejemplo.com/foto-2.jpg']);
  assert.deepEqual(resto, ['https://cdn.ejemplo.com/foto-3.jpg']);
  const subidas = new Map(primeras.map((u) => [u, bucket(u)]));
  const conGaleria = [tarjeta({ diseno: 'sin' }), tarjeta({ diseno: 'sin' }), tarjeta({ diseno: 'derecha', imagenSrc: null }, [galeria(2)])];
  assert.deepEqual(imagenesQueFaltan(conGaleria, asig, e, subidas), ['https://cdn.ejemplo.com/foto-3.jpg'], 'la galería tiene huecos: se sube');
  const sinHuecos = [tarjeta({ diseno: 'sin' }), tarjeta({ diseno: 'sin' }), tarjeta({ diseno: 'sin' })];
  assert.deepEqual(imagenesQueFaltan(sinHuecos, asig, e, subidas), [], 'sin dónde ponerla no se sube (quedaría huérfana en el bucket)');
  const muchas: EstiloOriginal = { ...e, secciones: Array.from({ length: 20 }, (_, i) => ({ titulo: `T${i}`, fondo: null })),
    imagenes: Array.from({ length: 24 }, (_, i) => ({ url: `https://cdn.ejemplo.com/m${i}.jpg`, seccion: i % 20, fondo: false, ancho: 400, alto: 300 })) };
  const todas = imagenesParaSubir(Array.from({ length: 20 }, (_, i) => i), muchas);
  assert.equal(todas.primeras.length, TOPES_IMAGENES_REPLICA.total);
  assert.equal(todas.resto.length, 0, 'el tope es de la réplica entera');
});

// ── 7. El lector manda el estilo; replicar.ts lo enchufa ──────────────────────

test('el lector: lee el estilo antes de tocar nada y lo manda; MaKo lo sanea y lo pasa al server', () => {
  assert.ok(JS_LECTOR.includes('function leerEstilo()'));
  const lee = JS_LECTOR.indexOf('estiloLeido = leerEstilo()');
  assert.ok(lee > 0 && lee < JS_LECTOR.indexOf('tocando = true;'), 'el estilo se lee después de tocar botones (con un modal abierto)');
  assert.match(JS_LECTOR, /parcial: !!parcial \|\| tarde\(\), estilo: estilo \}\);/);
  const m = sanearMensajeLectura({ tipo: 'mako-lectura', id: 'abcdefghijklmnopQRSTUV_-12', fase: 'fin', camino: 'ventana', titulo: 'T', ms: 1, quieto: true, parcial: false,
    piezas: [{ tipo: 'texto', texto: '# Crece tu negocio hoy' }], estilo: LEIDO }, { id: 'abcdefghijklmnopQRSTUV_-12', url: URL_L });
  assert.ok(m?.fase === 'fin');
  assert.equal(m.detalle.estilo?.boton, '#2563eb', 'el estilo se perdió en el mensaje');
  const alServer = aLecturaDelServer(m.detalle);
  assert.equal(alServer.estilo?.fondo, '#0b1020');
  const ida = JSON.parse(JSON.stringify(alServer));
  assert.ok(sanearLectura(ida), 'con el estilo, el server rechaza la lectura (Importar y el Diagnóstico la usan igual)');
  assert.deepEqual(estiloDeLectura(ida), m.detalle.estilo, 'Replicar no recibe el estilo que mandó el lector');
  const sinEstilo = sanearMensajeLectura({ tipo: 'mako-lectura', id: 'abcdefghijklmnopQRSTUV_-12', fase: 'fin', camino: 'ventana', piezas: [], estilo: { fondo: 'javascript:x' } }, { id: 'abcdefghijklmnopQRSTUV_-12', url: URL_L });
  assert.ok(sinEstilo?.fase === 'fin' && !('estilo' in sinEstilo.detalle), 'un estilo sin nada usable no viaja');
});

test('replicar.ts: el estilo en paralelo, el tema propio reusado, las imágenes al bucket; la copia fiel no cambia', () => {
  const rep = sinComentarios(leer('lib/editor-landing/replicar.ts'));
  assert.match(rep, /const leido = estiloDeLectura\(entrada\.lectura\);/);
  assert.match(rep, /leido \? Promise\.resolve\(leido\) : estiloDeLaPagina\(url\)/, 'sin lectura, el HTML que baja el server');
  assert.match(rep, /const tema = await temaParaLaCopia\(estilo, url\);/);
  assert.match(rep, /tema: `ws:\$\{tema\.tema\.id\}`/, 'la landing nace con el tema propio');
  assert.match(rep, /\.find\(\(t\) => t\.id === tema\.id\);\s*if \(ya\) return \{ ok: true, tema: ya \};/, 'el mismo estilo replicado otra vez pisaría el tema que la persona cambió');
  assert.match(rep, /aplicarEstilo\(tarjetas, asig, estilo, subidas, \{ fondoTema \}\)[\s\S]*crearLanding\(esq\.titulo, contenido, config\)/);
  const fiel = rep.slice(rep.indexOf('async function replicarFiel'), rep.indexOf('async function replicarComoBloques'));
  assert.doesNotMatch(fiel, /estilo|subirImagenes|temaParaLaCopia/, 'la Página web es la copia fiel: no cambia');
  const srv = sinComentarios(leer('lib/editor-landing/estilo-server.ts'));
  assert.match(srv, /copiarUrlABucket\(u, BUCKET_LANDING, ws\)/, 'las imágenes con la baranda y los topes del área');
  assert.match(srv, /for \(let salto = 0; salto <= MAX_SALTOS; salto\+\+\) \{\s*const check = await validarDestino\(actual\);/, 'la hoja revalida CADA salto');
  assert.match(srv, /lookup: lookupClavado\(ips\)/, 'sin la IP clavada vuelve el DNS rebinding');
  assert.match(srv, /htmlDePagina\(url, \{ talCual: true \}\)/);
});

// =============================================================================
// ROTURAS
// =============================================================================
// 14/10/2026, con un arnés en el scratchpad: una rotura por vez, restaurada de memoria y verificada por
// sha256. Base: 15 pasan / 0 fallan. Al final, otra vez 15 / 0. Pasan / fallan:
//    1. colorCss sin oklch ............................................... 13 / 2  «colorCss», «degradadoCss»
//    2. colorCss acepta lo transparente (ALFA_MINIMA 0) .................. 13 / 2  «colorCss», «degradadoCss»
//    3. degradadoCss sin las direcciones «to right» ...................... 12 / 3  «degradadoCss», «sanearEstilo», «temaDeEstilo»
//    4. fuenteDelCatalogo sin PARECIDAS .................................. 14 / 1  «fuentes»
//    5. PT Sans con un peso que no publica (300) ......................... 14 / 1  «el catálogo de fuentes»
//    6. sanearEstilo sin tope de imágenes ................................ 14 / 1  «topes»
//    7. una imagen SVG pasa .............................................. 14 / 1  «topes»
//    8. estiloDeHtml con los títulos del <nav> ........................... 14 / 1  «estiloDeHtml»
//    9. el modo oscuro cuenta (sin marcar @media dark ni .dark) ........... 14 / 1  «estiloDeHtml»
//   10. shadcn: su --accent (un gris) como acento ......................... 14 / 1  «una app de Tailwind/shadcn»
//   11. colorLegible no corrige .......................................... 13 / 2  «colorLegible», «temaDeEstilo»
//   12. colorLegible siempre hacia negro (no el más cercano) .............. 14 / 1  «colorLegible» (dio 15 / 0 hasta sumar el «< 5.5»)
//   13. el id del tema no es estable ..................................... 14 / 1  «temaDeEstilo»
//   14. el botón blanco sobre blanco se queda ............................ 14 / 1  «temaDeEstilo»
//   15. asignarSecciones sin el hueco exacto del medio .................... 14 / 1  «asignarSecciones»
//   16. asignarSecciones con la ventana desde el principio ................ 14 / 1  «asignarSecciones»
//   17. aplicarEstilo no saltea la imagen que no se copió ................. 14 / 1  «aplicarEstilo» (la primera
//       versión de esta rotura —poner la URL del tercero— dio 15 / 0: es código muerto detrás del filtro)
//   18. aplicarEstilo muta la entrada .................................... 14 / 1  «aplicarEstilo»
//   19. aplicarEstilo pinta el fondo de la página como propio ............. 14 / 1  «aplicarEstilo»
//   20. imagenesQueFaltan sin mirar los huecos ............................ 14 / 1  «las imágenes a subir»
//   21. lector.ts no pasa el estilo del mensaje ........................... 14 / 1  «el lector»
//   22. aLecturaDelServer sin el estilo ................................... 14 / 1  «el lector»
//   23. el lector no lee el estilo antes de tocar ......................... 14 / 1  «el lector»
//   24. replicar pisa el tema que ya existe ............................... 14 / 1  «replicar.ts»
//   25. la hoja de estilos sin revalidar cada salto ....................... 14 / 1  «replicar.ts»
