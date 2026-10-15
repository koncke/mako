// =============================================================================
// editor-landing-render — la ÚNICA fábrica de HTML público del editor copiado de Gamma
// =============================================================================
// Ejecuta lib/editor-landing/render.ts, especificacion.ts y grafico-svg.ts. Pedido de Martín
// (11/10/2026): «Replica por completo a Gamma, que se pueda hacer todo lo que ahí se hace.»
// Diseño: docs/diseno-editor-landing.md (D3). La página publicada vive en hola-mako.com, el mismo
// origen que la sesión de MaKo: un XSS acá es un XSS sobre la app. Lo que se ataca:
//   · un <script> en un texto, `javascript:` en un href (enlace, botón, imagen, barra), comillas
//     para romper un atributo, un srcdoc que intenta cerrar el iframe del HTML personalizado,
//     un `onerror` / `onclick` en atributos inventados (en el nodo, en la marca y en el árbol);
//   · un nodo desconocido (no sale ni su contenido), una sección oculta (no sale), las notas del
//     orador (nunca salen), imágenes ajenas al bucket (incluido un `..` y un host parecido);
//   · que cada forma sea un DOMOutputSpec que ProseMirror acepta (el editor usa la misma);
//   · que el render sea ESTABLE: mismo input → mismo HTML, byte por byte.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez, restaurada desde la copia en memoria y
// verificada por hash (scratchpad nucleo/romper.mjs). Con todo en su lugar: 15 pass / 0 fail.
// Las roturas y lo que tumbó cada una: bloque «ROTURAS» al final del archivo.

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMSerializer } from '@tiptap/pm/model';
import { htmlDeTarjeta, htmlDePagina, htmlDeFragmento, htmlDeContenido, srcPermitido } from '../lib/editor-landing/render';
import { SPEC_NODOS, SPEC_MARCAS, htmlDeArbol, numeroDeValor, origenImagenes } from '../lib/editor-landing/especificacion';
import { svgDeGrafico, normalizarGrafico } from '../lib/editor-landing/grafico-svg';
import { HIJOS_PERMITIDOS } from '../lib/editor-landing/validar';
import { temaPorId } from '../lib/editor-landing/temas';
import { NODO, type JsonNodo, type Pagina } from '../lib/editor-landing/doc';
import { CONFIG_DEFAULT, type ConfigLanding } from '../lib/editor-landing/api-tipos';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { DISENOS_LANDING, OBJETIVOS_LANDING, landingDesde } from '../lib/editor-landing/disenos-landing';
import { readFileSync } from 'node:fs';

const BUCKET = 'https://proyecto.supabase.co/storage/v1/object/public/landing-imagenes/';
const IMG = `${BUCKET}7/3f2a9c1e-uuid.png`;
const tema = temaPorId('pewter');
const PUB = { modo: 'publico' as const };

const txt = (text: string, marks?: JsonNodo['marks']): JsonNodo => (marks ? { type: 'text', text, marks } : { type: 'text', text });
const p = (...c: JsonNodo[]): JsonNodo => ({ type: 'paragraph', content: c });
const seccion = (content: JsonNodo[], attrs: Record<string, unknown> = {}): JsonNodo => ({ type: NODO.tarjeta, attrs: { id: 'tA', ...attrs }, content });
const frag = (n: JsonNodo | JsonNodo[]) => htmlDeFragmento(n, PUB);
/**
 * Los NOMBRES de atributo `on…` de todas las etiquetas. Se recorre atributo por atributo (los
 * valores van siempre entre comillas dobles y sin comillas crudas adentro): un « onerror=» escrito
 * DENTRO de un valor escapado, o como texto, es inofensivo y no cuenta.
 */
function atributosOn(html: string): string[] {
  const out: string[] = [];
  for (const etiqueta of html.match(/<[a-zA-Z][^>]*>/g) ?? []) {
    const cuerpo = etiqueta.replace(/^<[a-zA-Z0-9]+/, '').replace(/>$/, '');
    for (const m of cuerpo.matchAll(/\s*([^\s="'>]+)(?:="[^"]*")?/g)) if (/^on/i.test(m[1])) out.push(m[1]);
  }
  return out;
}

test('origen de las imágenes: sale de NEXT_PUBLIC_SUPABASE_URL', () => {
  assert.equal(origenImagenes(), BUCKET);
});

test('XSS · un <script> en un texto sale escapado, en cualquier nodo', () => {
  const malo = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  const html = frag(seccion([
    { type: 'heading', attrs: { level: 2 }, content: [txt(malo)] },
    p(txt(malo, [{ type: 'bold' }])),
    { type: NODO.botones, content: [{ type: NODO.boton, attrs: { href: '#t-x' }, content: [txt(malo)] }] },
    { type: NODO.grafico, attrs: { tipo: 'columnas', titulo: malo, categorias: [malo], series: [{ nombre: malo, valores: [3] }] } },
  ]));
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('XSS · `javascript:` no sale en ningún href (enlace, botón, imagen, barra del sitio)', () => {
  const variantes = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', '//evil.com/x'];
  for (const v of variantes) {
    const html = frag(seccion([
      p(txt('enlace', [{ type: 'link', attrs: { href: v, target: '_blank' } }])),
      { type: NODO.botones, content: [{ type: NODO.boton, attrs: { href: v, nuevaPestana: true }, content: [txt('Botón')] }] },
      { type: NODO.imagen, attrs: { src: IMG, href: v, alt: 'x' } },
    ]));
    assert.doesNotMatch(html, /javascript:|vbscript:|data:text|href="\/\/evil/i, `se coló «${v}»`);
    const cfg: ConfigLanding = { ...CONFIG_DEFAULT, sitio: { ...CONFIG_DEFAULT.sitio, nav: { mostrar: true, logo: null, enlaces: [{ texto: 'Malo', destino: v }], botones: [{ texto: 'Malo', destino: v, estilo: 'primario' }] } } };
    const pag: Pagina = { id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [seccion([p(txt('x'))])] } };
    assert.doesNotMatch(htmlDePagina(pag, cfg, tema, PUB), /javascript:|vbscript:|data:text/i, `se coló «${v}» en la barra`);
  }
  // Los buenos SÍ salen.
  const bueno = frag(seccion([p(txt('a', [{ type: 'link', attrs: { href: 'https://ejemplo.com/x?y=1', target: '_blank' } }]))]));
  assert.match(bueno, /<a href="https:\/\/ejemplo\.com\/x\?y=1" target="_blank" rel="noopener noreferrer">a<\/a>/);
});

test('XSS · las comillas no rompen un atributo (alt, mensaje de éxito, etiqueta de un campo, texto de la barra)', () => {
  const romper = `x" onerror="alert(1)' onload='alert(2)`;
  const html = frag(seccion([
    { type: NODO.imagen, attrs: { src: IMG, alt: romper } },
    { type: NODO.formulario, attrs: { campos: [{ id: 'c1', tipo: 'texto', etiqueta: romper }], exito: romper, boton: romper } },
  ]));
  assert.deepEqual(atributosOn(html), []);
  assert.match(html, /alt="x&quot; onerror=&quot;alert\(1\)&#39; onload=&#39;alert\(2\)"/);
});

test('XSS · un srcdoc que intenta cerrar el iframe queda adentro del atributo', () => {
  const html = frag(seccion([{ type: NODO.htmlLibre, attrs: { html: '"></iframe><script>alert(document.cookie)</script><iframe x="', alto: 300 } }]));
  assert.equal((html.match(/<iframe/g) ?? []).length, 1, 'un solo iframe');
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /<iframe sandbox="allow-scripts" srcdoc="&quot;&gt;&lt;\/iframe&gt;&lt;script&gt;/);
  assert.doesNotMatch(html, /allow-same-origin/, 'el HTML personalizado corre en un origen opaco');
});

test('XSS · un `on…` inventado no sale: ni del nodo, ni de la marca, ni de un árbol', () => {
  const html = frag(seccion([
    { type: 'paragraph', attrs: { onclick: 'alert(1)', variante: 'grande' }, content: [txt('a', [{ type: 'bold', attrs: { onmouseover: 'alert(2)' } }])] },
    { type: NODO.imagen, attrs: { src: IMG, onerror: 'alert(3)' } },
  ], { onerror: 'alert(4)', style: 'background:url(javascript:alert(5))' }));
  assert.deepEqual(atributosOn(html), []);
  assert.doesNotMatch(html, /alert/);
  // El serializador mismo, aunque una especificación tuviera un error:
  assert.equal(htmlDeArbol(['div', { onclick: 'x', class: 'ok', 'a b': 'y' }, 'z']), '<div class="ok">z</div>');
  assert.equal(htmlDeArbol(['script', {}, 'alert(1)']), 'alert(1)', 'una etiqueta fuera de la lista no se escribe');
});

test('un nodo desconocido no sale, ni su contenido', () => {
  const html = frag(seccion([
    { type: 'script', content: [txt('alert(1)')] },
    { type: 'iframe', attrs: { src: 'https://evil.com' } },
    p(txt('sigue')),
  ]));
  assert.doesNotMatch(html, /alert|evil/);
  assert.match(html, /<p>sigue<\/p>/);
  assert.equal(htmlDeTarjeta({ type: 'script', content: [] } as JsonNodo, tema, PUB), '');
});

test('sección oculta: no sale en lo público; con incluirOcultas sale (marcada fuera de lo público); las notas, nunca', () => {
  const t = seccion([p(txt('secreta'))], { oculta: true, notas: 'NOTA-PRIVADA', bloqueadaIA: true });
  assert.equal(htmlDeTarjeta(t, tema, PUB), '');
  const pag: Pagina = { id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [t, seccion([p(txt('visible'))], { id: 'tB' })] } };
  const html = htmlDePagina(pag, CONFIG_DEFAULT, tema, PUB);
  assert.doesNotMatch(html, /secreta/);
  assert.match(html, /visible/);
  const mini = htmlDeTarjeta(t, tema, { modo: 'miniatura', incluirOcultas: true });
  assert.match(mini, /secreta/);
  assert.match(mini, /data-oculta="si"/);
  for (const h of [html, mini, htmlDeTarjeta({ ...t, attrs: { ...t.attrs, oculta: false } }, tema, PUB)]) {
    assert.doesNotMatch(h, /NOTA-PRIVADA|bloqueada|notas/i);
  }
});

test('imágenes: sólo del bucket landing-imagenes (ajenas, `..`, otro bucket y host parecido, afuera)', () => {
  const ajenas = [
    'https://evil.com/x.png',
    `${BUCKET}../curso-adjuntos/7/x.png`,
    'https://proyecto.supabase.co/storage/v1/object/public/curso-adjuntos/7/x.png',
    'https://proyecto.supabase.co.evil.com/storage/v1/object/public/landing-imagenes/7/x.png',
    `${BUCKET}7/x.svg`,
    `${BUCKET}7/x.png?token=1`,
    `${BUCKET}7/x.png"onerror="alert(1)`,
    `${BUCKET}x.png`,
  ];
  for (const src of ajenas) {
    assert.equal(srcPermitido(src), false, src);
    const html = frag(seccion([{ type: NODO.imagen, attrs: { src } }], { diseno: 'izquierda', imagenSrc: src }));
    assert.doesNotMatch(html, /<img|gm-acento/, `salió «${src}»`);
    assert.match(html, /data-diseno="sin"/, 'sin imagen, la sección no reserva la columna');
  }
  assert.equal(srcPermitido(IMG), true);
  const html = frag(seccion([{ type: NODO.imagen, attrs: { src: IMG, alt: 'Foto' } }], { diseno: 'izquierda', imagenSrc: IMG, imagenFocoX: 20, imagenFocoY: 80 }));
  assert.match(html, /<img src="https:\/\/proyecto\.supabase\.co\/storage\/v1\/object\/public\/landing-imagenes\/7\/3f2a9c1e-uuid\.png" alt="Foto"/);
  assert.match(html, /class="gm-acento" data-ajuste="cubrir" style="background-image:url\(&quot;https:[^"]+\.png&quot;\);background-position:20% 80%"/);
});

test('el contrato de clases (D3): sección, columnas, diseño optimizado, botón, recuadro, desplegable, insertado, formulario', () => {
  const html = htmlDeTarjeta(seccion([
    { type: NODO.columnas, attrs: { anchos: [4, 8], divisores: true }, content: [{ type: NODO.columna, content: [p(txt('a'))] }, { type: NODO.columna, content: [p(txt('b'))] }] },
    { type: NODO.optimizado, attrs: { variante: 'numeros-grandes', columnas: '3' }, content: [{ type: NODO.optimizadoItem, attrs: { valor: '97%', destacado: true, icono: 'libro' }, content: [p(txt('i'))] }] },
    { type: NODO.botones, attrs: { alinea: 'centro' }, content: [{ type: NODO.boton, attrs: { href: 'pagina:p2', variante: 'contorno' }, content: [txt('Ir')] }] },
    { type: NODO.recuadro, attrs: { tono: 'advertencia' }, content: [p(txt('ojo'))] },
    { type: NODO.desplegable, content: [{ type: NODO.desplegableTitulo, content: [txt('¿Qué?')] }, { type: NODO.desplegableCuerpo, content: [p(txt('Esto'))] }] },
    { type: NODO.insertado, attrs: { src: 'https://calendly.com/fulano/30min', alto: 800 } },
    { type: NODO.formulario, attrs: { campos: [{ id: 'c1', tipo: 'nombre' }, { id: 'c2', tipo: 'email', requerido: true }, { id: 'c3', tipo: 'telefono' }, { id: 'c4', tipo: 'empresa' }, { id: 'c5', tipo: 'opciones', etiqueta: '¿Compras o rentas?', opciones: ['Compro', 'Rento'] }], redirigir: 'pagina:p2' } },
  ], { fondo: 'color', fondoColor: '#102030', ancho: 'amplio' }), tema, { modo: 'publico', urlBase: '/l/mi-sitio', paginas: [{ id: 'p2', ruta: 'gracias' }] });
  assert.match(html, /^<div class="gm-doc" style="--gm-[^"]+" data-modo="publico"><div class="gm-fondo"><div class="gm-pagina"><section class="gm-tarjeta" id="t-tA" data-diseno="sin" data-ancho="amplio" data-alinea="centro" data-alto="auto" data-fondo="color" data-superposicion="ninguna" style="--gm-tarjeta-fondo:#102030;/);
  assert.match(html, /<div class="gm-tarjeta-fondo" style="background:#102030"><\/div><div class="gm-tarjeta-cuerpo">/);
  assert.match(html, /<div class="gm-columnas" style="--gm-cols: 4fr 8fr" data-divisores="si"><div class="gm-columna"><p>a<\/p><\/div>/);
  assert.match(html, /<div class="gm-optimizado" data-variante="numeros-grandes" data-grupo="estadisticas" data-cols="3" data-iconos="si"><div class="gm-item" data-destacado="si" style="--gm-num:97"><div class="gm-item-marca"><span class="gm-item-icono" data-icono="libro" aria-hidden="true"><svg /);
  assert.match(html, /<span class="gm-item-valor">97%<\/span><\/div><div class="gm-item-cuerpo"><p>i<\/p><\/div><\/div><\/div>/);
  assert.match(html, /<div class="gm-botones" data-alinea="centro"><a class="gm-boton" data-variante="contorno" href="\/l\/mi-sitio\/gracias">Ir<\/a><\/div>/);
  assert.match(html, /<aside class="gm-recuadro" data-tono="advertencia"><div class="gm-recuadro-icono" data-icono="advertencia" aria-hidden="true"><svg [^]*?<\/svg><\/div><div class="gm-recuadro-cuerpo"><p>ojo<\/p><\/div><\/aside>/);
  assert.match(html, /<details class="gm-desplegable"><summary class="gm-desplegable-titulo">¿Qué\?<\/summary><div class="gm-desplegable-cuerpo"><p>Esto<\/p><\/div><\/details>/);
  assert.match(html, /<div class="gm-insertado" data-proveedor="calendly" data-clase="agenda"><iframe src="https:\/\/calendly\.com\/fulano\/30min" title="Calendly" data-proveedor="calendly" data-alto="800" sandbox="allow-scripts allow-same-origin allow-forms/);
  // El formulario: inputs que el Pixel reconoce, POST sin action, y ningún dato en una URL.
  assert.match(html, /<form class="gm-formulario" method="post" data-exito="[^"]+" data-redirigir="\/l\/mi-sitio\/gracias">/);
  assert.doesNotMatch(html, /<form[^>]*\saction=/);
  assert.match(html, /<input type="text" autocomplete="name" id="gmc\d+" name="nombre"/);
  assert.match(html, /<input type="email" autocomplete="email" inputmode="email" id="gmc\d+" name="email" maxlength="200" required="">/);
  assert.match(html, /<input type="tel" autocomplete="tel" inputmode="tel" id="gmc\d+" name="telefono"/);
  assert.match(html, /name="empresa"/);
  assert.match(html, /<label for="(gmc\d+-0)" hidden="">¿Compras o rentas\?<\/label><label class="gm-opcion"><input type="radio" id="\1" name="respuesta-\d+" value="Compro">/);
  assert.match(html, /<button type="submit" class="gm-boton" data-variante="primario">Enviar<\/button><p class="gm-formulario-exito" hidden="" aria-live="polite">/);
});

test('enlaces entre páginas: `pagina:<id>` se resuelve con urlBase; sin base, o a una página que no está, queda en «#»', () => {
  const t = seccion([{ type: NODO.botones, content: [
    { type: NODO.boton, attrs: { href: 'pagina:p2' }, content: [txt('A')] },
    { type: NODO.boton, attrs: { href: 'pagina:p1' }, content: [txt('B')] },
    { type: NODO.boton, attrs: { href: 'pagina:borrada' }, content: [txt('C')] },
    { type: NODO.boton, attrs: { href: '#t-tA' }, content: [txt('D')] },
  ] }]);
  const paginas = [{ id: 'p1', ruta: '' }, { id: 'p2', ruta: 'gracias' }];
  const con = htmlDeFragmento(t, { modo: 'publico', urlBase: 'https://hola-mako.com/l/mi-sitio/', paginas });
  assert.match(con, /href="https:\/\/hola-mako\.com\/l\/mi-sitio\/gracias">A</);
  assert.match(con, /href="https:\/\/hola-mako\.com\/l\/mi-sitio">B</);
  assert.match(con, /href="#">C</);
  assert.match(con, /href="#t-tA">D</);
  assert.doesNotMatch(htmlDeFragmento(t, { modo: 'publico', paginas }), /pagina:/, 'sin base no sale un esquema que el navegador no conoce');
  assert.doesNotMatch(htmlDeFragmento(t, { modo: 'publico', urlBase: 'javascript:alert(1)', paginas }), /javascript/);
});

test('la página: barra, pie con saltos y sello «Hecho con MaKo» según la configuración; htmlDeContenido resuelve las páginas sola', () => {
  const cfg: ConfigLanding = {
    ...CONFIG_DEFAULT,
    sitio: { ...CONFIG_DEFAULT.sitio, nombre: 'Mi <negocio>', nav: { mostrar: true, logo: null, enlaces: [{ texto: 'Precios', destino: '#t-tA' }], botones: [{ texto: 'Agendar', destino: 'pagina:p2', estilo: 'primario' }] }, pie: { mostrar: true, texto: 'Línea 1\nLínea <2>' } },
  };
  const contenido = { v: 1 as const, paginas: [
    { id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc' as const, content: [seccion([p(txt('hola'))])] } },
    { id: 'p2', titulo: 'Gracias', ruta: 'gracias', doc: { type: 'doc' as const, content: [seccion([p(txt('gracias'))], { id: 'tG' })] } },
  ] };
  const [inicio, gracias] = htmlDeContenido(contenido, cfg, tema, { modo: 'publico', urlBase: '/l/mi-sitio' });
  assert.equal(gracias.ruta, 'gracias');
  assert.match(inicio.html, /<nav class="gm-nav"><div class="gm-nav-interior"><a class="gm-nav-marca" href="\/l\/mi-sitio">Mi &lt;negocio&gt;<\/a><ul class="gm-nav-enlaces"><li><a class="gm-nav-enlace" href="#t-tA">Precios<\/a><\/li><\/ul><div class="gm-nav-botones"><a class="gm-boton" data-variante="primario" href="\/l\/mi-sitio\/gracias">Agendar<\/a><\/div><\/div><\/nav><main class="gm-pagina">/);
  assert.match(inicio.html, /<footer class="gm-pie"><p>Línea 1<br>Línea &lt;2&gt;<\/p><\/footer><a class="gm-marca" href="https:\/\/hola-mako\.com" target="_blank" rel="noopener">Hecho con MaKo<\/a><\/div><\/div>$/);
  const sinSello = htmlDePagina(contenido.paginas[0], { ...cfg, sitio: { ...cfg.sitio, marcaMako: false, nav: { ...cfg.sitio.nav, mostrar: false }, pie: { mostrar: false, texto: 'x' } } }, tema, PUB);
  assert.doesNotMatch(sinSello, /gm-marca|gm-nav|gm-pie/);
});

test('cada forma es un DOMOutputSpec que ProseMirror acepta (el editor arma su DOM con la misma)', () => {
  class ElFalso {
    attrs = new Map<string, string>();
    hijos: unknown[] = [];
    style = { cssText: '' };
    nodeType = 1;
    constructor(readonly tag: string, readonly ns: string | null) {}
    setAttribute(k: string, v: string) { this.attrs.set(k, String(v)); }
    setAttributeNS(_ns: string, k: string, v: string) { this.attrs.set(k, String(v)); }
    appendChild(c: unknown) { this.hijos.push(c); return c; }
  }
  const docFalso = {
    createElement: (t: string) => new ElFalso(t, null),
    createElementNS: (ns: string, t: string) => new ElFalso(t, ns),
    createTextNode: (s: string) => ({ nodeType: 3, data: s }),
  } as unknown as Document;
  const muestras: Record<string, unknown> = {
    [NODO.tarjeta]: { id: 'tA', diseno: 'derecha', imagenSrc: IMG },
    [NODO.imagen]: { src: IMG, href: 'https://a.com' },
    [NODO.video]: { src: `${BUCKET}7/v.mp4` },
    [NODO.insertado]: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    [NODO.formulario]: { campos: [{ id: 'c1', tipo: 'opciones', opciones: ['a', 'b'] }] },
    [NODO.grafico]: { tipo: 'dona', categorias: ['a', 'b'], series: [{ nombre: 's', valores: [1, 2] }] },
    [NODO.htmlLibre]: { html: '<b>x</b>' },
  };
  for (const [nombre, fn] of Object.entries(SPEC_NODOS)) {
    const r = DOMSerializer.renderSpec(docFalso, fn(muestras[nombre] ?? {}) as never) as unknown as { dom: ElFalso; contentDOM?: ElFalso };
    const lleva = !!HIJOS_PERMITIDOS[nombre];
    assert.equal(!!r.contentDOM, lleva, `${nombre}: ${lleva ? 'le falta el hueco' : 'un átomo no lleva hueco'}`);
  }
  for (const [nombre, fn] of Object.entries(SPEC_MARCAS)) {
    const r = DOMSerializer.renderSpec(docFalso, fn({ href: 'https://a.com', color: 'acento', tam: 'l' }) as never) as unknown as { contentDOM?: ElFalso };
    assert.ok(r.contentDOM, `marca ${nombre} sin hueco`);
  }
  // El gráfico va en el espacio de nombres de SVG (si no, el navegador no lo dibuja).
  const g = DOMSerializer.renderSpec(docFalso, SPEC_NODOS[NODO.grafico](muestras[NODO.grafico]) as never) as unknown as { dom: ElFalso };
  assert.equal((g.dom.hijos[0] as ElFalso).ns, 'http://www.w3.org/2000/svg');
});

test('gráficos: SVG estable, con la paleta del tema y respaldo, valores con prefijo y sufijo, y «Sin datos»', () => {
  const g = { tipo: 'columnas', titulo: 'Ventas', categorias: ['Ene', 'Feb'], series: [{ nombre: 'A', valores: [1200, -50] }, { nombre: 'B', valores: [3, 4] }], prefijo: '$', sufijo: ' MXN' };
  const svg = svgDeGrafico(g);
  assert.equal(svg, svgDeGrafico(JSON.parse(JSON.stringify(g))));
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 640 360" class="gm-grafico-svg" role="img" aria-label="Ventas"><title>Ventas<\/title>/);
  assert.match(svg, /style="fill:var\(--gm-paleta-1, #4f46e5\)"/);
  assert.match(svg, />\$1,200 MXN</);
  assert.match(svg, />-\$50 MXN</);
  assert.match(svg, /<text [^>]*>Ene<\/text>/);
  for (const tipo of ['barras', 'columnasApiladas', 'lineas', 'area', 'circular', 'dona']) {
    const s = svgDeGrafico({ ...g, tipo });
    assert.match(s, /<\/svg>$/);
    assert.doesNotMatch(s, /NaN|Infinity|undefined/, tipo);
  }
  assert.match(svgDeGrafico({ tipo: 'barras', categorias: [], series: [] }), />Sin datos</);
  const n = normalizarGrafico({ tipo: 'nuevo', categorias: Array.from({ length: 40 }, (_, i) => `c${i}`), series: [{ valores: ['3', 'x'] }] });
  assert.equal(n.tipo, 'barras');
  assert.equal(n.categorias.length, 24);
  assert.deepEqual(n.series[0].valores.slice(0, 3), [3, 0, 0]);
  assert.equal(numeroDeValor('4.9 de 5'), 4.9);
  assert.equal(numeroDeValor('+1,200 clientes'), 1200);
  assert.equal(numeroDeValor('sin número'), null);
});

test('render ESTABLE: el mismo input da el mismo HTML, byte por byte (y no muta el input)', () => {
  const t = seccion([
    { type: 'heading', attrs: { level: 1, variante: 'titulo' }, content: [txt('Hola '), txt('mundo', [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://a.com' } }]), txt(' y más', [{ type: 'link', attrs: { href: 'https://a.com' } }])] },
    { type: NODO.formulario, attrs: { campos: [{ id: 'c1', tipo: 'email' }] } },
    { type: NODO.grafico, attrs: { tipo: 'dona', categorias: ['a', 'b', 'c'], series: [{ nombre: 's', valores: [1, 2, 3] }] } },
  ], { fondo: 'degradado', fondoDegradado: 'aurora' });
  const copia = JSON.stringify(t);
  const a = htmlDeTarjeta(t, tema, PUB);
  const b = htmlDeTarjeta(JSON.parse(copia), tema, PUB);
  assert.equal(a, b);
  assert.equal(JSON.stringify(t), copia, 'el input quedó igual');
  // Las marcas comparten etiqueta: el enlace envuelve las dos partes, la negrita sólo la suya.
  assert.match(a, /<h1 class="gm-titulo">Hola <a href="https:\/\/a\.com"><strong>mundo<\/strong> y más<\/a><\/h1>/);
});

// El VSL vacío de un diseño (pedido de Martín, 14/10/2026: «que la mayoría de las plantillas sean con un
// VIDEO»): la grilla de Diseños son miniaturas, y sin esto ninguna mostraba un video.
// Roturas (14/10/2026, en memoria, restauradas y verificadas por hash; base: 16 pasan, 0 fallan): render.ts
// sin la excepción de la miniatura → 15 / 1; el vacío de video en todos los modos → 15 / 1; cualquier pista
// dibuja el ▶ (la agenda también) → 15 / 1. Desde la revisión del mismo día el ▶ sale sólo con
// `marcadores` (el test de abajo). Desde la tanda 6 el ▶ es el `play-relleno` (peso «fill»): con
// especificacion.ts de vuelta en el `play` de contorno, 16 pasan / 2 fallan (éste y el de abajo).
test('miniatura: el insertado VACÍO de video se dibuja como ▶ (con el svg del catálogo); la publicada, la exportación y el editor no; una agenda vacía, nunca', () => {
  const vacio = (proveedor?: string): JsonNodo => seccion([p(txt('Hola')), { type: NODO.insertado, attrs: proveedor ? { src: '', proveedor, alto: null } : { src: '' } }]);
  const mini = htmlDeTarjeta(vacio('youtube'), tema, { modo: 'miniatura', marcadores: true });
  assert.match(mini, /<div class="gm-insertado" data-proveedor="youtube" data-clase="video" data-marcador="si" data-pista="si"><div class="gm-marcador" data-play="si"><span class="gm-marcador-play" data-icono="play-relleno" aria-hidden="true"><svg [^>]*viewBox="0 0 256 256"[^>]*><path d="M240,128a15\.74/);
  assert.doesNotMatch(mini, /<iframe|YouTube|Pega/, 'sin iframe ni texto');
  for (const modo of ['publico', 'exportar', 'editor'] as const) {
    assert.doesNotMatch(htmlDeTarjeta(vacio('youtube'), tema, { modo }), /gm-insertado|gm-marcador|data-icono="play-relleno"/, `el VSL vacío sale en ${modo}`);
  }
  for (const modo of ['miniatura', 'publico', 'exportar', 'editor'] as const) {
    assert.doesNotMatch(htmlDeTarjeta(vacio('calendly'), tema, { modo, marcadores: true }), /gm-insertado|data-icono="play-relleno"/, `la agenda vacía sale en ${modo}`);
  }
  assert.doesNotMatch(htmlDeTarjeta(vacio(), tema, { modo: 'miniatura', marcadores: true }), /gm-insertado/, 'sin pista (el «Insertar» genérico) tampoco');
  assert.doesNotMatch(htmlDeTarjeta(vacio('inventado'), tema, { modo: 'miniatura', marcadores: true }), /gm-insertado/, 'una pista inventada no es un video');
});

// El modo 'miniatura' NO es sólo la grilla (revisión del 14/10/2026): app/m/landing lo usa para mostrar
// lo que vería un visitante en su teléfono, y ahí no puede aparecer el ▶ que la publicada no tiene, ni
// un video al 52%. Los marcadores los pide quien dibuja una miniatura de TRABAJO.
// Roturas (14/10/2026, en memoria, restauradas y verificadas por hash; base: 18 pasan, 0 fallan): la
// miniatura los pone siempre, sin pedirlos → 16 / 2 (éste y el de las columnas); el video angosto vuelve
// a colgar de `data-modo="miniatura"` → 17 / 1; app/m/landing los pide → 17 / 1.
test('los marcadores (el ▶ y el video angosto) salen sólo si quien dibuja los pide; la vista del visitante en el teléfono no los pide', () => {
  const vsl = seccion([p(txt('Hola')), { type: NODO.insertado, attrs: { src: '', proveedor: 'youtube', alto: null } }]);
  const sin = htmlDeTarjeta(vsl, tema, { modo: 'miniatura' });
  assert.doesNotMatch(sin, /gm-insertado|data-icono="play-relleno"|data-marcadores/, 'sin pedirlos, la miniatura es la publicada');
  const con = htmlDeTarjeta(vsl, tema, { modo: 'miniatura', marcadores: true });
  assert.match(con, /^<div class="gm-doc"[^>]* data-modo="miniatura" data-marcadores="si"/);
  assert.match(con, /data-icono="play-relleno"/);
  assert.doesNotMatch(htmlDeTarjeta(vsl, tema, { modo: 'publico', marcadores: true }), /gm-insertado|data-marcadores/, 'fuera de la miniatura no existen');
  // El video angosto cuelga del atributo, no del modo.
  assert.ok(CSS_CONTENIDO.includes('.gm-doc[data-marcadores="si"] .gm-tarjeta-cuerpo > .gm-insertado[data-clase="video"] { width: 52%;'));
  assert.doesNotMatch(CSS_CONTENIDO, /\[data-modo="miniatura"\][^{]*gm-insertado\[data-clase="video"\]/, 'una regla del video por el modo vuelve a pegarle al teléfono');
  // Quién los pide: las miniaturas de trabajo sí, la vista del visitante no.
  const leer = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  for (const f of ['../app/web-generator/MiniaturaLanding.tsx', '../app/web-generator/editor/TiraSecciones.tsx', '../app/web-generator/editor/paneles/PanelAgente.tsx']) {
    assert.match(leer(f), /modo: 'miniatura', incluirOcultas: true, marcadores: true \}/, `${f} no pide los marcadores`);
  }
  assert.doesNotMatch(leer('../app/m/landing/[id]/page.tsx').replace(/^[ \t]*\/\/.*$/gm, ''), /marcadores/, 'el teléfono los pide');
});

// Una columna que sale VACÍA no deja su hueco (revisión del 14/10/2026): en los diseños con el video al
// costado, sin el enlace pegado, la publicada y la exportación sacaban `<div class="gm-columna"></div>`
// (texto en 5/12 y 7/12 en blanco, los 10 objetivos de los dos diseños).
// Roturas (14/10/2026, en memoria, restauradas y verificadas por hash; base: 18 pasan, 0 fallan): sin
// `htmlDeColumnas` → 17 / 1; los anchos no se rearman → 17 / 1; con una sola columna queda la grilla → 17 / 1.
test('una columna vacía no sale: se rearman los anchos de las que quedan, y con una sola no hay grilla', () => {
  const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const mal: string[] = [];
  for (const d of DISENOS_LANDING.filter((x) => x.video === 'costado')) {
    for (const o of OBJETIVOS_LANDING) {
      const hero = landingDesde(d, o.id)!.paginas[0].doc.content[0];
      for (const modo of ['publico', 'exportar', 'miniatura'] as const) {
        const h = htmlDeTarjeta(hero, temaPorId(d.tema), { modo });
        if (/<div class="gm-columna"><\/div>/.test(h)) mal.push(`${d.id} × ${o.id} (${modo}): columna vacía`);
        if (/gm-columnas/.test(h)) mal.push(`${d.id} × ${o.id} (${modo}): quedó la grilla con una columna`);
        if (!/<h1/.test(h)) mal.push(`${d.id} × ${o.id} (${modo}): se perdió el texto`);
      }
      // Con el enlace pegado, las dos columnas siguen.
      const conVideo = JSON.parse(JSON.stringify(hero).replace('"src":""', `"src":"${YT}"`)) as JsonNodo;
      const h = htmlDeTarjeta(conVideo, temaPorId(d.tema), { modo: 'publico' });
      if (!/<div class="gm-columnas" style="--gm-cols: 5fr 7fr">/.test(h) || (h.match(/class="gm-columna"/g) ?? []).length !== 2 || !/<iframe/.test(h)) mal.push(`${d.id} × ${o.id}: con el video pegado no quedan las dos columnas`);
    }
  }
  assert.deepEqual(mal, []);
  // Tres columnas con la del medio vacía: quedan dos, con SUS anchos.
  const col = (...c: JsonNodo[]): JsonNodo => ({ type: NODO.columna, content: c });
  const tres = seccion([{ type: NODO.columnas, attrs: { anchos: [3, 6, 3], divisores: false }, content: [col(p(txt('A'))), col({ type: NODO.imagen, attrs: { src: '' } }), col(p(txt('C')))] }]);
  assert.match(htmlDeTarjeta(tres, tema, PUB), /<div class="gm-columnas" style="--gm-cols: 3fr 3fr"><div class="gm-columna"><p>A<\/p><\/div><div class="gm-columna"><p>C<\/p><\/div><\/div>/);
  // Sin nada que omitir, sale como siempre.
  const dos = seccion([{ type: NODO.columnas, attrs: { anchos: [4, 8], divisores: true }, content: [col(p(txt('A'))), col(p(txt('B')))] }]);
  assert.match(htmlDeTarjeta(dos, tema, PUB), /<div class="gm-columnas" style="--gm-cols: 4fr 8fr" data-divisores="si"><div class="gm-columna"><p>A<\/p><\/div><div class="gm-columna"><p>B<\/p><\/div><\/div>/);
});

// ─────────────────────────────────────────────────────────────────────────────
// ROTURAS (11/10/2026). Base: 15 pass / 0 fail. Cada rotura sobre el fuente, corrida, y vuelta
// al original desde la copia en memoria (hash verificado). Resultado de cada una:
//   R1 escaparTexto no escapa «<» (grafico-svg.ts) ............ 13 / 2  (el <script> en un texto; el pie)
//   R2 hrefPermitido deja pasar todo (especificacion.ts) ...... 14 / 1  (`javascript:` en ningún href)
//   R3 escaparAtributo no escapa comillas (grafico-svg.ts) .... 12 / 3  (comillas; srcdoc; imágenes ajenas)
//   R4 render.ts ignora `oculta` .............................. 14 / 1  (sección oculta)
//   R5 srcPermitido acepta todo (especificacion.ts) ........... 14 / 1  (imágenes sólo del bucket)
//   R6 htmlDeArbol deja pasar `on…` (grafico-svg.ts) .......... 14 / 1  (`on…` inventado)
//   R7 azar en la raíz `.gm-doc` (render.ts) .................. 13 / 2  (contrato de clases; render ESTABLE)
//   R8 las notas del orador salen como `data-notas` ........... 14 / 1  (sección oculta y notas)
//   R9 el HTML personalizado con `allow-same-origin` .......... 14 / 1  (srcdoc)
// ─────────────────────────────────────────────────────────────────────────────
