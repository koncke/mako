// =============================================================================
// editor/insertar — insertar bloques y mover, duplicar, borrar, combinar y partir secciones
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1).
//
// Lo usan el menú «/» (MenuBarra), «Agregar bloque», la tira de secciones, las opciones de
// cada sección (TarjetaVista) y la IA. Dos capas, a propósito:
//
//   · PURA (sin vista): `bloqueJson(id)` arma el JSON de cada bloque del catálogo, y las
//     funciones `tr…(state, …)` arman la transacción sobre un `EditorState`. Las prueba
//     tests/editor-landing-insertar.test.ts en node, con el esquema real.
//   · CON EDITOR: `insertarBloque`, `moverTarjeta`, `duplicarTarjeta`, `borrarTarjeta`… toman
//     el `Editor` de TipTap, despachan la transacción y ubican el cursor.
//
// ⚠️ Cada `IdBloque` de lib/editor-landing/catalogo-bloques.ts tiene su `case` en `bloqueJson`
//    (el `never` del final lo exige el compilador, y el test lo vuelve a mirar en el fuente).
//    Un id nuevo en el catálogo sin su `case` acá es un ítem del menú que no inserta nada.
// ⚠️ Deshacer un borrado devuelve el MISMO nodo (la misma sección, con su id: los comentarios y
//    las anclas `#t-<id>` le apuntan), en su lugar corrido por lo que se escribió después, y NO
//    lo duplica si un Ctrl+Z ya lo devolvió (AGENTS.md: «Deshacer una acción destructiva
//    devuelve la MISMA identidad»).
// =============================================================================

import type { Editor } from '@tiptap/core';
import type { Node as NodoPM, NodeType } from '@tiptap/pm/model';
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { undoDepth } from '@tiptap/pm/history';
import type { IdBloque } from '@/lib/editor-landing/catalogo-bloques';
import { bloquePorId } from '@/lib/editor-landing/catalogo-bloques';
import {
  NODO, nuevoId, parrafo, titulo, tarjetaVacia, tituloDeTarjeta,
  type CampoFormulario, type JsonNodo, type TipoGrafico, type TonoRecuadro, type VarianteOptimizado,
} from '@/lib/editor-landing/doc';
import type { OpcionesImagen } from './contexto';

// ─────────────────────────────────────────────────────────────────────────────
// El JSON de cada bloque (puro)
// ─────────────────────────────────────────────────────────────────────────────

const txt = (t: string): JsonNodo[] => (t ? [{ type: 'text', text: t }] : []);
const p = (t = '', variante?: string): JsonNodo => parrafo(t, variante ? { variante } : undefined);
const h3 = (t: string): JsonNodo => titulo(t, 3);
const item = (contenido: JsonNodo[], attrs: Record<string, unknown> = {}): JsonNodo => ({
  type: NODO.optimizadoItem, attrs: { icono: null, imagenSrc: null, valor: '', destacado: false, ...attrs }, content: contenido,
});
const lista = (tipo: 'bulletList' | 'orderedList', textos: string[]): JsonNodo => ({
  type: tipo, content: textos.map((t) => ({ type: 'listItem', content: [p(t)] })),
});

/** El contenido inicial de cada diseño optimizado: textos que dicen qué va en cada lugar. */
function itemsDe(variante: VarianteOptimizado): JsonNodo[] {
  switch (variante) {
    case 'numeros-grandes':
      return [
        item([p('De los clientes repiten')], { valor: '97%' }),
        item([p('Más rápido que el método anterior')], { valor: '3x' }),
        item([p('Personas ya lo usan')], { valor: '+1.200' }),
      ];
    case 'lado-a-lado':
      return [
        item([h3('Antes'), lista('bulletList', ['Lo que pasa hoy', 'El problema que se repite'])]),
        item([h3('Después'), lista('bulletList', ['Lo que cambia', 'El resultado que consigues'])], { destacado: true }),
      ];
    case 'citas-caras':
      return [1, 2, 3].map(() => item([p('“Qué cambió después de trabajar contigo, en sus palabras.”'), p('Nombre, cargo', 'pequeno')]));
    case 'equipo':
      return [1, 2, 3].map(() => item([h3('Nombre'), p('Cargo', 'pequeno')]));
    case 'logos':
      return [1, 2, 3, 4, 5].map((n) => item([p(`Empresa ${n}`, 'pequeno')]));
    case 'galeria':
      return [1, 2, 3, 4].map(() => item([p('Descripción de la imagen', 'pequeno')]));
    case 'iconos-texto':
      return [['rayo', 'Rápido'], ['escudo', 'Seguro'], ['corazon', 'Simple']].map(([icono, t]) =>
        item([h3(t), p('Explica este beneficio en una frase.')], { icono }));
    case 'piramide':
    case 'embudo':
      return ['Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4'].map((t) => item([h3(t), p('Qué pasa en este nivel.')]));
    case 'tiempo-horizontal':
      return ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4'].map((t) => item([h3(t), p('Qué pasa en esta etapa.')]));
    case 'etapas-horizontales':
    case 'flechas-horizontales':
    case 'ciclo':
      return ['Paso 1', 'Paso 2', 'Paso 3'].map((t) => item([h3(t), p('Qué pasa en este paso.')]));
    default:
      return ['Punto clave 1', 'Punto clave 2', 'Punto clave 3'].map((t) => item([h3(t), p('Explica por qué importa en una o dos frases.')]));
  }
}

function columnas(n: number): JsonNodo {
  const ancho = Math.round(12 / n);
  return {
    type: NODO.columnas,
    attrs: { anchos: Array.from({ length: n }, () => ancho), divisores: false },
    content: Array.from({ length: n }, (_, i) => ({ type: NODO.columna, content: [h3(`Punto ${i + 1}`), p('Describe este punto en una o dos frases.')] })),
  };
}

function tabla(n: number): JsonNodo {
  const celda = (tipo: 'tableHeader' | 'tableCell', t: string): JsonNodo => ({ type: tipo, attrs: { colspan: 1, rowspan: 1 }, content: [p(t)] });
  return {
    type: 'table',
    content: Array.from({ length: n }, (_, f) => ({
      type: 'tableRow',
      content: Array.from({ length: n }, (_, c) => (f === 0 ? celda('tableHeader', `Columna ${c + 1}`) : celda('tableCell', ''))),
    })),
  };
}

function grafico(tipo: TipoGrafico): JsonNodo {
  const torta = tipo === 'circular' || tipo === 'dona';
  return {
    type: NODO.grafico,
    attrs: torta
      ? { tipo, titulo: '', categorias: ['Directo', 'Redes', 'Referidos'], series: [{ nombre: 'Clientes', valores: [45, 30, 25] }], mostrarValores: true, leyenda: true, sufijo: '%', prefijo: '' }
      : { tipo, titulo: '', categorias: ['Ene', 'Feb', 'Mar', 'Abr'], series: [{ nombre: 'Ventas', valores: [12, 19, 15, 24] }], mostrarValores: true, leyenda: false, sufijo: '', prefijo: '' },
  };
}

function formulario(): JsonNodo {
  const campo = (tipo: CampoFormulario['tipo'], etiqueta: string, requerido: boolean): CampoFormulario => ({ id: nuevoId('c'), tipo, etiqueta, requerido, opciones: [] });
  return {
    type: NODO.formulario,
    attrs: {
      campos: [campo('nombre', 'Nombre', true), campo('email', 'Correo electrónico', true), campo('telefono', 'Teléfono', false)],
      boton: 'Enviar', exito: '¡Listo! Recibimos tus datos.', redirigir: null,
    },
  };
}

const boton = (texto: string, variante: 'primario' | 'secundario'): JsonNodo => ({
  type: NODO.boton, attrs: { href: '#', variante, nuevaPestana: false }, content: txt(texto),
});

/**
 * El JSON del bloque que inserta cada ítem del catálogo. `extra.url` es la imagen o el video ya
 * elegidos (los bloques de imagen y video devuelven `null` sin ella: no se inserta una figura
 * vacía que el server tiraría al guardar).
 */
export function bloqueJson(id: IdBloque, extra: { url?: string | null } = {}): JsonNodo | null {
  const def = bloquePorId(id);
  const variante = def?.variante;
  switch (id) {
    // ── Bloques básicos ──
    case 'titulo': return titulo('', 1, 'titulo');
    case 'h1': return titulo('', 1);
    case 'h2': return titulo('', 2);
    case 'h3': return titulo('', 3);
    case 'h4': return titulo('', 4);
    case 'antetitulo': return p('', 'antetitulo');
    case 'parrafo': return p();
    case 'texto-grande': return p('', 'grande');
    case 'texto-pequeno': return p('', 'pequeno');
    case 'vinetas': return { type: 'bulletList', content: [{ type: 'listItem', content: [p()] }] };
    case 'numerada': return { type: 'orderedList', content: [{ type: 'listItem', content: [p()] }] };
    case 'tareas': return { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [p()] }] };
    case 'cita': return { type: 'blockquote', content: [p()] };
    case 'separador': return { type: 'horizontalRule' };
    case 'espaciador': return { type: NODO.espaciador, attrs: { alto: 'm' } };
    case 'desplegable':
      return { type: NODO.desplegable, content: [{ type: NODO.desplegableTitulo }, { type: NODO.desplegableCuerpo, content: [p()] }] };
    case 'columnas-2':
    case 'columnas-3':
    case 'columnas-4':
      return columnas(typeof variante === 'number' ? variante : 2);
    case 'recuadro-info':
    case 'recuadro-nota':
    case 'recuadro-advertencia':
    case 'recuadro-precaucion':
    case 'recuadro-exito':
    case 'recuadro-pregunta':
      return { type: NODO.recuadro, attrs: { tono: (variante as TonoRecuadro) ?? 'info' }, content: [p()] };

    // ── Diseños optimizados ──
    case 'opt-vinetas':
    case 'opt-cajas':
    case 'opt-iconos':
    case 'opt-tiempo':
    case 'opt-etapas':
    case 'opt-flechas':
    case 'opt-estadisticas':
    case 'opt-comparacion':
    case 'opt-piramide':
    case 'opt-embudo':
    case 'opt-ciclo':
    case 'opt-citas':
    case 'opt-equipo':
    case 'opt-logos':
    case 'opt-galeria': {
      const v = (variante as VarianteOptimizado) ?? 'vinetas-grandes';
      return { type: NODO.optimizado, attrs: { variante: v, columnas: 'auto', mostrarIconos: true }, content: itemsDe(v) };
    }

    // ── Herramientas de MaKo ──
    // La agenda y el VSL entran vacíos con su proveedor de entrada: el NodeView pide el enlace y
    // el proveedor real lo decide lo que se pegue (un link de Cal.com en «Agenda» queda Cal.com).
    case 'agenda': return { type: NODO.insertado, attrs: { src: '', proveedor: 'calendly', alto: null } };
    case 'vsl': return { type: NODO.insertado, attrs: { src: '', proveedor: 'youtube', alto: null } };
    // El link de pago se pega en el botón (BotonesVista abre en otra pestaña lo que empieza con http).
    case 'pago': return { type: NODO.botones, attrs: { alinea: 'izquierda' }, content: [boton('Pagar ahora', 'primario')] };

    // ── Formularios y botones ──
    case 'boton': return { type: NODO.botones, attrs: { alinea: 'izquierda' }, content: [boton('Comenzar ahora', 'primario')] };
    case 'botones-2':
      return { type: NODO.botones, attrs: { alinea: 'izquierda' }, content: [boton('Comenzar ahora', 'primario'), boton('Saber más', 'secundario')] };
    case 'formulario': return formulario();
    case 'etiqueta': return { type: 'paragraph', content: [{ type: 'text', text: 'Etiqueta', marks: [{ type: 'etiqueta', attrs: { color: null } }] }] };

    // ── Imágenes y videos (piden la URL antes) ──
    case 'imagen':
    case 'imagen-buscar':
    case 'imagen-url':
      return extra.url ? { type: NODO.imagen, attrs: { src: extra.url, alt: '', ancho: 100, alinea: 'centro', href: null, forma: 'normal' } } : null;
    case 'video-subir':
      return extra.url ? { type: NODO.video, attrs: { src: extra.url, ancho: 100, autoplay: false, bucle: false, poster: null } } : null;

    // ── Incrustaciones: entran vacías y su NodeView pide el enlace o el código ──
    case 'video-enlace':
    case 'insertar':
      return { type: NODO.insertado, attrs: { src: '', proveedor: '', alto: null } };
    // Con id desde que nace (T6): la publicada sirve cada bloque desde /l/html/<docId>/<id>.
    case 'html-libre': return { type: NODO.htmlLibre, attrs: { id: nuevoId('h'), html: '', alto: 300 } };

    // ── Gráficos ──
    case 'grafico-barras':
    case 'grafico-columnas':
    case 'grafico-lineas':
    case 'grafico-circular':
    case 'grafico-dona':
      return grafico((variante as TipoGrafico) ?? 'columnas');

    // ── Tablas ──
    case 'tabla-2':
    case 'tabla-3':
    case 'tabla-4':
      return tabla(typeof variante === 'number' ? variante : 3);

    default: {
      const sinCase: never = id;
      void sinCase;
      return null;
    }
  }
}

/** Los bloques que piden una imagen o un video ANTES de insertarse. */
export const PIDEN_ARCHIVO: Readonly<Partial<Record<IdBloque, 'imagen' | 'video'>>> = {
  imagen: 'imagen', 'imagen-buscar': 'imagen', 'imagen-url': 'imagen', 'video-subir': 'video',
};

// ─────────────────────────────────────────────────────────────────────────────
// Secciones del documento (puro)
// ─────────────────────────────────────────────────────────────────────────────

export type SeccionEnDoc = { id: string; pos: number; indice: number; nodo: NodoPM };

/** Las secciones del documento, en orden, con su posición. */
export function seccionesDe(doc: NodoPM): SeccionEnDoc[] {
  const out: SeccionEnDoc[] = [];
  doc.forEach((nodo, pos, indice) => {
    if (nodo.type.name === NODO.tarjeta) out.push({ id: String(nodo.attrs.id ?? ''), pos, indice, nodo });
  });
  return out;
}

export function seccionPorId(doc: NodoPM, id: string | null | undefined): SeccionEnDoc | null {
  if (!id) return null;
  return seccionesDe(doc).find((s) => s.id === id) ?? null;
}

/** La posición donde empieza la sección de índice `i` (o el final del documento). */
function posDeIndice(doc: NodoPM, i: number): number {
  let pos = 0;
  for (let k = 0; k < Math.min(i, doc.childCount); k++) pos += doc.child(k).nodeSize;
  return pos;
}

/** La sección donde está una posición (o la que sigue, si la posición está entre dos). */
export function seccionEnPos(doc: NodoPM, pos: number): SeccionEnDoc | null {
  const p0 = Math.max(0, Math.min(pos, doc.content.size));
  const $p = doc.resolve(p0);
  const idx = $p.depth === 0 ? Math.min($p.index(0), doc.childCount - 1) : $p.index(0);
  if (idx < 0) return null;
  const nodo = doc.child(idx);
  return nodo.type.name === NODO.tarjeta ? { id: String(nodo.attrs.id ?? ''), pos: posDeIndice(doc, idx), indice: idx, nodo } : null;
}

/** Cursor al principio del primer texto de lo que empieza en `pos`. */
function cursorAdentro(tr: Transaction, pos: number): void {
  const $p = tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size));
  tr.setSelection(Selection.near($p, 1));
}

/**
 * Mueve la sección `desde` para que quede en el índice `hasta` (el índice FINAL, de 0 a n-1).
 * Desde un arrastre que suelta «antes de la sección g», el final es `g > desde ? g - 1 : g`.
 */
export function trMoverTarjeta(state: EditorState, desde: number, hasta: number): Transaction | null {
  const doc = state.doc;
  const n = doc.childCount;
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 0 || hasta < 0 || desde >= n || hasta >= n || desde === hasta) return null;
  const nodo = doc.child(desde);
  const posDesde = posDeIndice(doc, desde);
  const tr = state.tr.delete(posDesde, posDesde + nodo.nodeSize);
  const posHasta = posDeIndice(tr.doc, hasta);
  tr.insert(posHasta, nodo);
  cursorAdentro(tr, posHasta);
  return tr.scrollIntoView();
}

/** Una copia de la sección con un id nuevo, justo debajo. Devuelve el id nuevo. */
export function trDuplicarTarjeta(state: EditorState, id: string): { tr: Transaction; id: string } | null {
  const s = seccionPorId(state.doc, id);
  if (!s) return null;
  const nuevo = nuevoId('t');
  const copia = s.nodo.type.create({ ...s.nodo.attrs, id: nuevo }, s.nodo.content, s.nodo.marks);
  const pos = s.pos + s.nodo.nodeSize;
  const tr = state.tr.insert(pos, copia);
  cursorAdentro(tr, pos);
  return { tr: tr.scrollIntoView(), id: nuevo };
}

/**
 * Saca la sección. Si es la ÚNICA, queda una en blanco en su lugar (el documento no puede
 * quedar sin secciones: `doc: tarjeta+`). Devuelve lo que sacó, para el deshacer.
 */
export function trBorrarTarjeta(state: EditorState, id: string): { tr: Transaction; pos: number; nodo: NodoPM; reemplazo: string | null } | null {
  const s = seccionPorId(state.doc, id);
  if (!s) return null;
  const tr = state.tr;
  let reemplazo: string | null = null;
  if (state.doc.childCount <= 1) {
    const vacia = state.schema.nodeFromJSON(tarjetaVacia());
    reemplazo = String(vacia.attrs.id);
    tr.replaceWith(s.pos, s.pos + s.nodo.nodeSize, vacia);
  } else {
    tr.delete(s.pos, s.pos + s.nodo.nodeSize);
  }
  cursorAdentro(tr, Math.min(s.pos, Math.max(0, tr.doc.content.size - 1)));
  return { tr, pos: s.pos, nodo: s.nodo, reemplazo };
}

/** Funde la sección con la de arriba: el contenido pasa a la de arriba, que conserva su estilo. */
export function trCombinarConAnterior(state: EditorState, id: string): Transaction | null {
  const s = seccionPorId(state.doc, id);
  if (!s || s.indice === 0) return null;
  const prev = state.doc.child(s.indice - 1);
  if (prev.type.name !== NODO.tarjeta) return null;
  const posPrev = s.pos - prev.nodeSize;
  const unida = prev.type.create(prev.attrs, prev.content.append(s.nodo.content), prev.marks);
  const tr = state.tr.replaceWith(posPrev, s.pos + s.nodo.nodeSize, unida);
  // El cursor, donde empieza lo que era la sección de abajo.
  tr.setSelection(Selection.near(tr.doc.resolve(posPrev + 1 + prev.content.size), 1));
  return tr.scrollIntoView();
}

/**
 * Parte una sección en dos a la altura de su bloque `indice`: lo de antes queda en la sección
 * (con su id y su estilo), y del bloque `indice` en adelante pasa a una sección NUEVA con el
 * mismo fondo y el mismo ancho (lo que se ve igual sigue viéndose igual) y sin imagen ni notas.
 * `quitarBloque` saca el bloque `indice` (la línea «---» que pidió partir). Ninguna mitad queda
 * vacía: la que no tiene bloques lleva un párrafo.
 */
export function partirEn(tr: Transaction, posTarjeta: number, indice: number, op: { quitarBloque?: boolean } = {}): string | null {
  const t = tr.doc.nodeAt(posTarjeta);
  if (!t || t.type.name !== NODO.tarjeta) return null;
  const hijos: NodoPM[] = [];
  t.forEach((c) => hijos.push(c));
  if (indice < 0 || indice > hijos.length) return null;
  const par = () => tr.doc.type.schema.nodes.paragraph.create();
  const antes = hijos.slice(0, indice);
  const despues = hijos.slice(indice + (op.quitarBloque ? 1 : 0));
  const id = nuevoId('t');
  const a = t.type.create(t.attrs, antes.length ? antes : [par()], t.marks);
  const b = t.type.create({
    id, fondo: t.attrs.fondo, fondoColor: t.attrs.fondoColor, fondoDegradado: t.attrs.fondoDegradado,
    ancho: t.attrs.ancho, alineacion: t.attrs.alineacion,
  }, despues.length ? despues : [par()]);
  tr.replaceWith(posTarjeta, posTarjeta + t.nodeSize, [a, b]);
  cursorAdentro(tr, posTarjeta + a.nodeSize);
  return id;
}

/** Parte la sección donde está `pos`, a la altura del bloque que la contiene. */
export function trPartirTarjeta(state: EditorState, pos: number): { tr: Transaction; id: string } | null {
  const $p = state.doc.resolve(Math.max(0, Math.min(pos, state.doc.content.size)));
  if ($p.depth < 2 || $p.node(1).type.name !== NODO.tarjeta) return null;
  const indice = $p.index(1);
  if (indice === 0) return null; // nada arriba: no hay qué partir
  const tr = state.tr;
  const id = partirEn(tr, $p.before(1), indice);
  return id ? { tr: tr.scrollIntoView(), id } : null;
}

/** Inserta una sección (en blanco si no se pasa otra) en el índice `indice`. Devuelve su id. */
export function trInsertarTarjeta(state: EditorState, indice: number, json?: JsonNodo | null): { tr: Transaction; id: string } | null {
  let nodo: NodoPM;
  try {
    const j = json ?? tarjetaVacia();
    const attrs = { ...(j.attrs ?? {}) };
    if (typeof attrs.id !== 'string' || !attrs.id || seccionPorId(state.doc, attrs.id)) attrs.id = nuevoId('t');
    nodo = state.schema.nodeFromJSON({ ...j, attrs });
    nodo.check();
  } catch {
    return null;
  }
  if (nodo.type.name !== NODO.tarjeta) return null;
  const i = Math.max(0, Math.min(indice, state.doc.childCount));
  const pos = posDeIndice(state.doc, i);
  const tr = state.tr.insert(pos, nodo);
  cursorAdentro(tr, pos);
  return { tr: tr.scrollIntoView(), id: String(nodo.attrs.id) };
}

/**
 * Dónde puede ir un bloque de tipo `tipo` cerca de la selección:
 *   · si el cursor está en un bloque de texto VACÍO y su contenedor acepta el bloque, lo
 *     reemplaza (como en Gamma: «/tabla» en una línea vacía pone la tabla ahí);
 *   · si no, después del bloque del cursor, en el contenedor más cercano que lo acepte (una
 *     columna no acepta columnas: van después de las columnas, en la sección).
 */
export function lugarParaBloque(doc: NodoPM, sel: Selection, tipo: NodeType): { from: number; to: number } | null {
  const $from = sel.$from;
  if (sel instanceof NodeSelection) {
    const $n = doc.resolve(sel.from);
    for (let d = $n.depth; d >= 1; d--) {
      // En su contenedor, después del nodo elegido; más arriba, después del bloque que lo contiene.
      const despues = d === $n.depth ? sel.to : $n.after(d + 1);
      if ($n.node(d).canReplaceWith($n.index(d) + 1, $n.index(d) + 1, tipo)) return { from: despues, to: despues };
    }
    return null;
  }
  if ($from.depth === 0) {
    // Entre dos secciones (cursor de hueco): al principio de la sección que sigue, o al final de la última.
    const idx = Math.min($from.index(0), doc.childCount - 1);
    const t = doc.child(idx);
    const ini = posDeIndice(doc, idx);
    if (t.canReplaceWith(0, 0, tipo)) return { from: ini + 1, to: ini + 1 };
    return null;
  }
  const D = $from.depth;
  if ($from.parent.isTextblock && $from.parent.content.size === 0 && D >= 2) {
    const cont = $from.node(D - 1);
    const i = $from.index(D - 1);
    if (cont.canReplaceWith(i, i + 1, tipo)) return { from: $from.before(D), to: $from.after(D) };
  }
  for (let d = D - 1; d >= 1; d--) {
    const i = $from.index(d);
    if ($from.node(d).canReplaceWith(i + 1, i + 1, tipo)) {
      const pos = $from.after(d + 1);
      return { from: pos, to: pos };
    }
  }
  return null;
}

/**
 * Inserta un bloque (JSON) cerca del cursor o de `op.pos`. `op.rango` se borra antes en la misma
 * transacción (el «/consulta» que escribió la persona para abrir el menú).
 */
export function trInsertarBloque(state: EditorState, json: JsonNodo, op: { pos?: number; rango?: { from: number; to: number } | null } = {}): Transaction | null {
  let nodo: NodoPM;
  try {
    nodo = state.schema.nodeFromJSON(json);
    nodo.check();
  } catch {
    return null;
  }
  const tr = state.tr;
  if (op.rango && op.rango.to > op.rango.from) tr.delete(op.rango.from, op.rango.to);
  if (typeof op.pos === 'number') {
    const p0 = tr.mapping.map(Math.max(0, Math.min(op.pos, state.doc.content.size)));
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(p0, tr.doc.content.size))));
  }
  const lugar = lugarParaBloque(tr.doc, tr.selection, nodo.type);
  if (!lugar) return null;
  tr.replaceWith(lugar.from, lugar.to, nodo);
  const pos = lugar.from;
  if (nodo.isAtom || nodo.isLeaf) tr.setSelection(NodeSelection.create(tr.doc, pos));
  else tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size)), 1));
  return tr.scrollIntoView();
}

// ─────────────────────────────────────────────────────────────────────────────
// Con el editor
// ─────────────────────────────────────────────────────────────────────────────

const vivo = (e: Editor | null | undefined): e is Editor => !!e && !e.isDestroyed;

function despachar(editor: Editor, tr: Transaction | null | undefined, enfocar = true): boolean {
  if (!tr || !vivo(editor)) return false;
  editor.view.dispatch(tr);
  if (enfocar) editor.view.focus();
  return true;
}

/** Los bloques de TEXTO convierten el bloque del cursor (Gamma: «/h2» en una línea la vuelve título). */
const CONVIERTEN: Partial<Record<IdBloque, (e: Editor) => boolean>> = {
  titulo: (e) => e.chain().focus().setNode('heading', { level: 1, variante: 'titulo' }).run(),
  h1: (e) => e.chain().focus().setNode('heading', { level: 1, variante: null }).run(),
  h2: (e) => e.chain().focus().setNode('heading', { level: 2, variante: null }).run(),
  h3: (e) => e.chain().focus().setNode('heading', { level: 3, variante: null }).run(),
  h4: (e) => e.chain().focus().setNode('heading', { level: 4, variante: null }).run(),
  antetitulo: (e) => e.chain().focus().setNode('paragraph', { variante: 'antetitulo' }).run(),
  parrafo: (e) => e.chain().focus().setNode('paragraph', { variante: null }).run(),
  'texto-grande': (e) => e.chain().focus().setNode('paragraph', { variante: 'grande' }).run(),
  'texto-pequeno': (e) => e.chain().focus().setNode('paragraph', { variante: 'pequeno' }).run(),
  vinetas: (e) => e.chain().focus().toggleBulletList().run(),
  numerada: (e) => e.chain().focus().toggleOrderedList().run(),
  tareas: (e) => e.chain().focus().toggleTaskList().run(),
  cita: (e) => e.chain().focus().toggleBlockquote().run(),
};

export type OpInsertar = {
  /** El selector de imágenes del contexto (`useEditorLanding().elegirImagen`). Sin él, los bloques de imagen y video no se insertan. */
  elegirImagen?: (op?: OpcionesImagen) => Promise<string | null>;
  /** Una imagen o un video YA elegidos (no abre el selector). */
  url?: string | null;
  /** Lo que se borra antes de insertar (el «/consulta» del menú). */
  rango?: { from: number; to: number } | null;
  /** Dónde insertar, en vez del cursor. */
  pos?: number;
};

/**
 * Inserta el bloque `id` del catálogo donde está el cursor (o en `op.pos`). Los de texto
 * convierten el bloque del cursor; «Etiqueta» marca lo elegido (o escribe «Etiqueta» marcada);
 * los de imagen y video abren el selector y esperan la URL. Devuelve si insertó algo.
 */
export async function insertarBloque(editor: Editor, id: IdBloque, op: OpInsertar = {}): Promise<boolean> {
  if (!vivo(editor)) return false;
  const borrarRango = () => {
    if (op.rango && op.rango.to > op.rango.from) editor.chain().deleteRange(op.rango).run();
  };

  // Texto: convertir el bloque del cursor, si es un bloque de texto.
  const convertir = CONVIERTEN[id];
  if (convertir && typeof op.pos !== 'number' && editor.state.selection.$from.parent.isTextblock && !(editor.state.selection instanceof NodeSelection)) {
    borrarRango();
    if (convertir(editor)) return true;
  }

  // Etiqueta: sobre lo elegido, o un «Etiqueta» nuevo y elegido.
  if (id === 'etiqueta' && typeof op.pos !== 'number' && editor.state.selection.$from.parent.isTextblock) {
    borrarRango();
    if (!editor.state.selection.empty) return editor.chain().focus().toggleEtiqueta().run();
    const desde = editor.state.selection.from;
    return editor.chain().focus()
      .insertContent({ type: 'text', text: 'Etiqueta', marks: [{ type: 'etiqueta', attrs: { color: null } }] })
      .setTextSelection({ from: desde, to: desde + 'Etiqueta'.length })
      .run();
  }

  // Imagen o video: la URL primero. La posición se SIGUE mientras el selector está abierto
  // (la persona puede seguir escribiendo): el bloque va donde estaba el cursor al pedirlo.
  const pide = PIDEN_ARCHIVO[id];
  let url = op.url ?? null;
  let pos = op.pos;
  let rango = op.rango ?? null;
  if (pide && !url) {
    if (!op.elegirImagen) return false;
    const seguido = seguirPosicion(editor, typeof pos === 'number' ? pos : editor.state.selection.from);
    const seguidoRango = rango ? { a: seguirPosicion(editor, rango.from), b: seguirPosicion(editor, rango.to) } : null;
    let elegida: string | null = null;
    try {
      const seccion = tarjetaEnCursor(editor);
      elegida = await op.elegirImagen({ modo: pide, sugerencia: seccion ? tituloDeTarjeta(seccion.nodo.toJSON() as JsonNodo) : undefined });
    } finally {
      pos = seguido.soltar();
      if (seguidoRango) rango = { from: seguidoRango.a.soltar(), to: seguidoRango.b.soltar() };
    }
    if (!elegida || !vivo(editor)) return false;
    url = elegida;
  }

  const json = bloqueJson(id, { url });
  if (!json) return false;
  return despachar(editor, trInsertarBloque(editor.state, json, { pos, rango }));
}

/**
 * Sigue una posición del documento mientras otros cambian el texto (una subida, un selector
 * abierto): cada transacción la corre con su `mapping`. `soltar()` deja de seguirla y la devuelve.
 */
export function seguirPosicion(editor: Editor, pos: number): { actual: () => number; soltar: () => number } {
  let p = pos;
  const correr = ({ transaction }: { transaction: Transaction }) => { p = transaction.mapping.map(p); };
  editor.on('transaction', correr);
  let suelto = false;
  return {
    actual: () => p,
    soltar: () => {
      if (!suelto) { suelto = true; editor.off('transaction', correr); }
      return p;
    },
  };
}

/** La sección donde está el cursor: su id, su posición y el nodo. */
export function tarjetaEnCursor(editor: Editor): { id: string; pos: number; nodo: NodoPM } | null {
  if (!vivo(editor)) return null;
  const sel = editor.state.selection;
  if (sel instanceof NodeSelection && sel.node.type.name === NODO.tarjeta) return { id: String(sel.node.attrs.id ?? ''), pos: sel.from, nodo: sel.node };
  const s = seccionEnPos(editor.state.doc, sel.from);
  return s ? { id: s.id, pos: s.pos, nodo: s.nodo } : null;
}

/** Mueve la sección de `desdeIdx` al índice final `hastaIdx`. */
export function moverTarjeta(editor: Editor, desdeIdx: number, hastaIdx: number): boolean {
  if (!vivo(editor)) return false;
  return despachar(editor, trMoverTarjeta(editor.state, desdeIdx, hastaIdx));
}

/** Duplica la sección (la del cursor si no se dice cuál). Devuelve el id de la copia. */
export function duplicarTarjeta(editor: Editor, id?: string | null): string | null {
  if (!vivo(editor)) return null;
  const cual = id ?? tarjetaEnCursor(editor)?.id;
  if (!cual) return null;
  const r = trDuplicarTarjeta(editor.state, cual);
  return r && despachar(editor, r.tr) ? r.id : null;
}

/**
 * Saca un nodo y devuelve el DESHACER que lo vuelve a poner: el MISMO nodo, en su lugar corrido
 * por lo que se escribió después. No lo pone dos veces: si un Ctrl+Z ya lo devolvió (la
 * profundidad del historial bajó de la que había justo después de sacarlo) o `yaVolvio` dice
 * que está, no hace nada. El seguimiento se suelta solo al minuto (el toast dura 5 s).
 */
export function sacarConDeshacer(
  editor: Editor,
  tr: Transaction,
  pos: number,
  nodo: NodoPM,
  op: { yaVolvio?: (doc: NodoPM) => boolean; reemplazo?: (doc: NodoPM) => SeccionEnDoc | null } = {},
): () => void {
  if (!despachar(editor, tr, false)) return () => {};
  const profundidad = undoDepth(editor.state);
  const seguido = seguirPosicion(editor, pos);
  const tope = setTimeout(() => seguido.soltar(), 60_000);
  let usado = false;
  return () => {
    if (usado) return;
    usado = true;
    clearTimeout(tope);
    const p = seguido.soltar();
    if (!vivo(editor)) return;
    const doc = editor.state.doc;
    if (undoDepth(editor.state) < profundidad) return;
    if (op.yaVolvio?.(doc)) return;
    const t = editor.state.tr;
    const vacia = op.reemplazo?.(doc) ?? null;
    if (vacia) {
      // La sección en blanco que quedó en lugar de la única: si sigue vacía, la vuelve a ocupar la original.
      t.replaceWith(vacia.pos, vacia.pos + vacia.nodo.nodeSize, nodo);
    } else {
      const $p = doc.resolve(Math.max(0, Math.min(p, doc.content.size)));
      const destino = nodo.type.name === NODO.tarjeta ? ($p.depth === 0 ? $p.pos : $p.after(1)) : $p.pos;
      t.insert(destino, nodo);
    }
    editor.view.dispatch(t.scrollIntoView());
  };
}

/**
 * Borra la sección y devuelve su deshacer (el MISMO nodo, con su id). Quien llama muestra el
 * toast de 5 s: `avisar('Sección eliminada', borrarTarjeta(editor, id))`.
 */
export function borrarTarjeta(editor: Editor, id: string): () => void {
  if (!vivo(editor)) return () => {};
  const r = trBorrarTarjeta(editor.state, id);
  if (!r) return () => {};
  return sacarConDeshacer(editor, r.tr, r.pos, r.nodo, {
    yaVolvio: (doc) => !!seccionPorId(doc, id),
    reemplazo: (doc) => {
      if (!r.reemplazo) return null;
      const v = seccionPorId(doc, r.reemplazo);
      return v && v.nodo.textContent === '' ? v : null;
    },
  });
}

/** Funde la sección con la de arriba («Combinar con lo anterior»). */
export function combinarConAnterior(editor: Editor, id: string): boolean {
  if (!vivo(editor)) return false;
  return despachar(editor, trCombinarConAnterior(editor.state, id));
}

/** Parte la sección donde está el cursor (o `pos`) a la altura de ese bloque. Devuelve el id de la sección nueva. */
export function partirTarjeta(editor: Editor, pos?: number): string | null {
  if (!vivo(editor)) return null;
  const r = trPartirTarjeta(editor.state, typeof pos === 'number' ? pos : editor.state.selection.from);
  return r && despachar(editor, r.tr) ? r.id : null;
}

/** Inserta una sección en blanco (o la que se pase) en el índice `indice`. Devuelve su id. */
export function insertarTarjetaEn(editor: Editor, indice: number, json?: JsonNodo | null): string | null {
  if (!vivo(editor)) return null;
  const r = trInsertarTarjeta(editor.state, indice, json);
  return r && despachar(editor, r.tr) ? r.id : null;
}

/**
 * Inserta un «diseño de sección» (DISENOS_SECCION de lib/editor-landing/plantillas.ts) después
 * de la sección `despuesDe` (o de la del cursor, o al final). Devuelve el id de la nueva.
 */
export function insertarDisenoSeccion(editor: Editor, nodo: JsonNodo, despuesDe?: string | null): string | null {
  if (!vivo(editor)) return null;
  const ref = seccionPorId(editor.state.doc, despuesDe ?? tarjetaEnCursor(editor)?.id ?? null);
  const indice = ref ? ref.indice + 1 : editor.state.doc.childCount;
  return insertarTarjetaEn(editor, indice, nodo);
}

/** Lleva el cursor (y la vista) a la sección. */
export function irATarjeta(editor: Editor, id: string): boolean {
  if (!vivo(editor)) return false;
  const s = seccionPorId(editor.state.doc, id);
  if (!s) return false;
  const tr = editor.state.tr;
  cursorAdentro(tr, s.pos);
  editor.view.dispatch(tr);
  editor.view.focus();
  try {
    const dom = editor.view.nodeDOM(s.pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch { /* sin DOM todavía: el cursor ya quedó ahí */ }
  return true;
}
