'use client';

// =============================================================================
// PanelFicha — la ficha del lead como panel que entra por la derecha
// =============================================================================
// Martín, 14/11/2026, mirando la grabación del CRM que se armó para la portada de las landings
// (public/vsl-assets/sitio/crm-ficha.webm, banco en C:/dev/bancos-portada/banco-crm): «Me gustó mucho cómo quedó el
// detail de los leads en el CRM… que ya no se vaya al modal sino que esté así como un desplegable a la derecha. Me gusta
// que esté de esa manera. Entonces apliquémoslo».
//
// Es la CARCASA: entra deslizándose, mide 560 y ocupa el alto entero, con su filete y su sombra a la izquierda. Lo de
// adentro es la ficha de siempre (app/crm/LeadSheet.tsx) o su esqueleto mientras carga (app/crm/LeadEditModal.tsx).
//
// ⚠️ NO ES UN MODAL, y eso cambia tres cosas respecto del pop-up de antes:
//   · el tablero sigue a la vista y se USA: no hay velo, ni scroll bloqueado, ni foco atrapado. Tocar otra tarjeta
//     (o una fila de la tabla) cambia la ficha SIN cerrar el panel: la carcasa no se desmonta, así que no vuelve a
//     entrar deslizándose; sólo cambia lo de adentro;
//   · tocar AFUERA la cierra, salvo lo que convive con ella (`TOCAR_SIN_CERRAR`);
//   · el Escape la cierra salvo que haya un diálogo encima (la pila, `profundidadModales`) o que estés escribiendo en
//     un campo: ahí el Escape es del campo. En el pop-up, Escape adentro del nombre cerraba la ficha entera.
//
// ⚠️ «ADENTRO» ES EL ÁRBOL DE REACT, NO EL DOM. Los diálogos de la ficha (mover de etapa, borrar, el selector de la
// cara, el AI Analyst de la izquierda) se dibujan por portal en el `body`: en el DOM están afuera del panel. El toque se
// marca en `onPointerDownCapture`, que sube por el árbol de React a través de los portales, y la escucha del documento
// (que corre DESPUÉS, en burbuja) lo lee. Con sólo `contains` del DOM, tocar «Mandar a la papelera» cerraba la ficha.
//
// ⚠️ SE MONTA UNA VEZ por apertura: quien la usa (LeadEditModal) la pone siempre en el mismo lugar del árbol, cargando
// o no, y cambia SÓLO a sus hijos. Si el esqueleto y la ficha fueran dos carcasas, cada tarjeta nueva la haría entrar
// otra vez desde afuera.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { profundidadModales } from '@/app/_components/pila-modales';
import { ANCHO_PANEL_FICHA, ENTRADA_PANEL_FICHA, PANEL_FICHA_PANTALLA_ENTERA } from './ficha-medidas';

/**
 * Lo que se toca AFUERA del panel sin cerrarlo:
 *  · un lead (la tarjeta del Kanban, la fila de la tabla: `data-lead-id`, CrmBoard): abre ESE lead en el mismo panel;
 *  · lo que lo pida con `data-ficha-sigue`;
 *  · MaKo (su estrella, su globo y su chat): sabe qué ficha está abierta (app/crm/lead-abierto.ts), y cerrarla al
 *    escribirle le sacaría de qué lead le hablas;
 *  · los avisos (`role` status o alert): el «Deshacer» de un aviso no es «salir de la ficha».
 */
export const TOCAR_SIN_CERRAR = '[data-lead-id],[data-ficha-sigue],[data-mako-chat],.ch-tab-mako,.ch-globo,[role="status"],[role="alert"]';

/** Cuánto tarda en irse: más rápido que la entrada, sin frenar (se va, no llega). */
export const SALIDA_PANEL_FICHA_MS = 220;

/**
 * ¿Un toque en `t` cierra el panel? `enElPanel`: el toque cayó adentro (en el árbol de React, portales incluidos).
 * `modalesEncima`: lo que hay en la pila; con un diálogo abierto, el toque es de ese diálogo.
 */
export function cierraAlTocar(t: Element | null, enElPanel: boolean, modalesEncima: number): boolean {
  if (enElPanel || modalesEncima > 0 || !t || !t.isConnected) return false;
  // La barra de scroll de la página: el toque cae en <html>, y no es «afuera» de nada.
  if (t === t.ownerDocument.documentElement) return false;
  return !t.closest(TOCAR_SIN_CERRAR);
}

/** ¿Este Escape es de un campo donde estás escribiendo? Ahí lo maneja el campo (cancelar), no el panel. */
export function escapeDeUnCampo(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const tipo = ((el as HTMLInputElement).type || 'text').toLowerCase();
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(tipo);
}

const sinMovimiento = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function PanelFicha({ etiqueta, onCerrar, children }: {
  /** Cómo se anuncia el panel: «Ficha de <nombre>». */
  etiqueta: string;
  /** Cerrar de verdad (lo desmonta quien lo montó). Corre UNA vez, cuando terminó de irse. */
  onCerrar: () => void;
  /**
   * Lo de adentro. Recibe `cerrar`, que es el que hay que usar para la cruz o «Volver»: anima la salida y después
   * llama a `onCerrar`. Llamar a `onCerrar` directo también cierra, sin animación.
   */
  children: (cerrar: () => void) => ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);

  const [saliendo, setSaliendo] = useState(false);
  const yendose = useRef(false);
  const cerrado = useRef(false);
  const reloj = useRef<number | null>(null);
  const terminar = useCallback(() => {
    if (cerrado.current) return;
    cerrado.current = true;
    if (reloj.current != null) window.clearTimeout(reloj.current);
    cerrarRef.current();
  }, []);
  const cerrar = useCallback(() => {
    if (yendose.current || cerrado.current) return;
    if (sinMovimiento()) { terminar(); return; }
    yendose.current = true;
    setSaliendo(true);
    // Por si la animación no termina (una pestaña en segundo plano no anima): se cierra igual.
    reloj.current = window.setTimeout(terminar, SALIDA_PANEL_FICHA_MS + 120);
  }, [terminar]);
  useEffect(() => () => { if (reloj.current != null) window.clearTimeout(reloj.current); }, []);

  // El toque que cayó ADENTRO (árbol de React, portales incluidos). Se apaga solo por si la escucha del documento no
  // llega a leerlo (un toque que alguien frenó en el camino).
  const adentro = useRef(false);
  const marcarAdentro = () => {
    adentro.current = true;
    window.setTimeout(() => { adentro.current = false; }, 0);
  };

  useEffect(() => {
    const nodo = ref.current;
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // El foco entra al panel (el lector de pantalla lo anuncia por su nombre), sin mover el scroll de nada.
    nodo?.focus({ preventScroll: true });

    // En CAPTURA sobre window, como el pop-up de antes: corre antes que los diálogos anidados, y por eso se abstiene
    // mientras haya algo en la pila (lo cierra el de arriba).
    const onTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      if (profundidadModales() > 0) return;
      if (escapeDeUnCampo(document.activeElement)) return;
      e.stopPropagation();
      cerrar();
    };
    const onToque = (e: PointerEvent) => {
      const enElPanel = adentro.current;
      adentro.current = false;
      if (e.button !== 0) return;
      const t = e.target instanceof Element ? e.target : null;
      if (cierraAlTocar(t, enElPanel || (!!t && !!nodo?.contains(t)), profundidadModales())) cerrar();
    };
    window.addEventListener('keydown', onTecla, true);
    document.addEventListener('pointerdown', onToque);
    return () => {
      window.removeEventListener('keydown', onTecla, true);
      document.removeEventListener('pointerdown', onToque);
      // El foco vuelve a donde estaba SÓLO si se quedó sin lugar (estaba adentro del panel, que ya no está). Si
      // cerraste tocando el buscador del tablero, el foco es del buscador.
      const ahora = document.activeElement;
      if (antes?.isConnected && (!ahora || ahora === document.body || (nodo?.contains(ahora) ?? false))) antes.focus({ preventScroll: true });
    };
  }, [cerrar]);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={etiqueta}
      data-panel-ficha=""
      className={saliendo ? 'pf pf--sale' : 'pf'}
      onPointerDownCapture={marcarAdentro}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget && yendose.current) terminar(); }}
    >
      {children(cerrar)}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </aside>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario (AGENTS.md): por eso la hoja se arma con comillas simples.
// ⚠️ Y SIN `transform` NI `will-change` EN REPOSO: la animación sin `fill-mode` se lo saca al terminar. Con un transform
// puesto, el panel sería el bloque contenedor de todo lo `position: fixed` de adentro (los menús de la ficha, el
// asistente de etapa) y se dibujarían corridos adentro del panel en vez de sobre la ventana.
// El `top` y el alto los corrige la regla global de los <aside> cuando está la barra de inspección (app/globals.css).
const CSS = ''
  + '.pf{ position:fixed; top:0; right:0; bottom:0; z-index:80; width:min(' + ANCHO_PANEL_FICHA + 'px, 100vw);'
  + ' display:flex; flex-direction:column; min-height:0; overflow:hidden; outline:none; box-sizing:border-box;'
  + ' background:var(--surface); border-left:1px solid var(--border); box-shadow:-24px 0 60px -30px rgba(0,0,0,.35);'
  + ' animation:pf-entra ' + ENTRADA_PANEL_FICHA.ms + 'ms ' + ENTRADA_PANEL_FICHA.curva + '; }'
  + '.pf--sale{ animation:pf-sale ' + SALIDA_PANEL_FICHA_MS + 'ms cubic-bezier(0.4, 0, 1, 1) forwards; }'
  + '@keyframes pf-entra{ from{ transform:translateX(105%); } to{ transform:translateX(0); } }'
  + '@keyframes pf-sale{ from{ transform:translateX(0); } to{ transform:translateX(105%); } }'
  // En el teléfono es la pantalla entera: una hoja, sin filete ni sombra (no hay nada al lado).
  + '@media (max-width:' + PANEL_FICHA_PANTALLA_ENTERA + 'px){ .pf{ width:100vw; border-left:0; box-shadow:none; } }'
  + '@media (prefers-reduced-motion: reduce){ .pf, .pf--sale{ animation:none; } }';
