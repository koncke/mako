'use client';

// =============================================================================
// MenuBarra — el menú «/» de Gamma (comandos con barra)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» En Gamma se escribe «/» en un bloque vacío o después de
// un espacio y aparece un menú blanco con todo lo que se puede insertar, agrupado,
// con su ícono azul, su nombre y el atajo markdown a la derecha; lo que se escribe
// a continuación lo filtra (gamma-ui §5.6). Diseño: docs/diseno-editor-landing.md.
//
// El MOTOR (cuándo se abre, qué se escribió, cuándo se cierra) es un plugin propio de
// ProseMirror: extensiones/barra.ts. Este componente sólo lo DIBUJA, leyendo su
// estado con `useEditorState`, y le contesta las flechas, Enter y Tab
// (`registrarTeclasBarra`). Lo monta el armazón (paquete H) una vez, adentro del
// proveedor del contexto: `<MenuBarra />`.
//
// Al elegir: se inserta con `insertarBloque` de insertar.ts (paquete G1), la MISMA
// puerta que usan «Agregar bloque» y la IA, pasándole la «/consulta» como el rango a
// borrar: el menú no sabe armar ningún bloque ni decide dónde va.
//
// Lo que se agregó a lo de Gamma: la línea de ayuda de cada bloque (el catálogo la
// trae; en Gamma va en un tooltip). Lo que no: «Seguir escribiendo con IA» y
// «Nueva sección con IA» del «/» de Gamma — la IA de MaKo entra por la barra de
// formato y por «Edición con IA» (paquete I2), y un renglón que no inserta un bloque
// no es de este catálogo.
// =============================================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorState, type Editor } from '@tiptap/react';
import { useCapaModal } from '@/app/_components/pila-modales';
import { useEditorLanding } from './contexto';
import { PIDEN_ARCHIVO, insertarBloque } from './insertar';
import { ATAJO_MARKDOWN, cerrarBarra, estadoBarra, gruposDeBarra, registrarTeclasBarra } from './extensiones/barra';
import { EstilosG2, Icono, noRobaFoco, useDomDelEditor, vistaDe } from './BarraFormato';
import type { DefBloque } from '@/lib/editor-landing/catalogo-bloques';

// Medido en el GIF del «/» de Gamma: popover blanco de ~280 px y ~230 de alto con scroll. Acá va
// un poco más ancho y alto porque cada renglón lleva su ayuda debajo del nombre.
const ANCHO = 320;
const ALTO_MAX = 360;

const CSS_MENU: string = [
  '.gmx-mb{padding:6px;max-height:' + ALTO_MAX + 'px}',
  '.gmx-mb-fila{display:flex;align-items:center;gap:10px;width:100%;padding:6px 8px;border:0;border-radius:8px;background:transparent;text-align:left;cursor:pointer}',
  '.gmx-mb-fila[data-activo="si"]{background:var(--gmx-azul-fondo)}',
  '.gmx-mb-ico{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;border:1px solid var(--gmx-borde);border-radius:6px;background:var(--gmx-fondo);color:var(--gmx-azul)}',
  '.gmx-mb-txt{display:flex;flex-direction:column;flex:1 1 auto;min-width:0}',
  '.gmx-mb-nombre{font-size:14px;font-weight:500;color:var(--gmx-texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.gmx-mb-ayuda{font-size:12px;font-weight:400;color:var(--gmx-tenue);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
].join('\n');

export function MenuBarra({ editor: editorProp }: { editor?: Editor | null }) {
  const ctx = useEditorLanding();
  const editor = editorProp ?? ctx.editor;
  const dom = useDomDelEditor(editor);
  const estado = useEditorState({ editor, selector: ({ editor: e }) => (e && !e.isDestroyed ? estadoBarra(e.state) : null) });
  const abierto = !!estado && !!dom;
  const consulta = estado?.consulta ?? '';
  const grupos = useMemo(() => gruposDeBarra(consulta), [consulta]);
  const planos = useMemo(() => grupos.flatMap((g) => g.bloques), [grupos]);
  // El renglón resaltado vuelve al primero cuando cambia lo escrito: se guarda junto con la consulta
  // a la que pertenece y se deriva (sin un efecto que lo resetee un render tarde).
  const [sel, setSel] = useState<{ q: string; i: number }>({ q: '', i: 0 });
  const i = sel.q === consulta ? Math.max(0, Math.min(sel.i, planos.length - 1)) : 0;
  const capa = useCapaModal(abierto, { anidada: true });
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Lo que el handler de teclado necesita leer en el momento de la tecla (se registra una vez).
  const vivo = useRef({ planos, i, consulta });
  useEffect(() => { vivo.current = { planos, i, consulta }; }, [planos, i, consulta]);

  const elegir = (def: DefBloque) => {
    const e = editor;
    const st = e && !e.isDestroyed ? estadoBarra(e.state) : null;
    if (!e || !st) return;
    const rango = { from: st.desde, to: st.hasta };
    // El menú se cierra YA: una imagen o un video esperan al selector, y el menú no puede quedar
    // abierto encima mientras tanto.
    cerrarBarra(e);
    if (PIDEN_ARCHIVO[def.id]) {
      // Con selector de por medio, la «/consulta» se borra antes: si la persona cancela, no queda
      // escrita en la sección. El bloque va donde estaba la barra (insertarBloque sigue la posición).
      e.chain().focus().deleteRange(rango).run();
      void insertarBloque(e, def.id, { elegirImagen: ctx.elegirImagen });
    } else {
      // El resto: insertarBloque borra la «/consulta» y decide dónde va el bloque (en el párrafo que
      // queda vacío, si lo reemplaza, o después).
      void insertarBloque(e, def.id, { rango, elegirImagen: ctx.elegirImagen });
    }
  };
  const elegirRef = useRef(elegir);
  useEffect(() => { elegirRef.current = elegir; });

  useEffect(() => {
    const vista = vistaDe(editor);
    if (!abierto || !vista) return;
    registrarTeclasBarra(vista, (ev) => {
      const { planos: ps, i: k, consulta: q } = vivo.current;
      const mover = (d: number) => {
        if (!ps.length) return;
        setSel({ q, i: (k + d + ps.length) % ps.length });
      };
      if (ev.key === 'ArrowDown') { mover(1); return true; }
      if (ev.key === 'ArrowUp') { mover(-1); return true; }
      if ((ev.key === 'Enter' || ev.key === 'Tab') && !ev.isComposing) {
        if (!ps.length) return false;
        ev.preventDefault();
        elegirRef.current(ps[k]);
        return true;
      }
      return false;
    });
    return () => registrarTeclasBarra(vista, null);
  }, [abierto, editor, dom]);

  // Escape: en captura y con stopImmediatePropagation (los Escape de la casa viven en `document`;
  // sin esto, cerrar el menú cerraría también lo que esté abajo en la pila).
  useEffect(() => {
    if (!abierto || !editor) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !capa.esElDeArriba()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cerrarBarra(editor);
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [abierto, editor, capa.esElDeArriba]);

  // Si el editor pierde el foco (clic en otra parte de la pantalla), el menú se cierra. Un clic en
  // un renglón no cuenta: los renglones no se llevan el foco (onMouseDown + preventDefault).
  useEffect(() => {
    if (!abierto || !editor) return;
    const alSalir = ({ event }: { event: FocusEvent }) => {
      const destino = event.relatedTarget as Node | null;
      if (destino && ref.current?.contains(destino)) return;
      cerrarBarra(editor);
    };
    editor.on('blur', alSalir);
    return () => { editor.off('blur', alSalir); };
  }, [abierto, editor]);

  // Debajo de la «/» (arriba si no entra), portaleado y en `position: fixed`.
  useLayoutEffect(() => {
    if (!abierto || !estado) { setPos(null); return; }
    const ubicar = () => {
      const vista = vistaDe(editor);
      const el = ref.current;
      if (!vista || !el) return;
      let c: { left: number; top: number; bottom: number };
      try { c = vista.coordsAtPos(Math.min(estado.desde, vista.state.doc.content.size)); } catch { return; }
      const h = el.offsetHeight;
      let top = c.bottom + 6;
      if (top + h > window.innerHeight - 8 && c.top - h - 6 >= 8) top = c.top - h - 6;
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      const left = Math.max(8, Math.min(c.left - 8, window.innerWidth - ANCHO - 8));
      setPos((p) => (p && Math.abs(p.top - top) < 0.5 && Math.abs(p.left - left) < 0.5 ? p : { top, left }));
    };
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => { window.removeEventListener('resize', ubicar); window.removeEventListener('scroll', ubicar, true); };
  }, [abierto, estado, editor, planos.length]);

  // El renglón resaltado siempre a la vista cuando se recorre con las flechas.
  useEffect(() => {
    if (!abierto) return;
    const fila = ref.current?.querySelector<HTMLElement>('[data-activo="si"]');
    fila?.scrollIntoView({ block: 'nearest' });
  }, [abierto, i, consulta]);

  if (!abierto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      className="gmx gmx-pop gmx-mb"
      role="listbox"
      aria-label="Insertar bloque"
      data-gmx-capa=""
      data-gmx-z={capa.z}
      onMouseDown={noRobaFoco}
      style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: ANCHO, zIndex: capa.z, opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none' }}
    >
      <EstilosG2 />
      <style href="gmx-mb" precedence="medium">{CSS_MENU}</style>
      {!planos.length && <div className="gmx-vacio">No se han encontrado bloques</div>}
      {grupos.map((g) => (
        <div key={g.categoria} role="group" aria-label={g.categoria}>
          <div className="gmx-grupo">{g.categoria}</div>
          {g.bloques.map((b) => {
            const k = planos.indexOf(b);
            return (
              <button
                key={b.id}
                type="button"
                role="option"
                aria-selected={k === i}
                className="gmx-mb-fila"
                data-activo={k === i ? 'si' : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => { if (k !== i) setSel({ q: consulta, i: k }); }}
                onClick={() => elegir(b)}
              >
                <span className="gmx-mb-ico"><Icono nombre={b.icono} tam={16} /></span>
                <span className="gmx-mb-txt">
                  <span className="gmx-mb-nombre">{b.nombre}</span>
                  <span className="gmx-mb-ayuda">{b.ayuda}</span>
                </span>
                {ATAJO_MARKDOWN[b.id] && <span className="gmx-fila-atajo">{ATAJO_MARKDOWN[b.id]}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export default MenuBarra;
