// =============================================================================
// /api/perfil — leer/guardar perfil del usuario + preferencias de notificaciones
// =============================================================================

import type { NextRequest } from 'next/server';
import { getPerfil, setPerfil, getNotifPrefs, setNotifPrefs, type NotifPrefs, type Perfil } from '@/lib/perfil';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const [perfil, prefs] = await Promise.all([getPerfil(), getNotifPrefs()]);
  return Response.json({ ok: true, perfil, prefs });
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
