// =============================================================================
// /api/admin/reiniciar-onboarding — «Reiniciar onboarding» de la barra de la vista de administrador (20/11/2026)
// =============================================================================
// POST { aplicar?: boolean } → reinicia el onboarding y el reto del negocio que se está MIRANDO (sin `aplicar`, sólo dice qué
// cambiaría). Qué se reinicia y qué no lo dice lib/reiniciar-onboarding.ts; lo hace lib/reiniciar-onboarding-server.ts.
//
// Guard: super admin (getSesionAdmin) y el negocio lo dice el SERVER (getWorkspaceActual), nunca el cuerpo del pedido. Nunca el
// negocio del dueño (OWNER_WS): ahí no hay onboarding (lib/onboarding-state.ts, «Mauricio jamás ve el wizard»).

import { NextResponse } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { OWNER_WS } from '@/lib/auth-session';
import { getWorkspaceActual } from '@/lib/workspace';
import { reiniciarOnboarding } from '@/lib/reiniciar-onboarding-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'Sólo un administrador de MaKo.' }, { status: 403 });
  const ws = await getWorkspaceActual();
  if (ws == null) return NextResponse.json({ ok: false, error: 'No estás mirando ningún negocio.' }, { status: 400 });
  if (ws === OWNER_WS) return NextResponse.json({ ok: false, error: 'El negocio del dueño no tiene onboarding.' }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { aplicar?: unknown };
  try {
    // El respaldo (lo de antes, con el perfil entero) no viaja al navegador: lo guarda el script.
    const { resultado } = await reiniciarOnboarding(ws, { aplicar: body.aplicar === true });
    return NextResponse.json({ ok: true, ws, ...resultado });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[api:reiniciar-onboarding] ws=${ws}: ${error}`);
    return NextResponse.json({ ok: false, error: `No se pudo reiniciar: ${error}` }, { status: 500 });
  }
}
