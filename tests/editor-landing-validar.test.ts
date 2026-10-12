// =============================================================================
// editor-landing-validar — el saneo de lo que se GUARDA en el editor copiado de Gamma
// =============================================================================
// Ejecuta lib/editor-landing/validar.ts (`sanearContenido`, `sanearConfig`, el modelo de
// contenido) y los normalizadores de especificacion.ts. Pedido de Martín (11/10/2026): «Replica
// por completo a Gamma, que se pueda hacer todo lo que ahí se hace.» Diseño:
// docs/diseno-editor-landing.md (D1-D3).
//
// Lo que se fija:
//   · un nodo o una marca desconocidos se van CON MOTIVO (AGENTS.md: «Lo que un saneador
//     DESCARTA queda escrito»); un `javascript:`, un `onerror` y una imagen ajena, también;
//   · las listas cerradas de doc.ts (lo que no es exactamente un valor de la lista no se lee);
//   · ids de sección y de campo únicos en toda la landing, rutas válidas y únicas con UN inicio;
//   · los bloques sueltos van a una sección (no se tiran);
//   · lo que sale CARGA en un esquema de ProseMirror armado con `CONTENIDO_TIPTAP`: si no, TipTap
//     abre un documento vacío y el autoguardado lo guarda encima (el modo de falla caro);
//   · es IDEMPOTENTE: sanear lo saneado no cambia nada ni anota nada;
//   · la configuración: Píxel sólo dígitos, SEO 60/160, barra ≤ 5 enlaces y ≤ 2 botones.
//
// Probado ROMPIÉNDOLO (11/10/2026), una rotura por vez, restaurada desde la copia en memoria y
// verificada por hash (scratchpad nucleo/romper.mjs). Con todo en su lugar: 12 pass / 0 fail.
// Las roturas y lo que tumbó cada una: bloque «ROTURAS» al final del archivo.

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Schema, type NodeSpec, type MarkSpec } from '@tiptap/pm/model';
import { sanearContenido, sanearConfig, excedeTope, CONTENIDO_TIPTAP, HIJOS_PERMITIDOS, SIN_MARCAS } from '../lib/editor-landing/validar';
import { NORMALIZAR_NODOS } from '../lib/editor-landing/especificacion';
import { NODO, TOPES, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';

const IMG = 'https://proyecto.supabase.co/storage/v1/object/public/landing-imagenes/7/foto-1.png';
const txt = (text: string, marks?: JsonNodo['marks']): JsonNodo => (marks ? { type: 'text', text, marks } : { type: 'text', text });
const p = (...c: JsonNodo[]): JsonNodo => ({ type: 'paragraph', content: c });
const sec = (content: unknown[], attrs: Record<string, unknown> = {}) => ({ type: NODO.tarjeta, attrs, content });
const landing = (...docs: unknown[][]) => ({ v: 1, paginas: docs.map((content, i) => ({ id: `p${i}`, titulo: i ? `Pág ${i}` : 'Inicio', ruta: i ? `pag-${i}` : '', doc: { type: 'doc', content } })) });
const tieneMotivo = (d: string[], re: RegExp) => assert.ok(d.some((x) => re.test(x)), `falta un motivo ${re} en:\n${d.join('\n')}`);

/**
 * El esquema de ProseMirror con el modelo de contenido EXPORTADO (el mismo que tiene que usar el
 * editor). Los atributos se declaran con los nombres de los normalizadores.
 */
function esquema(): Schema {
  const nodes: Record<string, NodeSpec> = { doc: { content: CONTENIDO_TIPTAP.doc }, text: { inline: true } };
  for (const nombre of Object.keys(NORMALIZAR_NODOS)) {
    const attrs = Object.fromEntries(Object.keys(NORMALIZAR_NODOS[nombre]({})).map((k) => [k, { default: null }]));
    const contenido = CONTENIDO_TIPTAP[nombre];
    nodes[nombre] = {
      attrs,
      ...(contenido ? { content: contenido } : {}),
      ...(nombre === 'hardBreak' ? { inline: true } : {}),
      ...(SIN_MARCAS.has(nombre) ? { marks: '' } : {}),
    };
  }
  const marks: Record<string, MarkSpec> = {
    bold: {}, italic: {}, underline: {}, strike: {},
    link: { attrs: { href: { default: null }, target: { default: null } } },
    textStyle: { attrs: { color: { default: null }, tam: { default: null } } },
    highlight: { attrs: { color: { default: null } } },
    etiqueta: { attrs: { color: { default: null } } },
  };
  return new Schema({ nodes, marks });
}
const ESQUEMA = esquema();
const cargaEnTipTap = (c: LandingContenido) => { for (const pg of c.paginas) ESQUEMA.nodeFromJSON(pg.doc).check(); };

test('un nodo desconocido se va CON MOTIVO (y su contenido con él); el resto se conserva', () => {
  const r = sanearContenido(landing([sec([{ type: 'script', content: [txt('alert(1)')] }, { type: 'marquesina', attrs: { x: 1 } }, p(txt('sigue'))], { id: 'tA' })]));
  tieneMotivo(r.descartes, /nodo desconocido «script»/);
  tieneMotivo(r.descartes, /nodo desconocido «marquesina»/);
  const t = r.contenido.paginas[0].doc.content[0];
  assert.deepEqual(t.content, [p(txt('sigue'))]);
  assert.doesNotMatch(JSON.stringify(r.contenido), /alert|marquesina|script/);
});

test('XSS: `javascript:` en un enlace o un botón, un `onerror` inventado y una marca desconocida se van con motivo', () => {
  const r = sanearContenido(landing([sec([
    p(txt('a', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'bold' }, { type: 'parpadeo' }])),
    { type: NODO.botones, content: [{ type: NODO.boton, attrs: { href: 'JaVaScRiPt:alert(1)', onclick: 'x' }, content: [txt('B', [{ type: 'bold' }])] }] },
    { type: 'paragraph', attrs: { onmouseover: 'alert(2)', style: 'x' }, content: [txt('c')] },
  ], { id: 'tA', onerror: 'alert(3)' })]));
  tieneMotivo(r.descartes, /enlace no permitido «javascript:alert\(1\)»/);
  tieneMotivo(r.descartes, /destino de botón no permitido/);
  tieneMotivo(r.descartes, /atributo desconocido «onerror» en tarjeta/);
  tieneMotivo(r.descartes, /atributo desconocido «onclick» en boton/);
  tieneMotivo(r.descartes, /atributo desconocido «onmouseover» en paragraph/);
  tieneMotivo(r.descartes, /marca desconocida «parpadeo»/);
  tieneMotivo(r.descartes, /un botón no lleva formato/);
  const json = JSON.stringify(r.contenido);
  assert.doesNotMatch(json, /javascript|onerror|onclick|onmouseover|parpadeo|alert/i);
  // La negrita del párrafo sobrevive; el botón queda sin destino y sin formato.
  assert.deepEqual(r.contenido.paginas[0].doc.content[0].content![0], p(txt('a', [{ type: 'bold' }])));
});

test('imágenes y videos sólo del bucket de la landing; el insertado sólo de un proveedor de lib/embeds.ts', () => {
  const r = sanearContenido(landing([sec([
    { type: NODO.imagen, attrs: { src: 'https://evil.com/x.png', alt: 'mala' } },
    { type: NODO.imagen, attrs: { src: IMG, alt: 'buena', ancho: 55 } },
    { type: NODO.video, attrs: { src: IMG } },
    { type: NODO.insertado, attrs: { src: 'https://evil.com/embed' } },
    { type: NODO.insertado, attrs: { src: 'https://youtu.be/dQw4w9WgXcQ', proveedor: 'inventado' } },
  ], { id: 'tA', diseno: 'derecha', imagenSrc: 'https://evil.com/acento.jpg' })]));
  tieneMotivo(r.descartes, /imagen fuera del almacenamiento de la landing «https:\/\/evil\.com\/x\.png»/);
  tieneMotivo(r.descartes, /video fuera del almacenamiento/);
  tieneMotivo(r.descartes, /insertado de un sitio no permitido/);
  tieneMotivo(r.descartes, /imagen de acento fuera del almacenamiento/);
  const t = r.contenido.paginas[0].doc.content[0];
  assert.equal(t.attrs!.imagenSrc, null);
  assert.deepEqual(t.content!.map((n) => n.type), [NODO.imagen, NODO.insertado]);
  assert.equal(t.content![0].attrs!.alt, 'buena');
  assert.equal(t.content![0].attrs!.ancho, 55);
  // El src del insertado lo arma lib/embeds.ts (el que entró no se guarda), y el proveedor también.
  assert.deepEqual(t.content![1].attrs, { src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0', proveedor: 'youtube', alto: null });
});

test('un insertado VACÍO es un marcador: se guarda sin motivo (su NodeView pide el enlace) y no se publica', async () => {
  // Decisión de la integración (11/10/2026): «Insertar» y «Video de YouTube…» entran sin enlace. Tirarlos
  // hacía desaparecer el bloque al recargar y anotaba un descarte en cada guardado.
  const r = sanearContenido(landing([sec([p(txt('Antes')), { type: NODO.insertado, attrs: { src: '' } }, { type: NODO.insertado, attrs: {} }], { id: 'tA' })]));
  assert.deepEqual(r.descartes, []);
  const t = r.contenido.paginas[0].doc.content[0];
  assert.deepEqual(t.content!.map((n) => n.type), ['paragraph', NODO.insertado, NODO.insertado]);
  cargaEnTipTap(r.contenido);
  const { htmlDeTarjeta } = await import('../lib/editor-landing/render');
  const { TEMAS } = await import('../lib/editor-landing/temas');
  assert.doesNotMatch(htmlDeTarjeta(t, TEMAS[0], { modo: 'publico' }), /gm-insertado/, 'la página publicada dibujaría un hueco sin explicación');
});

test('listas cerradas: lo que no es exactamente un valor de la lista vuelve al default, con motivo', () => {
  const r = sanearContenido(landing([sec([
    { type: NODO.optimizado, attrs: { variante: 'cajas-3d', columnas: '9', mostrarIconos: 'si' }, content: [{ type: NODO.optimizadoItem, attrs: { icono: '<svg>', valor: 'x'.repeat(80) }, content: [p(txt('i'))] }] },
    { type: NODO.recuadro, attrs: { tono: 'peligro' }, content: [p(txt('r'))] },
    { type: 'heading', attrs: { level: 9 }, content: [txt('h')] },
    { type: NODO.espaciador, attrs: { alto: 'enorme' } },
    p(txt('x', [{ type: 'textStyle', attrs: { color: 'red', tam: '99px' } }, { type: 'highlight', attrs: { color: '#FEF08A' } }])),
  ], { id: 'tA', diseno: 'diagonal', ancho: 'gigante', fondo: 'color', fondoColor: 'rojo' })]));
  const t = r.contenido.paginas[0].doc.content[0];
  assert.equal(t.attrs!.diseno, 'sin');
  assert.equal(t.attrs!.ancho, 'normal');
  assert.equal(t.attrs!.fondo, 'tema', 'un color que no es hex no deja el fondo en «color»');
  tieneMotivo(r.descartes, /«diseno» inválido en tarjeta/);
  const [opt, rec, h, esp, par] = t.content!;
  assert.deepEqual(opt.attrs, { variante: 'vinetas-grandes', columnas: 'auto', mostrarIconos: true });
  assert.deepEqual(opt.content![0].attrs, { icono: null, imagenSrc: null, valor: 'x'.repeat(40), destacado: false });
  tieneMotivo(r.descartes, /«variante» inválido en optimizado/);
  assert.equal(rec.attrs!.tono, 'info');
  assert.deepEqual(h.attrs, { level: 2 });
  assert.deepEqual(esp.attrs, { alto: 'm' });
  // textStyle sin un valor válido se cae entero; el resaltado con un hex queda.
  assert.deepEqual(par.content![0].marks, [{ type: 'highlight', attrs: { color: '#FEF08A' } }]);
});

test('ids de sección y de campo únicos en TODA la landing: los repetidos se regeneran, con motivo', () => {
  const form = (id: string) => ({ type: NODO.formulario, attrs: { campos: [{ id, tipo: 'email' }, { id: 'c-otro', tipo: 'email' }, { tipo: 'hackeo' }] } });
  const r = sanearContenido(landing(
    [sec([p(txt('a')), form('c1')], { id: 'tA' }), sec([p(txt('b'))], { id: 'tA' }), sec([p(txt('c'))], { id: 'id con espacios' })],
    [sec([form('c1')], { id: 'tA' })],
  ));
  const tarjetas = r.contenido.paginas.flatMap((pg) => pg.doc.content);
  const ids = tarjetas.map((t) => t.attrs!.id as string);
  assert.equal(new Set(ids).size, 4);
  assert.equal(ids[0], 'tA', 'el primero conserva el suyo');
  tieneMotivo(r.descartes, /id de sección repetido «tA»/);
  tieneMotivo(r.descartes, /id de sección inválido «id con espacios»/);
  const campos = tarjetas.flatMap((t) => (t.content ?? []).filter((n) => n.type === NODO.formulario)).flatMap((f) => f.attrs!.campos as { id: string; tipo: string }[]);
  assert.equal(campos.length, 2, 'un email repetido y un tipo desconocido se van');
  assert.equal(new Set(campos.map((c) => c.id)).size, 2);
  tieneMotivo(r.descartes, /campo\(s\) de tipo desconocido o repetido/);
  tieneMotivo(r.descartes, /id de campo repetido «c1»/);
});

test('páginas: UNA sola ruta de inicio, rutas válidas y únicas, ids únicos, y nunca menos de una página', () => {
  const doc = { type: 'doc', content: [sec([p(txt('x'))])] };
  const r = sanearContenido({ v: 1, paginas: [
    { id: 'p1', titulo: 'Inicio', ruta: '', doc },
    { id: 'p1', titulo: 'Otra portada', ruta: '', doc },
    { id: 'p3', titulo: 'Gracias', ruta: 'Gracias!!', doc },
    { id: 'p4', titulo: 'Gracias', ruta: 'gracias', doc },
    { id: 'p5', titulo: 'Repetida', ruta: 'gracias', doc },
  ] });
  const rutas = r.contenido.paginas.map((pg) => pg.ruta);
  assert.deepEqual(rutas, ['', 'otra-portada', 'gracias', 'gracias-2', 'gracias-3']);
  assert.equal(new Set(r.contenido.paginas.map((pg) => pg.id)).size, 5);
  tieneMotivo(r.descartes, /también era el inicio: pasa a \/otra-portada/);
  tieneMotivo(r.descartes, /ruta inválida «Gracias!!»/);
  tieneMotivo(r.descartes, /ruta repetida «gracias»/);
  tieneMotivo(r.descartes, /id de página repetido «p1»/);
  // Sin inicio, la primera pasa a serlo.
  const sinInicio = sanearContenido({ v: 1, paginas: [{ id: 'a', titulo: 'A', ruta: 'a-a-a', doc }, { id: 'b', titulo: 'B', ruta: 'b-b-b', doc }] });
  assert.deepEqual(sinInicio.contenido.paginas.map((pg) => pg.ruta), ['', 'b-b-b']);
  // Basura → una página vacía, con motivo.
  for (const basura of [null, 42, 'no es json', { paginas: 'x' }, []]) {
    const v = sanearContenido(basura);
    assert.equal(v.contenido.paginas.length, 1);
    assert.equal(v.contenido.paginas[0].ruta, '');
    cargaEnTipTap(v.contenido);
  }
  // Más páginas que el tope.
  const muchas = sanearContenido({ v: 1, paginas: Array.from({ length: TOPES.paginas + 3 }, (_, i) => ({ id: `q${i}`, titulo: `P${i}`, ruta: i ? `pagina-${i}` : '', doc })) });
  assert.equal(muchas.contenido.paginas.length, TOPES.paginas);
  tieneMotivo(muchas.descartes, /páginas \(tope 12\)/);
});

test('estructura: bloques sueltos van a una sección, y lo que el esquema exige se completa (no se tira)', () => {
  const r = sanearContenido(landing([
    p(txt('suelto 1')),
    { type: 'heading', attrs: { level: 2 }, content: [txt('suelto 2')] },
    sec([
      { type: NODO.desplegable, content: [p(txt('sin título ni cuerpo'))] },
      { type: NODO.columnas, attrs: { anchos: [3, 3, 3] }, content: [{ type: NODO.columna, content: [p(txt('a'))] }, { type: NODO.columna }] },
      { type: NODO.columnas, content: [{ type: NODO.columna, content: [p(txt('única'))] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [p(txt('anidado'))] }] }] }] },
      { type: 'paragraph', content: [txt(''), txt('x\u0000y'), { type: 'imagen', attrs: { src: IMG } }] },
      { type: 'table', content: [{ type: 'tableRow', content: [] }, { type: 'tableRow', content: [{ type: 'tableCell', content: [] }] }] },
    ], { id: 'tB' }),
  ]));
  const [envuelta, t] = r.contenido.paginas[0].doc.content;
  tieneMotivo(r.descartes, /2 bloque\(s\) fuera de una sección/);
  assert.deepEqual(envuelta.content!.map((n) => n.type), ['paragraph', 'heading']);
  const [desp, cols, unica, lista, par, tabla] = t.content!;
  assert.deepEqual(desp.content!.map((n) => n.type), [NODO.desplegableTitulo, NODO.desplegableCuerpo]);
  assert.deepEqual(desp.content![1].content, [p(txt('sin título ni cuerpo'))], 'lo suelto va al cuerpo');
  assert.deepEqual(cols.attrs, { anchos: [6, 6], divisores: false });
  tieneMotivo(r.descartes, /los anchos de las columnas no coinciden/);
  assert.equal(unica.type, 'paragraph', 'unas columnas de una sola columna dejan su contenido');
  assert.equal(lista.content![0].content![0].type, 'paragraph', 'un ítem de lista arranca con un párrafo');
  assert.deepEqual(par.content, [txt('xy')], 'sin texto vacío ni caracteres de control; la imagen no va en un texto');
  tieneMotivo(r.descartes, /«imagen» no puede ir dentro de un texto/);
  assert.equal(tabla.content!.length, 1);
  assert.deepEqual(tabla.content![0].content![0].content, [{ type: 'paragraph' }]);
  cargaEnTipTap(r.contenido);
});

test('lo que sale CARGA en el esquema de ProseMirror armado con CONTENIDO_TIPTAP (si no, TipTap abre vacío)', () => {
  // Un documento hostil y desordenado: cada nodo fuera de lugar, con atributos basura.
  const caos = landing([
    { type: 'text', text: 'texto suelto en el doc' },
    sec([
      { type: NODO.tarjeta, content: [p(txt('tarjeta adentro de tarjeta'))] },
      { type: NODO.columnas, content: Array.from({ length: 8 }, (_, i) => ({ type: NODO.columna, content: [{ type: NODO.columnas, content: [] }, p(txt(`c${i}`))] })) },
      { type: NODO.optimizado, content: Array.from({ length: 15 }, () => ({ type: NODO.optimizadoItem, content: [{ type: NODO.optimizado }, { type: NODO.columnas }] })) },
      { type: NODO.botones, content: [{ type: NODO.boton, content: [{ type: 'hardBreak' }, txt('x', [{ type: 'italic' }])] }, p(txt('no soy botón'))] },
      { type: NODO.recuadro },
      { type: 'blockquote', content: [{ type: NODO.formulario }] },
      { type: 'orderedList', attrs: { start: -4 }, content: [{ type: 'taskItem', attrs: { checked: 'sí' } }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'heading', content: [txt('h')] }] }] },
      { type: NODO.desplegable, content: [{ type: NODO.desplegableCuerpo }, { type: NODO.desplegableTitulo, content: [txt('t')] }, { type: NODO.desplegableTitulo }] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 99, colwidth: [100] }, content: [{ type: 'table' }] }] }] },
      { type: NODO.grafico, attrs: { series: 'x' } },
      { type: NODO.formulario, attrs: { campos: [{ tipo: 'opciones', opciones: ['solo una'] }] } },
    ]),
    sec([], { id: '' }),
  ]);
  const r = sanearContenido(caos);
  assert.doesNotThrow(() => cargaEnTipTap(r.contenido));
  assert.ok(r.descartes.length > 10, `se anotaron ${r.descartes.length} descartes`);
  // Y el formulario de «opciones» con una sola opción pasa a texto (como la gramática de la IA).
  const json = JSON.stringify(r.contenido);
  assert.match(json, /"tipo":"texto"/);
});

test('IDEMPOTENTE: sanear lo saneado devuelve lo mismo y no anota nada', () => {
  const r1 = sanearContenido(landing([
    sec([
      { type: 'heading', attrs: { level: 1, variante: 'titulo', textAlign: 'center' }, content: [txt('Hola', [{ type: 'link', attrs: { href: 'www.ejemplo.com', target: null } }])] },
      { type: NODO.formulario, attrs: { campos: [{ tipo: 'nombre' }, { tipo: 'email', requerido: true }] } },
      { type: NODO.grafico, attrs: { tipo: 'lineas', categorias: ['a', 'b'], series: [{ valores: [1] }] } },
      { type: NODO.imagen, attrs: { src: IMG, ancho: '70' } },
    ], { diseno: 'izquierda', imagenSrc: IMG, imagenFocoX: 150 }),
  ]));
  const r2 = sanearContenido(JSON.parse(JSON.stringify(r1.contenido)));
  assert.deepEqual(r2.contenido, r1.contenido);
  assert.deepEqual(r2.descartes, []);
  assert.equal(r2.bytes, r1.bytes);
  // Y el link con un dominio suelto se guardó con https://.
  assert.match(JSON.stringify(r1.contenido), /"href":"https:\/\/www\.ejemplo\.com"/);
});

test('topes: texto largo recortado, HTML personalizado sobre el tope vacío, secciones por página, bytes', () => {
  const largo = 'a'.repeat(TOPES.caracteresTexto + 10);
  const r = sanearContenido(landing([
    sec([p(txt(largo)), { type: NODO.htmlLibre, attrs: { html: 'x'.repeat(TOPES.htmlLibre + 1), alto: 300 } }]),
    ...Array.from({ length: TOPES.tarjetasPorPagina + 2 }, () => sec([p(txt('s'))])),
  ]));
  const [t] = r.contenido.paginas[0].doc.content;
  assert.equal(t.content![0].content![0].text!.length, TOPES.caracteresTexto);
  assert.equal(t.content![1].attrs!.html, '');
  tieneMotivo(r.descartes, /texto de 20010 caracteres/);
  tieneMotivo(r.descartes, /HTML personalizado de 50001 caracteres/);
  assert.equal(r.contenido.paginas[0].doc.content.length, TOPES.tarjetasPorPagina);
  tieneMotivo(r.descartes, /secciones en .* \(tope 60\)/);
  assert.equal(excedeTope(r), false);
  assert.equal(excedeTope({ bytes: TOPES.bytesContenido + 1 }), true);
});

test('configuración: defaults, Píxel de Meta sólo dígitos, SEO 60/160, barra ≤ 5 enlaces y ≤ 2 botones, imágenes del bucket', () => {
  const { config, descartes } = sanearConfig({
    tema: 'ws:mi-tema',
    sitio: {
      nombre: 'Mi negocio', seoTitulo: 't'.repeat(90), seoDescripcion: 'd'.repeat(300), metaPixelId: '1234567890<script>',
      favicon: 'https://evil.com/f.png', ogImagen: IMG, indexar: 'sí',
      nav: { mostrar: true, enlaces: Array.from({ length: 8 }, (_, i) => ({ texto: `E${i}`, destino: `#t-s${i}` })).concat([{ texto: 'Malo', destino: 'javascript:alert(1)' }]), botones: [{ texto: 'A', destino: 'https://a.com', estilo: 'raro' }, { texto: 'B', destino: 'pagina:p2' }, { texto: 'C', destino: '#t-x' }] },
      pie: { mostrar: true, texto: 'Pie' },
    },
    pagina: { animaciones: false, fondoImagen: IMG },
    origen: { modo: 'ia', pedido: 'una landing', objetivo: 'agendar', basadoEnUrl: 'javascript:x' },
  });
  assert.equal(config.tema, 'ws:mi-tema');
  assert.equal(config.sitio.seoTitulo.length, 60);
  assert.equal(config.sitio.seoDescripcion.length, 160);
  assert.equal(config.sitio.metaPixelId, null);
  tieneMotivo(descartes, /Píxel de Meta .* no es un número/);
  assert.equal(config.sitio.favicon, null);
  assert.equal(config.sitio.ogImagen, IMG);
  assert.equal(config.sitio.indexar, false, 'un «sí» que no es booleano no prende la indexación');
  assert.equal(config.sitio.nav.enlaces.length, 5);
  assert.equal(config.sitio.nav.botones.length, 2);
  assert.equal(config.sitio.nav.botones[0].estilo, 'primario');
  assert.equal(config.pagina.animaciones, false);
  assert.deepEqual(config.origen, { modo: 'ia', pedido: 'una landing', objetivo: 'agendar', basadoEnUrl: null });
  assert.equal(sanearConfig({ sitio: { metaPixelId: ' 123456789012345 ' } }).config.sitio.metaPixelId, '123456789012345');
  // Basura → los defaults.
  const vacia = sanearConfig('nada').config;
  assert.equal(vacia.tema, 'pewter');
  assert.equal(vacia.sitio.marcaMako, true);
  assert.equal(vacia.sitio.indexar, false);
});

test('el modelo de contenido: cada nodo con hijos tiene su expresión de TipTap, y ninguna nombra un nodo que no existe', () => {
  const conocidos = new Set([...Object.keys(NORMALIZAR_NODOS), 'doc', 'text']);
  for (const [nombre, hijos] of Object.entries(HIJOS_PERMITIDOS)) {
    assert.ok(CONTENIDO_TIPTAP[nombre], `${nombre} sin expresión`);
    for (const h of hijos) assert.ok(conocidos.has(h), `${nombre} admite «${h}», que no existe`);
  }
  for (const nombre of Object.keys(NORMALIZAR_NODOS)) {
    if (!HIJOS_PERMITIDOS[nombre]) assert.equal(CONTENIDO_TIPTAP[nombre], undefined, `${nombre} es un átomo`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROTURAS (11/10/2026). Base: 12 pass / 0 fail. Cada rotura sobre el fuente, corrida, y vuelta
// al original desde la copia en memoria (hash verificado). Resultado de cada una:
//   V1 `descartar` no anota nada (validar.ts) ................. 3 / 9  (todo lo que exige un motivo)
//   V2 la variante del optimizado no pasa por su lista ........ 11 / 1 (listas cerradas)
//   V3 un id de sección repetido no se regenera ............... 11 / 1 (ids únicos)
//   V4 una ruta repetida no se renombra ....................... 11 / 1 (páginas)
//   V5 un texto vacío queda ................................... 11 / 1 (estructura: ProseMirror lo rechaza)
//   V6 un ítem de lista sin párrafo inicial ................... 10 / 2 (estructura; CARGA en el esquema)
//   V7 los bloques sueltos del doc se tiran ................... 11 / 1 (estructura)
//   V8 el Píxel de Meta sin anclas (`/\d{5,20}/`) ............. 11 / 1 (configuración)
//   V9 hrefPermitido deja pasar todo (especificacion.ts) ...... 10 / 2 (XSS; idempotente)
//   V10 srcPermitido acepta todo (especificacion.ts) .......... 10 / 2 (imágenes; configuración)
// ─────────────────────────────────────────────────────────────────────────────
