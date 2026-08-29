// =============================================================================
// /api/perfil/destinatarios — a quiénes les llegan las notificaciones del negocio
// =============================================================================
// Reemplaza a la vieja acción `numero_dueno` de /api/perfil, que manejaba un solo
// teléfono. Guardar acá deja consistentes los tres settings históricos y suma
// todos los números al grupo de WhatsApp de MaKo (ver lib/notif-destinatarios).

import type { NextRequest } from 'next/server';
import { getDestinatarios, setDestinatarios, type Destinatarios } from '@/lib/notif-destinatarios';
import { getWorkspaceActual, getWorkspace } from '@/lib/workspace';
import { getGrupoJidMaKo } from '@/lib/mako-grupo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const ws = await getWorkspaceActual();
  const [destinatarios, grupoJid] = await Promise.all([
    getDestinatarios(),
    ws != null ? getGrupoJidMaKo(ws) : Promise.resolve(null),
  ]);
  return Response.json({ ok: true, destinatarios, tieneGrupo: Boolean(grupoJid) });
}

export async function POST(req: NextRequest) {
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
