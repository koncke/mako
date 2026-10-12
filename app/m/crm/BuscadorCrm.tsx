'use client';

// =============================================================================
// El buscador del CRM en el teléfono: busca en el SERVER (buscarLeadsAction) con
// un respiro de 300 ms y devuelve ~20 filas. Mientras hay texto, reemplaza al «Hoy»
// (los `children`, que dibuja el server); sin texto, el «Hoy» vuelve tal cual.
// La cartera NUNCA baja al teléfono.
// =============================================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import { FilaM, SeccionM, SkeletonFilas, VacioM, ErrorM, useConexion } from '@/app/m/_ui';
import { buscarLeadsAction } from './acciones';
import { MIN_BUSQUEDA, type FilaLeadM } from './reglas';

type Estado =
  | { fase: 'quieto' }
  | { fase: 'buscando' }
  | { fase: 'listo'; filas: FilaLeadM[]; hayMas: boolean }
  | { fase: 'error'; error: string };

export function BuscadorCrm({ children }: { children: ReactNode }) {
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<Estado>({ fase: 'quieto' });
  const pedido = useRef(0);
  const { enLinea } = useConexion();
  const query = q.trim();
  const activo = query.length >= MIN_BUSQUEDA;

  useEffect(() => {
    if (!activo) return;
    const n = ++pedido.current;
    const t = setTimeout(() => {
      setEstado({ fase: 'buscando' });
      buscarLeadsAction(query)
        .then((r) => {
          if (n !== pedido.current) return; // llegó tarde: ya se escribió otra cosa
          setEstado(r.ok ? { fase: 'listo', filas: r.filas, hayMas: r.hayMas } : { fase: 'error', error: r.error });
        })
        .catch(() => { if (n === pedido.current) setEstado({ fase: 'error', error: 'No pude buscar' }); });
    }, 300);
    return () => clearTimeout(t);
  }, [query, activo]);

  return (
    <>
      <div className="mc-buscar" role="search">
        <span className="mc-buscar__ico"><Icon name="search" size={18} /></span>
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Buscar un lead"
          aria-label="Buscar un lead por nombre, teléfono, email o empresa"
          value={q}
          onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < MIN_BUSQUEDA) setEstado({ fase: 'quieto' }); }}
          disabled={!enLinea}
        />
        {q && (
          <button type="button" className="mc-buscar__limpiar" aria-label="Borrar la búsqueda" onClick={() => { setQ(''); setEstado({ fase: 'quieto' }); }}>
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
      {!enLinea && <p className="mc-buscar__nota">Sin conexión: la búsqueda vuelve con la red.</p>}

      {activo ? (
        <SeccionM titulo="Resultados">
          {estado.fase === 'buscando' || estado.fase === 'quieto' ? <SkeletonFilas filas={3} />
            : estado.fase === 'error' ? <ErrorM frase={estado.error} />
            : estado.filas.length === 0 ? <VacioM frase="Nadie con ese nombre o número." />
            : (
              <>
                <div className="m-lista">
                  {estado.filas.map((f) => (
                    <FilaM key={f.id} titulo={f.nombre} segunda={f.segunda ?? undefined} href={`/m/crm/${f.id}`} />
                  ))}
                </div>
                {estado.hayMas && <p className="mc-buscar__nota">Hay más: escribe un poco más.</p>}
              </>
            )}
        </SeccionM>
      ) : children}
    </>
  );
}
