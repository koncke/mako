'use client';

// =============================================================================
// El grupo en la lista de la computadora: fijado arriba, en todos los Ops Center (3/11/2026)
// =============================================================================
// Martín: «que sea el grupo justamente, y que esté posicionado arriba». Va justo debajo de «Nuevo chat» (17/10: «Nuevo Chat» arriba de todo, no es un chat): es el primer chat. Fijado por el
// LUGAR y no `sticky`: `.co-lista` scrollea y la fila se va con ella, como el Cerebro. Afuera de `k.sesiones != null` en ChatSecondBrain.tsx: no espera a la lista de chats ni cae con su error.
//
// Es `FilaDeChat`, la de todos. Con la vista previa real y el número de no leídos. Lo que dice la fila lo decide ./pantalla.ts.

import { useState } from 'react';
import { Skeleton } from '@/app/_ui/Feedback';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { FilaDeChat } from '@/app/admin/operaciones/PiezasCentro';
import { AlfilerWA } from '@/app/admin/operaciones/MensajeWA';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { edadDelGrupo, filasVisibles, noLeidosEnFila, previaDelGrupo } from './pantalla';
import type { GruposDeLaLista } from './useGrupos';
import './grupo.css';

export function FilasDelGrupo({ g, abierto, onElegir }: {
  g: GruposDeLaLista;
  /** El grupo abierto: no se esconde detrás de «Ver más». */
  abierto: number | null;
  onElegir: (ws: number) => void;
}) {
  const [todos, setTodos] = useState(false);
  if (!g.grupos) {
    // Mientras llega, su lugar: la lista no salta. Sin poder leerla, nada: lo intenta en la vuelta siguiente.
    return g.cargando ? (
      <div className="co-cuenta co-cuenta--grupo" aria-hidden>
        <div className="gr-esqueleto">
          <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="dormido" size={38} />
          <span className="gr-esqueleto__texto"><Skeleton w="60%" h={12} /><Skeleton w="85%" h={10} /></span>
        </div>
      </div>
    ) : null;
  }
  const { visibles, resto } = filasVisibles(g.grupos, { todos, abierto });
  if (!visibles.length) return null;
  return (
    <div className="co-cuenta co-cuenta--grupo" data-grupos="">
      {visibles.map((f) => {
        const n = noLeidosEnFila(f.noLeidos);
        return (
          <FilaDeChat key={f.ws} titulo={f.titulo} criatura="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" actual={abierto === f.ws} hace={edadDelGrupo(f, g.ahora)}
            chip={<span className="gr-alfiler" title="Fijado" aria-label="Fijado"><AlfilerWA size={12} /></span>}
            previa={<span className="co-fila__l2"><span className={`gr-previa${n ? ' gr-previa--sinleer' : ''}`}>{previaDelGrupo(f)}</span>{n && <span className="gr-sinleer" aria-label={`${n} sin leer`}>{n}</span>}</span>}
            onElegir={() => onElegir(f.ws)} />
        );
      })}
      {resto > 0 && <button type="button" className="co-mas" onClick={() => setTodos(true)}>{`Ver ${resto} grupos más`}</button>}
    </div>
  );
}
