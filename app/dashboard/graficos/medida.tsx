'use client';

// =============================================================================
// medida — el área de un gráfico, MEDIDA: estira con flex y le pasa su ancho y su alto al dibujo
// =============================================================================
// Antes era un ResponsiveContainer de recharts adentro de una caja absoluta. Ahora el gráfico necesita SABER su
// tamaño para decidir (lib/graficos-gordo.ts): por debajo de 120 px de alto útil se esconden los ejes y por
// debajo de 80 queda sólo el número grande; la regla de etiquetas también depende del lugar.
//
//   · La caja estira con `flex: 1; min-height: 0` (AGENTS.md: un `height: 100%` contra un alto de flex no
//     resuelve en Safari) y el dibujo va en una capa absoluta adentro, así el SVG no empuja a la tarjeta.
//   · Se mide con `clientWidth`/`clientHeight` (no `getBoundingClientRect`, que trae el zoom de la grilla) y
//     un ResizeObserver: el panel de propiedades, la grilla y el PDF (1040 px) cambian el ancho sin un resize
//     de la ventana. La caja se dibuja SIEMPRE, también vacía: si sólo existiera con el tamaño ya medido, el
//     efecto que la mide no la encontraría nunca.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export type Tam = { w: number; h: number };

/** Mide un elemento. Devuelve la ref y el tamaño (null hasta la primera medida). */
export function useMedida<T extends HTMLElement>(): [RefObject<T | null>, Tam | null] {
  const ref = useRef<T | null>(null);
  const [tam, setTam] = useState<Tam | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      setTam((t) => (t && t.w === w && t.h === h ? t : { w, h }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, tam];
}

/** La caja del gráfico: estira, se mide, y dibuja `children(tam)` cuando ya tiene medida. */
export function AreaMedida({ children, minAlto = 0 }: { children: (tam: Tam) => ReactNode; minAlto?: number }) {
  const [ref, tam] = useMedida<HTMLDivElement>();
  return (
    <div ref={ref} style={{ flex: 1, minHeight: minAlto, position: 'relative', minWidth: 0 }}>
      {tam && tam.w > 0 && tam.h > 0 && <div style={{ position: 'absolute', inset: 0 }}>{children(tam)}</div>}
    </div>
  );
}
