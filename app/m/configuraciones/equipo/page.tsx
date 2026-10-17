// =============================================================================
// /m/configuraciones/equipo — «Configuración del negocio» › Equipo en el teléfono (17/10/2026). En la URL, /equipo.
// =============================================================================
// Referencia: «Miembros» de los ajustes del workspace de Slack en el celular y «Compartir en familia» de Ajustes de iOS.
// Es la lista de personas con su rol, y una hoja por persona para cambiar el rol, reenviar el acceso, suspender o
// eliminar. Abajo hay UN botón grande, «Sumar al equipo», que abre la hoja de invitar. Es lo mismo que la computadora
// (app/equipo/EquipoView.tsx), con la MISMA API (/api/equipo, que ya corta por rol: sólo el admin del negocio).
//
// La lista la lee el cliente de /api/equipo, como en escritorio. `leido` cambia con cada pasada del server (el refresco
// de tirar hacia abajo) y el cliente vuelve a pedirla. Sin eso refrescar animaba y no traía nada (AGENTS.md → MaKo Mobile).
// =============================================================================

import '../configuraciones.css';
import { requireMovil } from '@/lib/movil-guard';
import { CabeceraM, PantallaM } from '@/app/m/_ui';
import { EquipoM } from './EquipoM';

export const dynamic = 'force-dynamic';

export default async function EquipoMovil() {
  await requireMovil({ navKey: 'configuraciones' });
  return (
    <PantallaM>
      <CabeceraM titulo="Equipo" />
      <EquipoM leido={Date.now()} />
    </PantallaM>
  );
}
