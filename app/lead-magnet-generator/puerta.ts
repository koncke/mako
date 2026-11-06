// =============================================================================
// La puerta del Lead Magnet Generator (5/11/2026): por ahora, SÓLO la plataforma
// =============================================================================
// La tab es nueva y nadie de afuera la vio: hasta que Martín la abra a los clientes, entra el super admin en su propio negocio
// (no mirando a un cliente), como Newsletters (app/newsletters/puerta.ts). `adminOnly` de nav.ts sólo esconde la fila: sin esta
// puerta, el admin de cualquier negocio con el plan completo abría la URL. La API de MaKo la cierra con `soloPlataforma`
// (lib/api-mako/areas/leadmagnet.def.ts). Para abrirla: sacar `adminOnly` de nav.ts, esta puerta y el `soloPlataforma`.
// =============================================================================

import 'server-only';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { estaImpersonando } from '@/lib/workspace';
import { requireRolWs } from '@/lib/tab-access';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';

export const NAV_LEAD_MAGNETS = 'lead-magnet-generator';

/** ¿Quien pide es la plataforma (el super admin en su negocio)? */
export async function esLaPlataforma(): Promise<boolean> {
  return !!(await getSesionAdmin()) && !(await estaImpersonando());
}

/** La de la pantalla de escritorio. */
export async function puertaLeadMagnets(): Promise<void> {
  await requireRolWs([], { nav: NAV_LEAD_MAGNETS });
  if (!(await esLaPlataforma())) redirect('/');
}

/** La de la ruta: `null` = entra; si no, la respuesta tal cual (404: a quien no le corresponde, no existe). */
export async function puertaLeadMagnetsApi(): Promise<Response | null> {
  const cerrada = await soloAdminDeTab(NAV_LEAD_MAGNETS);
  if (cerrada) return cerrada;
  if (!(await esLaPlataforma())) return Response.json({ ok: false, error: 'No existe' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return null;
}
