// =============================================================================
// /api/agente/token — acuñar/rotar el token del AGENTE (Claude Code) del workspace
// =============================================================================
// POST → { token }. Si ya había uno, este lo REEMPLAZA (el viejo deja de servir).
// Con sesión de browser: lo aprieta el humano desde /integraciones, nunca un
// agente. Solo el ADMIN del workspace (o el super-admin) puede acuñar: el token
// da lectura del plan entero de ese workspace.
// =============================================================================

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { rotarAgenteToken } from '@/lib/agente-token';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: false, error: 'sin sesión' }, { status: 401 });
  // Un closer/setter no acuña credenciales de su agencia.
  if (sesion.rol !== 'admin' && sesion.rolWs !== 'admin') {
    return NextResponse.json({ ok: false, error: 'solo el admin del espacio' }, { status: 403 });
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return NextResponse.json({ ok: false, error: 'sin workspace (entrá como un cliente)' }, { status: 400 });

  try {
    return NextResponse.json({ ok: true, token: await rotarAgenteToken(ws) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
