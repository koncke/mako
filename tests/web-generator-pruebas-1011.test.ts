// =============================================================================
// Web Generator — lo que rompió la prueba en producción del 10/11/2026 (docs/pruebas/web-generator-10-11.md)
// =============================================================================
// Lo que se fija:
//   1. `textoDe` separa los BLOQUES aunque estén adentro de columnas, y no parte un párrafo por sus marcas. Medido: la portada de
//      «Lead magnet» se llamaba «Guía gratuitaTus primeros 10 clientesUna guía corta…» en «Redirigir a» y en la vista previa de
//      Google del diálogo de Publicar.
//   2. `tituloDeTarjeta` encuentra el título también adentro de las columnas (la portada con formulario al costado).
//   3. El SEO publicado (seo-pagina.ts): un SEO de página con «[…]» de la plantilla no se publica, y en el inicio manda lo que
//      la persona escribió en Publicar → SEO. Medido: la publicada salía «[Nombre de la guía] (gratis)» y lo escrito en el
//      diálogo no llegaba. Recorre las 12 plantillas.
//   4. El diálogo de Publicar muestra en la vista previa LO MISMO que se publica (la misma función).
//   5. El menú «Agregar bloque»: filas al alto del contenido (36 tarjetas con la segunda línea cortada) y el nombre visible en
//      oscuro (`--gma-t200` pasó a ser un borde el 31/10).
//
// Correr: node --import tsx --test tests/web-generator-pruebas-1011.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODO, parrafo, tarjeta, textoDe, titulo, tituloDeTarjeta, type JsonNodo } from '../lib/editor-landing/doc';
import { metaDePagina, seoCompleto } from '../lib/editor-landing/seo-pagina';
import { metaDePagina as metaDelServer } from '../lib/editor-landing/server-reglas';
import { rangosACompletar } from '../lib/editor-landing/especificacion';
import { PLANTILLAS } from '../lib/editor-landing/plantillas';
import { DISENOS_LANDING, landingDesde } from '../lib/editor-landing/disenos-landing';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const columnas = (...cols: JsonNodo[][]): JsonNodo => ({ type: NODO.columnas, content: cols.map((c) => ({ type: NODO.columna, content: c })) });
const ante = (t: string) => parrafo(t);

test('1. textoDe: los bloques de una columna van separados; un párrafo con negrita sigue en un renglón', () => {
  const portada = tarjeta([columnas([ante('Guía gratuita'), titulo('Tus primeros 10 clientes', 1, 'titulo'), parrafo('Una guía corta.')], [parrafo('Nombre')])]);
  assert.equal(textoDe(portada), 'Guía gratuita\nTus primeros 10 clientes\nUna guía corta.\nNombre');
  assert.equal(textoDe(portada, ' '), 'Guía gratuita Tus primeros 10 clientes Una guía corta. Nombre');
  const conNegrita: JsonNodo = { type: 'paragraph', content: [{ type: 'text', text: 'Tus ' }, { type: 'text', text: 'primeros', marks: [{ type: 'bold' }] }, { type: 'text', text: ' 10' }] };
  assert.equal(textoDe(conNegrita), 'Tus primeros 10', 'las marcas parten el texto, no el renglón');
  const conSalto: JsonNodo = { type: 'paragraph', content: [{ type: 'text', text: 'uno' }, { type: 'hardBreak' }, { type: 'text', text: 'dos' }] };
  assert.equal(textoDe(conSalto), 'uno\ndos');
  // El documento entero: una sección no se pega a la siguiente.
  const doc: JsonNodo = { type: 'doc', content: [tarjeta([titulo('Arriba')]), tarjeta([titulo('Abajo')])] };
  assert.equal(textoDe(doc, ' '), 'Arriba Abajo');
  // Los vacíos no dejan separadores colgando.
  assert.equal(textoDe(tarjeta([parrafo(''), titulo('Solo'), parrafo('')])), 'Solo');
});

test('2. tituloDeTarjeta: el título adentro de las columnas, no el antetítulo pegado a todo', () => {
  const portada = tarjeta([columnas([ante('Guía gratuita'), titulo('Tus primeros 10 clientes', 1, 'titulo'), parrafo('Una guía corta.')], [parrafo('Nombre')])]);
  assert.equal(tituloDeTarjeta(portada), 'Tus primeros 10 clientes');
  const conNegrita = tarjeta([{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Qué vas a ' }, { type: 'text', text: 'encontrar', marks: [{ type: 'bold' }] }] }]);
  assert.equal(tituloDeTarjeta(conNegrita), 'Qué vas a encontrar', 'una negrita ya no corta el título');
  assert.equal(tituloDeTarjeta(tarjeta([parrafo('Sin títulos'), parrafo('otra')])), 'Sin títulos', 'sin título: el primer renglón');
  // La portada REAL de «Minimal» × «Lead magnet» (la que se creó en producción).
  const minimal = DISENOS_LANDING.find((d) => d.id === 'minimal') ?? DISENOS_LANDING[0];
  const lm = landingDesde(minimal, 'lead-magnet');
  assert.ok(lm, 'el diseño arma el lead magnet');
  const t = tituloDeTarjeta(lm!.paginas[0].doc.content![0] as JsonNodo);
  assert.doesNotMatch(t, /gratuita\S/i, `sin el antetítulo pegado: «${t}»`);
});

test('3. el SEO publicado: sin los «[…]» de la plantilla, y en el inicio manda lo que escribió la persona', () => {
  assert.equal(seoCompleto('[Nombre de la guía] (gratis)'), '');
  assert.equal(seoCompleto('  Mi guía (gratis) '), 'Mi guía (gratis)');
  const inicio = { id: 'a', titulo: 'Inicio', ruta: '', seoTitulo: '[Nombre de la guía] (gratis)', seoDescripcion: 'Descarga gratis [nombre de la guía].' };
  const vacio = CONFIG_DEFAULT.sitio;
  assert.deepEqual(metaDePagina(inicio, vacio, 'Lead magnet / descarga'), { titulo: 'Lead magnet / descarga', descripcion: '' },
    'la plantilla sin completar no sale: cae al título de la landing, como promete el diálogo');
  const escrito = { ...vacio, seoTitulo: 'Tus primeros 10 clientes', seoDescripcion: 'La guía gratis.' };
  assert.deepEqual(metaDePagina(inicio, escrito, 'Lead magnet / descarga'), { titulo: 'Tus primeros 10 clientes', descripcion: 'La guía gratis.' });
  assert.equal(metaDePagina({ ...inicio, seoTitulo: '¡Gracias!' }, escrito, 'Doc').titulo, 'Tus primeros 10 clientes',
    'en el inicio, lo escrito en Publicar → SEO gana al de la página (la interfaz no edita el de cada página)');
  assert.equal(metaDePagina({ ...inicio, seoTitulo: '¡Gracias!' }, vacio, 'Doc').titulo, '¡Gracias!', 'sin nada escrito, el de la página completo sí');
  const interna = { id: 'b', titulo: 'Gracias', ruta: 'gracias', seoTitulo: '[Tu marca]: gracias' };
  assert.equal(metaDePagina(interna, escrito, 'Doc').titulo, 'Gracias', 'una interna con «[…]» cae a su nombre');
  assert.equal(metaDePagina({ ...interna, seoTitulo: 'Gracias por anotarte' }, escrito, 'Doc').titulo, 'Gracias por anotarte');
  assert.equal(metaDelServer, metaDePagina, 'el server publica con la MISMA función');
  // Las 12 plantillas: ninguna página publica un «[…]» de SEO si la persona no escribió nada.
  for (const p of PLANTILLAS) {
    for (const pag of p.contenido().paginas) {
      const m = metaDePagina(pag, vacio, p.nombre);
      assert.deepEqual(rangosACompletar(m.titulo), [], `${p.id}/${pag.ruta || 'inicio'}: «${m.titulo}»`);
      assert.deepEqual(rangosACompletar(m.descripcion), [], `${p.id}/${pag.ruta || 'inicio'}: «${m.descripcion}»`);
    }
  }
});

test('4. el diálogo de Publicar: la vista previa sale de la misma función que la publicada', () => {
  const d = sinComentarios(leer('app/web-generator/editor/dialogos/DialogoPublicar.tsx'));
  assert.match(d, /import \{ metaDePagina \} from '@\/lib\/editor-landing\/seo-pagina';/);
  assert.match(d, /const metaInicio = inicio \? metaDePagina\(\{ \.\.\.inicio, ruta: '' \}, sitio, tituloDoc\)/);
  assert.match(d, /const tituloBusqueda = metaInicio\.titulo;/);
  assert.match(d, /placeholder=\{tituloSinEscribir\}/, 'la ayuda del «Título» es lo que sale si se deja vacío');
  assert.doesNotMatch(d, /sitio\.seoTitulo\.trim\(\) \|\| titulo/, 'nada de armar el título por su cuenta');
});

test('5. «Agregar bloque»: filas al alto de su contenido y el nombre visible en oscuro', () => {
  const css = sinComentarios(leer('app/web-generator/gamma.css'));
  const grilla = /\.gma-pop-grilla \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(grilla, /grid-auto-rows: max-content;/, 'con max-height, las filas auto se quedan en el mínimo de la tarjeta');
  assert.match(grilla, /max-height: 360px;/);
  assert.match(css, /\[data-tema="oscuro"\] \.gma \.gma-tile-nombre \{ color: var\(--gma-texto-fuerte\); \}/);
  assert.doesNotMatch(css, /\[data-tema="oscuro"\][^{]*\{[^}]*color: var\(--gma-t(?:200|300)\)/, 'un borde translúcido no es un color de texto');
});

test('6. la caja del chat sin la app de escritorio: la frase en un renglón entero y el botón abajo', () => {
  const panel = leer('app/web-generator/editor/paneles/PanelAgente.tsx');
  const css = /const CSS_AGENTE = `([\s\S]*?)`;/.exec(panel)?.[1] ?? '';
  assert.match(css, /\.gma-ag \.co-caja textarea::placeholder\{white-space:nowrap;/, 'la frase sigue en UN renglón (Martín, 24/10)');
  assert.match(css, /\.gma-ag \.co-caja__fila:has\(\.co-instalar\)\{flex-wrap:wrap;/, 'bloqueada, la fila se parte');
  assert.match(css, /\.gma-ag \.co-caja__fila:has\(\.co-instalar\)>\.co-caja__campo\{flex-basis:calc\(100% - 48px\)\}/,
    'el campo toma el renglón entero (menos el «+»): medido, de 115 a 247 px para una frase de 161');
  assert.match(css, /:is\(\.co-instalar,:has\(\.co-instalar\)\)\{margin-left:auto\}/, 'el botón, a la derecha');
});

// PROBADO ROMPIÉNDOLO (10/11/2026, base 6/0; cada rotura sobre el archivo real, restaurado y verificado por hash):
//   · `textoDe` separando otra vez por el tipo del PADRE              → 5/1 (1)
//   · `tituloDeTarjeta` mirando sólo los hijos directos               → 5/1 (2)
//   · `seoCompleto` dejando pasar los «[…]»                           → 5/1 (3)
//   · en el inicio, el SEO de la página otra vez antes que el del sitio → 5/1 (3)
//   · el diálogo armando el título por su cuenta                       → 5/1 (4)
//   · sin `grid-auto-rows: max-content`                                → 5/1 (5)
//   · el nombre en oscuro con `--gma-t200`                             → 5/1 (5)
//   · sin el `flex-wrap` de la caja bloqueada                          → 5/1 (6)
