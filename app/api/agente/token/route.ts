// =============================================================================
// /api/agente/token — acuñar/rotar el token del AGENTE (Claude Code) del workspace
// =============================================================================
// POST → { token, pista }. Si ya había uno, este lo REEMPLAZA (el viejo deja de servir).
// El token se devuelve UNA vez: en la base queda sólo su hash (09/10/2026).
// Con sesión de browser: lo aprieta el humano desde /integraciones, nunca un
// agente. Solo el ADMIN del workspace (o el super-admin) puede acuñar: el token
// da lectura del plan entero de ese workspace.
// =============================================================================

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { rotarAgenteToken, type AlcanceToken } from '@/lib/agente-token';
import { esAlcance } from '@/lib/api-mako/alcance';
import { consentimientoVigente, aceptar, VERSION_CONSENTIMIENTO } from '@/lib/agente-consentimiento';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  let body: { acepto?: unknown; alcance?: unknown } | null = null;
  try { body = (await req.json()) as { acepto?: unknown; alcance?: unknown }; } catch { /* sin cuerpo: es válido, significa «todavía no acepté» */ }
  // El alcance del token (lib/api-mako/alcance.ts). Sin decir nada, `proponer`: es lo
  // que los tokens siempre hicieron (leer + dejar propuestas). `ejecutar` se pide
  // explícito desde la pantalla, con el texto de lo que significa a la vista.
  const alcance: AlcanceToken = esAlcance(body?.alcance) ? body.alcance : 'proponer';

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
    // La ÚNICA vez que el token sale de MaKo: en la base queda su hash (lib/agente-token-nucleo.ts).
    // La pantalla lo muestra en este momento y después sólo la pista.
    // Con QUIÉN lo acuñó (14/10/2026): el token vale mientras esa persona siga administrando
    // este workspace. Sin esto, una agencia a la que le sacaban el cliente (o un admin
    // suspendido) se iba con un bearer que seguía leyendo y escribiendo.
    const { token, pista } = await rotarAgenteToken(ws, alcance, sesion.email ?? '');
    return NextResponse.json(
      { ok: true, token, pista, alcance },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
