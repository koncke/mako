'use client';

// =============================================================================
// MiembrosClientes — la vista «Miembros» de Classroom › Clients: el directorio de la comunidad del programa
// =============================================================================
// Martín, 29/10/2026: «unificar la tab de clientes con la tab de miembros, porque al fin y al cabo es el típico botón que
// tenemos en el CRM u otros lugares, del botón de Kanban o botón de lista. Son lo mismo, no deberían ser dos tabs». Hasta
// ese día era la sub-tab Members (/classroom/members, que redirige a `?vista=miembros`).
//
// Es la MISMA pieza que dibujaba Members (app/_comunidad/Miembros.tsx adentro de Comunidad): los filtros Todos · Equipo ·
// En línea · Fuera, la búsqueda, el perfil de cada uno y la moderación (sacar y volver a admitir). Lo que cambia:
//   · la piel es la de la APP, la del kanban de al lado (la del curso era la de la comunidad);
//   · sin la fila de la comunidad (la búsqueda de posts y la campana son de Community, que sigue siendo su sub-tab);
//   · el selector de vistas de Clients va al final de la barra de Miembros, donde está en la barra del kanban.
// La comunidad se pide al montar (la del equipo, por sus server actions): llega con la vista, no con el HTML del kanban.

import { useMemo, type ReactNode } from 'react';
import { Comunidad } from '@/app/_comunidad/Comunidad';
import { apiDelEquipo } from './comunidad/api-equipo';

export function MiembrosClientes({ productoId, selector }: {
  /** El programa de la cabecera: la comunidad es de un producto. */
  productoId: number;
  /** El selector de vistas de Clients (Kanban · Lista · Miembros · Avance). Sin él (la plataforma), no hay a dónde cambiar. */
  selector?: ReactNode;
}) {
  const api = useMemo(() => apiDelEquipo(productoId), [productoId]);
  return (
    <Comunidad key={productoId} api={api} tema="equipo" piel="app" pestana="miembros" sinPestanas sinBarra extraMiembros={selector} />
  );
}
