'use client';

// =============================================================================
// GrillaPiezas — todas sus piezas, a todo el ancho y por páginas (4/11/2026)
// =============================================================================
// Martín, mirando a Den Borg: «rediseña mejor la parte donde se ve todos sus reels, YT, etc... No me gusta para nada esa parte con
// scroll infinito, y sin ocupar todo el ancho». Antes vivía en la columna izquierda, al lado del riel, y crecía de a 60 tarjetas:
// 13.000 px de página con 160 piezas. Ahora va debajo de todo, a todo el ancho, y por páginas de FILAS ENTERAS: se mide cuántas
// columnas entran (`columnasQueEntran`, el mismo cálculo que `auto-fill`) y una página son esas columnas × `FILAS_POR_PAGINA`.
// Una página nunca termina con una fila a medias, y la grilla dibuja a lo sumo una página: con 500 piezas, 15 tarjetas en el DOM.
//
// El paginador copia el de GitHub y el de Linear: primera, última, la actual con sus vecinas y «…» (`botonesDePaginas`).
// Cambiar de página lleva la cabecera de la grilla a la vista (si no se ve), sin animar el scroll de toda la página.
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../_components/icons';
import { FILAS_POR_PAGINA, botonesDePaginas, columnasQueEntran, paginaEnRango } from '@/lib/spy-vista';

/** El chevron de la casa apunta abajo: girado, apunta a un costado (no hay variante por lado: icons.tsx). */
export function Flecha({ a, size = 16 }: { a: 'izquierda' | 'derecha'; size?: number }) {
  return <span aria-hidden style={{ display: 'inline-flex', transform: `rotate(${a === 'izquierda' ? 90 : -90}deg)` }}><Icon name="chevron" size={size} /></span>;
}

/** El ancho mínimo de una tarjeta y el hueco: los mismos que `.spy-pgrid` en la hoja de la tab. */
const MINIMO = 210;
/** En el teléfono, dos columnas: una sola tarjeta a lo ancho es una pantalla entera por pieza. */
const MINIMO_ANGOSTO = 150;
const HUECO = 16;

export function GrillaPiezas<T extends { id: number }>({ piezas, reinicio, tarjeta, cabecera, vacio }: {
  piezas: readonly T[];
  /** Cuando cambia (la búsqueda, el tipo, el orden, el competidor), vuelve a la página 1. */
  reinicio: string;
  tarjeta: (p: T) => ReactNode;
  /** El título y las herramientas, encima de la grilla. Se lleva a la vista al cambiar de página. */
  cabecera: ReactNode;
  /** Lo que se ve si la búsqueda o el tipo no dejan ninguna. */
  vacio?: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const arriba = useRef<HTMLDivElement>(null);
  const [columnas, setColumnas] = useState(5);
  const [pagina, setPagina] = useState(1);

  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setColumnas(columnasQueEntran(el.clientWidth, el.clientWidth < 600 ? MINIMO_ANGOSTO : MINIMO, el.clientWidth < 600 ? 12 : HUECO));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- volver a la página 1 cuando cambia lo que se mira, no un cálculo
  useEffect(() => { setPagina(1); }, [reinicio]);

  const porPagina = columnas * FILAS_POR_PAGINA;
  const actual = paginaEnRango(pagina, piezas.length, porPagina);
  const paginas = Math.max(1, Math.ceil(piezas.length / porPagina));
  const desde = (actual - 1) * porPagina;
  const estas = piezas.slice(desde, desde + porPagina);

  const ir = (n: number) => {
    setPagina(n);
    const r = arriba.current?.getBoundingClientRect();
    if (r && r.top < 0) arriba.current?.scrollIntoView({ block: 'start' });
  };

  return (
    <section className="spy-todas" aria-label="Todas sus piezas">
      <div ref={arriba} className="spy-todas__cabecera">{cabecera}</div>
      <div ref={caja} className="spy-pgrid spy-pgrid--ancha" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
        {estas.map((p) => <div key={p.id} className="spy-pgrid__celda">{tarjeta(p)}</div>)}
      </div>
      {!piezas.length && vacio}
      {paginas > 1 && (
        <nav className="spy-paginas" aria-label="Páginas">
          <span className="spy-paginas__cuenta">{desde + 1}–{Math.min(desde + porPagina, piezas.length)} de {piezas.length}</span>
          <div className="spy-paginas__botones">
            <button type="button" className="spy-paginas__flecha" aria-label="Página anterior" disabled={actual <= 1} onClick={() => ir(actual - 1)}>
              <Flecha a="izquierda" />
            </button>
            {botonesDePaginas(actual, paginas).map((n, i) => (n == null
              ? <span key={`s${i}`} className="spy-paginas__salto" aria-hidden>…</span>
              : (
                <button key={n} type="button" className="spy-paginas__n" aria-current={n === actual ? 'page' : undefined} onClick={() => ir(n)}>
                  {n}
                </button>
              )))}
            <button type="button" className="spy-paginas__flecha" aria-label="Página siguiente" disabled={actual >= paginas} onClick={() => ir(actual + 1)}>
              <Flecha a="derecha" />
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
