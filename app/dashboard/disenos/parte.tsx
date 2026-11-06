'use client';

// =============================================================================
// Parte — una tarjeta de una hoja con DISEÑO PROPIO, que en un BLOQUE se dibuja sola (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «Los dashboard puede que estén, pero se rompen todos en la vista de EDICIÓN... Haz que todo sea funcional
// y editable». Hasta ese día una hoja copiada (Closing ← Halden, Marketing ← Kestrel…) se MIRABA con su diseño entero y se
// EDITABA en la grilla de siempre, con otros gráficos: «Editar» cambiaba la pantalla por otra, y nada de lo que se veía se
// podía tocar. Desde ese día cada tarjeta del diseño es un BLOQUE de la grilla (`Elemento.diseno`, lib/graficos-catalogo.ts):
// se elige, se mueve, se agranda, se configura (lo que lee) y se borra como cualquier pieza, y se ve igual mirando y editando.
//
// Cómo: el componente del diseño (./HojaClosing.tsx…) se dibuja ENTERO, como siempre, y cada tarjeta va envuelta en `<Parte id>`.
// Adentro de un bloque (`<ParteSola.Provider value="tasa">`), `Parte` dibuja sólo la suya y las demás devuelven null. Lo que no es
// una tarjeta (el armazón de la página: su padding, su grilla, sus columnas) lo aplana la hoja de estilos de ./BloqueDeDiseno.tsx.
//
// ⚠️ `Parte` NO agrega un nodo: le pone `data-parte` a su hijo. Con un envoltorio, la grilla del diseño perdería la tarjeta como
//    hija directa (sus `grid-column`, sus `span`) y la hoja entera —la de la miniatura de «Nueva hoja»— cambiaría.
// ⚠️ El id de una parte es una CLAVE: lo guardan las hojas (`Elemento.diseno.parte`). No se renombra; el catálogo vive en
//    lib/disenos-partes.ts y `tests/dashboard-bloques-diseno.test.ts` exige que cada `<Parte id>` de un diseño esté ahí.
// =============================================================================

import { cloneElement, createContext, isValidElement, useContext, type ReactElement, type ReactNode } from 'react';

/** La parte que se dibuja sola; null = la hoja entera (la miniatura de «Nueva hoja»). */
export const ParteSola = createContext<string | null>(null);

/** La parte que se está dibujando sola, o null si es la hoja entera. */
export const useParteSola = (): string | null => useContext(ParteSola);

/** ¿Se dibuja esta parte? (para lo que se calcula sólo si se ve: una lectura, un reloj). */
export function useSeDibuja(id: string | readonly string[]): boolean {
  const solo = useContext(ParteSola);
  if (solo == null) return true;
  return typeof id === 'string' ? solo === id : id.includes(solo);
}

/** Una tarjeta del diseño: siempre en la hoja entera; en un bloque, sólo la suya. */
export function Parte({ id, children }: { id: string; children: ReactNode }) {
  const solo = useContext(ParteSola);
  if (solo != null && solo !== id) return null;
  if (!isValidElement(children)) return <>{children}</>;
  return cloneElement(children as ReactElement<Record<string, unknown>>, { 'data-parte': id });
}
