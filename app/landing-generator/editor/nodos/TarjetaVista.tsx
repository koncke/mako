'use client';

// =============================================================================
// nodos/TarjetaVista — la SECCIÓN (el «módulo» de Gamma 5) con sus controles
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D1, D3).
// Lo que se copia: gamma-ui §5.8 (el MÓDULO) y §5.7 (el menú de una sección).
//
// La sección ES el elemento del NodeView (`section.gm-tarjeta`, `as: 'section'` en
// extensiones/index.ts), y adentro van, en este orden de capas:
//   · `.gm-tarjeta-fondo` (el NodeViewWrapper: pinta el fondo propio, detrás);
//   · `.gm-acento` (la imagen de acento; sin imagen, el hueco «Agregar imagen»);
//   · `.gm-tarjeta-cuerpo`: el contentDOM de ProseMirror con los bloques (lo marca index.ts);
//   · los controles de Gamma 5, todos en `.gma` y `contentEditable={false} suppressContentEditableWarning`: la columna de 3
//     botones a la izquierda POR FUERA del módulo (⋮ opciones y asa · ✨ Ask Agent · ▤ notas),
//     el «+» entre secciones, la mini barra [+ | ✨ | ▾] debajo de la activa y la marca de oculta.
//
// ⚠️ Los `data-*` del contrato (`data-diseno`, `data-ancho`…) los escribe index.ts en cada
//    actualización de ProseMirror, sin pasar por React (si no, se pintaba un cuadro con los
//    viejos). Acá sólo se escribe lo que necesita el TEMA (el `style` con las variables de un
//    fondo propio) y `data-activa`.
// ⚠️ Mover la sección por su ⋮ es un gesto de puntero propio, no drag-and-drop de HTML5: con
//    `draggable` en la sección, ProseMirror arranca un arrastre desde cualquier margen, y su
//    `stopEvent` ignora el `dragstart` de un botón. Se marca la sección (un borde, sin tocar su
//    tamaño: AGENTS.md), una línea dice dónde cae, y el auto-scroll va por rAF (con eventos de
//    puntero el navegador no congela los timers, como sí hace en un arrastre nativo).
// ⚠️ Eliminar deja 5 s de «Deshacer» que devuelve el MISMO nodo con su id (insertar.ts).
// =============================================================================

import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { NodeViewWrapper, useEditorState, type NodeViewProps } from '@tiptap/react';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { EditorLandingContext } from '../contexto';
import { attrsTarjeta, specTarjeta, srcImagen } from '@/lib/editor-landing/especificacion';
import { varsDeFondoPropio } from '@/lib/editor-landing/temas';
import { DISENOS_SECCION } from '@/lib/editor-landing/plantillas';
import { TIPOS_IMAGEN, TOPE_IMAGEN_BYTES, terminoTarjeta } from '@/lib/editor-landing/api-tipos';
import { NODO, TOPES, tituloDeTarjeta, type AttrsTarjeta, type JsonNodo } from '@/lib/editor-landing/doc';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import AskAgent, { type ModoAskAgent } from '../AskAgent';
import EstiloSeccion, { ESTILO_RESTABLECIDO } from '../paneles/EstiloSeccion';
import {
  borrarTarjeta, combinarConAnterior, duplicarTarjeta, insertarDisenoSeccion, insertarTarjetaEn, moverTarjeta, seccionPorId,
} from '../insertar';
import { CSS_NODOS } from '../extensiones/estilos-nodos';
import { Flotante, FilaMenu, Ico, SepMenu, sinRobarFoco } from '../extensiones/piezas';
import { opcionesLanding } from '../extensiones/plugins';
import { attrsDeRaiz } from '../extensiones/comun';

/** Los modos del Ask Agent (AskAgent.tsx, paquete I2): editar la sección, probar diseños, agregar una. */
type ModoAgente = ModoAskAgent;

type Panel =
  | { tipo: 'menu' | 'notas' | 'estilo' | 'disenos'; ancla: HTMLElement }
  | { tipo: 'agente'; ancla: HTMLElement; modo: ModoAgente };

/** El contenedor que scrollea al lienzo (para el auto-scroll del arrastre). */
function contenedorConScroll(el: HTMLElement | null): HTMLElement | Window {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return window;
}

export default function TarjetaVista(props: NodeViewProps & { selectionInside?: boolean }) {
  const { node, editor, getPos } = props;
  const ctx = useContext(EditorLandingContext);
  // «sección» o «diapositiva» (T3); sin el contexto (no debería pasar), «sección».
  const uno = terminoTarjeta(ctx?.config ?? {});
  const Uno = terminoTarjeta(ctx?.config ?? {}, { mayuscula: true });
  const a = attrsTarjeta(node.attrs);
  const id = String(node.attrs.id ?? '');
  const fondoRef = useRef<HTMLDivElement | null>(null);
  const acentoRef = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [foco, setFoco] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const cerrarPanel = useCallback(() => setPanel(null), []);

  const editable = useEditorState({ editor, selector: ({ editor: e }) => !!e?.isEditable }) ?? false;
  // «Activa» = la que el armazón dice (la del cursor o la última tocada); sin armazón, la del cursor.
  const activa = ctx ? ctx.tarjetaActiva === id : !!props.selectionInside;

  // ── Lo que necesita el TEMA: las variables de un fondo propio, en el style de la sección ──
  const spec = specTarjeta(node.attrs, { modo: 'editor', varsFondo: ctx ? (r) => varsDeFondoPropio(ctx.tema, r) : undefined });
  const estiloSeccion = attrsDeRaiz(spec).style;
  const estiloFondo = (spec.slice(1).find((h) => Array.isArray(h) && (attrsDeRaiz(h as typeof spec).class ?? '') === 'gm-tarjeta-fondo') as typeof spec | undefined);
  const cssFondo = estiloFondo ? attrsDeRaiz(estiloFondo).style : undefined;
  useLayoutEffect(() => {
    const sec = fondoRef.current?.parentElement;
    if (!sec) return;
    if (estiloSeccion) sec.setAttribute('style', estiloSeccion); else sec.removeAttribute('style');
    if (activa) sec.setAttribute('data-activa', 'si'); else sec.removeAttribute('data-activa');
  }, [estiloSeccion, activa]);

  // ── Escribir atributos: UNA transacción por gesto, cada una su paso de deshacer ──
  const setAttrs = useCallback((cambios: Partial<AttrsTarjeta>, cerrar = true) => {
    const pos = getPos();
    if (typeof pos !== 'number' || editor.isDestroyed) return;
    editor.chain().command(({ tr }) => {
      const n = tr.doc.nodeAt(pos);
      if (!n || n.type.name !== NODO.tarjeta) return false;
      tr.setNodeMarkup(pos, undefined, { ...n.attrs, ...cambios });
      if (cerrar) closeHistory(tr);
      return true;
    }).run();
  }, [editor, getPos]);

  const avisar = useCallback((t: string, deshacer?: () => void) => {
    if (ctx) ctx.avisar(t, deshacer);
    else opcionesLanding(editor).avisar?.(t);
  }, [ctx, editor]);

  const indiceActual = () => seccionPorId(editor.state.doc, id)?.indice ?? -1;

  // ── La imagen de acento ──
  const elegirImagen = useCallback(async () => {
    const elegir = ctx?.elegirImagen ?? opcionesLanding(editor).elegirImagen;
    if (!elegir) return;
    const url = await elegir({ modo: 'imagen', sugerencia: tituloDeTarjeta(node.toJSON() as JsonNodo) || undefined });
    if (!url) return;
    if (!srcImagen(url)) { avisar('Imagen no válida'); return; }
    setAttrs({ imagenSrc: url, diseno: a.diseno === 'sin' ? 'izquierda' : a.diseno });
  }, [ctx, editor, node, setAttrs, a.diseno, avisar]);

  const subirAcento = useCallback(async (f: File) => {
    if (!(TIPOS_IMAGEN as readonly string[]).includes(f.type)) { avisar('Formato no admitido'); return; }
    if (f.size > TOPE_IMAGEN_BYTES) { avisar('Imagen muy pesada'); return; }
    const subir = ctx?.subirArchivo ?? opcionesLanding(editor).subirArchivo;
    if (!subir) return;
    setSubiendo(true);
    try {
      const url = await subir(f);
      if (srcImagen(url)) setAttrs({ imagenSrc: url, diseno: a.diseno === 'sin' ? 'izquierda' : a.diseno });
    } catch {
      avisar('No se pudo subir');
    } finally {
      setSubiendo(false);
    }
  }, [ctx, editor, setAttrs, a.diseno, avisar]);

  // Soltar una imagen sobre el acento la sube y la pone. Listeners NATIVOS sobre el elemento: el
  // de ProseMirror vive en la raíz del editor (más arriba) y el de React más arriba todavía, así
  // que sólo uno puesto acá se entera ANTES y puede frenar que ProseMirror la inserte como bloque.
  const diseno = a.diseno;
  useEffect(() => {
    const el = acentoRef.current;
    if (!el || !editable) return;
    const hayArchivos = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const sobre = (e: DragEvent) => {
      if (!hayArchivos(e)) return;
      e.preventDefault();
      e.stopPropagation();
      el.setAttribute('data-soltando', 'si');
    };
    const fuera = () => el.removeAttribute('data-soltando');
    const soltar = (e: DragEvent) => {
      if (!hayArchivos(e)) return;
      e.preventDefault();
      e.stopPropagation();
      fuera();
      const f = Array.from(e.dataTransfer?.files ?? []).find((x) => x.type.startsWith('image/'));
      if (f) void subirAcento(f);
    };
    el.addEventListener('dragover', sobre);
    el.addEventListener('dragleave', fuera);
    el.addEventListener('drop', soltar);
    return () => { el.removeEventListener('dragover', sobre); el.removeEventListener('dragleave', fuera); el.removeEventListener('drop', soltar); };
  }, [diseno, editable, subirAcento]);

  // ── El punto de enfoque: la cruz se arrastra sin transacciones; UNA al soltar ──
  const cruzRef = useRef<HTMLDivElement | null>(null);
  const focoActual = useRef<{ x: number; y: number }>({ x: a.imagenFocoX, y: a.imagenFocoY });
  useEffect(() => { focoActual.current = { x: a.imagenFocoX, y: a.imagenFocoY }; }, [a.imagenFocoX, a.imagenFocoY]);
  useEffect(() => {
    if (!foco) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setFoco(false); } };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [foco]);
  const moverFoco = (clientX: number, clientY: number) => {
    const el = acentoRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.round(Math.max(0, Math.min(100, ((clientX - r.left) / Math.max(1, r.width)) * 100)) * 10) / 10;
    const y = Math.round(Math.max(0, Math.min(100, ((clientY - r.top) / Math.max(1, r.height)) * 100)) * 10) / 10;
    focoActual.current = { x, y };
    el.style.backgroundPosition = `${x}% ${y}%`;
    if (cruzRef.current) { cruzRef.current.style.left = `${x}%`; cruzRef.current.style.top = `${y}%`; }
  };

  // ── Arrastrar la sección por su ⋮ ──
  const gesto = useRef<{ x: number; y: number; arrastrando: boolean; desde: number; destino: number; yPuntero: number; raf: number; linea: HTMLDivElement | null; scroll: HTMLElement | Window } | null>(null);
  const trasArrastre = useRef(false);
  const secciones = () => Array.from(editor.view.dom.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains('gm-tarjeta'));
  const ubicarLinea = () => {
    const g = gesto.current;
    if (!g?.linea) return;
    const lista = secciones();
    let destino = lista.length;
    for (let i = 0; i < lista.length; i++) {
      const r = lista[i].getBoundingClientRect();
      if (g.yPuntero < r.top + r.height / 2) { destino = i; break; }
    }
    g.destino = destino;
    const ref = lista[Math.min(destino, lista.length - 1)]?.getBoundingClientRect();
    if (!ref) return;
    const antes = destino > 0 ? lista[destino - 1].getBoundingClientRect() : null;
    const y = destino >= lista.length ? ref.bottom + 16 : antes ? (antes.bottom + ref.top) / 2 : ref.top - 16;
    g.linea.style.top = `${Math.round(y - 1.5)}px`;
    g.linea.style.left = `${Math.round(ref.left)}px`;
    g.linea.style.width = `${Math.round(ref.width)}px`;
  };
  const autoScroll = () => {
    const g = gesto.current;
    if (!g?.arrastrando) return;
    const caja = g.scroll === window ? { top: 0, bottom: window.innerHeight } : (g.scroll as HTMLElement).getBoundingClientRect();
    const margen = 70;
    let dy = 0;
    if (g.yPuntero < caja.top + margen) dy = -Math.ceil((caja.top + margen - g.yPuntero) / 4);
    else if (g.yPuntero > caja.bottom - margen) dy = Math.ceil((g.yPuntero - (caja.bottom - margen)) / 4);
    if (dy) { g.scroll.scrollBy({ top: dy }); ubicarLinea(); }
    g.raf = requestAnimationFrame(autoScroll);
  };
  const terminarArrastre = (soltar: boolean) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    if (g.raf) cancelAnimationFrame(g.raf);
    g.linea?.remove();
    fondoRef.current?.parentElement?.removeAttribute('data-arrastrando');
    document.body.style.removeProperty('cursor');
    if (!g.arrastrando) return;
    trasArrastre.current = true;
    if (soltar && g.destino !== g.desde && g.destino !== g.desde + 1) {
      moverTarjeta(editor, g.desde, g.destino > g.desde ? g.destino - 1 : g.destino);
    }
  };
  useEffect(() => () => terminarArrastre(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Copiar la sección: por el mismo camino que Ctrl+C (el portapapeles fiel la lleva entera) ──
  const copiar = () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const { view } = editor;
    view.focus();
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(Math.min(pos + 2, view.state.doc.content.size))));
    view.dispatch(tr);
    avisar(ok ? 'Copiado' : 'No se pudo copiar');
  };

  const copiarEnlace = () => {
    let base = ctx?.urlPublica ?? null;
    const pagina = ctx?.paginas.find((x) => x.id === ctx.paginaActual);
    if (base && pagina?.ruta) base = `${base.replace(/\/+$/, '')}/${pagina.ruta}`;
    if (!base) base = window.location.href.split('#')[0];
    const url = `${base}#t-${id}`;
    if (!navigator.clipboard) { avisar('No se pudo copiar'); return; }
    navigator.clipboard.writeText(url).then(() => avisar('Enlace copiado'), () => avisar('No se pudo copiar'));
  };

  const eliminar = () => {
    const deshacer = borrarTarjeta(editor, id);
    avisar(`${Uno} eliminada`, deshacer);
  };

  const abrir = (tipo: Panel['tipo'], ancla: HTMLElement | null, modo?: ModoAgente) => {
    if (!ancla) return;
    setPanel((p) => (p && p.tipo === tipo && p.ancla === ancla ? null : tipo === 'agente' ? { tipo, ancla, modo: modo ?? 'editar' } : { tipo, ancla }));
  };

  // El panel que se abre desde el menú se ancla al ⋮ (el menú se cierra al elegir).
  const asaRef = useRef<HTMLButtonElement | null>(null);
  const desdeMenu = (accion: () => void) => () => { setPanel(null); accion(); };

  const conImagen = a.diseno !== 'sin' && !!a.imagenSrc;
  const mostrarAcento = a.diseno !== 'sin';
  const n = editor.state.doc.childCount;
  const iMenu = panel?.tipo === 'menu' ? indiceActual() : -1;

  return (
    <>
      <style href="gma-nodos" precedence="medium">{CSS_NODOS}</style>
      <NodeViewWrapper ref={fondoRef} className="gm-tarjeta-fondo" contentEditable={false} suppressContentEditableWarning style={cssFondo ? { background: cssFondo.replace(/^background:/, '') } : undefined} />

      {mostrarAcento && (
        <div
          ref={acentoRef}
          className="gm-acento"
          data-ajuste={a.imagenAjuste}
          data-vacio={conImagen ? undefined : 'si'}
          contentEditable={false}
          suppressContentEditableWarning
          style={conImagen ? { backgroundImage: `url("${a.imagenSrc}")`, backgroundPosition: `${a.imagenFocoX}% ${a.imagenFocoY}%` } : undefined}
        >
          {editable && a.diseno !== 'fondo' && (
            <div className="gma gmc gmc-acento-capa" onMouseDown={sinRobarFoco} onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button, .gmc-foco')) void elegirImagen(); }}>
              {!conImagen && (
                <button type="button" className="gmc-hueco" onClick={() => void elegirImagen()} title="Haz doble clic o suelta una imagen">
                  <Ico n="imagen" tam={28} />
                  Agregar imagen
                </button>
              )}
              {conImagen && !foco && (
                <div className="gmc-acento-barra">
                  <button type="button" className="gmc-btn" title="Reemplazar imagen" aria-label="Reemplazar imagen" onClick={() => void elegirImagen()}><Ico n="refrescar" /></button>
                  <button type="button" className="gmc-btn" title="Cambiar punto de enfoque" aria-label="Cambiar punto de enfoque" onClick={() => setFoco(true)}><Ico n="objetivo" /></button>
                  <button type="button" className="gmc-btn" title={a.imagenAjuste === 'cubrir' ? 'Adaptar' : 'Rellenar'} aria-label={a.imagenAjuste === 'cubrir' ? 'Adaptar' : 'Rellenar'}
                    onClick={() => setAttrs({ imagenAjuste: a.imagenAjuste === 'cubrir' ? 'contener' : 'cubrir' })}><Ico n={a.imagenAjuste === 'cubrir' ? 'zoom-menos' : 'zoom-mas'} /></button>
                  <button type="button" className="gmc-btn" title="Quitar imagen de acento" aria-label="Quitar imagen de acento" onClick={() => setAttrs({ imagenSrc: null })}><IconoBorrar size={15} /></button>
                </div>
              )}
              {foco && <CapaFoco cruzRef={cruzRef} x={a.imagenFocoX} y={a.imagenFocoY} onMover={moverFoco}
                onSoltar={() => setAttrs({ imagenFocoX: focoActual.current.x, imagenFocoY: focoActual.current.y })} onListo={() => setFoco(false)} />}
              {subiendo && <div className="gmc-cargando">Subiendo…</div>}
            </div>
          )}
        </div>
      )}

      {/* Con la imagen de FONDO, el acento queda detrás del texto: sus controles van en la esquina de la sección. */}
      {editable && a.diseno === 'fondo' && (
        <div className="gma gmc gmc-esquina" contentEditable={false} suppressContentEditableWarning onMouseDown={sinRobarFoco}>
          {!conImagen
            ? <button type="button" className="gmc-hueco-pildora" onClick={() => void elegirImagen()}><Ico n="imagen" /> Agregar imagen</button>
            : !foco && (
              <>
                <button type="button" className="gmc-btn" title="Reemplazar imagen" aria-label="Reemplazar imagen" onClick={() => void elegirImagen()}><Ico n="refrescar" /></button>
                <button type="button" className="gmc-btn" title="Cambiar punto de enfoque" aria-label="Cambiar punto de enfoque" onClick={() => setFoco(true)}><Ico n="objetivo" /></button>
                <button type="button" className="gmc-btn" title="Quitar imagen de acento" aria-label="Quitar imagen de acento" onClick={() => setAttrs({ imagenSrc: null })}><IconoBorrar size={15} /></button>
              </>
            )}
        </div>
      )}
      {editable && a.diseno === 'fondo' && foco && (
        <div className="gma gmc" contentEditable={false} suppressContentEditableWarning style={{ position: 'absolute', inset: 0, zIndex: 7, borderRadius: 'inherit' }} onMouseDown={sinRobarFoco}>
          <CapaFoco cruzRef={cruzRef} x={a.imagenFocoX} y={a.imagenFocoY} onMover={moverFoco}
            onSoltar={() => setAttrs({ imagenFocoX: focoActual.current.x, imagenFocoY: focoActual.current.y })} onListo={() => setFoco(false)} />
        </div>
      )}

      {editable && (
        <>
          {/* La columna de Gamma 5, por fuera del módulo a la izquierda */}
          <div className="gma gmc gmc-lado" contentEditable={false} suppressContentEditableWarning data-abierto={panel ? '' : undefined}>
            <button
              ref={asaRef}
              type="button"
              className="gmc-btn"
              data-asa=""
              title={`Opciones · arrastra para reordenar las ${terminoTarjeta(ctx?.config ?? {}, { plural: true })}`}
              aria-label={`Opciones de la ${uno}`}
              aria-haspopup="menu"
              aria-expanded={panel?.tipo === 'menu'}
              onMouseDown={sinRobarFoco}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                const desde = indiceActual();
                if (desde < 0) return;
                gesto.current = { x: e.clientX, y: e.clientY, arrastrando: false, desde, destino: desde, yPuntero: e.clientY, raf: 0, linea: null, scroll: window };
                try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura, el gesto sigue igual */ }
              }}
              onPointerMove={(e) => {
                const g = gesto.current;
                if (!g) return;
                g.yPuntero = e.clientY;
                if (!g.arrastrando) {
                  if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 6) return;
                  g.arrastrando = true;
                  setPanel(null);
                  const linea = document.createElement('div');
                  linea.className = 'gmc-indicador';
                  document.body.appendChild(linea);
                  g.linea = linea;
                  g.scroll = contenedorConScroll(editor.view.dom as HTMLElement);
                  fondoRef.current?.parentElement?.setAttribute('data-arrastrando', 'si');
                  document.body.style.cursor = 'grabbing';
                  g.raf = requestAnimationFrame(autoScroll);
                }
                ubicarLinea();
              }}
              onPointerUp={(e) => {
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ya no la tenía */ }
                terminarArrastre(true);
              }}
              onPointerCancel={() => terminarArrastre(false)}
              onLostPointerCapture={() => { if (gesto.current?.arrastrando) terminarArrastre(true); else gesto.current = null; }}
              onClick={(e) => {
                // Después de un arrastre, el clic que el navegador manda al soltar no abre el menú.
                if (trasArrastre.current) { trasArrastre.current = false; return; }
                abrir('menu', e.currentTarget);
              }}
            >
              <Ico n="puntos-vertical" />
            </button>
            <button type="button" className="gmc-btn" title="Ask Agent" aria-label="Editar la sección con IA" aria-expanded={panel?.tipo === 'agente' && panel.modo === 'editar'}
              onMouseDown={sinRobarFoco} onClick={(e) => abrir('agente', e.currentTarget, 'editar')}>
              <Ico n="destellos" />
            </button>
            <button type="button" className="gmc-btn" title="Notas del orador" aria-label="Notas del orador" aria-expanded={panel?.tipo === 'notas'}
              data-con-notas={a.notas ? '' : undefined} onMouseDown={sinRobarFoco} onClick={(e) => abrir('notas', e.currentTarget)}>
              <Ico n="notas" />
            </button>
          </div>

          {/* El «+» del hueco de arriba: una sección en blanco ACÁ */}
          <div className="gma gmc gmc-entre" contentEditable={false} suppressContentEditableWarning>
            <button type="button" title="Agregar sección" aria-label="Agregar sección" onMouseDown={sinRobarFoco}
              onClick={() => { const i = indiceActual(); if (i >= 0) insertarTarjetaEn(editor, i); }}>
              <Ico n="mas" />
            </button>
          </div>

          {/* Debajo de la activa: [ + | ✨ | ▾ ] */}
          {activa && (
            <div className="gma gmc gmc-mini" contentEditable={false} suppressContentEditableWarning>
              <button type="button" title="Agregar sección" aria-label="Agregar sección" onMouseDown={sinRobarFoco}
                onClick={() => { const i = indiceActual(); if (i >= 0) insertarTarjetaEn(editor, i + 1); }}>
                <Ico n="mas" />
              </button>
              <button type="button" title="Agregar sección con IA" aria-label="Agregar sección con IA" aria-expanded={panel?.tipo === 'agente' && panel.modo === 'agregar'}
                onMouseDown={sinRobarFoco} onClick={(e) => abrir('agente', e.currentTarget, 'agregar')}>
                <Ico n="destellos" />
              </button>
              <button type="button" title="Diseños" aria-label="Diseños de sección" aria-haspopup="menu" aria-expanded={panel?.tipo === 'disenos'}
                onMouseDown={sinRobarFoco} onClick={(e) => abrir('disenos', e.currentTarget)}>
                <Ico n="chevron-abajo" />
              </button>
            </div>
          )}
        </>
      )}

      {a.oculta && (
        <div className="gma gmc gmc-oculta" contentEditable={false} suppressContentEditableWarning><Ico n="ojo-tachado" /> Oculta</div>
      )}

      {/* ── Los paneles ── */}
      {panel?.tipo === 'menu' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrarPanel} etiqueta={Uno} lado="derecha" rol="menu" ancho={248}>
          <div className="gmc-menu-titulo">{Uno}</div>
          <FilaMenu icono="copiar" texto="Copiar" onClick={desdeMenu(copiar)} />
          <FilaMenu icono="duplicar" texto={`Duplicar ${uno}`} onClick={desdeMenu(() => { duplicarTarjeta(editor, id); })} />
          <FilaMenu icono="flecha-arriba" texto="Combinar con lo anterior" apagado={iMenu <= 0} onClick={desdeMenu(() => { combinarConAnterior(editor, id); })} />
          <SepMenu />
          <FilaMenu icono="paleta" texto="Cambiar el color de fondo" onClick={() => setPanel({ tipo: 'estilo', ancla: asaRef.current ?? panel.ancla })} />
          <FilaMenu icono="diseno" texto={`Editar estilo de ${uno}`} onClick={() => setPanel({ tipo: 'estilo', ancla: asaRef.current ?? panel.ancla })} />
          <FilaMenu icono="refrescar" texto="Restablecer estilo" onClick={desdeMenu(() => setAttrs(ESTILO_RESTABLECIDO))} />
          <FilaMenu icono="notas" texto="Notas del orador" onClick={() => setPanel({ tipo: 'notas', ancla: asaRef.current ?? panel.ancla })} />
          <FilaMenu icono="enlace" texto="Copiar enlace" onClick={desdeMenu(copiarEnlace)} />
          <SepMenu />
          <FilaMenu icono="chevron-arriba" texto="Mover arriba" apagado={iMenu <= 0} onClick={desdeMenu(() => { moverTarjeta(editor, iMenu, iMenu - 1); })} />
          <FilaMenu icono="chevron-abajo" texto="Mover abajo" apagado={iMenu < 0 || iMenu >= n - 1} onClick={desdeMenu(() => { moverTarjeta(editor, iMenu, iMenu + 1); })} />
          <FilaMenu icono={a.oculta ? 'ojo' : 'ojo-tachado'} texto={a.oculta ? 'Mostrar' : 'Ocultar'} onClick={desdeMenu(() => setAttrs({ oculta: !a.oculta }))} />
          <FilaMenu icono="varita" texto="Probar nuevo diseño" onClick={() => setPanel({ tipo: 'agente', ancla: asaRef.current ?? panel.ancla, modo: 'disenos' })} />
          <SepMenu />
          <FilaMenu icono={<IconoBorrar size={16} />} texto="Eliminar" peligro onClick={desdeMenu(eliminar)} />
        </Flotante>
      )}

      {panel?.tipo === 'notas' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrarPanel} etiqueta="Notas del orador" lado="derecha" ancho={320}>
          <PanelNotas valor={a.notas} onGuardar={(t) => setAttrs({ notas: t.slice(0, TOPES.notas) }, false)} />
        </Flotante>
      )}

      {panel?.tipo === 'disenos' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrarPanel} etiqueta="Diseños" rol="menu" ancho={280}>
          <div className="gmc-menu-titulo">Diseños</div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {DISENOS_SECCION.map((d) => (
              <FilaMenu key={d.id} icono={d.icono} texto={d.nombre} onClick={desdeMenu(() => { insertarDisenoSeccion(editor, d.crear(), id); })} />
            ))}
          </div>
        </Flotante>
      )}

      {panel?.tipo === 'estilo' && <EstiloSeccion tarjetaId={id} ancla={panel.ancla} onCerrar={cerrarPanel} />}
      {panel?.tipo === 'agente' && <AskAgent tarjetaId={id} ancla={panel.ancla} onCerrar={cerrarPanel} modo={panel.modo} />}
    </>
  );
}

/** La capa del punto de enfoque: se arrastra la cruz (o se hace clic donde va). */
function CapaFoco({ cruzRef, x, y, onMover, onSoltar, onListo }: {
  cruzRef: RefObject<HTMLDivElement | null>;
  x: number;
  y: number;
  onMover: (cx: number, cy: number) => void;
  onSoltar: () => void;
  onListo: () => void;
}) {
  const apretado = useRef(false);
  return (
    <div
      className="gmc-foco"
      role="slider"
      aria-label="Cambiar punto de enfoque"
      aria-valuetext={`${Math.round(x)}% ${Math.round(y)}%`}
      onPointerDown={(e) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
        apretado.current = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sigue igual */ }
        onMover(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (apretado.current) onMover(e.clientX, e.clientY); }}
      onPointerUp={(e) => {
        if (!apretado.current) return;
        apretado.current = false;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ya no la tenía */ }
        onSoltar();
      }}
    >
      <div ref={cruzRef} className="gmc-foco-cruz" style={{ left: `${x}%`, top: `${y}%` }} />
      <button type="button" className="gmc-foco-listo" onMouseDown={sinRobarFoco} onClick={onListo}>Listo</button>
    </div>
  );
}

/**
 * Las notas del orador: un texto simple sobre el atributo `notas`. Se guarda con un respiro
 * (no una transacción por tecla) y al cerrar se manda lo pendiente: si no, lo escrito en el
 * último medio segundo se perdía al cerrar el panel.
 */
function PanelNotas({ valor, onGuardar }: { valor: string; onGuardar: (t: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const pendiente = useRef<string | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardarRef = useRef(onGuardar);
  useEffect(() => { guardarRef.current = onGuardar; }, [onGuardar]);
  const mandar = () => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null; }
    if (pendiente.current !== null) { guardarRef.current(pendiente.current); pendiente.current = null; }
  };
  useEffect(() => () => mandar(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="gmc-notas">
      <div className="gmc-menu-titulo">Notas del orador</div>
      <textarea
        value={texto}
        maxLength={TOPES.notas}
        placeholder="Añadir notas…"
        aria-label="Notas del orador"
        autoFocus
        onChange={(e) => {
          setTexto(e.target.value);
          pendiente.current = e.target.value;
          if (reloj.current) clearTimeout(reloj.current);
          reloj.current = setTimeout(mandar, 400);
        }}
        onBlur={mandar}
      />
    </div>
  );
}
