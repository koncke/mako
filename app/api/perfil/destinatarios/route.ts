// =============================================================================
// /api/perfil/destinatarios — a quiénes les llegan las notificaciones del negocio
// =============================================================================
// Reemplaza a la vieja acción `numero_dueno` de /api/perfil, que manejaba un solo
// teléfono. Guardar acá deja consistentes los tres settings históricos y suma
// todos los números al grupo de WhatsApp de MaKo (ver lib/notif-destinatarios).
//
// ⚠️ SÓLO EL ADMIN DEL WORKSPACE (auditoría de seguridad, 14/10/2026). La pantalla que la usa
// (/perfil y /configuraciones, `requireRolWs([])`) ya era sólo admin, pero la ruta no miraba el
// rol y el proxy sólo pide sesión: un closer o un setter con su cookie leía los teléfonos y
// emails del dueño (GET) y se sumaba él mismo (POST) — su número entraba al grupo de MaKo del
// negocio y le llegaban los reportes (ventas, gasto, montos). El mismo corte que /api/equipo.

import type { NextRequest } from 'next/server';
import { getDestinatarios, setDestinatarios, type Destinatarios } from '@/lib/notif-destinatarios';
import { getWorkspaceActual, getWorkspace, getRolWsEfectivo } from '@/lib/workspace';
import { getGrupoJidMaKo } from '@/lib/mako-grupo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** null = entra. getRolWsEfectivo da 'admin' al admin del workspace y a la agencia. */
async function soloAdmin(): Promise<Response | null> {
  if ((await getRolWsEfectivo()) === 'admin') return null;
  return Response.json({ ok: false, error: 'Solo el admin de la cuenta puede configurar los destinatarios.' }, { status: 403 });
}

export async function GET() {
  const cerrada = await soloAdmin();
  if (cerrada) return cerrada;
  const ws = await getWorkspaceActual();
  const [destinatarios, grupoJid] = await Promise.all([
    getDestinatarios(),
    ws != null ? getGrupoJidMaKo(ws) : Promise.resolve(null),
  ]);
  return Response.json({ ok: true, destinatarios, tieneGrupo: Boolean(grupoJid) });
}

export async function POST(req: NextRequest) {
  const cerrada = await soloAdmin();
  if (cerrada) return cerrada;
  let body: Partial<Destinatarios>;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: 'json inválido' }, { status: 400 });
  }
  const ws = await getWorkspaceActual();
  if (ws == null) {
    return Response.json({ ok: false, error: 'Elige un cliente para configurar sus destinatarios.' }, { status: 400 });
  }
  try {
    const wsRow = await getWorkspace(ws);
    const r = await setDestinatarios(body, wsRow?.nombre ?? 'tu negocio');
    return Response.json(r, { status: r.ok ? 200 : 500 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
