// =============================================================================
// SeccionM — un bloque de una pantalla de /m: título 20/600 y, si hace falta, UNA acción
// =============================================================================
// Sin 'use client': no tiene estado, así que se dibuja en el server cuando la
// página es un Server Component. 24 px arriba y 8 abajo: más aire ARRIBA del
// título que abajo, para que el título pertenezca a lo que sigue.
//
// Sin kicker ni subtítulo (vetos de la casa). Si una sección necesita un párrafo
// para entenderse, el problema es la sección.
// =============================================================================

import type { ReactNode } from 'react';

export function SeccionM({ titulo, accion, id, children }: {
  titulo: ReactNode;
  /** Como mucho una: «Ver todo», un link a la pantalla de la lista. 44 px de toque. */
  accion?: ReactNode;
  id?: string;
  children?: ReactNode;
}) {
  const idTitulo = id ? `${id}-titulo` : undefined;
  return (
    <section className="m-seccion" id={id} aria-labelledby={idTitulo}>
      <div className="m-seccion__cab">
        <h2 className="m-seccion__titulo" id={idTitulo}>{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}
