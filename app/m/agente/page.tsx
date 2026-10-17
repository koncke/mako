// =============================================================================
// /m/agente — «Client Agents» en el teléfono (17/10/2026). En la URL, /admin/agente. Sólo el super admin.
// =============================================================================
// En qué trabajan los clientes en SU Claude Code: una sesión por fila, del cliente que la cerró, con su título y la
// fecha. Al tocarla se abre una hoja con el resumen y los primeros mensajes del cliente, que es donde se ve CÓMO prompea.
// Referencia: el feed de actividad de la app de Linear (o la de Intercom) en el celular, con una fila por evento, lo más
// nuevo arriba y el detalle en una hoja. Lee lo MISMO que la computadora (`leerSesionesAgente`, lib/agente-sesiones.ts),
// también sin una sola llamada de IA.
//
// ⚠️ LA PUERTA ES LA DE ESCRITORIO: `getSesionAdmin()`, antes de leer nada. La lectura cruza el aislamiento por
// workspace (es la única del sistema que lo hace), así que esta puerta es la que importa.
// =============================================================================

import './agente.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { leerSesionesAgente } from '@/lib/agente-sesiones';
import { PantallaM, VacioM } from '@/app/m/_ui';
import { AgenteM, type SesionM } from './AgenteM';

export const dynamic = 'force-dynamic';

export default async function AgenteMovil() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  const { sesiones, nombreWs } = await leerSesionesAgente();
  if (!sesiones.length) {
    return (
      <PantallaM>
        <VacioM frase="Todavía no reportó ningún agente. Cuando un cliente instale el plugin de MaKo y acepte el reporte, cada sesión aparece aquí." />
      </PantallaM>
    );
  }
  // Al navegador va lo que se dibuja: los primeros seis mensajes de cada sesión, como en la computadora.
  const filas: SesionM[] = sesiones.map((s) => ({
    id: s.id, cliente: nombreWs.get(s.workspace_id) ?? `Workspace ${s.workspace_id}`, cuando: s.empezo_en ?? s.created_at,
    titulo: s.acta?.titulo ?? null, resumen: s.acta?.resumen ?? null, redacciones: s.redacciones ?? 0,
    turnos: (s.turnos ?? []).slice(0, 6).map((t) => (t.texto.length > 240 ? `${t.texto.slice(0, 240)}…` : t.texto)),
    masTurnos: Math.max(0, (s.turnos?.length ?? 0) - 6),
  }));
  const clientes = new Set(sesiones.map((s) => s.workspace_id)).size;
  const mensajes = sesiones.reduce((a, s) => a + (s.turnos?.length ?? 0), 0);
  const redacciones = sesiones.reduce((a, s) => a + (s.redacciones ?? 0), 0);
  return (
    <PantallaM>
      <AgenteM sesiones={filas} resumen={{ sesiones: sesiones.length, clientes, mensajes, redacciones }} />
    </PantallaM>
  );
}
