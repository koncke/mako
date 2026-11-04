// =============================================================================
// Las páginas de MaKo editables por sección, sin romper su diseño (24/10/2026)
// =============================================================================
// Martín, textual: «Todas las paginas de MaKo no son editables, clickeo y no se pueden editar las secciones... Eso esta
// mal. Deben serlo. Y eso no implica romper el diseño, en todo caso agregar funcionalidades al editor web.»
//
// Las páginas de MaKo son secciones de «Diseño editable» (el HTML de Claude Design en un iframe). Lo que faltaba:
//   1. la IA del chat las veía como una caja cerrada (`conservar`): ahora ve sus TEXTOS y los cambia, cada uno en su
//      lugar exacto del HTML (lib/editor-landing/html-editable-textos.ts): la forma no se toca;
//   2. un clic adentro del diseño no activaba la sección (pasa en el iframe; ProseMirror no lo ve);
//   3. sólo se podía escribir, cambiar una imagen o un enlace: suma negrita y cursiva.
// Correr: node --import tsx --test tests/editor-web-paginas-mako-editables.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOPE_TEXTOS_DISENO, codificar, conTextos, decodificar, textosDeHtmlEditable } from '../lib/editor-landing/html-editable-textos';
import { bloquesATarjeta, tarjetaABloques, GRAMATICA_IA, type TarjetaIA } from '../lib/editor-landing/ia-bloques';
import { NODO, type JsonNodo } from '../lib/editor-landing/doc';

const RAIZ = join(import.meta.dirname, '..');
// El fin de línea, normalizado ANTES de buscar (AGENTS.md, «Fin de línea»): en un clon con autocrlf los fuentes llegan en CRLF.
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Un pedazo como los de la landing de MaKo: estilos en línea, un atributo con «>», un ícono, una entidad y un botón. */
const HTML =
  '<section class="hero" style="padding:72px 24px" data-x="a>b">' +
  '<style>.hero h1{color:red}</style>' +
  '<h1 style="font-size:54px">Tu landing <span style="color:#2F6FED">en una tarde</span>, sin programador</h1>' +
  '<p>Le cuentas a la IA&nbsp;lo que vendes &amp; la editas.</p>' +
  '<svg viewBox="0 0 10 10"><text>no es texto</text><path d="M0 0"/></svg>' +
  '<a href="#beta" class="cta">  Quiero mi diagnóstico  </a><br/><img src="https://x.test/a.png" alt="foto">' +
  '</section>';

test('los textos de un diseño: en orden, decodificados, sin los de un estilo o un ícono', () => {
  assert.deepEqual(textosDeHtmlEditable(HTML), [
    'Tu landing', 'en una tarde', ', sin programador', 'Le cuentas a la IA lo que vendes & la editas.', 'Quiero mi diagnóstico',
  ]);
  assert.deepEqual(textosDeHtmlEditable(''), []);
  assert.equal(decodificar('a&amp;b&lt;c&#39;d&#x41;&nbsp;'), "a&b<c'dA ");
  assert.equal(codificar('<b>&'), '&lt;b&gt;&amp;');
});

test('volver a poner los textos: la forma intacta, sólo cambia lo que dice; igual = byte por byte', () => {
  const mismos = textosDeHtmlEditable(HTML);
  assert.equal(conTextos(HTML, mismos), HTML, 'los mismos textos tocaron el HTML');
  const nuevo = conTextos(HTML, ['Tu web', 'en una hora', ', sin código', 'Le dices a MaKo <script>alert(1)</script> qué vendes.', 'Lo quiero']);
  assert.ok(nuevo, 'no volvió');
  // Etiquetas, estilos, atributos (con su «>»), el estilo y el ícono: iguales.
  for (const pieza of ['<section class="hero" style="padding:72px 24px" data-x="a>b">', '<style>.hero h1{color:red}</style>',
    '<h1 style="font-size:54px">', '<span style="color:#2F6FED">', '<svg viewBox="0 0 10 10"><text>no es texto</text><path d="M0 0"/></svg>',
    '<a href="#beta" class="cta">', '<br/><img src="https://x.test/a.png" alt="foto">']) {
    assert.ok(nuevo.includes(pieza), `se tocó la forma: falta ${pieza}`);
  }
  assert.ok(nuevo.includes('<h1 style="font-size:54px">Tu web <span style="color:#2F6FED">en una hora</span>, sin código</h1>'), nuevo);
  // Los espacios de alrededor del botón se conservan; un texto nunca abre una etiqueta.
  assert.ok(nuevo.includes('<a href="#beta" class="cta">  Lo quiero  </a>'));
  assert.ok(nuevo.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.doesNotMatch(nuevo, /<script>/);
  // Otra cantidad: no se adivina dónde va cada uno.
  assert.equal(conTextos(HTML, mismos.slice(1)), null);
  assert.equal(conTextos(HTML, [...mismos, 'otro']), null);
  assert.equal(conTextos(HTML, [1, 2, 3, 4, 5] as unknown[]), null);
});

test('la IA ve los TEXTOS de una sección de diseño y los cambia sin tocar la forma (antes: una caja cerrada)', () => {
  const editable: JsonNodo = { type: NODO.htmlEditable, attrs: { html: HTML } };
  const base: JsonNodo = { type: NODO.tarjeta, attrs: { id: 'tmako1' }, content: [editable] };
  const ida = tarjetaABloques(base);
  assert.equal(ida.bloques.length, 1);
  const b = ida.bloques[0] as { t: string; ref: string; textos: string[] };
  assert.equal(b.t, 'diseno', 'el diseño volvió a viajar como «conservar»: MaKo no ve sus textos');
  assert.deepEqual(b.textos, textosDeHtmlEditable(HTML));
  assert.ok(!JSON.stringify(ida).includes('style='), 'el HTML viajó al modelo');

  // El modelo cambia un texto: vuelve el MISMO nodo con el html nuevo.
  const editada: TarjetaIA = { ...ida, bloques: [{ ...b, textos: b.textos.map((t, i) => (i === 0 ? 'Tu web' : t)) }] as TarjetaIA['bloques'] };
  const vuelta = bloquesATarjeta(editada, { base });
  const nodo = vuelta.content?.[0];
  assert.equal(nodo?.type, NODO.htmlEditable);
  assert.equal(nodo?.attrs?.html, conTextos(HTML, editada.bloques[0] && (editada.bloques[0] as { textos: string[] }).textos));
  assert.equal(vuelta.attrs?.id, 'tmako1');

  // Otra cantidad: la sección queda como estaba, y se dice.
  const descartes: string[] = [];
  const mal = bloquesATarjeta({ ...ida, bloques: [{ ...b, textos: ['uno solo'] }] as TarjetaIA['bloques'] }, { base, descartes });
  assert.equal(mal.content?.[0]?.attrs?.html, HTML);
  assert.match(descartes.join('\n'), /volvieron 1 textos y la sección tiene 5/);

  // Una sección con demasiados textos sigue cerrada (no se manda un muro al modelo).
  const muchos = '<div>' + Array.from({ length: TOPE_TEXTOS_DISENO + 1 }, (_, i) => `<p>t${i}</p>`).join('') + '</div>';
  const grande = tarjetaABloques({ type: NODO.tarjeta, attrs: { id: 'tg' }, content: [{ type: NODO.htmlEditable, attrs: { html: muchos } }] });
  assert.equal(grande.bloques[0]?.t, 'conservar');
  // La gramática le explica la regla al modelo (desde la réplica editable, 29/10: «cambios» para unos pocos, y «textos» con la
  // MISMA cantidad y el mismo orden para casi todos; nunca agregar ni quitar).
  assert.match(GRAMATICA_IA, /"t":"diseno","ref","textos"[\s\S]*"textos" con la MISMA cantidad, en el mismo orden[\s\S]*No agregues ni quites textos/);
});

test('un clic adentro del diseño ACTIVA su sección, y su barrita suma negrita y cursiva', () => {
  const vista = sinComentarios(leer('app/web-generator/editor/nodos/HtmlEditableVista.tsx'));
  assert.match(vista, /d\.addEventListener\('mousedown', \(e\) => \{\s*activarDiseno\(\{ doc: d, guardar: \(\) => guardarVivo\.current\(\) \}\);\s*marcarSeccion\(\);/);
  assert.match(vista, /if \(n\.type\.name === NODO\.tarjeta\) \{ const id = String\(n\.attrs\.id \?\? ''\); if \(id\) c\.marcarActiva\(id\); return; \}/);
  // Desde el 25/10/2026 la barrita va con íconos y el nombre en el tooltip (`boton(nombre, ícono, acción)`).
  assert.match(vista, /boton\('Negrita', <Icono nombre="negrita" \/>, \(\) => formato\('bold'\)\)/);
  assert.match(vista, /boton\('Cursiva', <Icono nombre="cursiva" \/>, \(\) => formato\('italic'\)\)/);
  // El editor le da al contexto la forma de activar una sección sin mover el cursor ni el scroll.
  const editor = sinComentarios(leer('app/web-generator/editor/EditorLanding.tsx'));
  assert.match(editor, /marcarActiva: setTarjetaActiva,/);
});
