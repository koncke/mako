// =============================================================================
// Los menús del editor de landings (paquete G2): el «/», «Cambiar diseño» y la barra
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer todo lo
// que ahí se hace.» Diseño: docs/diseno-editor-landing.md. Lo que fija este archivo:
//
//   1. EL «/» encuentra un bloque por su nombre o por un sinónimo, sin acentos ni mayúsculas
//      («titulo» → Título, «precaución» → el cuadro de precaución), y con la consulta vacía
//      muestra TODO el catálogo, una vez cada bloque, en el orden de categorías de Gamma.
//   2. EL MOTOR del «/» (extensiones/barra.ts) se abre sólo con una «/» TECLEADA al principio
//      de un bloque vacío o después de un espacio (una URL o «y/o» no lo abren), sigue lo que
//      se escribe y se cierra si el cursor sale, si la «/» desaparece o con Escape. Se prueba
//      con el plugin de verdad sobre un EditorState (el editor de TipTap sin montar no instala
//      plugins: se arma el estado con `extensionManager.plugins`).
//   3. «CAMBIAR DISEÑO» ofrece TODAS las variantes de OPTIMIZADOS: la grilla sale de
//      `gruposDeDiseno`, que recorre OPTIMIZADOS sin filtro (se lee el fuente) y devuelve
//      cada variante una vez en su grupo (se ejecuta); y cada miniatura es el render real de
//      esa variante.
//   4. LA BARRA no tiene botones sin handler ni botones que le roben el foco al texto
//      (todo `<button>` de BarraFormato.tsx lleva onClick y onMouseDown), y en todo el paquete
//      no hay un `<button>` ni un renglón de menú sin onClick. «Editar con IA» tiene una fila
//      por cada acción de ACCIONES_TEXTO.
//
// Los fuentes se leen normalizando CRLF y sin comentarios (la casa explica en los comentarios
// lo que se sacó, y un guard que lee el comentario se acusa solo).
//
// ── Roturas (11/10/2026, arnés que restaura de memoria y verifica el hash; base en verde: 13 pasan, 0 fallan) ──
//   · gruposDeBarra filtra a mano el nombre, sin buscarBloques (sin acentos ni sinónimos)   -> 12 / 1
//   · gruposDeBarra se saltea la primera categoría (`CATEGORIAS_BLOQUE.slice(1)`)            -> 11 / 2
//   · handleTextInput abre el menú también pegado a una palabra                             -> 12 / 1
//   · handleKeyDown sin la rama de Escape                                                   -> 12 / 1
//   · gruposDeDiseno deja afuera un grupo (`OPTIMIZADOS.filter(…)`)                          -> 11 / 2
//   · la grilla dibuja sólo 6 variantes por grupo (`g.variantes.slice(0, 6)`)               -> 12 / 1
//   · la miniatura dibuja siempre la misma variante                                         -> 12 / 1
//   · la muestra «Predeterminado» del color sin onClick                                     -> 11 / 2
//   · BotonBarra sin el onMouseDown que cuida el foco                                       -> 12 / 1
//   · «Editar con IA» sin la fila de «Seguir escribiendo con IA»                             -> 12 / 1
//   · «Añadir fila» del gráfico (otro archivo del paquete) sin onClick                       -> 12 / 1
//   Lo que NO pudo fijarse con una rotura: el chequeo «la barra y el cursor en el MISMO bloque»
//   de `calcular` (barra.ts). Sacarlo no cambia nada observable: si el cursor va a un bloque
//   anterior lo corta `cabeza <= desde`, y si va a uno posterior la consulta trae un salto de
//   línea y `consultaValida` la rechaza. Queda como defensa, no como regla con test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorState, TextSelection, type Plugin, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { BLOQUES, CATEGORIAS_BLOQUE } from '../lib/editor-landing/catalogo-bloques';
import { OPTIMIZADOS, type JsonNodo } from '../lib/editor-landing/doc';
import { ACCIONES_TEXTO } from '../lib/editor-landing/api-tipos';
import { TEMAS } from '../lib/editor-landing/temas';
import {
  ATAJO_MARKDOWN, ExtensionBarra, claveBarra, consultaValida, estadoBarra, gruposDeBarra,
} from '../app/landing-generator/editor/extensiones/barra';
import { gruposDeDiseno, htmlDeMiniatura } from '../app/landing-generator/editor/nodos/OptimizadoVista';
import { ACCIONES_IA } from '../app/landing-generator/editor/BarraFormato';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario ANTES que los bloques (un «/*» citado en una línea se comería código).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ED = 'app/landing-generator/editor/';
const BARRA = ED + 'BarraFormato.tsx';
const OPT = ED + 'nodos/OptimizadoVista.tsx';
const FUENTES_G2 = [
  BARRA, ED + 'MenuBarra.tsx', ED + 'AsaBloque.tsx', ED + 'SelectorIcono.tsx', OPT,
  ED + 'nodos/BotonesVista.tsx', ED + 'nodos/FormularioVista.tsx', ED + 'nodos/GraficoVista.tsx',
  ED + 'nodos/InsertadoVista.tsx', ED + 'nodos/HtmlLibreVista.tsx',
];

/**
 * Las etiquetas de apertura `<Nombre …>` de un fuente JSX, enteras. Se camina con las llaves y
 * las comillas balanceadas: un `=>` adentro de un handler tiene un `>` que NO cierra la etiqueta.
 */
function etiquetas(src: string, nombre: string): string[] {
  const out: string[] = [];
  const re = new RegExp('<' + nombre + '(?=[\\s/>])', 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let prof = 0;
    let comilla: string | null = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (comilla) { if (c === comilla && src[i - 1] !== '\\') comilla = null; continue; }
      if (c === '"' || c === "'") { comilla = c; continue; }
      if (c === '{') prof++;
      else if (c === '}') prof--;
      else if (c === '>' && prof === 0) break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. El filtro del «/»
// ─────────────────────────────────────────────────────────────────────────────

const idsDe = (q: string) => gruposDeBarra(q).flatMap((g) => g.bloques.map((b) => b.id));

test('el «/» encuentra por nombre y por sinónimo, sin acentos ni mayúsculas', () => {
  assert.ok(idsDe('titulo').includes('titulo'), '«titulo» sin tilde tiene que encontrar «Título»');
  assert.ok(idsDe('TÍTULO').includes('titulo'), 'con tilde y en mayúsculas, también');
  assert.ok(idsDe('vinetas').includes('vinetas'), '«vinetas» tiene que encontrar «Lista con viñetas»');
  assert.ok(idsDe('testimonio').includes('cita'), 'un sinónimo del catálogo («testimonio») encuentra la cita');
  assert.ok(idsDe('precaución').includes('recuadro-precaucion'), 'con tilde contra un sinónimo escrito sin tilde');
  assert.ok(idsDe('calendly').includes('insertar'), '«calendly» encuentra Insertar');
  assert.ok(idsDe('como funciona').includes('opt-etapas'), 'un sinónimo con un espacio adentro');
  assert.deepEqual(idsDe('zzqqx'), [], 'algo que no existe no muestra nada');
});

test('con la consulta vacía el «/» muestra todo el catálogo, una vez cada bloque, en el orden de Gamma', () => {
  const grupos = gruposDeBarra('');
  const ids = grupos.flatMap((g) => g.bloques.map((b) => b.id));
  assert.equal(ids.length, BLOQUES.length);
  assert.equal(new Set(ids).size, BLOQUES.length);
  const orden = grupos.map((g) => g.categoria);
  assert.deepEqual(orden, CATEGORIAS_BLOQUE.filter((c) => BLOQUES.some((b) => b.categoria === c)));
  for (const g of grupos) for (const b of g.bloques) assert.equal(b.categoria, g.categoria);
});

test('lo escrito después de la «/» deja de ser un comando cuando es una frase', () => {
  assert.equal(consultaValida(''), true);
  assert.equal(consultaValida('tabla'), true);
  assert.equal(consultaValida('como funciona'), true);
  assert.equal(consultaValida(' tabla'), false, 'empieza con un espacio');
  assert.equal(consultaValida('tabla  x'), false, 'dos espacios seguidos');
  assert.equal(consultaValida('a/b'), false, 'otra barra');
  assert.equal(consultaValida('hola que tal'), false, 'con un espacio y sin nada que mostrar');
  assert.equal(consultaValida('x'.repeat(41)), false, 'pasa el tope');
});

test('los atajos markdown del «/» sólo nombran bloques del catálogo', () => {
  const ids = new Set(BLOQUES.map((b) => b.id as string));
  for (const k of Object.keys(ATAJO_MARKDOWN)) assert.ok(ids.has(k), k + ' no es un bloque del catálogo');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. El motor del «/»
// ─────────────────────────────────────────────────────────────────────────────

const p = (texto = ''): JsonNodo => (texto ? { type: 'paragraph', content: [{ type: 'text', text: texto }] } : { type: 'paragraph' });

/** Un EditorState con los plugins reales de StarterKit + la barra, y el cursor en `cursor`. */
function estado(doc: JsonNodo[], cursor: number): { s: EditorState; plugin: Plugin; cerrar: () => void } {
  const e = new Editor({ extensions: [StarterKit, ExtensionBarra], content: { type: 'doc', content: doc }, injectCSS: false });
  let s = EditorState.create({ schema: e.schema, doc: e.state.doc, plugins: e.extensionManager.plugins });
  s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, cursor)));
  const plugin = s.plugins.find((x) => (x.spec as { key?: unknown }).key === claveBarra);
  assert.ok(plugin, 'la extensión registra el plugin de la barra');
  return { s, plugin, cerrar: () => e.destroy() };
}

/** Teclear `texto` en el cursor como lo hace el navegador: primero `handleTextInput`, si nadie lo tomó, la inserción de siempre. */
function teclear(s: EditorState, plugin: Plugin, texto: string): EditorState {
  const { from, to } = s.selection;
  let nuevo = s;
  const vista = { state: s, dispatch: (tr: Transaction) => { nuevo = nuevo.apply(tr); } } as unknown as EditorView;
  const deflt = () => s.tr.insertText(texto, from, to);
  const fn = plugin.props.handleTextInput;
  const usado = fn ? fn.call(plugin, vista, from, to, texto, deflt) : false;
  return usado ? nuevo : s.apply(deflt());
}

test('el «/» se abre con una barra tecleada en un bloque vacío y sigue lo que se escribe', () => {
  const { s: s0, plugin, cerrar } = estado([p('Hola'), p()], 7);
  let s = teclear(s0, plugin, '/');
  assert.deepEqual(estadoBarra(s), { desde: 7, hasta: 8, consulta: '' });
  for (const c of 'tab') s = teclear(s, plugin, c);
  assert.deepEqual(estadoBarra(s), { desde: 7, hasta: 11, consulta: 'tab' });
  cerrar();
});

test('después de un espacio se abre; pegada a una palabra (una URL, «y/o») no', () => {
  const a = estado([p('Hola ')], 6);
  assert.notEqual(estadoBarra(teclear(a.s, a.plugin, '/')), null, 'después de un espacio');
  a.cerrar();
  const b = estado([p('Hola')], 5);
  assert.equal(estadoBarra(teclear(b.s, b.plugin, '/')), null, 'pegada a una palabra');
  b.cerrar();
});

test('el «/» se cierra si el cursor se va a otro bloque, si la barra desaparece o con Escape', () => {
  const { s: s0, plugin, cerrar } = estado([p('Hola'), p()], 7);
  let s = teclear(s0, plugin, '/');
  s = teclear(s, plugin, 'h');
  assert.notEqual(estadoBarra(s), null);
  const otroBloque = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 3)));
  assert.equal(estadoBarra(otroBloque), null, 'el cursor pasó a otro bloque');
  const sinBarra = s.apply(s.tr.delete(7, 8));
  assert.equal(estadoBarra(sinBarra), null, 'la barra se borró');
  let despues = s;
  const vista = { state: s, dispatch: (tr: Transaction) => { despues = despues.apply(tr); } } as unknown as EditorView;
  const usado = plugin.props.handleKeyDown?.call(plugin, vista, { key: 'Escape' } as KeyboardEvent);
  assert.equal(usado, true, 'Escape lo toma el menú');
  assert.equal(estadoBarra(despues), null, 'y lo cierra');
  const sigue = teclear(despues, plugin, 'x');
  assert.equal(estadoBarra(sigue), null, 'seguir escribiendo no lo reabre');
  cerrar();
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. «Cambiar diseño»
// ─────────────────────────────────────────────────────────────────────────────

test('«Cambiar diseño» arma la grilla con TODAS las variantes de OPTIMIZADOS, sin filtro (fuente)', () => {
  const src = sinComentarios(leer(OPT));
  const ini = src.indexOf('export function gruposDeDiseno');
  const fin = src.indexOf('const ANCHO_MINI', ini);
  assert.ok(ini > 0 && fin > ini, 'gruposDeDiseno existe');
  const cuerpo = src.slice(ini, fin);
  assert.ok(cuerpo.length < 800, 'el recorte es la función y no el archivo');
  assert.match(cuerpo, /for \(const o of OPTIMIZADOS\)/, 'recorre OPTIMIZADOS');
  assert.doesNotMatch(cuerpo, /\.(filter|slice|splice)\(|\bcontinue\b|\bbreak\b|\bif \(!?o\./, 'sin nada que deje variantes afuera');
  assert.match(src, /const grupos = useMemo\(\(\) => gruposDeDiseno\(\), \[\]\)/, 'la grilla usa gruposDeDiseno');
  assert.match(src, /grupos\.map\(\(g\) =>/, 'dibuja cada grupo');
  assert.match(src, /g\.variantes\.map\(\(v\) =>/, 'y cada variante del grupo');
  assert.match(src, /updateAttributes\(\{ variante: v\.id \}\)/, 'elegir cambia SOLO el atributo');
});

test('«Cambiar diseño»: cada variante aparece una vez, en su grupo y con su nombre de Gamma', () => {
  const grupos = gruposDeDiseno();
  const ids = grupos.flatMap((g) => g.variantes.map((v) => v.id as string));
  assert.equal(ids.length, OPTIMIZADOS.length);
  assert.deepEqual([...ids].sort(), OPTIMIZADOS.map((o) => o.id as string).sort());
  for (const g of grupos) {
    for (const v of g.variantes) {
      const o = OPTIMIZADOS.find((x) => x.id === v.id);
      assert.ok(o);
      assert.equal(o.grupo, g.grupo);
      assert.equal(o.nombre, v.nombre);
    }
  }
});

test('cada miniatura es el render real de su variante', () => {
  const tema = TEMAS[0];
  for (const o of OPTIMIZADOS) {
    const html = htmlDeMiniatura(o.id, tema);
    assert.match(html, /class="gm-doc"/, o.id + ': la raíz con el tema');
    assert.match(html, new RegExp('data-variante="' + o.id + '"'), o.id + ': el diseño pedido');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. La barra
// ─────────────────────────────────────────────────────────────────────────────

test('la barra de formato no tiene botones sin handler, y ninguno le roba el foco al texto', () => {
  const src = sinComentarios(leer(BARRA));
  const botones = etiquetas(src, 'button');
  assert.ok(botones.length >= 8, 'se encontraron los botones de la barra (' + botones.length + ')');
  for (const b of botones) {
    assert.match(b, /\sonClick=\{/, 'botón sin onClick: ' + b.slice(0, 120));
    assert.match(b, /\sonMouseDown=\{/, 'botón que se lleva el foco del texto: ' + b.slice(0, 120));
  }
  const deBarra = etiquetas(src, 'BotonBarra');
  assert.ok(deBarra.length >= 10, 'se encontraron los botones de la barra (' + deBarra.length + ')');
  for (const b of deBarra) assert.match(b, /\sonClick=\{/, 'BotonBarra sin onClick: ' + b.slice(0, 120));
  for (const f of etiquetas(src, 'FilaMenu')) assert.match(f, /\sonClick=\{/, 'renglón sin onClick: ' + f.slice(0, 120));
  for (const i of etiquetas(src, 'Interruptor')) assert.match(i, /\sonCambio=\{/, 'interruptor sin onCambio: ' + i.slice(0, 120));
});

test('en todo el paquete no hay un botón ni un renglón de menú sin onClick', () => {
  for (const f of FUENTES_G2) {
    const src = sinComentarios(leer(f));
    for (const b of etiquetas(src, 'button')) assert.match(b, /\sonClick=\{/, f + ': botón sin onClick: ' + b.slice(0, 120));
    for (const r of etiquetas(src, 'FilaMenu')) assert.match(r, /\sonClick=\{/, f + ': renglón sin onClick: ' + r.slice(0, 120));
  }
});

test('«Editar con IA» tiene una fila por cada acción de texto del contrato', () => {
  assert.deepEqual(new Set(ACCIONES_IA.map((a) => a.tipo)), new Set(ACCIONES_TEXTO));
  assert.equal(ACCIONES_IA.length, ACCIONES_TEXTO.length);
});
