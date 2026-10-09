// =============================================================================
// /api/perfil — perfil de la persona + preferencias de reportes del workspace
// =============================================================================
// Dos cosas que NO viven acá, cada una con su ruta propia:
//   ./notif-inapp     → pop-up y sonido. Son de la PERSONA y los pide el provider
//                       del layout en cada pantalla: no puede pagar las lecturas
//                       de este GET en cada carga de página.
//   ./destinatarios   → a quiénes les llega. Antes era la acción `numero_dueno`
//                       de acá, que manejaba un solo teléfono.

import type { NextRequest } from 'next/server';
import { leerPerfil, setPerfil, getNotifPrefs, setNotifPrefs, type NotifPrefs, type Perfil } from '@/lib/perfil';
import { getWorkspaceActual } from '@/lib/workspace';
import { getGrupoJidMaKo } from '@/lib/mako-grupo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const ws = await getWorkspaceActual();
  const [{ perfil, vista }, prefs, grupoJid] = await Promise.all([
    // `vista` dice si es el perfil de OTRO (agencia o super admin viendo a un cliente) y de
    // qué cuenta: la pantalla lo rotula con eso. Lo decide el server (lib/perfil-sujeto.ts).
    leerPerfil(),
    getNotifPrefs(),
    ws != null ? getGrupoJidMaKo(ws) : Promise.resolve(null),
  ]);
  return Response.json({ ok: true, perfil, vista, prefs, tieneGrupo: Boolean(grupoJid) });
}

export async function POST(req: NextRequest) {
  let body: { action?: string; perfil?: Partial<Perfil>; prefs?: NotifPrefs };
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
    return Response.json({ ok: false, error: 'acción no reconocida' }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
