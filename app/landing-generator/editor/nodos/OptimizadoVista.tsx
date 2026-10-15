'use client';

// =============================================================================
// OptimizadoVista — los «Diseños optimizados» de Gamma (smart layouts) en el editor
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma, que se pueda hacer
// todo lo que ahí se hace.» Un diseño optimizado es una lista de ítems (cajas, pasos,
// estadísticas, una línea de tiempo…) cuyo DIBUJO es sólo un atributo: «Cambiar
// diseño» cambia `variante` y el contenido no se toca (doc.ts). Con el cursor
// adentro aparece una barrita: Cambiar diseño (la grilla de miniaturas de las 52
// variantes, agrupadas con los nombres de Gamma), Columnas, Mostrar íconos y
// «Añadir elemento»; y para el ítem donde está el cursor: Ícono, Imagen, Valor (las
// estadísticas), Destacado (uno por vez) y Eliminar elemento.
//
// Dos NodeViews, y la razón de que sean distintos:
//   · `OptimizadoVista` (React, con NodeViewContent): el contenedor, con su barrita.
//     La forma pública (`.gm-optimizado[data-variante]…`) va en el contentDOM
//     (`useAtributosEnContenido`): la hoja de css.ts apunta `.gm-optimizado > .gm-item`
//     y `:nth-child`, y cualquier envoltorio de React entre los dos la rompe.
//   · `vistaItemOptimizado` (DOM, sin React): cada ítem. Su `dom` ES el `.gm-item` —un
//     NodeView de React le pondría otro envoltorio— y su `.gm-item-marca` (ícono,
//     imagen, valor) se dibuja con la misma forma que el render público
//     (specOptimizadoItem) y los íconos con `htmlDeIcono`. `ignoreMutation` deja a
//     ProseMirror leer sólo el cuerpo del ítem: si releyera la marca, la volvería a
//     dibujar sin el SVG y quedaría un bucle.
//   PEDIDO al paquete G1 (extensiones): `optimizado` → `ReactNodeViewRenderer(OptimizadoVista)`
//   y `optimizadoItem` → `addNodeView() { return vistaItemOptimizado; }`.
//
// Las miniaturas de «Cambiar diseño» son el render REAL (htmlDeTarjeta del paquete A con
// la hoja de css.ts, en el tema de la landing), no dibujos aparte: una variante nueva de
// OPTIMIZADOS aparece sola en la grilla y se ve como va a quedar. El test del paquete lee
// este fuente y comprueba que la grilla sale de OPTIMIZADOS sin filtro.
// =============================================================================

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { NodeViewContent, NodeViewWrapper, useEditorState, type ReactNodeViewProps } from '@tiptap/react';
import type { NodeViewRenderer } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { Node as NodoPM } from '@tiptap/pm/model';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from '../contexto';
import { EstilosG2, FilaMenu, Flotante, Icono, MenuFilas, noRobaFoco, useAtributosEnContenido } from '../BarraFormato';
import { SelectorIcono } from '../SelectorIcono';
import { specOptimizado, specOptimizadoItem } from '@/lib/editor-landing/especificacion';
import { htmlDeArbol, type AttrsArbol, type NodoArbol } from '@/lib/editor-landing/grafico-svg';
import { htmlDeIcono, htmlDeTarjeta } from '@/lib/editor-landing/render';
import {
  COLUMNAS_OPTIMIZADO, MAX_ITEMS_OPTIMIZADO, NODO, OPTIMIZADOS, tarjeta,
  type GrupoOptimizado, type JsonNodo, type VarianteOptimizado,
} from '@/lib/editor-landing/doc';
import type { Tema } from '@/lib/editor-landing/temas';

// ─────────────────────────────────────────────────────────────────────────────
// La grilla de «Cambiar diseño» (pura: la lee el test)
// ─────────────────────────────────────────────────────────────────────────────

export type GrupoDiseno = { grupo: GrupoOptimizado; variantes: { id: VarianteOptimizado; nombre: string }[] };

/** Las variantes de OPTIMIZADOS agrupadas por su grupo de Gamma, en el orden del catálogo. Todas, sin filtro. */
export function gruposDeDiseno(): GrupoDiseno[] {
  const grupos: GrupoDiseno[] = [];
  for (const o of OPTIMIZADOS) {
    let g = grupos.find((x) => x.grupo === o.grupo);
    if (!g) { g = { grupo: o.grupo, variantes: [] }; grupos.push(g); }
    g.variantes.push({ id: o.id, nombre: o.nombre });
  }
  return grupos;
}

/** Ancho de una miniatura: la tarjeta mide 64.5em, así que la escala es ancho / 64.5 (css.ts: `--gm-base`). */
const ANCHO_MINI = 156;
const ICONOS_MINI = ['rayo', 'estrella', 'corazon', 'cohete'];

/** El HTML de una miniatura: una sección con el diseño y ítems de muestra, por el render público. */
export function htmlDeMiniatura(variante: VarianteOptimizado, tema: Tema): string {
  const grupo = OPTIMIZADOS.find((o) => o.id === variante)?.grupo;
  const cuantos = grupo === 'Comparación' ? 2 : grupo === 'Imágenes' || grupo === 'Personas' ? 4 : 3;
  const valores = ['75%', '40%', '90%', '4.8'];
  const items: JsonNodo[] = Array.from({ length: cuantos }, (_, k) => ({
    type: NODO.optimizadoItem,
    attrs: { icono: ICONOS_MINI[k], imagenSrc: null, valor: grupo === 'Estadísticas' ? valores[k] : '', destacado: variante === 'metrica-destacada' && k === 0 },
    content: [
      { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Título' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Una idea corta' }] },
    ],
  }));
  const t = tarjeta([{ type: NODO.optimizado, attrs: { variante, columnas: 'auto', mostrarIconos: true }, content: items }], { id: 'mini' });
  // Sin MARCADORES (render.ts) a propósito: es una muestra del diseño optimizado con ítems de
  // ejemplo, sin insertados; pedirlos no cambiaría nada de lo que se dibuja.
  return htmlDeTarjeta(t, tema, { modo: 'miniatura' });
}

// ─────────────────────────────────────────────────────────────────────────────
// El ítem (NodeView de DOM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dibuja `.gm-item` y su marca desde specOptimizadoItem (la misma forma que el render público).
 * Tanda 6 (14/10/2026), Martín: «los [] que el usuario debe completar, se queden como de otro color o algo
 * diferencial». La cifra del ítem («[00]%», «[$000]») es el atributo `valor`, no texto del documento: la
 * decoración del editor (extensiones/completar.ts) no la ve, así que la marca la pide ACÁ (`completar`).
 * Sólo en el NodeView: `renderHTML` (getHTML, lo que se guarda y se publica) sigue sin la marca.
 */
function pintarItem(dom: HTMLElement, marca: HTMLElement, attrs: Record<string, unknown>): void {
  const arbol = specOptimizadoItem(attrs, { completar: true });
  const a = arbol[1] as AttrsArbol;
  dom.className = a.class ?? 'gm-item';
  if (a['data-destacado']) dom.setAttribute('data-destacado', a['data-destacado']); else dom.removeAttribute('data-destacado');
  if (a.style) dom.setAttribute('style', a.style); else dom.removeAttribute('style');
  const tmp = document.createElement('div');
  tmp.innerHTML = htmlDeArbol(arbol[2] as NodoArbol);
  marca.innerHTML = tmp.firstElementChild?.innerHTML ?? '';
  marca.querySelectorAll<HTMLElement>('[data-icono]').forEach((s) => { s.innerHTML = htmlDeIcono(s.getAttribute('data-icono') ?? ''); });
}

/**
 * NodeView del ítem de un diseño optimizado. Su `dom` ES el `.gm-item` (hijo directo del
 * contentDOM del contenedor), el `.gm-item-cuerpo` es el contentDOM, y la marca no es editable.
 */
export const vistaItemOptimizado: NodeViewRenderer = ({ node }) => {
  let actual: NodoPM = node;
  const dom = document.createElement('div');
  const marca = document.createElement('div');
  const cuerpo = document.createElement('div');
  marca.className = 'gm-item-marca';
  marca.contentEditable = 'false';
  cuerpo.className = 'gm-item-cuerpo';
  dom.append(marca, cuerpo);
  pintarItem(dom, marca, actual.attrs);
  return {
    dom,
    contentDOM: cuerpo,
    update(n) {
      if (n.type !== actual.type) return false;
      if (n.attrs !== actual.attrs) pintarItem(dom, marca, n.attrs);
      actual = n;
      return true;
    },
    // Lo único que ProseMirror tiene que leer es el cuerpo: la marca y los atributos son nuestros.
    ignoreMutation(m) {
      if (m.type === 'selection') return false;
      return !cuerpo.contains(m.target as Node);
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// El contenedor (NodeView de React)
// ─────────────────────────────────────────────────────────────────────────────

const NOMBRE_COLUMNAS: Record<(typeof COLUMNAS_OPTIMIZADO)[number], string> = {
  auto: 'Automático', '1': '1 columna', '2': '2 columnas', '3': '3 columnas', '4': '4 columnas', '5': '5 columnas', '6': '6 columnas',
};

const CSS_OPT: string = [
  '.gmx-disenos{display:flex;flex-direction:column}',
  '.gmx-disenos-grilla{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:2px 4px 8px}',
  '.gmx-diseno{display:flex;flex-direction:column;gap:6px;padding:6px;border:1px solid var(--gmx-borde);border-radius:10px;background:var(--gmx-fondo);cursor:pointer;text-align:left}',
  '.gmx-diseno:hover{border-color:var(--gmx-azul-borde);box-shadow:var(--gmx-sombra-sm)}',
  '.gmx-diseno[aria-pressed="true"]{border:2px solid var(--gmx-anillo);padding:5px}',
  '.gmx-mini{position:relative;height:84px;border-radius:6px;overflow:hidden;pointer-events:none;background:var(--gmx-fondo-2)}',
  '.gmx-diseno-nombre{font-size:12px;font-weight:600;line-height:1.25;color:var(--gmx-texto)}',
  '.gmx-valor{display:flex;flex-direction:column;gap:6px;padding:4px}',
].join('\n');

type PanelOpt = { tipo: 'disenos' | 'columnas' | 'icono' | 'imagen' | 'valor'; ancla: HTMLElement };

export function OptimizadoVista(props: ReactNodeViewProps) {
  const { node, editor, getPos, selected, selectionInside, updateAttributes } = props;
  const ctx = useEditorLanding();
  const caja = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<PanelOpt | null>(null);
  const forma = specOptimizado(node.attrs)[1] as AttrsArbol;
  useAtributosEnContenido(caja, forma);

  // El ítem donde está el cursor (su posición, su índice y sus atributos).
  const item = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const base = getPos();
      if (!e || typeof base !== 'number') return null;
      const { $from } = e.state.selection;
      for (let d = $from.depth; d >= 2; d--) {
        if ($from.node(d).type.name !== NODO.optimizadoItem) continue;
        if ($from.before(d - 1) !== base) return null;
        const n = $from.node(d);
        return { pos: $from.before(d), indice: $from.index(d - 1), icono: (n.attrs.icono as string | null) ?? null, imagenSrc: (n.attrs.imagenSrc as string | null) ?? null, valor: String(n.attrs.valor ?? ''), destacado: !!n.attrs.destacado };
      }
      return null;
    },
  });
  const activo = (selected || !!selectionInside || !!panel) && editor.isEditable;
  const grupos = useMemo(() => gruposDeDiseno(), []);
  const minis = useMemo(() => (panel?.tipo === 'disenos' ? new Map(OPTIMIZADOS.map((o) => [o.id, htmlDeMiniatura(o.id, ctx.tema)])) : null), [panel?.tipo, ctx.tema]);

  const abrir = (tipo: PanelOpt['tipo'], ancla: HTMLElement) => setPanel((p) => (p && p.tipo === tipo ? null : { tipo, ancla }));
  const cerrar = () => setPanel(null);

  const ponerEnItem = (cambio: Record<string, unknown>) => {
    const pos = item?.pos;
    if (pos == null) return;
    editor.chain().command(({ tr }) => {
      const n = tr.doc.nodeAt(pos);
      if (!n || n.type.name !== NODO.optimizadoItem) return false;
      tr.setNodeMarkup(pos, undefined, { ...n.attrs, ...cambio });
      return true;
    }).run();
  };

  /** «Destacado» va de a uno: prender uno apaga los demás, en una sola transacción. */
  const destacar = () => {
    const base = getPos();
    if (typeof base !== 'number' || !item) return;
    editor.chain().command(({ tr }) => {
      const opt = tr.doc.nodeAt(base);
      if (!opt) return false;
      opt.forEach((it, off, idx) => {
        const nuevo = idx === item.indice ? !it.attrs.destacado : false;
        if (!!it.attrs.destacado !== nuevo) tr.setNodeMarkup(base + 1 + off, undefined, { ...it.attrs, destacado: nuevo });
      });
      return true;
    }).run();
  };

  /** Un ítem nuevo al final, con la misma estructura que el último (sus títulos y párrafos, vacíos). */
  const agregar = () => {
    const base = getPos();
    const tipoItem = editor.schema.nodes[NODO.optimizadoItem];
    if (typeof base !== 'number' || !tipoItem || node.childCount >= MAX_ITEMS_OPTIMIZADO) return;
    const ultimo = node.lastChild;
    const hijos: NodoPM[] = [];
    ultimo?.forEach((c) => { if (c.isTextblock) hijos.push(c.type.create(c.attrs)); });
    const attrs = { ...(ultimo?.attrs ?? {}), imagenSrc: null, valor: '', destacado: false };
    const nuevo = tipoItem.createAndFill(attrs, hijos.length ? hijos : undefined) ?? tipoItem.createAndFill(attrs);
    if (!nuevo) return;
    const donde = base + node.nodeSize - 1;
    editor.chain().focus().command(({ tr }) => {
      tr.insert(donde, nuevo);
      tr.setSelection(TextSelection.near(tr.doc.resolve(donde + 2)));
      return true;
    }).run();
  };

  const eliminarItem = () => {
    if (!item || node.childCount <= 1) return;
    const pos = item.pos;
    editor.chain().focus().command(({ tr }) => {
      const n = tr.doc.nodeAt(pos);
      if (!n) return false;
      tr.delete(pos, pos + n.nodeSize);
      return true;
    }).run();
  };

  const elegirImagen = async () => {
    cerrar();
    const url = await ctx.elegirImagen({ modo: 'imagen', sugerencia: node.textContent.slice(0, 80) });
    if (url) ponerEnItem({ imagenSrc: url });
  };

  const variante = String(node.attrs.variante ?? '');
  const nombreVariante = OPTIMIZADOS.find((o) => o.id === variante)?.nombre ?? 'Diseño';

  return (
    <NodeViewWrapper className="gmx-nv" data-activo={activo ? 'si' : undefined}>
      <EstilosG2 />
      <style href="gmx-opt" precedence="medium">{CSS_OPT}</style>
      {activo && (
        <div className="gmx gmx-nv-barra" contentEditable={false} onMouseDown={noRobaFoco}>
          <button type="button" className="gmx-btn" title="Cambiar diseño" aria-expanded={panel?.tipo === 'disenos'} onMouseDown={(e) => e.preventDefault()} onClick={(e) => abrir('disenos', e.currentTarget)}>
            <Icono nombre="diseno" /><span>{nombreVariante}</span><Icono nombre="chevron-abajo" tam={12} />
          </button>
          <button type="button" className="gmx-btn" title="Columnas" aria-expanded={panel?.tipo === 'columnas'} onMouseDown={(e) => e.preventDefault()} onClick={(e) => abrir('columnas', e.currentTarget)}>
            <Icono nombre="columnas-3" /><span>{NOMBRE_COLUMNAS[(node.attrs.columnas as (typeof COLUMNAS_OPTIMIZADO)[number]) ?? 'auto'] ?? 'Automático'}</span>
          </button>
          <button type="button" className="gmx-btn" title="Mostrar íconos" aria-pressed={!!node.attrs.mostrarIconos} onMouseDown={(e) => e.preventDefault()} onClick={() => updateAttributes({ mostrarIconos: !node.attrs.mostrarIconos })}>
            <Icono nombre="destellos" /><span>Íconos</span>
          </button>
          <button type="button" className="gmx-btn" title="Añadir elemento" disabled={node.childCount >= MAX_ITEMS_OPTIMIZADO} onMouseDown={(e) => e.preventDefault()} onClick={agregar}>
            <Icono nombre="mas" />
          </button>
          {item && (
            <>
              <span className="gmx-nv-sep" />
              <span className="gmx-nv-etq">Elemento {item.indice + 1}</span>
              <button type="button" className="gmx-btn" title="Ícono" aria-expanded={panel?.tipo === 'icono'} onMouseDown={(e) => e.preventDefault()} onClick={(e) => abrir('icono', e.currentTarget)}>
                <Icono nombre={item.icono || 'sonrisa'} />
              </button>
              <button type="button" className="gmx-btn" title="Imagen" aria-pressed={!!item.imagenSrc} aria-expanded={panel?.tipo === 'imagen'} onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { if (item.imagenSrc) abrir('imagen', e.currentTarget); else void elegirImagen(); }}>
                <Icono nombre="imagen" />
              </button>
              <button type="button" className="gmx-btn" title="Valor" aria-pressed={!!item.valor} aria-expanded={panel?.tipo === 'valor'} onMouseDown={(e) => e.preventDefault()} onClick={(e) => abrir('valor', e.currentTarget)}>
                <Icono nombre="porcentaje" />
              </button>
              <button type="button" className="gmx-btn" title="Destacado" aria-pressed={item.destacado} onMouseDown={(e) => e.preventDefault()} onClick={destacar}>
                <Icono nombre={item.destacado ? 'estrella-llena' : 'estrella'} />
              </button>
              <button type="button" className="gmx-btn" title="Eliminar elemento" aria-label="Eliminar elemento" disabled={node.childCount <= 1} onMouseDown={(e) => e.preventDefault()} onClick={eliminarItem}>
                <IconoBorrar size={16} />
              </button>
            </>
          )}
        </div>
      )}
      <div ref={caja} className="gmx-nv-marco"><NodeViewContent /></div>

      {panel?.tipo === 'disenos' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrar} etiqueta="Cambiar diseño" ancho={540}>
          <div className="gmx-disenos">
            {grupos.map((g) => (
              <div key={g.grupo}>
                <div className="gmx-grupo">{g.grupo}</div>
                <div className="gmx-disenos-grilla">
                  {g.variantes.map((v) => (
                    <button key={v.id} type="button" className="gmx-diseno" aria-pressed={v.id === variante} title={v.nombre}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => { updateAttributes({ variante: v.id }); }}>
                      <span className="gmx-mini" aria-hidden="true" style={{ ['--gm-base' as string]: (ANCHO_MINI / 64.5).toFixed(3) + 'px' } as CSSProperties}
                        dangerouslySetInnerHTML={{ __html: minis?.get(v.id) ?? '' }} />
                      <span className="gmx-diseno-nombre">{v.nombre}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Flotante>
      )}
      {panel?.tipo === 'columnas' && (
        <Flotante ancla={panel.ancla} onCerrar={cerrar} etiqueta="Columnas" ancho={200}>
          <MenuFilas etiqueta="Columnas">
            {COLUMNAS_OPTIMIZADO.map((c) => (
              <FilaMenu key={c} nombre={NOMBRE_COLUMNAS[c]} activo={(node.attrs.columnas ?? 'auto') === c ? true : undefined} onClick={() => { updateAttributes({ columnas: c }); cerrar(); }} />
            ))}
          </MenuFilas>
        </Flotante>
      )}
      {panel?.tipo === 'icono' && item && (
        <SelectorIcono ancla={panel.ancla} valor={item.icono} onCerrar={cerrar}
          onElegir={(n) => { ponerEnItem({ icono: n }); if (!node.attrs.mostrarIconos) updateAttributes({ mostrarIconos: true }); cerrar(); }}
          onQuitar={() => { ponerEnItem({ icono: null }); cerrar(); }} />
      )}
      {panel?.tipo === 'imagen' && item && (
        <Flotante ancla={panel.ancla} onCerrar={cerrar} etiqueta="Imagen" ancho={220}>
          <MenuFilas etiqueta="Imagen">
            <FilaMenu nombre="Reemplazar imagen" icono={<Icono nombre="imagen" />} onClick={() => { void elegirImagen(); }} />
            <FilaMenu nombre="Eliminar imagen" icono={<Icono nombre="cerrar" />} onClick={() => { ponerEnItem({ imagenSrc: null }); cerrar(); }} />
          </MenuFilas>
        </Flotante>
      )}
      {panel?.tipo === 'valor' && item && (
        <Flotante ancla={panel.ancla} onCerrar={cerrar} etiqueta="Valor" ancho={240}>
          <div className="gmx-valor">
            <span className="gmx-rotulo">Valor</span>
            <input className="gmx-campo" autoFocus defaultValue={item.valor} maxLength={40} placeholder="97%" aria-label="Valor"
              onChange={(e) => ponerEnItem({ valor: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); cerrar(); } }} />
            <span className="gmx-nota">Un número grande: 97%, 4.9, $1.200.</span>
          </div>
        </Flotante>
      )}
    </NodeViewWrapper>
  );
}

export default OptimizadoVista;
