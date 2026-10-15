'use client';

// =============================================================================
// MenuContextual — el CLIC DERECHO de la casa: un menú que abre en el punto del cursor
// =============================================================================
// Pedido de Martín (14/10/2026), textual: «E implementa el click derecho en todo el CRM para
// diferentes acciones dependiendo donde clickee...». La pieza es GENÉRICA a propósito: qué opciones
// salen lo decide cada pantalla (en el CRM, `opcionesCrm` de app/crm/menu-contextual-crm.ts, puro y
// con test); acá vive sólo CÓMO se abre, se ubica, se recorre con el teclado y se cierra.
//
// Moldes, y lo que se tomó de cada uno:
//   · app/dashboard/MenuContextual.tsx — las opciones las arma una función pura con test, y el menú
//     sólo las dibuja.
//   · el `Flotante` de app/web-generator/editor/MenuDocumento.tsx — portaleado al <body>,
//     REGISTRADO en la pila de modales como capa anidada, ubicado midiéndose después de montar
//     (el efecto depende del NODO, un state de ref callback, no de un ref fijo: con un portal la
//     primera corrida no encuentra nada y no vuelve a correr), y con opacidad 0 hasta ubicarse.
//   · el `MenuFlotante` de app/_components/Lienzo.tsx — el foco entra al primero, flechas, se
//     cierra con la rueda, al redimensionar y al perder la ventana. ⚠️ ESE NO SE REGISTRA EN LA
//     PILA, y es el defecto que acá no se copia: la ficha del lead (app/crm/LeadSheet.tsx) cierra
//     con Escape «SOLO si no hay nada encima» preguntándole a `profundidadModales()`. Un menú fuera
//     de la pila es «nada encima»: su Escape cerraba el menú Y la ficha de abajo.
//
// ⚠️ EL ESCAPE VA EN CAPTURA, SOBRE `document`, y frena con `stopImmediatePropagation` (no con
//    `stopPropagation`): todos los Escape de la casa viven en `document`/`window` y en captura, y
//    `stopPropagation` sólo frena la propagación a OTROS nodos, nunca a los otros listeners del mismo.
//    Y contesta sólo si es la capa de arriba (`esElDeArriba`, la nota de pila-modales.ts).
//
// ⚠️ UN CLIC DERECHO AFUERA NO CIERRA EN EL `pointerdown`: lo resuelve su `contextmenu`, que cierra
//    éste y deja que la pantalla abra el del lugar nuevo en el mismo gesto. Cerrando en el
//    `pointerdown`, el segundo clic derecho cerraba el menú y el `contextmenu` llegaba a una pantalla
//    a medio redibujar.
//
// Un renglón puede tener SUBMENÚ (`hijos`: «Mover a etapa ›») o ser una LÍNEA de botones sin rótulo
// (`enLinea`: las flechas ← → de una columna, el mismo pedido del «⋯»: «deberían ser 2 botones
// diferentes, solo que están en la misma linea», Martín, 30/09/2026). Un submenú largo trae buscador
// con el mismo umbral que el desplegable de la casa (`conBuscador`, app/components/dropdown-reglas.ts).
//
// ⚠️ LOS ESTILOS CON `:hover`/`:focus` VAN EN UN <style> PROPIO y no en app/_ui/ui.css, que es donde
//    los pide app/_ui/LEEME.md («Reglas de crecimiento», 3): ui.css no era de este cambio. Mudarlos es
//    una línea, y está anotado como pendiente.
// =============================================================================

import {
  Fragment, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { conBuscador } from '@/app/components/dropdown-reglas';
import { coincideBusqueda } from '@/lib/buscar-texto';
import { Avatar } from './Avatar';
import { IconoMenu, type NombreIconoMenu } from './iconos-menu';
import { SANS, radius, shadow, weight } from './tokens';

/** Un renglón del menú. `null` en la lista es un separador. */
export type ItemMenuContextual = {
  id: string;
  label: string;
  /** El ícono del set de la casa por NOMBRE (AGENTS.md: un desplegable lleva ícono), o un dibujo propio
   *  cuando el set no lo tiene (las flechas ← → de una columna). */
  icono?: NombreIconoMenu | ReactElement;
  /** Lo que nombra cada negocio (una etapa, una etiqueta) va con su COLOR, no con un ícono inventado. */
  color?: string;
  /** Una persona va con su avatar (la foto o sus iniciales). `null` = sin foto. */
  avatar?: string | null;
  /** Rojo: lo que borra. Va al final y separado (eso lo decide quien arma la lista). */
  peligro?: boolean;
  deshabilitado?: boolean;
  /** Submenú. Elegir un hijo llama a `onElegir(hijo.id, padre.id)`. */
  hijos?: ReadonlyArray<ItemMenuContextual>;
  /** Lo que dice el submenú vacío («Cargando…», «Sin etiquetas»). */
  vacio?: string;
  /** Una LÍNEA de botones sin rótulo: cada uno se anuncia por su `label`. El `id` de afuera es sólo la key. */
  enLinea?: ReadonlyArray<ItemMenuContextual>;
};
export type EntradaMenuContextual = ItemMenuContextual | null;

type Punto = { x: number; y: number };
const AIRE = 8;

/**
 * Dónde va una caja de `w`×`h` abierta en el punto (x, y) sin salirse de la ventana: si no entra a la
 * derecha abre hacia la izquierda del cursor, si no entra abajo abre hacia arriba, y nunca a menos de
 * 8 px del borde. Pura, para el test.
 */
export function ubicarEnVentana(x: number, y: number, w: number, h: number, vw: number, vh: number): Punto {
  const izq = x + w > vw - AIRE ? x - w : x;
  const arr = y + h > vh - AIRE ? y - h : y;
  return {
    x: Math.min(Math.max(AIRE, izq), Math.max(AIRE, vw - w - AIRE)),
    y: Math.min(Math.max(AIRE, arr), Math.max(AIRE, vh - h - AIRE)),
  };
}

/** El submenú: pegado a la derecha del renglón; si no entra, a su izquierda. Pura, para el test. */
export function ubicarSubmenu(r: { left: number; right: number; top: number }, w: number, h: number, vw: number, vh: number): Punto {
  const derecha = r.right - 4;
  return {
    x: derecha + w <= vw - AIRE ? derecha : Math.max(AIRE, r.left - w + 4),
    y: Math.min(Math.max(AIRE, r.top - 6), Math.max(AIRE, vh - h - AIRE)),
  };
}

/** Sin separadores al principio, al final ni dos seguidos: una raya que separa la nada se lee como un hueco roto. */
export function sinSeparadoresDeMas<T>(xs: ReadonlyArray<T | null>): Array<T | null> {
  const out: Array<T | null> = [];
  for (const x of xs) {
    if (x === null && (out.length === 0 || out[out.length - 1] === null)) continue;
    out.push(x);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/** A qué renglón va el foco con una flecha: da la vuelta en los dos extremos, y sin foco arranca del borde. */
export function siguienteFoco(actual: number, total: number, tecla: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'): number {
  if (total <= 0) return -1;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return total - 1;
  if (actual < 0) return tecla === 'ArrowDown' ? 0 : total - 1;
  return tecla === 'ArrowDown' ? (actual + 1) % total : (actual - 1 + total) % total;
}

const ESTILOS = '.mk-mctx__item{background:transparent}'
  + '.mk-mctx__item:hover:not(:disabled),.mk-mctx__item:focus,.mk-mctx__item[aria-expanded="true"]{background:var(--surface-2);outline:none}';

const PANEL: CSSProperties = {
  position: 'fixed', minWidth: 216, maxWidth: 320, padding: 5, borderRadius: radius.lg,
  background: 'var(--surface)', border: '1px solid var(--border-strong)', boxShadow: shadow.pop,
  fontFamily: SANS, overflowY: 'auto', maxHeight: 'calc(100vh - 16px)', outline: 'none',
};
const RENGLON: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px',
  borderRadius: radius.sm, border: 'none', fontFamily: SANS, fontSize: 13.5, fontWeight: weight.medium, color: 'var(--ink)', cursor: 'pointer',
};
const SEPARADOR: CSSProperties = { height: 1, background: 'var(--border)', margin: '4px 6px' };

const itemsDe = (panel: HTMLElement | null) =>
  [...(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];

/** El ícono de un renglón: avatar, punto de color, ícono del set o dibujo propio — en un lugar de 18 px. */
function Marca({ it }: { it: ItemMenuContextual }) {
  let dentro: ReactElement | null = null;
  if (it.avatar !== undefined) dentro = <Avatar name={it.label} url={it.avatar} size={18} />;
  else if (it.color) dentro = <span style={{ width: 9, height: 9, borderRadius: 999, background: it.color }} />;
  else if (typeof it.icono === 'string') dentro = <IconoMenu nombre={it.icono} size={17} />;
  else if (isValidElement(it.icono)) dentro = it.icono;
  return (
    <span aria-hidden style={{ width: 18, height: 18, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: it.peligro ? 'var(--bad)' : 'var(--dim)' }}>
      {dentro}
    </span>
  );
}

/**
 * Los renglones de un panel. Exportado para el test (se dibuja con `renderToStaticMarkup`): sin efectos,
 * sin portal. Lo usan el menú y su submenú.
 */
export function ListaMenuContextual({ items, padre = null, abierto = null, onElegir, onAbrir, onEncima }: {
  items: ReadonlyArray<EntradaMenuContextual>;
  /** El renglón del que sale esta lista (null = la raíz). */
  padre?: string | null;
  /** Qué submenú está abierto (para marcar su renglón). */
  abierto?: string | null;
  onElegir: (it: ItemMenuContextual, padre: string | null) => void;
  onAbrir?: (it: ItemMenuContextual, el: HTMLElement, teclado: boolean) => void;
  onEncima?: (it: ItemMenuContextual, el: HTMLElement) => void;
}) {
  return (
    <>
      {sinSeparadoresDeMas(items).map((it, k) => {
        if (!it) return <div key={`sep${k}`} role="separator" style={SEPARADOR} />;
        if (it.enLinea?.length) {
          return (
            <div key={it.id} role="group" aria-label={it.label} style={{ display: 'flex', gap: 4 }}
              onMouseEnter={(e) => onEncima?.(it, e.currentTarget)}>
              {it.enLinea.map((b) => (
                <button key={b.id} type="button" role="menuitem" className="mk-mctx__item" disabled={b.deshabilitado}
                  title={b.label} aria-label={b.label}
                  onClick={() => onElegir(b, padre)}
                  style={{ ...RENGLON, flex: 1, justifyContent: 'center', height: 34, padding: 0, color: 'var(--dim)', opacity: b.deshabilitado ? 0.45 : 1, cursor: b.deshabilitado ? 'default' : 'pointer' }}>
                  <Marca it={b} />
                </button>
              ))}
            </div>
          );
        }
        const conHijos = it.hijos !== undefined;
        return (
          <button key={it.id} type="button" role="menuitem" className="mk-mctx__item" disabled={it.deshabilitado}
            data-id={conHijos ? it.id : undefined}
            aria-haspopup={conHijos ? 'menu' : undefined}
            aria-expanded={conHijos ? abierto === it.id : undefined}
            onMouseEnter={(e) => onEncima?.(it, e.currentTarget)}
            // `detail === 0` es un «clic» que vino del teclado (Enter / Espacio): ahí el foco entra al submenú.
            onClick={(e) => (conHijos ? onAbrir?.(it, e.currentTarget, e.detail === 0) : onElegir(it, padre))}
            style={{ ...RENGLON, color: it.peligro ? 'var(--bad)' : 'var(--ink)', opacity: it.deshabilitado ? 0.45 : 1, cursor: it.deshabilitado ? 'default' : 'pointer' }}>
            <Marca it={it} />
            <span style={{ minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
            {conHijos && <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 15, lineHeight: 1 }}>›</span>}
          </button>
        );
      })}
    </>
  );
}

export function MenuContextual({ punto, items, onElegir, onCerrar, etiqueta = 'Acciones', titulo }: {
  /** Dónde se hizo el clic (coordenadas de la ventana). */
  punto: Punto;
  items: ReadonlyArray<EntradaMenuContextual>;
  /** Lo elegido; `padre` = el renglón del submenú de donde salió (null en la raíz). El menú ya se cerró. */
  onElegir: (id: string, padre: string | null) => void;
  onCerrar: () => void;
  etiqueta?: string;
  /** Una línea apagada arriba de todo («3 leads»): sobre QUÉ actúa el menú cuando no es obvio. */
  titulo?: string;
}) {
  // ⚠️ EN LA PILA, Y ANIDADA: no esconde lo de abajo (es parte de la misma pantalla), pero cuenta como
  // «algo encima» para el Escape de la ficha. Ver la cabecera.
  const { z, visible, esElDeArriba } = useCapaModal(true, { anidada: true });
  const [nodo, setNodo] = useState<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Punto | null>(null);
  const [sub, setSub] = useState<{ id: string; ancla: DOMRect; teclado: boolean } | null>(null);
  const [nodoSub, setNodoSub] = useState<HTMLDivElement | null>(null);
  const [posSub, setPosSub] = useState<Punto | null>(null);
  const [busca, setBusca] = useState('');

  // Los callbacks en refs, sincronizados en un efecto (no escritos durante el render): los listeners
  // del `document` viven todo el menú y tienen que llamar al de AHORA.
  const onCerrarRef = useRef(onCerrar);
  const onElegirRef = useRef(onElegir);
  useLayoutEffect(() => { onCerrarRef.current = onCerrar; onElegirRef.current = onElegir; });
  /** Lo que tenía el foco antes de abrir: vuelve ahí sólo si se cierra con Escape (al elegir, manda la acción). */
  const previo = useRef<HTMLElement | null>(null);
  useEffect(() => { previo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }, []);
  const cierreDiferido = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelarCierre = () => { if (cierreDiferido.current) { clearTimeout(cierreDiferido.current); cierreDiferido.current = null; } };
  useEffect(() => cancelarCierre, []);

  // Ubicarse en el punto, sin salirse de la ventana; y de nuevo si cambia de tamaño.
  // ⚠️ SIN TAMAÑO NO SE UBICA: el primer render sale con `display: none` (la capa todavía no está en la
  //    pila, `visible` da false), y medir ahí da 0×0 — un menú «ubicado» con tamaño cero se pinta un
  //    cuadro afuera de la ventana antes de corregirse. Se espera al ResizeObserver con el tamaño real.
  useLayoutEffect(() => {
    if (!nodo) return;
    const ubicar = () => {
      const r = nodo.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const p = ubicarEnVentana(punto.x, punto.y, r.width, r.height, window.innerWidth, window.innerHeight);
      setPos((q) => (q && Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5 ? q : p));
    };
    ubicar();
    const ro = new ResizeObserver(ubicar);
    ro.observe(nodo);
    return () => ro.disconnect();
  }, [nodo, punto.x, punto.y]);

  // El submenú, contra su renglón.
  useLayoutEffect(() => {
    if (!nodoSub || !sub) return;
    const ubicar = () => {
      const r = nodoSub.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const p = ubicarSubmenu(sub.ancla, r.width, r.height, window.innerWidth, window.innerHeight);
      setPosSub((q) => (q && Math.abs(q.x - p.x) < 0.5 && Math.abs(q.y - p.y) < 0.5 ? q : p));
    };
    ubicar();
    const ro = new ResizeObserver(ubicar);
    ro.observe(nodoSub);
    return () => ro.disconnect();
  }, [nodoSub, sub]);

  // El foco entra al primero una vez ubicado: con el menú abierto ya se elige con las flechas y Enter.
  const enfocado = useRef(false);
  useEffect(() => {
    if (!nodo || !pos || enfocado.current) return;
    enfocado.current = true;
    (itemsDe(nodo)[0] ?? nodo).focus({ preventScroll: true });
  }, [nodo, pos]);
  // Y al submenú abierto con el teclado (al buscador, si lo tiene). Una vez por apertura.
  const subEnfocado = useRef<string | null>(null);
  useEffect(() => {
    if (!nodoSub || !posSub || !sub?.teclado || subEnfocado.current === sub.id) return;
    subEnfocado.current = sub.id;
    (nodoSub.querySelector<HTMLElement>('input') ?? itemsDe(nodoSub)[0])?.focus({ preventScroll: true });
  }, [nodoSub, posSub, sub]);

  const abrirSub = useCallback((it: ItemMenuContextual, el: HTMLElement, teclado: boolean) => {
    cancelarCierre();
    subEnfocado.current = null;
    setBusca('');
    setPosSub(null);
    setSub({ id: it.id, ancla: el.getBoundingClientRect(), teclado });
  }, []);
  /** Cierra el submenú; con `volver`, el foco vuelve a su renglón. */
  const cerrarSub = useCallback((volver: boolean) => {
    const id = sub?.id;
    setSub(null);
    setPosSub(null);
    if (volver && id && nodo) {
      [...nodo.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]')].find((b) => b.dataset.id === id)?.focus({ preventScroll: true });
    }
  }, [sub, nodo]);

  const elegir = useCallback((it: ItemMenuContextual, padre: string | null) => {
    if (it.deshabilitado) return;
    onCerrarRef.current();
    onElegirRef.current(it.id, padre);
  }, []);

  /**
   * Pasar el cursor por la raíz: un renglón con submenú lo abre; uno sin submenú lo cierra, pero con
   * 200 ms de gracia — ir en diagonal desde «Mover a etapa ›» hasta su submenú cruza el renglón de abajo,
   * y cerrar en el acto lo hacía imposible de alcanzar con el mouse.
   */
  const encima = useCallback((it: ItemMenuContextual, el: HTMLElement) => {
    if (!it.enLinea) el.focus({ preventScroll: true });
    if (it.hijos !== undefined) {
      if (sub?.id !== it.id) abrirSub(it, el, false); else cancelarCierre();
      return;
    }
    if (!sub) return;
    cancelarCierre();
    cierreDiferido.current = setTimeout(() => { setSub(null); setPosSub(null); }, 200);
  }, [sub, abrirSub]);

  // Teclado, clic afuera, rueda, ventana: todo en `document` y en captura.
  useEffect(() => {
    if (!nodo) return;
    const adentro = (t: EventTarget | null) => t instanceof Node && (nodo.contains(t) || !!nodoSub?.contains(t));
    const tecla = (e: KeyboardEvent) => {
      if (!esElDeArriba()) return;
      const activo = document.activeElement as HTMLElement | null;
      const enSub = !!(nodoSub && activo && nodoSub.contains(activo));
      const enBuscador = activo instanceof HTMLInputElement && enSub;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (sub) { cerrarSub(true); return; }
        previo.current?.focus?.({ preventScroll: true });
        onCerrarRef.current();
        return;
      }
      if (e.key === 'Tab') { e.preventDefault(); onCerrarRef.current(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || ((e.key === 'Home' || e.key === 'End') && !enBuscador)) {
        const lista = itemsDe(enSub ? nodoSub : nodo);
        const i = siguienteFoco(enBuscador ? -1 : lista.indexOf(activo as HTMLElement), lista.length, e.key);
        if (i < 0) return;
        e.preventDefault();
        lista[i].focus({ preventScroll: true });
        return;
      }
      // Un `click()` de programa llega con `detail === 0`: el renglón lo toma como teclado y el foco entra.
      if (e.key === 'ArrowRight' && !enSub && activo?.getAttribute('aria-haspopup') === 'menu') {
        e.preventDefault();
        activo.click();
        return;
      }
      if (e.key === 'ArrowLeft' && enSub && !enBuscador) { e.preventDefault(); cerrarSub(true); return; }
      if (e.key === 'Enter' && enBuscador) {
        e.preventDefault();
        itemsDe(nodoSub)[0]?.click();
      }
    };
    const afuera = (e: PointerEvent) => {
      // Un clic derecho afuera lo resuelve su `contextmenu` (ver la cabecera). Ctrl+clic en Mac es un clic derecho.
      if (e.button === 2 || e.ctrlKey || adentro(e.target)) return;
      if (!esElDeArriba()) return;
      onCerrarRef.current();
    };
    const otroClicDerecho = (e: MouseEvent) => { if (!adentro(e.target)) onCerrarRef.current(); };
    const rueda = (e: WheelEvent) => { if (!adentro(e.target)) onCerrarRef.current(); };
    const cerrar = () => onCerrarRef.current();
    document.addEventListener('keydown', tecla, true);
    document.addEventListener('pointerdown', afuera, true);
    document.addEventListener('contextmenu', otroClicDerecho, true);
    document.addEventListener('wheel', rueda, { capture: true, passive: true });
    window.addEventListener('resize', cerrar);
    window.addEventListener('blur', cerrar);
    return () => {
      document.removeEventListener('keydown', tecla, true);
      document.removeEventListener('pointerdown', afuera, true);
      document.removeEventListener('contextmenu', otroClicDerecho, true);
      document.removeEventListener('wheel', rueda, { capture: true });
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('blur', cerrar);
    };
  }, [nodo, nodoSub, sub, esElDeArriba, cerrarSub]);

  if (typeof document === 'undefined') return null;
  const padre = sub ? items.find((x): x is ItemMenuContextual => !!x && x.id === sub.id) ?? null : null;
  const hijos = padre?.hijos ?? [];
  const buscador = conBuscador(hijos.length);
  const visibles = buscador && busca.trim() ? hijos.filter((h) => coincideBusqueda([h.label], busca)) : hijos;

  return createPortal(
    <>
      <style>{ESTILOS}</style>
      <div ref={setNodo} role="menu" aria-label={etiqueta} tabIndex={-1} data-menu-contextual=""
        onContextMenu={(e) => e.preventDefault()}
        onMouseEnter={cancelarCierre}
        style={{ ...PANEL, left: pos?.x ?? punto.x, top: pos?.y ?? punto.y, zIndex: z + 1, opacity: pos ? 1 : 0, display: visible ? undefined : 'none' }}>
        {titulo && (
          <div aria-hidden style={{ padding: '6px 10px 4px', fontSize: 12, fontWeight: 600, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
        )}
        <ListaMenuContextual items={items} abierto={sub?.id ?? null} onElegir={elegir} onEncima={encima}
          // Con el mouse, el submenú ya lo abrió el hover: el clic no lo cierra. Con el teclado, el foco entra.
          onAbrir={(it, el, teclado) => { if (sub?.id === it.id && !teclado) { cancelarCierre(); return; } abrirSub(it, el, teclado); }} />
      </div>
      {padre && (
        <div ref={setNodoSub} role="menu" aria-label={padre.label} tabIndex={-1} data-menu-contextual=""
          onContextMenu={(e) => e.preventDefault()}
          onMouseEnter={cancelarCierre}
          style={{ ...PANEL, maxHeight: 'min(380px, calc(100vh - 16px))', left: posSub?.x ?? 0, top: posSub?.y ?? 0, zIndex: z + 2, opacity: posSub ? 1 : 0, display: visible ? undefined : 'none' }}>
          {buscador && (
            <input className="mk-input" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar…" aria-label={`Buscar en ${padre.label}`}
              style={{ width: '100%', marginBottom: 4, boxSizing: 'border-box' }} />
          )}
          {visibles.length
            ? <ListaMenuContextual items={visibles} padre={padre.id} onElegir={elegir} />
            : <div style={{ ...RENGLON, cursor: 'default', color: 'var(--faint)' }}>{hijos.length ? 'Sin resultados' : padre.vacio ?? 'Nada para elegir'}</div>}
        </div>
      )}
    </>,
    document.body,
  );
}
