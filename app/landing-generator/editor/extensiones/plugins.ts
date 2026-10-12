// =============================================================================
// extensiones/plugins — ids únicos, «---» parte la sección, portapapeles fiel y subidas
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1).
//
// Cuatro extensiones sin interfaz:
//
//   · IdsUnicos: toda sección tiene un id válido y ÚNICO después de cada transacción (las
//     anclas `#t-<id>`, los comentarios y la IA le apuntan). Ante un duplicado (pegar una
//     sección copiada) se queda con su id la que YA EXISTÍA antes de la transacción, aunque
//     la pegada quede arriba: si no, pegar una copia encima del original le cambiaba el id
//     al original y se llevaba puestos sus comentarios. De paso: un título con
//     `variante: 'titulo'` es siempre h1 (lo mismo que hace el saneo), y los ids de los
//     campos de formulario no se repiten.
//   · PartirConGuiones: «---» al principio de una línea suelta de la sección la parte en dos
//     ahí, como en Gamma. Adentro de una columna, una lista o un recuadro no aplica: ahí
//     sigue valiendo la regla de StarterKit (la línea divisoria).
//   · PortapapelesFiel: al COPIAR, cada nodo propio viaja con sus atributos enteros en un
//     `data-gm-json` (ver comun.ts). Sólo en el portapapeles: ni el DOM del editor ni
//     `getHTML()` lo llevan.
//   · Subidas: pegar o soltar una imagen o un video lo sube al bucket (`subirArchivo` del
//     contexto) y lo inserta donde cayó, aunque se siga escribiendo mientras sube (la
//     posición se corre con cada transacción, como en el editor rico). Pegar SÓLO un enlace
//     de YouTube/Vimeo/Calendly en una línea vacía, o su código, inserta el bloque.
// =============================================================================

import { Extension, InputRule, type Editor } from '@tiptap/core';
import { DOMSerializer, type DOMOutputSpec, type Node as NodoPM, type Schema } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Mapping } from '@tiptap/pm/transform';
import { NODO, nuevoId } from '@/lib/editor-landing/doc';
import { idValido } from '@/lib/editor-landing/especificacion';
import { TIPOS_IMAGEN, TIPOS_VIDEO, TOPE_IMAGEN_BYTES, TOPE_VIDEO_BYTES } from '@/lib/editor-landing/api-tipos';
import { embedDe } from '@/lib/embeds';
import { esCodigoParaInsertar } from '@/app/_ui/editor-rico-reglas';
import { partirEn, trInsertarBloque } from '../insertar';
import { ATTR_JSON } from './comun';

// ─────────────────────────────────────────────────────────────────────────────
// Opciones del documento (lo que pasa quien arma el editor)
// ─────────────────────────────────────────────────────────────────────────────

export type OpcionesLanding = {
  /** Sube un archivo al bucket público y devuelve su URL (con progreso real por XHR). */
  subirArchivo: (f: File, onProgreso?: (pct: number) => void) => Promise<string>;
  /** Abre el selector de imágenes y resuelve con la URL elegida o null. */
  elegirImagen: (op?: { modo?: 'imagen' | 'video'; sugerencia?: string }) => Promise<string | null>;
  /** Toast corto (3-4 palabras). Opcional: sin él, un archivo que no se puede subir se ignora en silencio. */
  avisar?: (texto: string) => void;
};

/**
 * Guarda las opciones del documento para quien no tenga el contexto a mano (un NodeView montado
 * fuera del proveedor, un plugin): `opcionesLanding(editor)`.
 */
export const OpcionesDelDocumento = Extension.create<Partial<OpcionesLanding>>({
  name: 'opcionesLanding',
  addOptions() { return {}; },
});

export function opcionesLanding(editor: Editor | null | undefined): Partial<OpcionesLanding> {
  const ext = editor?.extensionManager.extensions.find((e) => e.name === 'opcionesLanding');
  return (ext?.options as Partial<OpcionesLanding> | undefined) ?? {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Atajos de Gamma que StarterKit no trae
// ─────────────────────────────────────────────────────────────────────────────

const abridoresDeEnlace = new WeakMap<Editor, () => boolean>();

/**
 * Quien dibuja el panel del enlace (la barra de formato, paquete G2) se registra acá para que
 * ⌘K / Ctrl+K lo abra. Sin nadie registrado el atajo no se traga la tecla: un atajo que no hace
 * nada es peor que el del navegador. `fn` devuelve si lo abrió.
 */
export function registrarAbrirEnlace(editor: Editor, fn: (() => boolean) | null): void {
  if (fn) abridoresDeEnlace.set(editor, fn);
  else abridoresDeEnlace.delete(editor);
}

/**
 * Los atajos de la lista oficial de Gamma (gamma-ui §7) que StarterKit no trae o trae con otra
 * tecla: ⌘K enlace, ⌘⇧X tachado (StarterKit usa ⌘⇧S), ⌘/ numerada, ⌘. viñetas y ⌘, tareas (los
 * de ⌘⇧7/8/9 siguen andando: son de StarterKit).
 */
export const AtajosLanding = Extension.create({
  name: 'atajosLanding',
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => abridoresDeEnlace.get(this.editor)?.() ?? false,
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      'Mod-/': () => this.editor.commands.toggleOrderedList(),
      'Mod-.': () => this.editor.commands.toggleBulletList(),
      'Mod-,': () => this.editor.commands.toggleTaskList(),
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Ids únicos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La transacción que deja los ids bien (o null si ya lo están). Pura: la prueba el test.
 * `trs` y `viejo` dicen qué secciones YA existían (las que conservan su id ante un duplicado);
 * sin ellos (al crear el editor) gana la primera de arriba.
 */
export function trIdsUnicos(trs: readonly Transaction[], viejo: EditorState | null, nuevo: EditorState): Transaction | null {
  const doc = nuevo.doc;
  // Las secciones que sobrevivieron, en su posición nueva: ésas se quedan con su id.
  const guardian = new Map<string, number>();
  if (viejo) {
    const m = new Mapping();
    for (const t of trs) for (const s of t.mapping.maps) m.appendMap(s);
    viejo.doc.forEach((n, pos) => {
      const id = n.attrs.id;
      if (n.type.name !== NODO.tarjeta || typeof id !== 'string') return;
      const r = m.mapResult(pos, 1);
      if (r.deleted) return;
      const ahora = doc.nodeAt(r.pos);
      if (ahora?.type.name === NODO.tarjeta && ahora.attrs.id === id && !guardian.has(id)) guardian.set(id, r.pos);
    });
  }
  const usados = new Set<string>();
  doc.forEach((n) => { if (typeof n.attrs.id === 'string') usados.add(n.attrs.id); });
  const nuevoUnico = (prefijo: string) => {
    let id = nuevoId(prefijo);
    while (usados.has(id)) id = nuevoId(prefijo);
    usados.add(id);
    return id;
  };

  let tr: Transaction | null = null;
  const t = () => (tr ??= nuevo.tr);
  const vistos = new Set<string>();
  doc.forEach((n, pos) => {
    if (n.type.name !== NODO.tarjeta) return;
    const id = idValido(n.attrs.id);
    let cambiar = !id;
    if (id) {
      const dueno = guardian.get(id);
      if (dueno !== undefined && dueno !== pos) cambiar = true;
      else if (dueno === undefined && vistos.has(id)) cambiar = true;
    }
    if (cambiar) t().setNodeMarkup(pos, undefined, { ...n.attrs, id: nuevoUnico('t') });
    else if (id) vistos.add(id);
  });

  // Títulos «grandes» siempre h1, y campos de formulario sin ids repetidos.
  const campos = new Set<string>();
  doc.descendants((n, pos) => {
    if (n.isTextblock && n.type.name !== 'heading') return false;
    if (n.type.name === 'heading' && n.attrs.variante === 'titulo' && n.attrs.level !== 1) {
      t().setNodeMarkup(pos, undefined, { ...n.attrs, level: 1 });
    }
    if (n.type.name === NODO.formulario && Array.isArray(n.attrs.campos)) {
      let cambio = false;
      const lista = (n.attrs.campos as { id?: string }[]).map((c) => {
        const cid = idValido(c?.id);
        if (cid && !campos.has(cid)) { campos.add(cid); return c; }
        cambio = true;
        const otro = nuevoUnico('c');
        campos.add(otro);
        return { ...c, id: otro };
      });
      if (cambio) t().setNodeMarkup(pos, undefined, { ...n.attrs, campos: lista });
    }
    return !n.isAtom;
  });
  return tr;
}

export const IdsUnicos = Extension.create({
  name: 'idsUnicos',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('idsUnicos'),
      appendTransaction: (trs, viejo, nuevo) => (trs.some((x) => x.docChanged) ? trIdsUnicos(trs, viejo, nuevo) : null),
    })];
  },
  onCreate() {
    // El contenido inicial no pasa por `appendTransaction`: se arregla una vez al crear, fuera
    // del historial (no es un cambio de la persona, y Ctrl+Z no lo tiene que deshacer).
    const tr = trIdsUnicos([], null, this.editor.state);
    // `preventUpdate`: no es un cambio de la persona, y sin esto el autoguardado marcaba «sin
    // guardar» un documento que nadie tocó (EditorRico, trampa 15).
    if (tr) this.editor.view.dispatch(tr.setMeta('addToHistory', false).setMeta('preventUpdate', true));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// «---» parte la sección
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prioridad alta: tiene que correr ANTES que la regla de la línea divisoria de StarterKit, que
 * también se dispara con «---». Si no aplica (no es una línea suelta de la sección), devuelve
 * null y TipTap prueba la siguiente.
 */
export const PartirConGuiones = Extension.create({
  name: 'partirConGuiones',
  priority: 1000,
  addInputRules() {
    return [new InputRule({
      find: /^---$/,
      handler: ({ state, range }) => {
        const $f = state.doc.resolve(range.from);
        if ($f.depth !== 2 || $f.parentOffset !== 0) return null;
        if ($f.parent.type.name !== 'paragraph' || $f.node(1).type.name !== NODO.tarjeta) return null;
        // Según la versión de TipTap el último «-» ya está escrito o no: la línea tiene que ser
        // SÓLO los guiones.
        const texto = $f.parent.textContent;
        if (texto !== '--' && texto !== '---') return null;
        const id = partirEn(state.tr, $f.before(1), $f.index(1), { quitarBloque: true });
        return id ? undefined : null;
      },
    })];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Portapapeles fiel
// ─────────────────────────────────────────────────────────────────────────────

const PROPIOS = new Set<string>(Object.values(NODO));

/** La forma con el JSON de los atributos agregado a su elemento raíz. */
function conJson(spec: DOMOutputSpec, nodo: NodoPM): DOMOutputSpec {
  if (!Array.isArray(spec) || typeof spec[0] !== 'string') return spec;
  let json: string;
  try { json = JSON.stringify(nodo.attrs); } catch { return spec; }
  const resto = spec.slice(1);
  const a1 = resto[0];
  const esAttrs = a1 && typeof a1 === 'object' && !Array.isArray(a1) && !(typeof Node !== 'undefined' && a1 instanceof Node);
  if (esAttrs) return [spec[0], { ...(a1 as Record<string, unknown>), [ATTR_JSON]: json }, ...resto.slice(1)] as unknown as DOMOutputSpec;
  return [spec[0], { [ATTR_JSON]: json }, ...resto] as unknown as DOMOutputSpec;
}

/** El serializador del portapapeles: el del esquema, con el JSON en cada nodo propio. */
export function serializadorPortapapeles(schema: Schema): DOMSerializer {
  const base = DOMSerializer.fromSchema(schema);
  const nodos: Record<string, (n: NodoPM) => DOMOutputSpec> = { ...base.nodes };
  for (const [nombre, fn] of Object.entries(base.nodes)) {
    if (PROPIOS.has(nombre)) nodos[nombre] = (n: NodoPM) => conJson(fn(n), n);
  }
  return new DOMSerializer(nodos, base.marks);
}

export const PortapapelesFiel = Extension.create({
  name: 'portapapelesFiel',
  addProseMirrorPlugins() {
    const serializador = serializadorPortapapeles(this.editor.schema);
    return [new Plugin({ key: new PluginKey('portapapelesFiel'), props: { clipboardSerializer: serializador } })];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Subidas (pegar / soltar archivos) y pegar un enlace de video o agenda
// ─────────────────────────────────────────────────────────────────────────────

type Destino = { pos: number; texto: string };
type EstadoSubidas = { destinos: Map<string, Destino>; deco: DecorationSet };
const CLAVE_SUBIDAS = new PluginKey<EstadoSubidas>('subidasLanding');

/** ¿Qué se puede subir de esto? `null` = nada (y el motivo, para avisar). */
function tipoSubible(f: File): { tipo: 'imagen' | 'video' } | { motivo: string } {
  if ((TIPOS_IMAGEN as readonly string[]).includes(f.type)) return f.size <= TOPE_IMAGEN_BYTES ? { tipo: 'imagen' } : { motivo: 'Imagen muy pesada' };
  if ((TIPOS_VIDEO as readonly string[]).includes(f.type)) return f.size <= TOPE_VIDEO_BYTES ? { tipo: 'video' } : { motivo: 'Video muy pesado' };
  return { motivo: 'Formato no admitido' };
}

/**
 * Office pone una FOTO del texto copiado en `clipboardData.files` además del HTML (lo midió el
 * editor rico, trampa 17). Si el HTML del mismo pegado tiene texto, lo que se pegó es el texto.
 */
function pegadoEsDeArchivos(dt: DataTransfer | null): boolean {
  if (!dt || !dt.files.length) return false;
  const html = dt.getData('text/html');
  if (!html) return true;
  const texto = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  return texto.length === 0;
}

export const Subidas = Extension.create<Partial<OpcionesLanding>>({
  name: 'subidasLanding',
  addOptions() { return {}; },
  addProseMirrorPlugins() {
    const ext = this;
    const subir = (view: import('@tiptap/pm/view').EditorView, archivos: File[], pos: number) => {
      const subirArchivo = ext.options.subirArchivo;
      if (!subirArchivo) return false;
      let alguno = false;
      for (const f of archivos) {
        const t = tipoSubible(f);
        if ('motivo' in t) { ext.options.avisar?.(t.motivo); continue; }
        alguno = true;
        const id = nuevoId('s');
        const texto = t.tipo === 'imagen' ? 'Subiendo imagen…' : 'Subiendo video…';
        view.dispatch(view.state.tr.setMeta(CLAVE_SUBIDAS, { agregar: { id, pos, texto } }).setMeta('addToHistory', false));
        subirArchivo(f, (pct) => {
          const el = typeof document !== 'undefined' ? document.querySelector(`[data-subida="${id}"]`) : null;
          if (el) el.textContent = `${texto} ${Math.round(pct)}%`;
        }).then((url) => {
          if (view.isDestroyed) return;
          const d = CLAVE_SUBIDAS.getState(view.state)?.destinos.get(id);
          const tr = view.state.tr.setMeta(CLAVE_SUBIDAS, { quitar: id });
          if (!d) { view.dispatch(tr); return; }
          const json = t.tipo === 'imagen'
            ? { type: NODO.imagen, attrs: { src: url, alt: '', ancho: 60, alinea: 'centro', href: null, forma: 'normal' } }
            : { type: NODO.video, attrs: { src: url, ancho: 100, autoplay: false, bucle: false, poster: null } };
          const ins = trInsertarBloque(view.state, json, { pos: d.pos });
          if (ins) { ins.setMeta(CLAVE_SUBIDAS, { quitar: id }); view.dispatch(ins); }
          else view.dispatch(tr);
        }).catch(() => {
          if (view.isDestroyed) return;
          view.dispatch(view.state.tr.setMeta(CLAVE_SUBIDAS, { quitar: id }).setMeta('addToHistory', false));
          ext.options.avisar?.('No se pudo subir');
        });
      }
      return alguno;
    };

    return [new Plugin<EstadoSubidas>({
      key: CLAVE_SUBIDAS,
      state: {
        init: () => ({ destinos: new Map(), deco: DecorationSet.empty }),
        apply(tr, prev) {
          // Cada destino se corre con lo que se escribió: lo que sube va donde se soltó.
          let destinos = prev.destinos;
          if (tr.docChanged && destinos.size) {
            destinos = new Map([...destinos].map(([k, d]) => [k, { ...d, pos: tr.mapping.map(d.pos) }]));
          }
          const meta = tr.getMeta(CLAVE_SUBIDAS) as { agregar?: Destino & { id: string }; quitar?: string } | undefined;
          if (meta?.agregar) { destinos = new Map(destinos); destinos.set(meta.agregar.id, { pos: meta.agregar.pos, texto: meta.agregar.texto }); }
          if (meta?.quitar) { destinos = new Map(destinos); destinos.delete(meta.quitar); }
          if (destinos === prev.destinos) return { destinos, deco: prev.deco.map(tr.mapping, tr.doc) };
          const decos = [...destinos].map(([id, d]) => Decoration.widget(Math.min(d.pos, tr.doc.content.size), () => {
            const el = document.createElement('span');
            el.className = 'gmc-subiendo';
            el.setAttribute('data-subida', id);
            el.setAttribute('contenteditable', 'false');
            el.textContent = d.texto;
            return el;
          }, { key: id, side: 1 }));
          return { destinos, deco: DecorationSet.create(tr.doc, decos) };
        },
      },
      props: {
        decorations: (state) => CLAVE_SUBIDAS.getState(state)?.deco ?? DecorationSet.empty,
        handlePaste(view, event) {
          const dt = event.clipboardData;
          if (pegadoEsDeArchivos(dt)) {
            const ok = subir(view, Array.from(dt!.files), view.state.selection.from);
            if (ok) { event.preventDefault(); return true; }
            return false;
          }
          // Sólo un enlace de video/agenda en una línea vacía, o su código: el bloque.
          const texto = dt?.getData('text/plain')?.trim() ?? '';
          if (!texto || texto.length > 5000) return false;
          const $f = view.state.selection.$from;
          const lineaVacia = $f.parent.isTextblock && $f.parent.content.size === 0;
          const esCodigo = esCodigoParaInsertar(texto);
          if (!esCodigo && (!lineaVacia || /\s/.test(texto))) return false;
          const emb = embedDe(texto);
          if (!emb) return false;
          const tr = trInsertarBloque(view.state, { type: NODO.insertado, attrs: { src: emb.src, proveedor: emb.proveedor, alto: emb.alto ?? null } });
          if (!tr) return false;
          view.dispatch(tr);
          event.preventDefault();
          return true;
        },
        handleDrop(view, event, _slice, movido) {
          if (movido) return false;
          const dt = (event as DragEvent).dataTransfer;
          if (!dt?.files.length) return false;
          // Soltar sobre la imagen de acento de una sección lo resuelve su NodeView (TarjetaVista).
          if ((event.target as HTMLElement | null)?.closest?.('.gm-acento, [data-soltar-propio]')) return false;
          const coords = view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY });
          const ok = subir(view, Array.from(dt.files), coords?.pos ?? view.state.selection.from);
          if (ok) { event.preventDefault(); return true; }
          return false;
        },
      },
    })];
  },
});
