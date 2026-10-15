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
 * El esqueleto con la FORMA DEL TABLERO (KanbanM): la barra de etapas, una columna entera y la
 * siguiente asomando. Es el de los `loading.tsx` del CRM y de Clientes (v3, 14/10/2026): sin él,
 * tocar la pestaña dejaba la pantalla anterior congelada hasta que el server terminaba (medido:
 * 1,8-3,3 s el CRM, más el arranque de la instancia después de cada deploy). Aparece a los 300 ms.
 */
export function SkeletonTablero({ conArriba = false }: { conArriba?: boolean }) {
  return (
    <div className="m-skel-kb" aria-busy="true" aria-label="Cargando el tablero">
      {conArriba && <span className="mk-skel m-skel-kb__arriba" />}
      <div className="m-skel-kb__etapas">
        {Array.from({ length: 5 }, (_, i) => <span key={i} className="mk-skel" />)}
      </div>
      <div className="m-skel-kb__pista">
        {[0, 1].map((c) => (
          <div key={c} className="m-skel-kb__col">
            <span className="mk-skel m-skel-kb__cab" />
            {Array.from({ length: c ? 2 : 4 }, (_, i) => <span key={i} className="mk-skel m-skel-kb__tj" />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** El esqueleto de la portada (General): el saludo lo pone el shell; acá, la tarjeta oscura y dos más. */
export function SkeletonTarjetas() {
  return (
    <div className="m-skel-tarjetas" aria-busy="true" aria-label="Cargando">
      <span className="mk-skel m-skel-tarjetas__heroe" />
      <span className="mk-skel m-skel-tarjetas__t" />
      <span className="mk-skel m-skel-tarjetas__t" />
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
