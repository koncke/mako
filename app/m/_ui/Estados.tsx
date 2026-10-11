// =============================================================================
// Los estados de una lista de /m: vacío y carga (sin 'use client': se dibujan en el server)
// =============================================================================
// ⚠️ NO SE REUSAN EmptyState/ErrorState de app/_ui tal cual: sus botones son
// `size="sm"`, que mide 36 px — por debajo del mínimo táctil de 44. Y su
// anatomía (ícono + título + detalle) es la del escritorio; en el teléfono el
// vacío es UNA frase.
//
// La frase distingue los cuatro casos, y los escribe quien llama porque sólo él
// sabe cuál es: primer uso («Todavía no hay leads.»), sin resultados («Nadie con
// ese nombre.»), sin permiso, o una falla (eso es <ErrorM>, que dice de quién fue).
// Nada de «más» ni «otro» si el cero incluye al sujeto de la frase.
// =============================================================================

import type { ReactNode } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';

export function VacioM({ frase, accion }: {
  /** UNA frase. Qué falta y, si se arregla en otro lado, dónde. */
  frase: ReactNode;
  /**
   * La salida, si la hay: acción + objeto («Crear un lead», nunca «Aceptar»).
   * `onClick` sólo desde un componente cliente (una función no viaja del server).
   */
  accion?: { rotulo: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="m-vacio" role="status">
      <p className="m-vacio__frase">{frase}</p>
      {accion?.href ? (
        <ButtonLink href={accion.href} variant="secondary" size="md">{accion.rotulo}</ButtonLink>
      ) : accion?.onClick ? (
        <Button variant="secondary" size="md" onClick={accion.onClick}>{accion.rotulo}</Button>
      ) : null}
    </div>
  );
}

/**
 * El esqueleto con la FORMA de la fila (círculo + dos líneas + riel), para la
 * primera carga. Aparece recién a los 300 ms: una carga rápida no parpadea.
 */
export function SkeletonFilas({ filas = 4 }: { filas?: number }) {
  return (
    <div className="m-skel-filas m-lista" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: Math.max(1, filas) }, (_, i) => (
        <div key={i} className="m-skel-fila">
          <span className="mk-skel" style={{ width: 20, height: 20, borderRadius: '50%', flex: 'none', marginTop: 2 }} />
          <span className="m-skel-fila__lineas">
            <span className="mk-skel" style={{ height: 14, width: i % 2 ? '52%' : '64%' }} />
            <span className="mk-skel" style={{ height: 12, width: i % 2 ? '36%' : '44%' }} />
          </span>
          <span className="mk-skel" style={{ width: 32, height: 12, flex: 'none', marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}
