'use client';

// =============================================================================
// AsaBloque — el asa ⋮⋮ y el «+» a la izquierda de cada bloque de una sección
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» En Gamma, al pasar el mouse por un bloque de una sección
// aparece a su izquierda un asa ⋮⋮ para arrastrarlo (y moverlo, incluso a otra
// sección) que al hacer clic abre su menú (gamma-ui §5.8: «handle ⋮⋮ a la izquierda
// de cada bloque»). Diseño: docs/diseno-editor-landing.md (D1).
//
// Qué es «el bloque»: un hijo DIRECTO de una tarjeta (un párrafo, una lista entera, un
// diseño optimizado, unas columnas). Se busca por posición y no por el DOM: con
// NodeViews de React en el medio, el árbol del DOM tiene envoltorios que no son nodos.
//
// El arrastre es el de ProseMirror y no uno propio (`extension-drag-handle` no está y
// arrastra yjs: D1). Las reglas de AGENTS.md que aplican, en orden:
//   · `dragstart` deja una NodeSelection del bloque y `view.dragging = { slice, move,
//     node }`: el `drop` del editor borra el original (`node.replace`) e inserta donde
//     cae (`dropPoint`). Sin `node`, ProseMirror borra la SELECCIÓN, que es lo mismo
//     sólo mientras nadie la cambie en el medio.
//   · La foto que sigue al cursor la toma el navegador AL TERMINAR `dragstart`: se le
//     pasa el bloque real (`setDragImage`, está en el documento y a la vista) y toda
//     marca visual va con `setTimeout(…, 0)`, o sale en la foto.
//   · Al nodo origen no se le toca el tamaño (colapsarlo deja el gesto sin salida).
//   · Durante un arrastre nativo el navegador congela `requestAnimationFrame` y los
//     timers: el auto-scroll del lienzo va en un `dragover` de `document`, en captura.
//   ⚠️ NO VERIFICADO en un navegador con ventana (la regla de la casa para un gesto: no
//      se verifica leyendo el handler). Queda para el cierre de la corrida (paquete K).
//
// El menú (Gamma: Duplicar, Eliminar, Convertir en…, Copiar enlace):
//   · Eliminar deja 5 s de «Deshacer» que vuelve a poner EL MISMO nodo en su posición
//     corrida, y no lo duplica si un Ctrl+Z ya lo devolvió (mira `undoDepth`: el molde
//     de `sacarConDeshacer` de EditorRico).
//   · Duplicar renueva los ids de los campos de un formulario (son únicos en la landing;
//     el server los regeneraría al guardar, pero hasta entonces el editor tendría dos).
//   · Convertir en… usa `aplicarTipoBloque`, la misma función que la barra de formato.
// =============================================================================

import { useEffect, useRef, useState, type DragEvent as EventoArrastre } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from './contexto';
import { insertarBarraEn } from './extensiones/barra';
import {
  EstilosG2, FilaMenu, Flotante, Icono, MenuFilas, TIPOS_BLOQUE, aplicarTipoBloque, eliminarBloqueConDeshacer, tipoDisponible,
  useDomDelEditor, vistaDe,
} from './BarraFormato';
import { NODO, nuevoId } from '@/lib/editor-landing/doc';

type Bloque = { pos: number; tipo: string; tarjetaPos: number; tarjetaId: string };

/** Los bloques que se pueden convertir a otro estilo de texto. */
const CONVERTIBLES: ReadonlySet<string> = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote']);

const CSS_ASA: string = [
  '.gmx-asa{display:flex;align-items:center;gap:2px;transition:opacity .12s}',
  '.gmx-asa-btn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:24px;padding:0;border:1px solid var(--gmx-borde);border-radius:6px;background:var(--gmx-fondo);color:var(--gmx-tenue);box-shadow:var(--gmx-sombra-sm);cursor:pointer}',
  '.gmx-asa-btn:hover,.gmx-asa-btn[aria-expanded="true"]{background:var(--gmx-hover);color:var(--gmx-texto)}',
  '.gmx-asa-arrastre{cursor:grab}',
  '.gmx-asa-arrastre:active{cursor:grabbing}',
].join('\n');

/** El bloque de primer nivel de una sección que está a la altura del puntero, o null. */
function bloqueEnPunto(vista: EditorView, x: number, y: number): Bloque | null {
  let hallado: Bloque | null = null;
  vista.state.doc.forEach((tarjeta, offTarjeta) => {
    if (hallado || tarjeta.type.name !== NODO.tarjeta) return;
    const domT = vista.nodeDOM(offTarjeta);
    if (!(domT instanceof HTMLElement)) return;
    const rt = domT.getBoundingClientRect();
    // Un poco de margen a la izquierda: ahí vive el asa, afuera del texto del bloque.
    if (y < rt.top || y > rt.bottom || x < rt.left - 80 || x > rt.right) return;
    tarjeta.forEach((hijo, offHijo) => {
      if (hallado) return;
      const pos = offTarjeta + 1 + offHijo;
      const d = vista.nodeDOM(pos);
      if (!(d instanceof HTMLElement)) return;
      const r = d.getBoundingClientRect();
      if (y >= r.top - 4 && y <= r.bottom + 4) {
        hallado = { pos, tipo: hijo.type.name, tarjetaPos: offTarjeta, tarjetaId: typeof tarjeta.attrs.id === 'string' ? tarjeta.attrs.id : '' };
      }
    });
  });
  return hallado;
}

/** El primer ancestro que scrollea en vertical (el lienzo del armazón), o null si scrollea la ventana. */
function contenedorConScroll(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

export function AsaBloque({ editor: editorProp }: { editor?: Editor | null }) {
  const ctx = useEditorLanding();
  const editor = editorProp ?? ctx.editor;
  const dom = useDomDelEditor(editor);
  const [bloque, setBloque] = useState<Bloque | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const [menu, setMenu] = useState<{ ancla: HTMLElement; sub?: 'convertir' } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const asa = useRef<HTMLDivElement | null>(null);
  const vivo = useRef<{ bloque: Bloque | null; menu: boolean; arrastrando: boolean }>({ bloque: null, menu: false, arrastrando: false });
  useEffect(() => { vivo.current = { bloque, menu: !!menu, arrastrando }; }, [bloque, menu, arrastrando]);

  // Dónde se dibuja: a la izquierda del bloque, a la altura de su primer renglón.
  const ubicar = (b: Bloque | null) => {
    const vista = vistaDe(editor);
    const d = b && vista ? vista.nodeDOM(b.pos) : null;
    if (!(d instanceof HTMLElement)) { setRect(null); return; }
    const r = d.getBoundingClientRect();
    const top = r.top + Math.min(r.height, 28) / 2 - 12;
    setRect({ top, left: r.left - 52 });
  };
  const ubicarRef = useRef(ubicar);
  useEffect(() => { ubicarRef.current = ubicar; });

  // Seguir al puntero (con un rAF: un `mousemove` dispara decenas de veces por segundo).
  useEffect(() => {
    if (!dom || !editor) return;
    let cuadro = 0;
    const mover = (ev: MouseEvent) => {
      if (vivo.current.menu || vivo.current.arrastrando || !editor.isEditable) return;
      const { clientX: x, clientY: y } = ev;
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const vista = vistaDe(editor);
        if (!vista) return;
        const b = bloqueEnPunto(vista, x, y);
        if (!b) return; // entre dos bloques (el margen): se queda el último, sin parpadear
        const a = vivo.current.bloque;
        if (!a || a.pos !== b.pos || a.tarjetaPos !== b.tarjetaPos) setBloque(b);
        ubicarRef.current(b);
      });
    };
    const salir = (ev: MouseEvent) => {
      const a = ev.relatedTarget as Node | null;
      if (a && asa.current?.contains(a)) return;
      if (vivo.current.menu || vivo.current.arrastrando) return;
      setBloque(null);
      setRect(null);
    };
    dom.addEventListener('mousemove', mover);
    dom.addEventListener('mouseleave', salir);
    return () => { cancelAnimationFrame(cuadro); dom.removeEventListener('mousemove', mover); dom.removeEventListener('mouseleave', salir); };
  }, [dom, editor]);

  // Mientras se escribe, el asa se va (como en Gamma y en Notion); con el menú abierto, se queda.
  useEffect(() => {
    if (!editor) return;
    const alCambiar = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged || vivo.current.menu || vivo.current.arrastrando) return;
      setBloque(null);
      setRect(null);
    };
    editor.on('transaction', alCambiar);
    return () => { editor.off('transaction', alCambiar); };
  }, [editor]);

  // El lienzo scrollea: el asa se mueve con el bloque.
  useEffect(() => {
    if (!bloque) return;
    const re = () => ubicarRef.current(vivo.current.bloque);
    window.addEventListener('scroll', re, true);
    window.addEventListener('resize', re);
    return () => { window.removeEventListener('scroll', re, true); window.removeEventListener('resize', re); };
  }, [bloque]);

  // Auto-scroll durante el arrastre: sólo `dragover` llega mientras se arrastra (rAF y timers congelados).
  useEffect(() => {
    if (!arrastrando || !dom) return;
    const caja = contenedorConScroll(dom);
    const sobre = (ev: DragEvent) => {
      const borde = 64;
      const r = caja ? caja.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const paso = ev.clientY < r.top + borde ? -18 : ev.clientY > r.bottom - borde ? 18 : 0;
      if (!paso) return;
      if (caja) caja.scrollBy(0, paso);
      else window.scrollBy(0, paso);
    };
    document.addEventListener('dragover', sobre, true);
    return () => document.removeEventListener('dragover', sobre, true);
  }, [arrastrando, dom]);

  if (!editor || !dom || !bloque || !rect || !editor.isEditable || typeof document === 'undefined') return null;

  const nodoActual = () => {
    const b = vivo.current.bloque;
    if (!b || editor.isDestroyed) return null;
    const n = editor.state.doc.nodeAt(b.pos);
    return n && n.type.name === b.tipo ? { b, n } : null;
  };

  const alArrastrar = (ev: EventoArrastre<HTMLButtonElement>) => {
    const vista = vistaDe(editor);
    const actual = nodoActual();
    if (!vista || !actual) { ev.preventDefault(); return; }
    const { b } = actual;
    const nodeSel = NodeSelection.create(vista.state.doc, b.pos);
    vista.dispatch(vista.state.tr.setSelection(nodeSel));
    const { dom: html, text, slice } = vista.serializeForClipboard(nodeSel.content());
    ev.dataTransfer.clearData();
    ev.dataTransfer.setData('text/html', html.innerHTML);
    ev.dataTransfer.setData('text/plain', text);
    ev.dataTransfer.effectAllowed = 'copyMove';
    const d = vista.nodeDOM(b.pos);
    if (d instanceof HTMLElement) {
      const r = d.getBoundingClientRect();
      ev.dataTransfer.setDragImage(d, Math.max(0, Math.min(ev.clientX - r.left, r.width)), Math.max(0, Math.min(ev.clientY - r.top, r.height)));
    }
    // `node` es lo que el drop borra del lugar viejo (prosemirror-view: `dragging.node.replace(tr)`).
    // El tipo público de `dragging` no lo declara, pero la clase interna sí lo lee.
    vista.dragging = { slice, move: true, node: nodeSel } as EditorView['dragging'];
    setMenu(null);
    // Después de la foto: lo que cambie acá no sale en la imagen que sigue al cursor.
    setTimeout(() => setArrastrando(true), 0);
  };
  const alSoltar = () => {
    setArrastrando(false);
    setBloque(null);
    setRect(null);
    // Si se soltó afuera del editor nadie consumió el arrastre: se limpia como lo hace ProseMirror.
    setTimeout(() => { const v = vistaDe(editor); if (v && v.dragging) v.dragging = null; }, 50);
  };

  const agregarAbajo = () => {
    const actual = nodoActual();
    if (!actual) return;
    insertarBarraEn(editor, actual.b.pos + actual.n.nodeSize);
    setBloque(null);
    setRect(null);
  };

  const duplicar = () => {
    const actual = nodoActual();
    if (!actual) return;
    const { b, n } = actual;
    const copia = n.type.name === NODO.formulario
      ? n.type.create({ ...n.attrs, campos: (Array.isArray(n.attrs.campos) ? n.attrs.campos : []).map((c: Record<string, unknown>) => ({ ...c, id: nuevoId('c') })) })
      : n.copy(n.content);
    editor.chain().focus().command(({ tr }) => { tr.insert(b.pos + n.nodeSize, copia); return true; }).run();
    setMenu(null);
  };

  const eliminar = () => {
    const actual = nodoActual();
    if (!actual) return;
    setMenu(null);
    setBloque(null);
    setRect(null);
    // Una sección no puede quedar vacía (content: '…+'): si era su único bloque, queda un párrafo.
    eliminarBloqueConDeshacer(editor, actual.b.pos, ctx.avisar);
  };

  const convertir = (tipo: (typeof TIPOS_BLOQUE)[number]['id']) => {
    const actual = nodoActual();
    if (!actual) return;
    const { b, n } = actual;
    editor.chain().command(({ tr }) => {
      const $a = tr.doc.resolve(b.pos + 1);
      const $b = tr.doc.resolve(b.pos + n.nodeSize - 1);
      tr.setSelection(TextSelection.between($a, $b));
      return true;
    }).run();
    aplicarTipoBloque(editor, tipo);
    setMenu(null);
  };

  const copiarEnlace = async () => {
    const actual = nodoActual();
    setMenu(null);
    if (!actual || !actual.b.tarjetaId) return;
    const pagina = ctx.paginas.find((p) => p.id === ctx.paginaActual);
    const base = ctx.urlPublica
      ? ctx.urlPublica.replace(/\/$/, '') + (pagina?.ruta ? '/' + pagina.ruta : '')
      : window.location.href.split('#')[0];
    try {
      await navigator.clipboard.writeText(base + '#t-' + actual.b.tarjetaId);
      ctx.avisar('Enlace copiado');
    } catch {
      ctx.avisar('No se pudo copiar');
    }
  };

  const convertible = CONVERTIBLES.has(bloque.tipo);
  const contenedor = dom.closest('.gma') ?? document.body;

  return createPortal(
    <div
      ref={asa}
      className="gmx gmx-asa"
      data-gmx-capa=""
      data-gmx-z={30}
      style={{ position: 'fixed', top: rect.top, left: rect.left, zIndex: 30, opacity: arrastrando ? 0.5 : 1 }}
      onMouseLeave={(ev) => {
        const a = ev.relatedTarget as Node | null;
        if (menu || arrastrando || (a && dom.contains(a))) return;
        setBloque(null);
        setRect(null);
      }}
    >
      <EstilosG2 />
      <style href="gmx-asa" precedence="medium">{CSS_ASA}</style>
      <button type="button" className="gmx-asa-btn" title="Agregar abajo" aria-label="Agregar abajo" onMouseDown={(e) => e.preventDefault()} onClick={agregarAbajo}>
        <Icono nombre="mas" tam={14} />
      </button>
      <button
        type="button"
        className="gmx-asa-btn gmx-asa-arrastre"
        title="Arrastra para mover"
        aria-label="Opciones del bloque"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        draggable
        // Sin preventDefault en el mousedown, a propósito: en Firefox cancela el arrastre nativo. El
        // clic se lleva el foco al asa, y las acciones del menú lo devuelven al texto (`focus()`).
        onDragStart={alArrastrar}
        onDragEnd={alSoltar}
        onClick={(e) => { const el = e.currentTarget; setMenu((m) => (m ? null : { ancla: el })); }}
      >
        <Icono nombre="arrastrar" tam={14} />
      </button>
      {menu && (
        <Flotante ancla={menu.ancla} onCerrar={() => setMenu(null)} etiqueta="Opciones del bloque" ancho={248}>
          {menu.sub === 'convertir' ? (
            <MenuFilas etiqueta="Convertir en">
              <FilaMenu nombre="Volver" icono={<Icono nombre="chevron-izquierda" />} onClick={() => setMenu((m) => (m ? { ancla: m.ancla } : m))} />
              <div className="gmx-sep" />
              {TIPOS_BLOQUE.map((t) => (
                <FilaMenu key={t.id} nombre={t.nombre} icono={<Icono nombre={t.icono} />} atajo={t.atajo} apagado={!tipoDisponible(editor, t.id)} onClick={() => convertir(t.id)} />
              ))}
            </MenuFilas>
          ) : (
            <MenuFilas etiqueta="Opciones del bloque">
              <FilaMenu nombre="Duplicar" icono={<Icono nombre="duplicar" />} atajo="⌘D" onClick={duplicar} />
              {convertible && <FilaMenu nombre="Convertir en" icono={<Icono nombre="refrescar" />} sub onClick={() => setMenu((m) => (m ? { ...m, sub: 'convertir' } : m))} />}
              <FilaMenu nombre="Copiar enlace" icono={<Icono nombre="enlace" />} apagado={!bloque.tarjetaId} onClick={() => { void copiarEnlace(); }} />
              <div className="gmx-sep" />
              <FilaMenu nombre="Eliminar" peligro icono={<IconoBorrar size={16} />} onClick={eliminar} />
            </MenuFilas>
          )}
        </Flotante>
      )}
    </div>,
    contenedor,
  );
}

export default AsaBloque;
