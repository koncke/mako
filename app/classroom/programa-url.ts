'use client';

// =============================================================================
// El programa que se mira, en la URL (`?producto=`), para que la cabecera de Clients diga el mismo
// =============================================================================
// El kanban (ClientesApp) y el Classroom (CursoApp) cambian de producto ADENTRO, con su propio desplegable, sin
// navegar (es un filtro sobre lo que ya llegó). Sin esto la cabecera de Clients (app/classroom/ClientsShell.tsx), que
// lee `?producto=`, seguía diciendo el programa de antes encima de otro. Y al revés: cuando la cabecera cambia de
// programa, navega con el `?producto=` nuevo y la pantalla tiene que tomarlo (`usePrograma`).
//
// ⚠️ `replaceState` CON `null` Y NO CON `window.history.state`: Next deja pasar sin enterarse un estado que ya es
//    suyo (`__NA`), y entonces `useSearchParams` de la cabecera no cambia. Con `null`, Next lo integra a su router
//    (copia su estado interno y avisa). Y replace, no push: el Atrás saca de la pantalla, no recorre productos.

import { useEffect, useState } from 'react';

/**
 * El producto de la pantalla, sembrado de la URL que leyó el server y RE-SEMBRADO cuando el server manda otro (la
 * cabecera cambió de programa: navegó). Cambiarlo adentro no navega; lo escribe en la URL `useProgramaEnUrl`.
 */
export function usePrograma(delServer: number | null): [number | null, (id: number | null) => void] {
  const [base, setBase] = useState(delServer);
  const [id, setId] = useState(delServer);
  if (base !== delServer) { setBase(delServer); setId(delServer); }
  return [id, setId];
}

/**
 * Escribe `?producto=<id>` en la URL sin navegar. Con `porDefecto` (el que la pantalla abre sin parámetro) no
 * ensucia una URL que no lo traía: `/classroom/clients` sigue siendo `/classroom/clients` mientras se mire el primero.
 */
export function useProgramaEnUrl(productoId: number | null, porDefecto: number | null): void {
  useEffect(() => {
    if (productoId == null) return;
    try {
      const { pathname, search, hash } = window.location;
      const sp = new URLSearchParams(search);
      const actual = sp.get('producto');
      if (actual === String(productoId)) return;
      if (actual == null && productoId === porDefecto) return;
      sp.set('producto', String(productoId));
      window.history.replaceState(null, '', `${pathname}?${sp.toString()}${hash}`);
    } catch { /* sin URL no se pierde nada: la pantalla sigue mirando su producto */ }
  }, [productoId, porDefecto]);
}
