'use client';

// =============================================================================
// GrillaMixta — tarjetas de distinto alto, en columnas y sin huecos (12/11/2026)
// =============================================================================
// Los outliers de Copywriting llevan la forma de su plataforma (YouTube 16:9, reel 9:16, carrusel 4:5, anuncio 1:1) y en una
// grilla de filas cada reel dejaba un hueco grande al lado de los de YouTube. Mide su ancho (ResizeObserver), calcula cuántas
// columnas entran y pone cada tarjeta, en orden, en la columna más baja (lib/grilla-mixta.ts, con su test). El alto se ESTIMA
// con la proporción del marco y el alto del pie: no hay que medir cada tarjeta.
// =============================================================================

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { columnasPara, repartirEnColumnas } from '@/lib/grilla-mixta';

export function GrillaMixta<T>({ items, clave, proporcion, pie, render, minimo = 258, hueco = 20, fila = 24, porDefecto = 4, etiqueta, className }: {
  items: readonly T[];
  clave: (x: T) => string;
  /** Ancho / alto del marco de la tarjeta. */
  proporcion: (x: T) => number;
  /** El alto que suma el pie de la tarjeta (px). */
  pie: number;
  /** La tarjeta: un `<li>`. */
  render: (x: T) => ReactNode;
  minimo?: number;
  hueco?: number;
  /** El espacio entre una tarjeta y la de abajo. */
  fila?: number;
  /** Las columnas antes de medir (el primer dibujo). */
  porDefecto?: number;
  etiqueta: string;
  className?: string;
}) {
  const [caja, setCaja] = useState<HTMLDivElement | null>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!caja) return;
    const medir = () => setAncho(caja.clientWidth);
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(caja);
    return () => ro?.disconnect();
  }, [caja]);
  const n = columnasPara(ancho, minimo, hueco, porDefecto);
  const columnas = useMemo(() => {
    const anchoCol = ancho > 0 ? (ancho - hueco * (n - 1)) / n : minimo;
    return repartirEnColumnas(items, n, (x) => anchoCol / Math.max(0.1, proporcion(x)) + pie + fila);
  }, [items, n, ancho, hueco, minimo, proporcion, pie, fila]);
  return (
    <div ref={setCaja} role="group" aria-label={etiqueta} className={className}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, columnGap: hueco, alignItems: 'start' }}>
      {columnas.map((col, i) => (
        <ul key={i} style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: fila }}>
          {col.map((x) => <GrillaItem key={clave(x)}>{render(x)}</GrillaItem>)}
        </ul>
      ))}
    </div>
  );
}

const GrillaItem = ({ children }: { children: ReactNode }) => <>{children}</>;
