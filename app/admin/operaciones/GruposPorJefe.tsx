'use client';

// =============================================================================
// Los chats de la lista del Ops Center, agrupados por su jefe o por su TAB (sacado de PiezasCentro.tsx el 10/11/2026)
// =============================================================================
// Vive aparte para que un test lo dibuje sin cargar el motor del Centro (PiezasCentro trae la caja y lo del servidor). Lo montan la
// lista del super admin (`ListaCentro`) y la del cliente (app/second-brain/ChatSecondBrain.tsx); PiezasCentro.tsx lo re-exporta.

import type { ReactNode } from 'react';
import { plegarGrupo, porJefe, type GrupoJefe, type TabDelChat } from '@/lib/centro-chats';

/** Los chats de adentro de cada grupo, plegados (10/11/2026): qué grupos abrió Martín, cómo se abre uno y cuáles se ven siempre. */
export type PlegadoDeGrupos<T> = { abiertos: ReadonlySet<string>; alternar: (clave: string) => void; siempre: (c: T) => boolean };

/**
 * Los chats agrupados por su jefe (`porJefe`): el jefe y, debajo, sus sub-chats corridos a la derecha; un grupo cuyo jefe no está
 * en la lista lleva su nombre arriba. UNO para las dos listas: la del super admin (`ListaCentro`) y la del cliente
 * (app/second-brain/ChatSecondBrain.tsx, sus chats agrupados por origen: 22/10/2026, «un orden como en Super Admin»).
 */
export function GruposPorJefe<T extends { titulo: string }>({ chats, fila, jefe, tabDe, plegado }: {
  chats: readonly T[]; fila: (c: T, sub: boolean) => ReactNode;
  /** La fila jefe de un grupo que no tiene chat propio (el cliente: lib/chat-mako-reglas.ts → jefeDelGrupo). Sin esto, su nombre. */
  jefe?: (g: GrupoJefe<T>) => T | null;
  /** La tab de cada chat (10/11/2026, `tabDeChat`): el grupo es la tab. Sin esto, el nombre del jefe. */
  tabDe?: (c: T) => TabDelChat | null;
  /** Los de adentro plegados detrás de «Mostrar N chats» (el «Mostrar más» de la lista, por grupo). Sin esto, todos a la vista. */
  plegado?: PlegadoDeGrupos<T>;
}) {
  return (
    <>
      {porJefe(chats, tabDe).map((g) => {
        const cabeza = g.chat ?? jefe?.(g) ?? null;
        const abierto = plegado ? plegado.abiertos.has(g.clave) : true;
        const { subs, ocultos } = plegado ? plegarGrupo(g, abierto, plegado.siempre) : { subs: g.subs, ocultos: 0 };
        return (
          <div key={g.clave} className="co-jefe">
            {cabeza ? fila(cabeza, false) : <p className="co-jefe__nombre">{g.jefe}</p>}
            {(subs.length > 0 || ocultos > 0 || (abierto && plegado && g.subs.length > 0)) && (
              <div className="co-jefe__subs">
                {subs.map((s) => fila(s, true))}
                {plegado && ocultos > 0 && (
                  <button type="button" className="co-mas" aria-expanded={false} onClick={() => plegado.alternar(g.clave)}>{`Mostrar ${ocultos} ${ocultos === 1 ? 'chat' : 'chats'}`}</button>
                )}
                {plegado && abierto && g.subs.length > 0 && g.subs.some((s) => !plegado.siempre(s)) && (
                  <button type="button" className="co-mas" aria-expanded onClick={() => plegado.alternar(g.clave)}>Mostrar menos</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

