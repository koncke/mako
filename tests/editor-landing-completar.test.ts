// =============================================================================
// editor-landing-completar — los textos A COMPLETAR («[Tu especialidad]») resaltados
// =============================================================================
// Pedido de Martín (14/10/2026): «También quiero que los [] que el usuario debe completar, se queden
// como de otro color o algo diferencial, y que eso se vea también en la miniatura, así se entiende
// mejor.» Ejecuta la regla (lib/editor-landing/especificacion.ts, `rangosACompletar`), el render
// (render.ts) y la decoración del editor (app/web-generator/editor/extensiones/completar.ts) sobre
// el esquema REAL del editor (getSchema y un Editor de TipTap sin montar, como editor-landing-insertar):
//
//   · la regla marca TODOS los corchetes de los catálogos (plantillas, diseños de sección,
//     presentaciones, diseños × objetivos) y no marca «[…]», «[ ]», un corchete con un salto adentro
//     ni uno suelto;
//   · la miniatura de TRABAJO (`marcadores`) los envuelve en `span.gm-completar`; la publicada, la
//     exportación, el editor y la vista del visitante en el teléfono (miniatura sin marcadores) NO,
//     en ninguna plantilla; también lo que sale de un atributo (las etiquetas, opciones y botón del
//     formulario; el título, las categorías y la leyenda de un gráfico, con un `tspan`), nunca la
//     etiqueta oculta que lee el Pixel;
//   · un corchete que una negrita parte en tres textos se marca igual y con etiquetas bien anidadas;
//   · la decoración marca los rangos correctos, no cambia el documento ni el JSON, y al editar
//     (escribir adentro, borrar el «]», negrita, Enter adentro, unir, pegar) queda IGUAL al cálculo
//     entero del documento final;
//   · la hoja los dibuja sólo en el editor y en la miniatura de trabajo.
//
// ── ROTURAS (14/10/2026, arnés que restaura DE MEMORIA y verifica el hash; base: 8 pasan, 0 fallan) ──
//   · render.ts: la miniatura de trabajo no marca                          -> 5 / 3 (miniatura, plantillas, partido)
//   · render.ts: marca en todos los modos (también la publicada)           -> 6 / 2 (miniatura, plantillas)
//   · render.ts: busca en cada texto y no en el corrido                    -> 7 / 1 (partido por la negrita)
//   · especificacion.ts: tope de 80 (el del primer plan)                   -> 6 / 2 (la regla, los catálogos)
//   · especificacion.ts: sin pedir letra o número («[ ]», «[…]»)           -> 7 / 1 (la regla)
//   · especificacion.ts: el `valor` del ítem no marca                      -> 7 / 1 (miniatura)
//   · completar.ts: un salto de línea no corta el corchete                 -> 7 / 1 (la decoración)
//   · completar.ts: al editar no se rearman los bloques tocados            -> 7 / 1 (al editar)
//   · completar.ts: al editar no se quitan las decoraciones viejas         -> 7 / 1 (al editar)
//   · esquema.ts: la extensión no está en la lista del documento           -> 7 / 1 (la decoración)
//   · css.ts: la regla vale en toda .gm-doc (también la publicada)          -> 7 / 1 (la hoja)
//   · css.ts: vuelve una sombra (pisaba el renglón de al lado)              -> 7 / 1 (la hoja)
// ── Lo que sale de un ATRIBUTO en la miniatura de trabajo (tanda 6, 14/10/2026; mismo arnés; base: 10 / 0) ──
//   · especificacion.ts: el formulario no marca                            -> 9 / 1 (atributos)
//   · especificacion.ts: el formulario marca en todos los modos            -> 7 / 3 (plantillas, atributos, editor)
//   · especificacion.ts: marca la etiqueta oculta que lee el Pixel         -> 9 / 1 (atributos)
//   · especificacion.ts: el botón del formulario sin marcar                -> 9 / 1 (atributos)
//   · especificacion.ts: el gráfico no marca                               -> 9 / 1 (atributos)
//   · especificacion.ts: el gráfico marca también en la publicada          -> 9 / 1 (atributos)
//   · especificacion.ts: la tinta del tspan sin `fill-opacity:1`           -> 9 / 1 (atributos)
//   · especificacion.ts: marca también el <title> del gráfico              -> 9 / 1 (atributos)
//   · grafico-svg.ts: `tspan` fuera de la lista de etiquetas               -> 9 / 1 (atributos)
// Y aparte (scratchpad, no es un test del repo): un fuzz de ~21.700 ediciones al azar comparó la
// decoración incremental con el cálculo entero: 0 diferencias; sin el `remove`, falla en la primera.
// =============================================================================

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Editor, getSchema } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import type { Node as NodoPM, Schema } from '@tiptap/pm/model';
import type { DecorationSet } from '@tiptap/pm/view';
import { extensionesBase } from '../app/web-generator/editor/extensiones/esquema';
import {
  CLAVE_A_COMPLETAR, actualizarACompletar, decoracionesACompletar, formularioConACompletar, pluginACompletar,
} from '../app/web-generator/editor/extensiones/completar';
import { RE_A_COMPLETAR, rangosACompletar, specFormulario, tramosACompletar } from '../lib/editor-landing/especificacion';
import { htmlDeArbol } from '../lib/editor-landing/grafico-svg';
import { htmlDeContenido, htmlDeTarjeta } from '../lib/editor-landing/render';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { temaPorId } from '../lib/editor-landing/temas';
import { NODO, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import { PLANTILLAS, DISENOS_SECCION } from '../lib/editor-landing/plantillas';
import { PLANTILLAS_PRESENTACION } from '../lib/editor-landing/plantillas-presentaciones';
import { DISENOS_LANDING, OBJETIVOS_LANDING, landingDesde } from '../lib/editor-landing/disenos-landing';

const tema = temaPorId('pewter');
const schema: Schema = getSchema(extensionesBase());

const txt = (text: string, marks?: JsonNodo['marks']): JsonNodo => (marks ? { type: 'text', text, marks } : { type: 'text', text });
const p = (...c: JsonNodo[]): JsonNodo => ({ type: 'paragraph', content: c });
const h1 = (...c: JsonNodo[]): JsonNodo => ({ type: 'heading', attrs: { level: 1 }, content: c });
const seccion = (...content: JsonNodo[]): JsonNodo => ({ type: NODO.tarjeta, attrs: { id: 'tA' }, content });
const NEGRITA = [{ type: 'bold' }];
const SPAN = '<span class="gm-completar">';

/** Los textos de lo que sea (un documento, un catálogo): todos los strings, recorridos. */
function textosDe(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) for (const v of x) textosDe(v, out);
  else if (x && typeof x === 'object') for (const v of Object.values(x)) textosDe(v, out);
  return out;
}

/** Todo lo que arman los catálogos, con sus documentos. */
function catalogos(): { nombre: string; contenido: LandingContenido | JsonNodo }[] {
  const out: { nombre: string; contenido: LandingContenido | JsonNodo }[] = [];
  for (const pl of PLANTILLAS) out.push({ nombre: 'plantilla ' + pl.id, contenido: pl.contenido() });
  for (const d of DISENOS_SECCION) out.push({ nombre: 'sección ' + d.id, contenido: d.crear() });
  for (const pr of PLANTILLAS_PRESENTACION) out.push({ nombre: 'presentación ' + pr.id, contenido: pr.contenido() });
  for (const d of DISENOS_LANDING) {
    for (const o of OBJETIVOS_LANDING) {
      const c = landingDesde(d, o.id);
      if (c) out.push({ nombre: 'diseño ' + d.id + ' × ' + o.id, contenido: c });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// La regla
// ─────────────────────────────────────────────────────────────────────────────

test('la regla: marca los corchetes con letra o número, sin saltos ni corchetes adentro; «[…]», «[ ]» y uno suelto no', () => {
  const marcados = (t: string) => rangosACompletar(t).map(([d, h]) => t.slice(d, h));
  assert.deepEqual(marcados('[Tu especialidad] para [tu cliente ideal]'), ['[Tu especialidad]', '[tu cliente ideal]']);
  assert.deepEqual(marcados('Consigue [resultado concreto] sin [lo que más le cuesta hoy]'), ['[resultado concreto]', '[lo que más le cuesta hoy]']);
  assert.deepEqual(marcados('[00]% · [$000] · [N] × [$00]'), ['[00]', '[$000]', '[N]', '[$00]']);
  assert.deepEqual(marcados('Texto [con un salto\nadentro] y […] y [ ] y [] y un [ suelto'), []);
  assert.deepEqual(marcados('[[doble]]'), ['[doble]'], 'el de adentro, sin comerse los de afuera');
  assert.deepEqual(marcados('[' + 'x'.repeat(120) + ']').length, 1, '120 adentro, sí');
  assert.deepEqual(marcados('[' + 'x'.repeat(121) + ']'), [], 'más de 120, no: un corchete abierto no se come el párrafo');
  // La regla es global y se usa con matchAll: dos llamadas seguidas dan lo mismo (no comparte lastIndex).
  assert.deepEqual(rangosACompletar('a [b] c'), rangosACompletar('a [b] c'));
  assert.equal(RE_A_COMPLETAR.lastIndex, 0);
  // tramos: un texto que empieza en `base` del texto corrido, partido por rangos que lo cruzan.
  assert.deepEqual(tramosACompletar('cliente', [[0, 4], [4, 11], [17, 23]], 4), [{ texto: 'cliente', completar: true }]);
  assert.deepEqual(tramosACompletar('ab [c] d', rangosACompletar('ab [c] d')), [
    { texto: 'ab ', completar: false }, { texto: '[c]', completar: true }, { texto: ' d', completar: false },
  ]);
  assert.deepEqual(tramosACompletar('', []), [{ texto: '', completar: false }]);
});

// El tope: con el {1,80} del primer plan quedaban 2 sin marcar (la garantía, 88; la historia del «Sobre
// mí», 86). Si alguien escribe un corchete más largo en un catálogo, este test lo dice.
test('la regla marca TODOS los corchetes de los catálogos (plantillas, secciones, presentaciones, diseños × objetivos)', () => {
  const sinMarcar: string[] = [];
  let total = 0;
  for (const { nombre, contenido } of catalogos()) {
    for (const t of textosDe(contenido)) {
      for (const m of t.matchAll(/\[[^\[\]\n]*[\p{L}\p{N}][^\[\]\n]*\]/gu)) {
        total++;
        const marcado = rangosACompletar(t).some(([d, h]) => d === m.index && h === m.index + m[0].length);
        if (!marcado) sinMarcar.push(nombre + ': ' + m[0]);
      }
    }
  }
  assert.ok(total > 1000, 'no se leyeron los catálogos (' + total + ')');
  assert.deepEqual(sinMarcar, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// La miniatura y lo que NO se marca
// ─────────────────────────────────────────────────────────────────────────────

test('miniatura de trabajo: span.gm-completar; publicada, exportación, editor y el teléfono: el texto tal cual', () => {
  const t = seccion(h1(txt('[Tu especialidad] para [tu cliente ideal]')), p(txt('Consigue [resultado <concreto> & más] hoy.')));
  const mini = htmlDeTarjeta(t, tema, { modo: 'miniatura', incluirOcultas: true, marcadores: true });
  assert.match(mini, /<h1[^>]*><span class="gm-completar">\[Tu especialidad\]<\/span> para <span class="gm-completar">\[tu cliente ideal\]<\/span><\/h1>/);
  assert.ok(mini.includes('<p>Consigue ' + SPAN + '[resultado &lt;concreto&gt; &amp; más]</span> hoy.</p>'), 'escapado adentro del span');
  for (const op of [{ modo: 'publico' as const }, { modo: 'exportar' as const }, { modo: 'editor' as const }, { modo: 'miniatura' as const }, { modo: 'publico' as const, marcadores: true }]) {
    const h = htmlDeTarjeta(t, tema, op);
    assert.doesNotMatch(h, /gm-completar/, JSON.stringify(op) + ' marca');
    assert.match(h, />\[Tu especialidad\] para \[tu cliente ideal\]<\/h1>/, JSON.stringify(op) + ': el texto no sale tal cual');
  }
  // El `valor` de un ítem («[00]%») es un atributo: también, y sólo en la miniatura de trabajo.
  const item = (valor: string): JsonNodo => ({ type: NODO.optimizadoItem, attrs: { valor }, content: [p(txt('[Qué mide la cifra]'))] });
  const cifras = seccion({ type: NODO.optimizado, attrs: { variante: 'numeros-grandes' }, content: [item('[00]%'), item('97%')] });
  const miniCifras = htmlDeTarjeta(cifras, tema, { modo: 'miniatura', marcadores: true });
  assert.ok(miniCifras.includes('<span class="gm-item-valor">' + SPAN + '[00]</span>%</span>'), 'el valor del ítem');
  assert.ok(miniCifras.includes('<span class="gm-item-valor">97%</span>'), 'un valor sin corchetes queda igual');
  assert.ok(htmlDeTarjeta(cifras, tema, { modo: 'publico' }).includes('<span class="gm-item-valor">[00]%</span>'));
});

test('en NINGUNA plantilla la publicada o la exportación traen la marca; la miniatura de su primera sección sí', () => {
  const mal: string[] = [];
  let conMarca = 0;
  for (const { nombre, contenido } of catalogos()) {
    if (!('paginas' in contenido)) continue;
    for (const modo of ['publico', 'exportar', 'editor'] as const) {
      for (const pg of htmlDeContenido(contenido, CONFIG_DEFAULT, tema, { modo })) if (pg.html.includes('gm-completar')) mal.push(nombre + ' (' + modo + ')');
    }
    const primera = contenido.paginas[0]?.doc.content[0];
    if (!primera) continue;
    const telefono = htmlDeTarjeta(primera, tema, { modo: 'miniatura', incluirOcultas: true });
    if (telefono.includes('gm-completar')) mal.push(nombre + ': el teléfono (miniatura sin marcadores)');
    // Lo que se VE de la sección (sin los atributos, como un alt o las notas del orador): las marcas
    // en línea no cortan el texto, los bloques sí.
    const visible = telefono.replace(/<\/?(strong|em|u|s|span|a|mark)\b[^>]*>/g, '').replace(/<[^>]*>/g, '\n');
    const tieneCorchete = rangosACompletar(visible).length > 0;
    const marca = htmlDeTarjeta(primera, tema, { modo: 'miniatura', incluirOcultas: true, marcadores: true }).includes('gm-completar');
    if (tieneCorchete !== marca) mal.push(nombre + ': la miniatura ' + (marca ? 'marca sin corchetes' : 'no marca sus corchetes'));
    if (marca) conMarca++;
  }
  assert.deepEqual(mal, []);
  assert.ok(conMarca >= 10, 'casi ninguna miniatura con corchetes (' + conMarca + '): el test no prueba nada');
});

/** Las etiquetas bien anidadas (una pila): lo que rompería un span que cruza una negrita. */
function anidadoBien(html: string): boolean {
  const pila: string[] = [];
  for (const m of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>/g)) {
    if (['br', 'img', 'input', 'source', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon'].includes(m[2])) continue;
    if (!m[1]) pila.push(m[2]);
    else if (pila.pop() !== m[2]) return false;
  }
  return pila.length === 0;
}

test('un corchete partido por una negrita (y un enlace) se marca igual, con etiquetas bien anidadas; uno partido por un salto, no', () => {
  const t = seccion(
    p(txt('Para [tu '), txt('cliente', NEGRITA), txt(' ideal] hoy')),
    p(txt('Con [un '), txt('enlace', [{ type: 'link', attrs: { href: 'https://a.com' } }]), txt(' adentro]')),
    p(txt('[partido'), { type: 'hardBreak' }, txt('por un salto]')),
    p(txt('Un [ suelto y '), txt('negrita', NEGRITA), txt(' sin cerrar')),
  );
  const mini = htmlDeTarjeta(t, tema, { modo: 'miniatura', marcadores: true });
  assert.ok(anidadoBien(mini), 'etiquetas mal anidadas');
  assert.ok(mini.includes('<p>Para ' + SPAN + '[tu </span><strong>' + SPAN + 'cliente</span></strong>' + SPAN + ' ideal]</span> hoy</p>'), mini);
  // En la miniatura el enlace es un span decorativo (sinInteractivos), con su marca adentro.
  assert.ok(mini.includes('<p>Con ' + SPAN + '[un </span><span data-gm-a="">' + SPAN + 'enlace</span></span>' + SPAN + ' adentro]</span></p>'), mini);
  assert.ok(mini.includes('<p>[partido<br>por un salto]</p>'), 'un salto corta el corchete');
  assert.ok(mini.includes('<p>Un [ suelto y <strong>negrita</strong> sin cerrar</p>'), 'un corchete sin cerrar no marca nada');
});

// ─────────────────────────────────────────────────────────────────────────────
// El editor: la decoración
// ─────────────────────────────────────────────────────────────────────────────

const docDe = (...tarjetas: JsonNodo[]): NodoPM => schema.nodeFromJSON({ type: 'doc', content: tarjetas });
/** Los rangos decorados, con el texto que cubre cada uno. */
const marcas = (set: DecorationSet | undefined, doc: NodoPM) =>
  (set?.find() ?? []).sort((a, b) => a.from - b.from).map((d) => ({ desde: d.from, hasta: d.to, texto: doc.textBetween(d.from, d.to), clase: (d as unknown as { type: { attrs: { class?: string } } }).type.attrs.class }));
/** La posición absoluta de `aguja` (la primera vez que aparece en un texto). */
function posDe(doc: NodoPM, aguja: string): number {
  let pos = -1;
  doc.descendants((n, p0) => {
    if (pos >= 0) return false;
    if (n.isText && n.text!.includes(aguja)) pos = p0 + n.text!.indexOf(aguja);
    return true;
  });
  assert.ok(pos >= 0, 'no está: ' + aguja);
  return pos;
}

test('la decoración marca los rangos correctos sobre el esquema real (también partidos por una negrita), sin tocar el documento', () => {
  const doc = docDe(seccion(
    h1(txt('[Tu especialidad] para [tu cliente ideal]')),
    p(txt('Para [tu '), txt('cliente', NEGRITA), txt(' ideal] hoy')),
    p(txt('[partido'), { type: 'hardBreak' }, txt('por un salto]')),
    { type: NODO.botones, content: [{ type: NODO.boton, attrs: { href: '#' }, content: [txt('[Agenda tu llamada]')] }] },
  ));
  doc.check();
  const m = marcas(decoracionesACompletar(doc), doc);
  assert.deepEqual(m.map((x) => x.texto), ['[Tu especialidad]', '[tu cliente ideal]', '[tu cliente ideal]', '[Agenda tu llamada]']);
  assert.ok(m.every((x) => x.clase === 'gm-completar'));
  assert.equal(m[0].desde, posDe(doc, '[Tu especialidad]'));
  assert.equal(m[2].desde, posDe(doc, 'Para [tu ') + 'Para '.length, 'el partido por la negrita empieza en su «[»');
  assert.equal(m[2].hasta, posDe(doc, ' ideal] hoy') + ' ideal]'.length, 'y termina en su «]», dos textos después');

  // Un Editor de TipTap con TODAS las extensiones del documento (sin montar): el plugin está enchufado
  // y el JSON no cambia.
  const json = { type: 'doc', content: [seccion(p(txt('Para [tu '), txt('cliente', NEGRITA), txt(' ideal] hoy')))] };
  const e = new Editor({ extensions: extensionesBase(), content: json, injectCSS: false });
  try {
    // Sin vista montada, el estado con los plugins se arma a mano (como editor-landing-menus).
    const s = EditorState.create({ schema: e.schema, doc: e.state.doc, plugins: e.extensionManager.plugins });
    const set = CLAVE_A_COMPLETAR.getState(s);
    assert.ok(set, 'el plugin no está en el editor');
    assert.deepEqual(marcas(set, s.doc).map((x) => x.texto), ['[tu cliente ideal]']);
    // Nada que agregue o filtre transacciones: el documento (y el JSON que se guarda) es el de siempre.
    const plugin = s.plugins.find((x) => (x.spec as { key?: unknown }).key === CLAVE_A_COMPLETAR)!;
    assert.equal(plugin.spec.appendTransaction, undefined);
    assert.equal(plugin.spec.filterTransaction, undefined);
    assert.ok(s.doc.eq(e.schema.nodeFromJSON(json)), 'el documento cambió');
    assert.deepEqual(e.getJSON(), e.schema.nodeFromJSON(json).toJSON(), 'el JSON guardado cambió');
    // getHTML() serializa el documento (sin plugins ni decoraciones); en node no hay DOM para llamarlo.
  } finally {
    e.destroy();
  }
});

test('al editar, la decoración queda IGUAL al cálculo entero del documento final (escribir, borrar el «]», negrita, Enter, unir, pegar)', () => {
  let s = EditorState.create({
    schema,
    plugins: [pluginACompletar()],
    doc: docDe(seccion(h1(txt('[Tu especialidad] para [tu cliente ideal]')), p(txt('Consigue [resultado concreto] sin esfuerzo')))),
  });
  const igual = (que: string) => {
    const incremental = marcas(CLAVE_A_COMPLETAR.getState(s), s.doc);
    const entero = marcas(decoracionesACompletar(s.doc), s.doc);
    assert.deepEqual(incremental, entero, que);
    return incremental.map((x) => x.texto);
  };
  igual('al abrir');
  // Escribir adentro de un corchete.
  s = s.apply(s.tr.insertText('muy ', posDe(s.doc, 'concreto]')));
  assert.ok(igual('escribir adentro').includes('[resultado muy concreto]'));
  // Borrar el «]»: deja de ser algo a completar.
  const cierre = posDe(s.doc, '] sin esfuerzo');
  s = s.apply(s.tr.delete(cierre, cierre + 1));
  assert.ok(!igual('borrar el cierre').some((t) => t.includes('resultado')));
  // Volver a escribirlo.
  s = s.apply(s.tr.insertText(']', cierre));
  assert.ok(igual('volver a cerrarlo').includes('[resultado muy concreto]'));
  // Negrita en el medio (no corre posiciones ni cambia el texto).
  const muy = posDe(s.doc, 'muy ');
  s = s.apply(s.tr.addMark(muy, muy + 3, schema.marks.bold.create()));
  assert.ok(igual('negrita en el medio').includes('[resultado muy concreto]'));
  // Enter adentro del corchete: se parte en dos párrafos y ninguno lo cierra.
  const corte = posDe(s.doc, 'concreto]');
  s = s.apply(s.tr.split(corte));
  assert.ok(!igual('Enter adentro').some((t) => t.includes('resultado')));
  // Unir los dos párrafos de nuevo (el borrado que deja un rango vacío en el borde).
  s = s.apply(s.tr.join(corte + 1));
  assert.ok(igual('unir').includes('[resultado muy concreto]'));
  // Pegar una sección entera con corchetes al final del documento, y escribir en otra sección.
  s = s.apply(s.tr.insert(s.doc.content.size, schema.nodeFromJSON({ ...seccion(p(txt('[Tu nombre] y [Tu historia]'))), attrs: { id: 'tB' } })));
  s = s.apply(s.tr.insertText('X', posDe(s.doc, 'para')));
  assert.deepEqual(igual('pegar una sección'), ['[Tu especialidad]', '[tu cliente ideal]', '[resultado muy concreto]', '[Tu nombre]', '[Tu historia]']);
  // Una transacción sin cambio de documento devuelve el MISMO set (no recalcula nada).
  const antes = CLAVE_A_COMPLETAR.getState(s)!;
  assert.equal(actualizarACompletar(antes, s.tr.setSelection(TextSelection.create(s.doc, 3))), antes);
});

// ─────────────────────────────────────────────────────────────────────────────
// El formulario (tanda 6): lo que el NodeView dibuja desde sus atributos
// ─────────────────────────────────────────────────────────────────────────────

// Rotura (14/10/2026, de memoria, verificada por hash; base 9 / 0): `formularioConACompletar` marca
// también lo `hidden` → 8 / 1; no baja a los hijos (sólo el primer nivel) → 8 / 1. Los dos, sólo éste.
// Pendiente de los huecos resaltados (tanda 6, 14/10/2026): lo que se dibuja desde un ATRIBUTO no pasaba
// por la marca de la miniatura de trabajo (las etiquetas y el botón del formulario, el título y las
// categorías de un gráfico). El alt de una imagen no se ve: no se marca.
test('la miniatura de trabajo marca también lo que sale de un ATRIBUTO (formulario y gráfico); la publicada no, ni la etiqueta oculta del Pixel', () => {
  const formulario: JsonNodo = {
    type: NODO.formulario,
    attrs: {
      campos: [
        { id: 'a1', tipo: 'texto', etiqueta: '¿Cuál es tu [objetivo]?', requerido: false, opciones: [] },
        { id: 'a2', tipo: 'opciones', etiqueta: '¿[Pregunta]?', requerido: true, opciones: ['[Opción 1]', 'Otra'] },
      ],
      boton: 'Quiero [mi lugar]',
      exito: 'Gracias [nombre]',
    },
  };
  const grafico: JsonNodo = {
    type: NODO.grafico,
    attrs: { tipo: 'columnas', titulo: 'Ventas de [tu producto]', categorias: ['[Mes 1]', 'Febrero'], series: [{ nombre: 'Ventas', valores: [10, 20] }] },
  };
  const t = seccion(formulario, grafico);
  const mini = htmlDeTarjeta(t, tema, { modo: 'miniatura', marcadores: true });
  // El formulario: las etiquetas, la pregunta, la opción y el botón (que en la miniatura es un span).
  assert.deepEqual([...mini.matchAll(/<span class="gm-completar">([^<]*)<\/span>/g)].map((m) => m[1]), ['[objetivo]', '[Pregunta]', '[Opción 1]', '[mi lugar]']);
  assert.match(mini, /<label for="[^"]+" hidden="">¿\[Pregunta\]\?<\/label>/, 'la etiqueta oculta que lee el Pixel, tal cual');
  assert.match(mini, /<p class="gm-formulario-exito" hidden="" aria-live="polite">Gracias \[nombre\]<\/p>/, 'el éxito, tal cual');
  // El gráfico: un tspan con la tinta del acento en el título y la categoría; el <title> y el aria-label no se ven.
  const tspans = [...mini.matchAll(/<tspan class="gm-completar" style="([^"]*)">([^<]*)<\/tspan>/g)];
  assert.deepEqual(tspans.map((m) => m[2]), ['[tu producto]', '[Mes 1]']);
  for (const m of tspans) assert.equal(m[1], 'fill:var(--gm-acento-texto, #2f6fed);fill-opacity:1');
  assert.match(mini, />Ventas de <tspan /, 'el resto del título sigue en su <text>');
  assert.match(mini, /<title>Ventas de \[tu producto\]<\/title>/);
  assert.match(mini, /aria-label="Ventas de \[tu producto\]"/);
  assert.ok(anidadoBien(mini), 'etiquetas mal anidadas');
  // La publicada, la exportación, el editor y el teléfono (miniatura sin marcadores): nada marcado.
  for (const op of [{ modo: 'publico' as const }, { modo: 'exportar' as const }, { modo: 'editor' as const }, { modo: 'miniatura' as const }]) {
    const h = htmlDeTarjeta(t, tema, op);
    assert.doesNotMatch(h, /gm-completar|<tspan/, JSON.stringify(op) + ' marca');
    assert.match(h, /¿Cuál es tu \[objetivo\]\?<\/label>/, JSON.stringify(op) + ': la etiqueta no sale tal cual');
  }
});

test('el formulario del editor marca los «[ ]» de etiquetas, preguntas, opciones y botón; lo oculto y la publicada, no', () => {
  const attrs = {
    campos: [
      { id: 'a1', tipo: 'texto', etiqueta: '¿Cuál es tu [objetivo]?', requerido: false, opciones: [] },
      { id: 'a2', tipo: 'opciones', etiqueta: '¿[Pregunta]?', requerido: true, opciones: ['[Opción 1]', 'Otra'] },
    ],
    boton: 'Quiero [mi lugar]',
    exito: 'Gracias [nombre]',
  };
  const arbol = specFormulario(attrs, { modo: 'editor' });
  const editor = htmlDeArbol(formularioConACompletar(arbol));
  const marcas = [...editor.matchAll(/<span class="gm-completar">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(marcas, ['[objetivo]', '[Pregunta]', '[Opción 1]', '[mi lugar]']);
  // La etiqueta oculta que lee el Pixel (`labels[0].textContent`) y el mensaje de éxito quedan tal cual.
  assert.match(editor, /<label for="[^"]+" hidden="">¿\[Pregunta\]\?<\/label>/);
  assert.match(editor, /<p class="gm-formulario-exito" hidden="" aria-live="polite">Gracias \[nombre\]<\/p>/);
  // Lo que no es la vista del editor sale sin marcar: el árbol de specFormulario no cambió.
  assert.doesNotMatch(htmlDeArbol(arbol), /gm-completar/);
  assert.doesNotMatch(htmlDeArbol(specFormulario(attrs, { modo: 'publico' })), /gm-completar/);
  // Sólo la vista del NodeView lo pide; el `renderHTML` del nodo no.
  const vista = readFileSync(join(__dirname, '..', 'app/web-generator/editor/nodos/FormularioVista.tsx'), 'utf8');
  assert.match(vista, /htmlDeArbol\(formularioConACompletar\(specFormulario\(node\.attrs, \{ modo: 'editor' \}\)\)\)/);
});

// ─────────────────────────────────────────────────────────────────────────────
// La hoja
// ─────────────────────────────────────────────────────────────────────────────

// La franja (y no el fondo entero ni una sombra) sale de la captura del 14/10/2026: con el fondo entero
// los renglones de un título (interlineado 1) se pisaban y el pedazo pisado salía con el doble de tinte.
test('la hoja dibuja la marca sólo en el editor y en la miniatura de trabajo: una franja del acento, sin sombras', () => {
  const reglas = CSS_CONTENIDO.split('\n').filter((l) => l.includes('.gm-completar'));
  assert.ok(reglas.length >= 2, 'la hoja no dibuja la marca');
  for (const r of reglas) {
    assert.match(r, /^\.gm-doc\[data-(modo="editor"|marcadores="si")\] /, 'una regla que no es del editor ni de la miniatura de trabajo: ' + r);
  }
  const todo = CSS_CONTENIDO.slice(CSS_CONTENIDO.indexOf('.gm-doc[data-modo="editor"] .gm-completar'));
  const base = /\.gm-doc\[data-modo="editor"\] \.gm-completar,\n\.gm-doc\[data-marcadores="si"\] \.gm-completar \{([^}]*)\}/.exec(todo)?.[1] ?? '';
  assert.match(base, /--gm-completar-tinte: color-mix\(in srgb, var\(--gm-acento-texto, #2f6fed\) 22%, transparent\)/, 'el tinte del acento');
  assert.match(base, /0 60% \/ 100% 80% no-repeat/, 'una franja, no el fondo entero');
  assert.match(base, /color: var\(--gm-acento-texto, inherit\)/);
  assert.doesNotMatch(base, /box-shadow/, 'una sombra pisa el renglón de al lado');
  assert.match(todo, /\.gm-boton \.gm-completar \{[^}]*--gm-completar-tinte: color-mix\(in srgb, currentColor/, 'adentro de un botón, del color de su texto');
});
