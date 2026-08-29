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
import { consentimientoVigente, aceptar, VERSION_CONSENTIMIENTO } from '@/lib/agente-consentimiento';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  let body: { acepto?: unknown } | null = null;
  try { body = (await req.json()) as { acepto?: unknown }; } catch { /* sin cuerpo: es válido, significa «todavía no acepté» */ }

  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: false, error: 'sin sesión' }, { status: 401 });
  // Un closer/setter no acuña credenciales de su agencia.
  if (sesion.rol !== 'admin' && sesion.rolWs !== 'admin') {
    return NextResponse.json({ ok: false, error: 'solo el admin del espacio' }, { status: 403 });
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return NextResponse.json({ ok: false, error: 'sin workspace (entra como un cliente)' }, { status: 400 });

  // EL TRATO ES LA PUERTA. El plugin reporta siempre lo que el cliente trabaja en su
  // Claude Code, y la única forma honesta de sostener ese «siempre» es que esté dicho
  // y aceptado ANTES: sin consentimiento vigente no hay token, y sin token el plugin
  // no puede hablar con MaKo. Se acepta en la misma llamada (`acepto: true`) para que
  // no haya un estado intermedio donde alguien aceptó y no tiene token, o al revés.
  try {
    if (!(await consentimientoVigente(ws))) {
      if (body?.acepto !== true) {
        return NextResponse.json(
          { ok: false, error: 'falta aceptar el reporte del agente', necesitaConsentimiento: true, version: VERSION_CONSENTIMIENTO },
          { status: 409 },
        );
      }
      await aceptar(ws, sesion.email ?? 'sin-email');
    }
    return NextResponse.json({ ok: true, token: await rotarAgenteToken(ws) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
