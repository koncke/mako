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
// ⚠️ LAS COLUMNAS QUE DIBUJA SON LAS QUE CUENTA: el mismo número va al `grid-template-columns` del estilo en línea Y a `porPagina`.
// Quien la monta en otro ancho las PIDE con `columnas` (el teléfono: una, docs/diseno-competitors-spy.md §8) en vez de taparle el
// estilo en línea con un `!important` desde su hoja: eso cambiaba lo que se VE sin cambiar lo que se CUENTA, y una página del
// teléfono traía el doble de tarjetas —el doble de miniaturas que bajar con datos (docs/hallazgos-mobile.md, 6/11/2026).
//
// ⚠️ CON VARIAS COLUMNAS, LA GRILLA DE CREATE (13/11/2026, Martín: «buen diseño»): cada tarjeta lleva la forma de su red desde el
// 12/11, y en una grilla de FILAS un short al lado de un video largo dejaba un hueco debajo del largo. Con `proporcion`, la página
// se reparte en columnas con `GrillaMixta` (app/_crear/GrillaMixta.tsx, la de Copywriting): cada tarjeta, en orden, va a la
// columna más baja. La página sigue siendo `columnas × FILAS_POR_PAGINA` tarjetas: lo que cambia es cómo se apilan, no cuántas.
// Con una columna (el teléfono) no hay huecos que llenar: la grilla de siempre.
//
// El paginador copia el de GitHub y el de Linear: primera, última, la actual con sus vecinas y «…» (`botonesDePaginas`).
// Cambiar de página lleva la cabecera de la grilla a la vista (si no se ve), sin animar el scroll de toda la página.
// =============================================================================

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../_components/icons';
import { FILAS_POR_PAGINA, botonesDePaginas, columnasQueEntran, paginaEnRango } from '@/lib/spy-vista';
import { GrillaMixta } from '@/app/_crear/GrillaMixta';

/** El chevron de la casa apunta abajo: girado, apunta a un costado (no hay variante por lado: icons.tsx). */
export function Flecha({ a, size = 16 }: { a: 'izquierda' | 'derecha'; size?: number }) {
  return <span aria-hidden style={{ display: 'inline-flex', transform: `rotate(${a === 'izquierda' ? 90 : -90}deg)` }}><Icon name="chevron" size={size} /></span>;
}

/** El ancho mínimo de una tarjeta y el hueco: los mismos que `.spy-pgrid` en la hoja de la tab. */
const MINIMO = 210;
/** En una ventana angosta de la computadora, dos columnas: una sola tarjeta a lo ancho es una pantalla entera por pieza. El
    teléfono no entra por acá: pide `columnas={1}` y no se mide nada. */
const MINIMO_ANGOSTO = 150;
const HUECO = 16;
const HUECO_ANGOSTO = 12;
/** Lo que suma el pie de la tarjeta (TarjetaPieza: el nombre en dos renglones y los números) para ESTIMAR su alto al repartirlas. */
const PIE_TARJETA = 92;

export function GrillaPiezas<T extends { id: number }>({ piezas, reinicio, tarjeta, cabecera, vacio, columnas: pedidas, proporcion }: {
  piezas: readonly T[];
  /** Cuando cambia (la búsqueda, el tipo, el orden, el competidor), vuelve a la página 1. */
  reinicio: string;
  tarjeta: (p: T) => ReactNode;
  /** El título y las herramientas, encima de la grilla. Se lleva a la vista al cambiar de página. */
  cabecera: ReactNode;
  /** Lo que se ve si la búsqueda o el tipo no dejan ninguna. */
  vacio?: ReactNode;
  /**
   * Cuántas columnas dibujar, en vez de medirlas por el ancho de la caja: el teléfono pide 1
   * (docs/diseno-competitors-spy.md §8). Es el número que también CUENTA la paginación, así que quien la monta no
   * tiene que pelearle el `grid-template-columns` del estilo en línea desde su hoja. Sin esto, se mide.
   */
  columnas?: number;
  /**
   * Ancho / alto del marco de cada una (`proporcionDe`). Con esto y más de una columna, se reparten como en Create
   * (`GrillaMixta`) y no quedan huecos entre formatos distintos. Sin esto, la grilla de filas.
   */
  proporcion?: (p: T) => number;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const arriba = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState(5);
  const [angosto, setAngosto] = useState(false);
  const [pagina, setPagina] = useState(1);
  /** Nunca menos de 1: con 0 columnas una página no tiene tarjetas y las páginas son infinitas. */
  const columnas = Math.max(1, Math.floor(pedidas ?? medidas));

  useLayoutEffect(() => {
    if (pedidas != null) return;
    const el = caja.current;
    if (!el) return;
    const medir = () => {
      setAngosto(el.clientWidth < 600);
      setMedidas(columnasQueEntran(el.clientWidth, el.clientWidth < 600 ? MINIMO_ANGOSTO : MINIMO, el.clientWidth < 600 ? HUECO_ANGOSTO : HUECO));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pedidas]);

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
    <section className="spy-todas" aria-label="Todas sus piezas" data-recorrido="spy-grilla">
      <div ref={arriba} className="spy-todas__cabecera">{cabecera}</div>
      <div ref={caja}>
        {proporcion && columnas > 1 ? (
          // Los mismos `minimo` y `hueco` con que se midió: la que reparte cuenta las mismas columnas que la paginación.
          <GrillaMixta
            items={estas} clave={(p) => String(p.id)} proporcion={proporcion} pie={PIE_TARJETA}
            minimo={angosto ? MINIMO_ANGOSTO : MINIMO} hueco={angosto ? HUECO_ANGOSTO : HUECO} fila={angosto ? HUECO_ANGOSTO : HUECO}
            porDefecto={columnas} etiqueta="Sus piezas" className="spy-mixta"
            render={(p) => <li className="spy-pgrid__celda">{tarjeta(p)}</li>}
          />
        ) : (
          <div className="spy-pgrid spy-pgrid--ancha" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
            {estas.map((p) => <div key={p.id} className="spy-pgrid__celda">{tarjeta(p)}</div>)}
          </div>
        )}
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
