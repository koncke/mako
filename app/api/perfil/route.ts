// =============================================================================
// /api/perfil — leer/guardar perfil del usuario + preferencias de notificaciones
// =============================================================================
// También expone el "número del dueño" del workspace (destinatario del grupo de
// MaKo): al setearlo/cambiarlo se crea o se sincroniza el grupo (lib/mako-grupo).

import type { NextRequest } from 'next/server';
import { getPerfil, setPerfil, getNotifPrefs, setNotifPrefs, type NotifPrefs, type Perfil } from '@/lib/perfil';
import { getWorkspaceActual, getWorkspace } from '@/lib/workspace';
import { getNumeroDueno, getGrupoJidMaKo, setNumeroDuenoYSync } from '@/lib/mako-grupo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Pop-up y sonido NO viven acá: son de la persona, los pide el provider del
// layout en cada pantalla y tienen su propia ruta liviana (./notif-inapp).
export async function GET() {
  const ws = await getWorkspaceActual();
  const [perfil, prefs, numeroDueno, grupoJid] = await Promise.all([
    getPerfil(),
    getNotifPrefs(),
    ws != null ? getNumeroDueno(ws) : Promise.resolve(null),
    ws != null ? getGrupoJidMaKo(ws) : Promise.resolve(null),
  ]);
  return Response.json({ ok: true, perfil, prefs, numeroDueno, tieneGrupo: Boolean(grupoJid) });
}

export async function POST(req: NextRequest) {
  let body: { action?: string; perfil?: Partial<Perfil>; prefs?: NotifPrefs; numero?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: 'json inválido' }, { status: 400 });
  }
  try {
    if (body.action === 'perfil' && body.perfil) {
      const perfil = await setPerfil(body.perfil);
      return Response.json({ ok: true, perfil });
    }
    if (body.action === 'prefs' && body.prefs) {
      await setNotifPrefs(body.prefs);
      return Response.json({ ok: true });
    }
    if (body.action === 'numero_dueno') {
      const ws = await getWorkspaceActual();
      if (ws == null) return Response.json({ ok: false, error: 'Elegí un cliente para configurar su número.' }, { status: 400 });
      const wsRow = await getWorkspace(ws);
      const r = await setNumeroDuenoYSync(ws, body.numero ?? '', wsRow?.nombre ?? 'tu negocio');
      return Response.json(r, { status: r.ok ? 200 : 500 });
    }
    return Response.json({ ok: false, error: 'acción no reconocida' }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
