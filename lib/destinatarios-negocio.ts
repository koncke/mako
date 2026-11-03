// =============================================================================
// A quién le avisa MaKo lo del negocio, como lo lee la pantalla — en UN lugar (17/10/2026)
// =============================================================================
// Lo leen GET /api/perfil/destinatarios (la computadora, desde el navegador) y la pantalla del teléfono
// (app/m/configuraciones/notificaciones, desde el server: así abre con los datos y sin una segunda ida y vuelta). Quien
// la llama pregunta antes si es el admin del negocio.
// =============================================================================

import 'server-only';
import { getDestinatarios, type Destinatarios } from './notif-destinatarios';
import { getWorkspaceActual } from './workspace';
import { getGrupoJidMaKo } from './mako-grupo';

export async function destinatariosDelNegocio(): Promise<{ destinatarios: Destinatarios; tieneGrupo: boolean; ws: number | null }> {
  const ws = await getWorkspaceActual();
  const [destinatarios, grupoJid] = await Promise.all([
    getDestinatarios(),
    ws != null ? getGrupoJidMaKo(ws) : Promise.resolve(null),
  ]);
  return { destinatarios, tieneGrupo: Boolean(grupoJid), ws };
}
