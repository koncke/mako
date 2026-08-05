'use client';

// =============================================================================
// VerMas — cortar una lista larga sin esconderla
// =============================================================================
// El historial se mostraba entero: en el detalle de un proyecto sin ningún tope, y en
// la tab de Proyectos con un `.slice(0, 40)` que igual deja una tira de 40 filas con
// avatar y chip cada una. Resultado: para llegar a lo que está DEBAJO del historial
// había que scrollear un rato largo, y el historial es justamente lo que menos se mira.
//
// La regla: se muestran las últimas N (lo nuevo es lo que importa) y el resto queda
// detrás de un botón que DICE CUÁNTAS son. Un «Ver más» que no dice cuánto falta no
// deja decidir si vale la pena abrirlo. Y una vez abierto se puede volver a cerrar:
// abrir para buscar una cosa no debería dejarte la pantalla larga para siempre.
// =============================================================================

import { useState } from 'react';

const SANS = "'Geist', sans-serif";

export function useVerMas<T>(items: T[], inicial = 8): { visibles: T[]; boton: React.ReactNode } {
  const [abierto, setAbierto] = useState(false);
  const ocultas = Math.max(0, items.length - inicial);
  const visibles = abierto || !ocultas ? items : items.slice(0, inicial);

  const boton = ocultas > 0 ? (
    <button
      type="button"
      onClick={() => setAbierto((v) => !v)}
      style={{
        alignSelf: 'flex-start', marginTop: 2, padding: '6px 12px', borderRadius: 9,
        border: '1px solid var(--border-strong)', background: 'var(--surface)',
        color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS,
      }}
    >
      {abierto ? 'Ver menos' : `Ver ${ocultas} más`}
    </button>
  ) : null;

  return { visibles, boton };
}
