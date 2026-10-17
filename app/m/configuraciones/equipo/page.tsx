// =============================================================================
// /m/configuraciones/equipo — «Configuración del negocio» › Equipo en el teléfono (17/10/2026). En la URL, /equipo.
// =============================================================================
// Referencia: «Miembros» de los ajustes del workspace de Slack en el celular y «Compartir en familia» de Ajustes de iOS.
// Es la lista de personas con su rol, y una hoja por persona para cambiar el rol, reenviar el acceso, suspender o
// eliminar. Abajo hay UN botón grande, «Sumar al equipo», que abre la hoja de invitar. Es lo mismo que la computadora
// (app/equipo/EquipoView.tsx), con la MISMA API (/api/equipo, que ya corta por rol: sólo el admin del negocio).
//
// La lista la lee el SERVER con la misma función que GET /api/equipo (`equipoDe`) y abre con ella: sin otra ida y vuelta
// desde el navegador (17/10/2026, «que el teléfono ande más rápido»). La lista se monta con `key` nuevo en cada pasada del
// server, así que tirar hacia abajo trae lo nuevo (AGENTS.md → MaKo Mobile). Las acciones van por /api/equipo.
// =============================================================================

import '../configuraciones.css';
import { requireMovil } from '@/lib/movil-guard';
import { getWorkspaceActual } from '@/lib/workspace';
import { equipoDe } from '@/lib/usuarios';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { EquipoM, type Miembro } from './EquipoM';

export const dynamic = 'force-dynamic';

export default async function EquipoMovil() {
  await requireMovil({ navKey: 'configuraciones' });
  // La MISMA lectura que GET /api/equipo (`equipoDe`), en el server. Al navegador va sólo lo que se dibuja.
  const ws = await getWorkspaceActual();
  const iniciales: Miembro[] | null = ws == null ? null : await equipoDe(ws)
    .then((xs) => xs.map((u) => ({
      id: u.id, email: u.email, nombre: u.nombre, foto_url: u.foto_url, estado: u.estado, rol_ws: u.rol_ws,
      ultimo_login: u.ultimo_login, invitacion_enviada_at: u.invitacion_enviada_at,
    })))
    .catch(() => null);
  return (
    <PantallaM>
      <CabeceraM titulo="Equipo" />
      <EquipoM key={Date.now()} iniciales={iniciales} />
    </PantallaM>
  );
}
