'use client';

// =============================================================================
// El grupo en la lista del teléfono: fijado arriba, en las dos listas (3/11/2026)
// =============================================================================
// La del cliente (ChatClienteM.tsx) y la del super admin (app/m/operaciones/ChatsMovil.tsx). Justo debajo de «Nuevo chat», adentro de su `ListaM`: es el primer chat. Lo que dice la fila lo decide
// app/_chat/grupo/pantalla.ts, igual que en la computadora.

import { useState } from 'react';
import { FilaM } from '@/app/m/_ui';
import { Skeleton } from '@/app/_ui/Feedback';
import { AlfilerWA } from '@/app/admin/operaciones/MensajeWA';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { edadDelGrupo, filasVisibles, noLeidosEnFila, previaDelGrupo } from '@/app/_chat/grupo/pantalla';
import type { GruposDeLaLista } from '@/app/_chat/grupo/useGrupos';
import '@/app/_chat/grupo/grupo.css';

export function FilasDelGrupoM({ g, abierto, onAbrir }: { g: GruposDeLaLista; abierto: number | null; onAbrir: (ws: number) => void }) {
  const [todos, setTodos] = useState(false);
  if (!g.grupos) {
    return g.cargando
      ? <FilaM chevron={false} leading={<Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="dormido" size={40} />} titulo={<Skeleton w={160} h={14} />} segunda={<Skeleton w={200} h={11} />} />
      : null;
  }
  const { visibles, resto } = filasVisibles(g.grupos, { todos, abierto });
  return (
    <>
      {visibles.map((f) => {
        const n = noLeidosEnFila(f.noLeidos);
        return (
          <FilaM key={`grupo-${f.ws}`} chevron={false} etiqueta={f.titulo}
            leading={<Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={40} />}
            titulo={<span className="gr-titulo-m m-operaciones-texto1"><span>{f.titulo}</span><span className="gr-alfiler" aria-label="Fijado"><AlfilerWA size={12} /></span></span>}
            segunda={<span className={n ? 'gr-previa--sinleer' : undefined}>{previaDelGrupo(f)}</span>}
            riel={<span className="gr-riel"><span className="m-operaciones-hace">{edadDelGrupo(f, g.ahora)}</span>{n && <span className="gr-sinleer" aria-label={`${n} sin leer`}>{n}</span>}</span>}
            onClick={() => onAbrir(f.ws)} />
        );
      })}
      {resto > 0 && <FilaM titulo={`Ver ${resto} grupos más`} onClick={() => setTodos(true)} navegacion />}
    </>
  );
}
