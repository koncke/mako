'use client';

// =============================================================================
// MiniaturaFicha — la vista previa de una plantilla de la ficha: LA TAB, dibujada en chico con los datos de ESTE lead
// =============================================================================
// Martín, 16/10/2026 (punto 5): «Las miniaturas de los TEMPLATES son todos iguales en todas las tabs, y no debería ser
// así... debes crear y mejorar los templates, con sus miniaturas». Hasta acá cada tarjeta era un boceto: rectángulos
// grises con el nombre de cada bloque, que en todas las tabs se veían iguales. Y la regla de la casa, del 14/10/2026 sobre
// las del Dashboard: «los templates tienen que ser fieles a lo que se va a ver, no inventes esas imagenes, que se vea tal
// cual».
//
// LA MINIATURA ES LA TAB, no un dibujo aparte: quien la monta (./FichaPorBloques.tsx) pone adentro el MISMO armador con
// los bloques de la plantilla y el lead que se está mirando, en una página de ANCHO_REF px escalada al ancho de la
// tarjeta, como app/dashboard/MiniaturaHoja.tsx. Se ve el principio de la tab y lo que no entra se corta abajo.
//
// ⚠️ LA ESCALA ES `transform: scale(k)` EN LÍNEA, no en ./ficha-css.ts: esa hoja no puede tener `transform` (un ancestro
//    de las tarjetas con transform vuelve relativos sus modales fijos). Acá no se abre nada: la miniatura es `inert` y
//    `aria-hidden` (la tarjeta de la galería es el botón), así que no hay modal que se corra.
// ⚠️ LOS BLOQUES ENTRAN CUANDO LA TARJETA SE VE (IntersectionObserver): una galería son ~10 plantillas, cada una con
//    sus bloques, y algunos leen al montarse (los cobros, el tracking). Los cobros van a un almacén por lead
//    (./pagos/datos.ts): diez miniaturas de Pagos son UNA lectura.
// =============================================================================

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** El ancho de la página que se dibuja (px): el del cuerpo de la ficha en el pop-up, más o menos. */
export const ANCHO_MINIATURA = 960;

export function MiniaturaFicha({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0);
  const [vivo, setVivo] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setK(el.clientWidth / ANCHO_MINIATURA);
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    if (typeof IntersectionObserver === 'undefined') { setVivo(true); return () => ro?.disconnect(); }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setVivo(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => { ro?.disconnect(); io.disconnect(); };
  }, []);
  return (
    <div ref={ref} className="fb-mini" aria-hidden inert>
      {vivo && k > 0 && (
        <div className="fb-mini-pagina" style={{ width: ANCHO_MINIATURA, transform: `scale(${k})`, transformOrigin: '0 0' }}>{children}</div>
      )}
    </div>
  );
}
