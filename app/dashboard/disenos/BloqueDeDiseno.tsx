'use client';

// =============================================================================
// BloqueDeDiseno — UNA tarjeta de una hoja con diseño propio, como bloque de la grilla (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «se rompen todos en la vista de EDICIÓN… Haz que todo sea funcional y editable». Un bloque es un elemento
// de la grilla (`Elemento.diseno`, lib/disenos-partes.ts) que dibuja la tarjeta `parte` de su diseño con el MISMO componente que
// dibuja la hoja entera (./DisenoVivo.tsx): la misma letra, el mismo movimiento, los mismos datos. Así se ve igual mirando y
// editando, y se mueve, se agranda y se borra como cualquier pieza.
//
// Cómo se dibuja sola una tarjeta:
//   · el diseño se monta con `ParteSola` (./parte.tsx): sus `<Parte id>` que no son ésta devuelven null;
//   · lo que no es una tarjeta (el armazón de la página: su padding, su grilla de 12, sus columnas) se APLANA con la hoja de
//     estilos de acá: todo lo que CONTIENE la tarjeta pasa a ser un bloque del ancho y el alto del bloque, sin padding ni fondo, y
//     lo que no la contiene (el título de la página, una barra) no se dibuja. La tarjeta llena el bloque;
//   · la entrada propia de la tarjeta (la que el diseño le pone a cada `[data-card]` al montarse) se cancela: la entrada es de la
//     HOJA (la elige «Estilo de la hoja», lib/graficos-entradas.ts), y dos entradas encimadas se ven como una que tarda.
//
// ⚠️ LA HOJA DE ESTILOS VA CON `!important` A PROPÓSITO: le gana a la de cada diseño (`.hc .hc-grid {…}`) sin tocarla. Con un
//    selector más específico habría que escribir uno por diseño.
// ⚠️ `:has()` (Chrome 105, Safari 15.4, Firefox 121): lo que no lo entiende dibuja la tarjeta con el armazón alrededor.
// =============================================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Elemento, Hoja } from '@/lib/graficos-catalogo';
import { nombreDeBloque } from '@/lib/disenos-partes';
import { ParteSola } from './parte';
import { DisenoVivo, type PropsDisenoVivo } from './DisenoVivo';

export const CSS_BLOQUE_DISENO = `
.lk-diseno { position: relative; width: 100%; height: 100%; min-height: 0; }
.lk-diseno *:has([data-parte]) {
  display: block !important; position: relative !important; inset: auto !important; transform: none !important;
  width: 100% !important; max-width: none !important; min-width: 0 !important; height: 100% !important; min-height: 0 !important; max-height: none !important;
  margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important;
  overflow: visible !important; gap: 0 !important;
}
.lk-diseno *:has([data-parte]) > *:not([data-parte]):not(:has([data-parte])):not(style):not(link):not([data-acompana]) { display: none !important; }
/* El diseño elige su versión de teléfono por el ancho de SU página (@container): en un bloque esa página mide lo que la tarjeta, y
   una tarjeta de 4 columnas se dibujaba como en un celular. En la grilla, sin contenedor: la versión de la computadora. En la
   pila del celular (data-pila), con el de siempre: ahí sí es un teléfono. */
.lk-diseno:not([data-pila]) *:has([data-parte]), .lk-diseno:not([data-pila]) [data-parte] { container-type: normal !important; }
.lk-diseno [data-parte] {
  width: 100% !important; max-width: none !important; min-width: 0 !important; height: 100% !important; max-height: none !important;
  margin: 0 !important; grid-column: auto !important; grid-row: auto !important; box-sizing: border-box !important;
}
.lk-diseno[data-vacio] > :not(style):not(.lk-diseno-vacio) { display: none !important; }
.lk-diseno-vacio { height: 100%; display: grid; place-items: center; padding: 16px; text-align: center; font-size: 13px; color: var(--dim); border: 1px dashed var(--border); border-radius: 14px; }
`;

export type PropsBloqueDeDiseno = Omit<PropsDisenoVivo, 'hoja' | 'onGrilla'> & {
  e: Elemento;
  hoja: Hoja;
  /** Mirando, la entrada de la hoja se la pone la grilla; acá sólo se cancela la de la tarjeta. */
  editando: boolean;
  /** En la pila del celular: la tarjeta se dibuja en su versión de teléfono. */
  enPila?: boolean;
  /** La tarjeta no tiene qué mostrar (o volvió a tener): mirando, la grilla le saca el lugar. */
  onVacio?: (vacio: boolean) => void;
};

export function BloqueDeDiseno({ e, hoja, editando, enPila = false, onVacio, ...resto }: PropsBloqueDeDiseno) {
  const raiz = useRef<HTMLDivElement>(null);
  const d = e.diseno;
  // La hoja que ve el diseño: la de verdad, con las piezas de ESTE bloque (un bloque insertado en otra hoja lee de las suyas).
  const hojaDelBloque = useMemo<Hoja | null>(() => (d ? { ...hoja, diseno: { id: d.id, piezas: d.piezas, v: 2 } } : null), [hoja, d]);

  // La entrada propia de la tarjeta, fuera: la de la hoja la pone la grilla. Después de los efectos del diseño (los hijos corren
  // antes), y otra vez después de los pasivos (un diseño que la arranca en un useEffect).
  const cancelar = () => {
    const t = raiz.current?.querySelector<HTMLElement>('[data-parte]');
    t?.getAnimations?.().forEach((a) => a.cancel());
  };
  useLayoutEffect(cancelar);
  useEffect(cancelar);

  // UNA TARJETA QUE NO TIENE QUÉ MOSTRAR (la de «Primer contacto» para quien no ve leads, una de General sin sus datos): editando
  // se dice qué bloque es; mirando no se dibuja nada (el lugar lo saca la grilla si el catálogo sabe cuándo, `soloSi`). Se mira el
  // DOM porque el diseño decide adentro si la dibuja, y llega con next/dynamic: hasta que llega, no está vacía (null).
  const [vacio, setVacio] = useState<boolean | null>(null);
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let t = 0;
    const mirar = () => { window.clearTimeout(t); t = window.setTimeout(() => setVacio(!el.querySelector('[data-parte]')), 900); };
    mirar();
    const obs = new MutationObserver(() => { if (el.querySelector('[data-parte]')) { window.clearTimeout(t); setVacio(false); } else mirar(); });
    obs.observe(el, { childList: true, subtree: true });
    return () => { obs.disconnect(); window.clearTimeout(t); };
  }, []);
  const avisar = useRef(onVacio);
  avisar.current = onVacio;
  useEffect(() => { if (vacio != null) avisar.current?.(vacio); }, [vacio]);

  if (!d || !hojaDelBloque) return null;
  const tarjeta = <DisenoVivo {...resto} hoja={hojaDelBloque} />;
  return (
    <div className="lk-diseno" ref={raiz} data-diseno={d.id} data-parte-sola={d.parte} data-editando={editando ? '' : undefined}
      data-pila={enPila ? '' : undefined} data-vacio={vacio ? '' : undefined}>
      <style href="dash-bloque-diseno" precedence="high">{CSS_BLOQUE_DISENO}</style>
      <ParteSola.Provider value={d.parte}>{tarjeta}</ParteSola.Provider>
      {vacio && editando && <div className="lk-diseno-vacio">{d.parte === 'vacia' ? `${nombreDeBloque(d)}: se ve sólo cuando la hoja no tiene datos` : `${nombreDeBloque(d)}: sin datos para mostrar todavía`}</div>}
    </div>
  );
}
