'use client';

// =============================================================================
// TiraSecciones — la tira de secciones de Gamma (filmstrip), a la izquierda del lienzo
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Es la de gamma-ui.md §5.7:
// arriba el interruptor «Vista de tira de imágenes | Vista de lista» y la ✕ para cerrarla,
// la píldora «Agregar sección», y las miniaturas numeradas de cada sección (el número en un
// cuadradito blanco abajo a la izquierda; la activa con borde azul de 2 px #2c88f7 y fondo azul
// claro). Click lleva a la sección; se ARRASTRA para reordenar; el clic derecho abre el menú de
// la sección (Cortar, Copiar, Pegar debajo, Duplicar, Agregar sección debajo, Ocultar/Mostrar,
// Copiar enlace, Eliminar); Supr/Retroceso elimina y Ctrl+D duplica con la miniatura enfocada.
//
// LAS MINIATURAS son el HTML del renderizador único (`htmlDeTarjeta(…, { modo: 'miniatura' })`,
// lib/editor-landing/render.ts): lo que se ve en la tira es lo que se publica. Se dibujan a
// ancho de escritorio (640 px con --gm-base = 640/64.5, así la sección mide sus 64.5em) y se
// achican con transform: scale(k) — no con un --gm-base diminuto, que una letra mínima del
// navegador (ajuste de accesibilidad, locales asiáticos) agrandaría y descuadraría. Adentro de
// una capa escalada nada se puede tocar, así que la capa va `inert` y sin eventos (AGENTS.md,
// «Una medida en píxeles adentro de una capa con transform: scale(k)»).
//
// SE REDIBUJA SÓLO LO QUE CAMBIÓ. Los nodos de ProseMirror son inmutables y se COMPARTEN entre
// transacciones: una sección que no se tocó conserva el MISMO objeto. Así que el HTML se cachea
// por identidad de nodo (WeakMap) y cada tecla rehace sólo la sección donde se escribió, con un
// respiro de 350 ms. Un cambio de tema invalida todo (la clave lleva el id del tema).
//
// ⚠️ Los ids de DOM se sacan del HTML de la miniatura: `htmlDeTarjeta` emite `section#t-<id>`,
// el mismo id que lleva la sección del editor, y la tira está ANTES en el documento — un
// `getElementById('t-…')` encontraría la miniatura.
//
// EL ARRASTRE es con pointer events, no HTML5 drag-and-drop: acá no se transporta nada, se
// mueve un ítem dentro de una lista. `setPointerCapture` retargetea el `pointerup` al
// contenedor, así que el ítem se anota en el `pointerdown` (AGENTS.md, «el gesto de un lienzo»),
// y un clic que fue arrastre no dispara el click del ítem (el click cae en el contenedor).
// `useReordenar` lo usa también el panel de páginas.
// =============================================================================

import {
  memo, useCallback, useEffect, useLayoutEffect, useRef, useState,
  type KeyboardEvent as KeyboardEventReact, type MouseEvent as MouseEventReact, type PointerEvent as PointerEventReact,
} from 'react';
import type { Editor } from '@tiptap/react';
import type { Node as NodoPM } from '@tiptap/pm/model';
import { htmlDeTarjeta } from '@/lib/editor-landing/render';
import { nuevoId, tarjetaVacia, tituloDeTarjeta, type JsonNodo } from '@/lib/editor-landing/doc';
import type { Tema } from '@/lib/editor-landing/temas';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { useEditorLanding } from './contexto';
import { borrarTarjeta, duplicarTarjeta, moverTarjeta, seccionPorId, seccionesDe } from './insertar';
import { Ico, ItemMenu, Menu, SepMenu, useTeclaMod } from './MenuDocumento';

// ─────────────────────────────────────────────────────────────────────────────
// Puro: copiar una sección y decidir dónde cae un arrastre
// ─────────────────────────────────────────────────────────────────────────────
// Buscar, mover, duplicar y borrar secciones lo hace ./insertar (paquete G1): una sola
// implementación para la tira, el menú de cada sección y la IA.

/** La copia de una sección con un id NUEVO (pegar): dos secciones con el mismo id comparten
 *  anclas `#t-<id>` y comentarios. */
export function conIdNuevo(t: JsonNodo): JsonNodo {
  const copia = JSON.parse(JSON.stringify(t)) as JsonNodo;
  copia.attrs = { ...(copia.attrs ?? {}), id: nuevoId('t') };
  return copia;
}

/**
 * El índice donde se SUELTA, a partir de la mitad vertical de cada ítem: cuántas mitades quedan
 * por encima del puntero (0 = antes del primero, n = después del último).
 */
export function destinoDeArrastre(mitades: readonly number[], y: number): number {
  let k = 0;
  while (k < mitades.length && y > mitades[k]) k++;
  return k;
}

/** El índice final de un ítem que estaba en `de` y se suelta en la ranura `destino` (0..n). */
export function indiceFinal(de: number, destino: number): number {
  return destino > de ? destino - 1 : destino;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reordenar una lista vertical con el puntero (la tira y el panel de páginas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los ítems llevan `data-indice={i}`; lo que no debe empezar un arrastre (un botón ⋯, un campo)
 * lleva `data-sin-arrastre`. Devuelve los handlers del contenedor (que tiene que tener
 * `position: relative` y ser el que scrollea), el ítem que se arrastra y dónde va la marca.
 */
export function useReordenar(onMover: (de: number, a: number) => void) {
  const contRef = useRef<HTMLDivElement | null>(null);
  const gesto = useRef<{ de: number; y0: number; activo: boolean; id: number; destino: number } | null>(null);
  const recienArrastro = useRef(false);
  const [arrastre, setArrastre] = useState<{ de: number; destino: number; marca: number } | null>(null);
  const onMoverRef = useRef(onMover);
  onMoverRef.current = onMover;

  const items = () => Array.from(contRef.current?.querySelectorAll<HTMLElement>(':scope > [data-indice]') ?? []);

  const onPointerDown = useCallback((e: PointerEventReact<HTMLDivElement>) => {
    if (e.button !== 0 || !contRef.current) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-sin-arrastre]')) return;
    const item = t.closest<HTMLElement>('[data-indice]');
    if (!item || item.parentElement !== contRef.current) return;
    gesto.current = { de: Number(item.dataset.indice), y0: e.clientY, activo: false, id: e.pointerId, destino: -1 };
  }, []);

  const onPointerMove = useCallback((e: PointerEventReact<HTMLDivElement>) => {
    const g = gesto.current;
    const cont = contRef.current;
    if (!g || !cont) return;
    if (!g.activo) {
      if (Math.abs(e.clientY - g.y0) < 5) return;
      g.activo = true;
      try { cont.setPointerCapture(g.id); } catch { /* el puntero ya no existe */ }
    }
    // Auto-scroll cerca de los bordes: con pointer events el navegador sigue entregando
    // `pointermove` (a diferencia del drag-and-drop nativo, que congela los timers).
    const caja = cont.getBoundingClientRect();
    if (e.clientY < caja.top + 28) cont.scrollTop -= 14;
    else if (e.clientY > caja.bottom - 28) cont.scrollTop += 14;
    const lista = items();
    const mitades = lista.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
    const destino = destinoDeArrastre(mitades, e.clientY);
    if (destino === g.destino) return;
    g.destino = destino;
    const ref = lista[destino] ?? lista[lista.length - 1];
    const marca = ref ? (destino < lista.length ? ref.offsetTop : ref.offsetTop + ref.offsetHeight + 4) : 0;
    setArrastre({ de: g.de, destino, marca });
  }, []);

  const terminar = useCallback((soltar: boolean) => {
    const g = gesto.current;
    gesto.current = null;
    setArrastre(null);
    if (!g || !g.activo) return;
    try { contRef.current?.releasePointerCapture(g.id); } catch { /* ya liberado */ }
    recienArrastro.current = true;
    window.setTimeout(() => { recienArrastro.current = false; }, 0);
    if (soltar && g.destino >= 0) {
      const fin = indiceFinal(g.de, g.destino);
      if (fin !== g.de) onMoverRef.current(g.de, fin);
    }
  }, []);

  const onPointerUp = useCallback(() => terminar(true), [terminar]);
  const onPointerCancel = useCallback(() => terminar(false), [terminar]);

  /** Un click que en realidad fue el final de un arrastre no cuenta como click. */
  const fueArrastre = useCallback(() => recienArrastro.current, []);

  return { contRef, arrastre, fueArrastre, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Miniaturas
// ─────────────────────────────────────────────────────────────────────────────

/** El ancho de escritorio al que se dibuja una miniatura antes de achicarla. */
const ANCHO_BASE = 640;
/** Tope de alto de una miniatura, en px: una sección muy larga no se come la tira. */
const ALTO_MAX = 180;

type ItemTira = { id: string; html: string; titulo: string; oculta: boolean };
type Cache = WeakMap<NodoPM, { tema: Tema; html: string; titulo: string }>;

/** El HTML de la miniatura, sin ids de DOM (ver la cabecera). */
function htmlDeMiniatura(json: JsonNodo, tema: Tema): string {
  return htmlDeTarjeta(json, tema, { modo: 'miniatura', incluirOcultas: true }).replace(/\sid="[^"]*"/g, '');
}

function leerItems(editor: Editor, tema: Tema, cache: Cache, previos: ItemTira[]): ItemTira[] {
  const out: ItemTira[] = [];
  for (const s of seccionesDe(editor.state.doc)) {
    let c = cache.get(s.nodo);
    if (!c || c.tema !== tema) {
      const json = s.nodo.toJSON() as JsonNodo;
      c = { tema, html: htmlDeMiniatura(json, tema), titulo: tituloDeTarjeta(json) };
      cache.set(s.nodo, c);
    }
    const oculta = s.nodo.attrs.oculta === true;
    const prev = previos[out.length];
    out.push(prev && prev.id === s.id && prev.html === c.html && prev.oculta === oculta && prev.titulo === c.titulo
      ? prev
      : { id: s.id, html: c.html, titulo: c.titulo, oculta });
  }
  return out.length === previos.length && out.every((x, i) => x === previos[i]) ? previos : out;
}

const Miniatura = memo(function Miniatura({ html }: { html: string }) {
  const cajaRef = useRef<HTMLDivElement | null>(null);
  const escalaRef = useRef<HTMLDivElement | null>(null);
  const [medida, setMedida] = useState<{ k: number; alto: number }>({ k: 0.17, alto: 64 });

  useLayoutEffect(() => {
    const caja = cajaRef.current;
    const escala = escalaRef.current;
    if (!caja || !escala) return;
    const medir = () => {
      const k = (caja.clientWidth || 108) / ANCHO_BASE;
      const alto = Math.min(ALTO_MAX, Math.max(24, Math.round(escala.offsetHeight * k)));
      setMedida((m) => (Math.abs(m.k - k) < 0.0005 && m.alto === alto ? m : { k, alto }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(escala);
    ro.observe(caja);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={cajaRef} className="gma-mini-caja" style={{ height: medida.alto }}>
      <div
        ref={escalaRef}
        className="gma-mini-escala"
        // --gm-base: la sección mide 64.5em = ANCHO_BASE. El ancho lo pone la clase.
        style={{ transform: `scale(${medida.k})`, ['--gm-base' as string]: `calc(${ANCHO_BASE}px / 64.5)` }}
        inert
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// La tira
// ─────────────────────────────────────────────────────────────────────────────

/** Lo copiado o cortado (vive mientras dure la pestaña: se pega también en otra landing). */
let portapapeles: JsonNodo | null = null;

const CLAVE_VISTA = 'gma.tira.vista';

export default function TiraSecciones({ revision, onCerrar }: {
  /** Sube cuando el armazón reemplaza el documento entero (cambio de página, recargar): esos
   *  reemplazos no emiten `update` y la tira no se enteraría. */
  revision: number;
  /** Ocultar la tira (el armazón dibuja el botón para volver a abrirla). */
  onCerrar: () => void;
}) {
  const ctx = useEditorLanding();
  const { editor, tema, tarjetaActiva, irATarjeta, insertarTarjetas, avisar, urlPublica, paginas, paginaActual } = ctx;
  const mod = useTeclaMod();
  const [items, setItems] = useState<ItemTira[]>([]);
  const [vista, setVista] = useState<'miniaturas' | 'lista'>('miniaturas');
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const cacheRef = useRef<Cache>(new WeakMap());
  const paginaRef = useRef(paginaActual);
  paginaRef.current = paginaActual;

  // La vista es una PREFERENCIA de quien mira: se restaura del navegador, y si no se puede leer
  // (ventana privada, almacenamiento bloqueado) queda la de siempre.
  useEffect(() => {
    try { if (localStorage.getItem(CLAVE_VISTA) === 'lista') setVista('lista'); } catch { /* sin almacenamiento */ }
  }, []);
  const cambiarVista = (v: 'miniaturas' | 'lista') => {
    setVista(v);
    try { localStorage.setItem(CLAVE_VISTA, v); } catch { /* sin almacenamiento */ }
  };

  // Leer las secciones: al montar, al cambiar el tema o el documento entero, y con un respiro
  // de 350 ms después de cada cambio.
  useEffect(() => {
    if (!editor) return;
    let t: number | null = null;
    const leer = () => {
      t = null;
      if (editor.isDestroyed) return;
      setItems((prev) => leerItems(editor, tema, cacheRef.current, prev));
    };
    leer();
    const programar = () => { if (t == null) t = window.setTimeout(leer, 350); };
    editor.on('update', programar);
    return () => { editor.off('update', programar); if (t != null) clearTimeout(t); };
  }, [editor, tema, revision]);

  const { contRef, arrastre, fueArrastre, handlers } = useReordenar((de, a) => {
    if (editor && moverTarjeta(editor, de, a)) avisar('Sección movida');
  });

  // ── Acciones sobre una sección ──
  const buscar = (id: string) => (editor ? seccionPorId(editor.state.doc, id) : null);

  // Borrar devuelve su deshacer (la MISMA sección, con su id: los comentarios le apuntan), y
  // si es la única queda una en blanco en su lugar (`doc: tarjeta+`). Si la persona cambió de
  // página antes de apretar «Deshacer», no se toca la otra página.
  const eliminar = (id: string) => {
    if (!editor || !buscar(id)) return;
    const pagina = paginaRef.current;
    const deshacer = borrarTarjeta(editor, id);
    avisar('Sección eliminada', () => { if (paginaRef.current === pagina) deshacer(); });
  };

  const duplicar = (id: string) => {
    if (editor && buscar(id)) duplicarTarjeta(editor, id);
  };

  const copiar = (id: string, avisarlo = true) => {
    const s = buscar(id);
    if (!s) return;
    portapapeles = s.nodo.toJSON() as JsonNodo;
    if (avisarlo) avisar('Sección copiada');
  };

  const pegar = (id: string) => {
    if (portapapeles) insertarTarjetas([conIdNuevo(portapapeles)], id);
  };

  const alternarOculta = (id: string) => {
    if (!editor) return;
    const s = buscar(id);
    if (!s) return;
    const oculta = s.nodo.attrs.oculta === true;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(s.pos, undefined, { ...s.nodo.attrs, oculta: !oculta }));
    avisar(oculta ? 'Sección visible' : 'Sección oculta');
  };

  const pagina = paginas.find((p) => p.id === paginaActual);
  const enlaceDe = (id: string) => (urlPublica ? `${urlPublica.replace(/\/$/, '')}${pagina?.ruta ? `/${pagina.ruta}` : ''}#t-${id}` : null);
  const copiarEnlace = (id: string) => {
    const url = enlaceDe(id);
    if (!url) return;
    void navigator.clipboard?.writeText(url).then(() => avisar('Enlace copiado'), () => avisar('No se pudo copiar el enlace'));
  };

  const teclas = (e: KeyboardEventReact<HTMLElement>, id: string, i: number) => {
    const conMod = e.metaKey || e.ctrlKey;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irATarjeta(id); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); eliminar(id); return; }
    if (conMod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicar(id); return; }
    if (conMod && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); copiar(id); return; }
    if (conMod && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); copiar(id, false); eliminar(id); return; }
    if (conMod && (e.key === 'v' || e.key === 'V') && portapapeles) { e.preventDefault(); pegar(id); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const lista = contRef.current?.querySelectorAll<HTMLElement>(':scope > [data-indice]');
      lista?.[e.key === 'ArrowDown' ? Math.min(i + 1, lista.length - 1) : Math.max(i - 1, 0)]?.focus();
    }
  };

  const abrirMenu = (e: MouseEventReact, id: string) => {
    e.preventDefault();
    setMenu({ id, x: e.clientX, y: e.clientY });
  };

  const itemMenu = menu ? items.find((x) => x.id === menu.id) : null;

  return (
    <div className="gma-tira" data-vista={vista} aria-label="Secciones">
      <div className="gma-tira-cabeza">
        <button type="button" className="gma-herr-boton gma-tip" data-tip="Vista de tira de imágenes" aria-label="Vista de tira de imágenes"
          aria-pressed={vista === 'miniaturas'} onClick={() => cambiarVista('miniaturas')}>
          <Ico n="diseno" t={14} />
        </button>
        <button type="button" className="gma-herr-boton gma-tip" data-tip="Vista de lista" aria-label="Vista de lista"
          aria-pressed={vista === 'lista'} onClick={() => cambiarVista('lista')}>
          <Ico n="lista" t={14} />
        </button>
        <span className="gma-tira-cabeza-sep" />
        <button type="button" className="gma-herr-boton gma-tip" data-tip="Cerrar tira de diapositivas" aria-label="Cerrar tira de diapositivas" onClick={onCerrar}>
          <Ico n="cerrar" t={14} />
        </button>
      </div>
      <button type="button" className="gma-tira-agregar" onClick={() => insertarTarjetas([tarjetaVacia()], tarjetaActiva)}>
        <Ico n="mas" t={12} /> Agregar sección
      </button>
      <div ref={contRef} className="gma-tira-lista" {...handlers}>
        {items.map((it, i) => (vista === 'miniaturas' ? (
          <div
            key={it.id || i}
            data-indice={i}
            role="button"
            tabIndex={0}
            className="gma-mini"
            aria-label={`Sección ${i + 1}${it.titulo ? `: ${it.titulo}` : ''}`}
            data-activa={it.id === tarjetaActiva ? 'si' : undefined}
            data-oculta={it.oculta ? 'si' : undefined}
            data-arrastrando={arrastre?.de === i ? 'si' : undefined}
            onClick={() => { if (!fueArrastre()) irATarjeta(it.id); }}
            onContextMenu={(e) => abrirMenu(e, it.id)}
            onKeyDown={(e) => teclas(e, it.id, i)}
          >
            <Miniatura html={it.html} />
            <span className="gma-mini-num">{i + 1}</span>
            {it.oculta ? <span className="gma-mini-oculta"><Ico n="ojo-tachado" t={11} /></span> : null}
          </div>
        ) : (
          <div
            key={it.id || i}
            data-indice={i}
            role="button"
            tabIndex={0}
            className="gma-fila-lista"
            data-activa={it.id === tarjetaActiva ? 'si' : undefined}
            data-oculta={it.oculta ? 'si' : undefined}
            onClick={() => { if (!fueArrastre()) irATarjeta(it.id); }}
            onContextMenu={(e) => abrirMenu(e, it.id)}
            onKeyDown={(e) => teclas(e, it.id, i)}
          >
            <span className="gma-fila-num">{i + 1}</span>
            <span className="gma-fila-titulo">{it.titulo || 'Sin título'}</span>
          </div>
        )))}
        {arrastre ? <div className="gma-marca-destino" style={{ top: arrastre.marca }} /> : null}
      </div>

      {menu && itemMenu ? (
        <Menu ancla={menu} onCerrar={() => setMenu(null)} etiqueta="Menú de la sección" ancho={250}>
          <div className="gma-menu-cabeza">
            <div className="gma-menu-cabeza-titulo">{itemMenu.titulo || 'Sin título'}</div>
          </div>
          <ItemMenu icono="mover" texto="Cortar" atajo={`${mod}X`} onClick={() => { copiar(menu.id, false); eliminar(menu.id); }} />
          <ItemMenu icono="copiar" texto="Copiar" atajo={`${mod}C`} onClick={() => copiar(menu.id)} />
          {portapapeles ? <ItemMenu icono="pegar" texto="Pegar debajo" atajo={`${mod}V`} onClick={() => pegar(menu.id)} /> : null}
          <ItemMenu icono="duplicar" texto="Duplicar" atajo={`${mod}D`} onClick={() => duplicar(menu.id)} />
          <ItemMenu icono="mas" texto="Agregar sección debajo" onClick={() => insertarTarjetas([tarjetaVacia()], menu.id)} />
          <SepMenu />
          <ItemMenu icono={itemMenu.oculta ? 'ojo' : 'ojo-tachado'} texto={itemMenu.oculta ? 'Mostrar' : 'Ocultar'} onClick={() => alternarOculta(menu.id)} />
          {enlaceDe(menu.id) ? <ItemMenu icono="enlace" texto="Copiar enlace" onClick={() => copiarEnlace(menu.id)} /> : null}
          <SepMenu />
          <ItemMenu icono={<IconoBorrar size={16} />} texto="Eliminar" peligro atajo="Supr" onClick={() => eliminar(menu.id)} />
        </Menu>
      ) : null}
    </div>
  );
}
