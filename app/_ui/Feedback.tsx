'use client';

// =============================================================================
// Spinner · Progress · Skeleton · Divider — «esperá», con tres significados
// =============================================================================
// El documento pide que cada uno comunique una cosa distinta, porque hoy se usan
// como si fueran el mismo:
//
//   Spinner   «estoy trabajando y no sé cuánto falta». Acciones cortas, dentro
//             de un botón o al lado de una fila.
//   Progress  «voy por acá». SOLO si conocés el total. Un progreso falso que se
//             queda en 90% es peor que no ponerlo.
//   Skeleton  «esto que ves va a ser contenido». Primera carga de una lista o
//             una card: mantiene la forma para que el layout no salte.
//
// Y uno que NO va acá: la animación de MaKo pensando. Esa tiene su propia
// gramática (ver la tarea #520) y muestra progreso real y fuente de datos —
// «no usar animación decorativa indefinida».

import type { CSSProperties } from 'react';

export function Spinner({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <span className="mk-spin" style={{ width: size, height: size, color }} role="status" aria-label="Cargando" />;
}

/** Barra de progreso. `value` de 0 a 100; sin él queda indeterminada. */
export function Progress({ value, tono = 'info', label }: { value: number; tono?: 'info' | 'good' | 'mako'; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = tono === 'good' ? 'var(--good)' : tono === 'mako' ? 'var(--mako)' : 'var(--primary)';
  return (
    <div className="mk-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/**
 * Bloque fantasma. Dale la MEDIDA de lo que va a aparecer: si el esqueleto es
 * más chico que el contenido real, la pantalla pega un salto al cargar.
 */
export function Skeleton({ w = '100%', h = 14, radius, style }: { w?: number | string; h?: number | string; radius?: number | string; style?: CSSProperties }) {
  return <span className="mk-skel" style={{ display: 'block', width: w, height: h, borderRadius: radius, ...style }} aria-hidden />;
}

/** Varias líneas de esqueleto, para un párrafo o una lista. */
export function SkeletonLines({ lines = 3, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} w={i === lines - 1 ? '62%' : '100%'} />
      ))}
    </div>
  );
}

export function Divider({ style }: { style?: CSSProperties }) {
  return <hr className="mk-divider" style={style} />;
}
