// =============================================================================
// /api/integraciones/meta-zernio — Meta conectado por Zernio, desde el modal de Meta de /integraciones (25/10/2026)
// =============================================================================
//   GET                                           → { ok: true, estado }   (si está activo, la conexión, las cuentas y los píxeles)
//   POST { action: 'guardar', accountId }         → { ok: true, estado, conflictos }   (al volver de «Conectar con Facebook»)
//   POST { action: 'elegir', cuenta?, pixel? }    → { ok: true, estado }   (la cuenta publicitaria o el píxel, de la lista)
//
// El ws sale SIEMPRE del request (`getWorkspaceActual`), nunca del cuerpo. Sólo un admin del negocio o el super admin.
// La lógica vive en lib/meta-conexion-zernio.ts.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { MetaZernioError, elegirMetaPorZernio, estadoMetaZernio, guardarConexionMetaPorZernio } from '@/lib/meta-conexion-zernio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function contexto(): Promise<{ ws: number; autor: string | null } | { error: string; status: number }> {
  const sesion = await getUsuarioActual();
  if (!sesion) return { error: 'solo admin', status: 403 };
  const esSuper = (await getSesionAdmin()) != null;
  const esAdminWs = (await getRolWsEfectivo()) === 'admin';
  if (!esSuper && !esAdminWs) return { error: 'solo admin', status: 403 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Elige un negocio primero.', status: 403 };
  // La sesión legacy trae el email de una cookie no firmada: se atribuye por el sub (lo mismo que /api/integraciones/credencial).
  return { ws, autor: sesion.legacy ? sesion.sub : (sesion.email || sesion.sub) };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  const c = await contexto();
  if ('error' in c) return NextResponse.json({ ok: false, error: c.error }, { status: c.status });
  try {
    return NextResponse.json({ ok: true, estado: await estadoMetaZernio(c.ws) });
  } catch (e) {
    console.error(`[api:meta-zernio] estado ws${c.ws}: ${msg(e).slice(0, 300)}`);
    return NextResponse.json({ ok: false, error: 'No pude leer tu conexión de Facebook.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const c = await contexto();
  if ('error' in c) return NextResponse.json({ ok: false, error: c.error }, { status: c.status });
  const body = (await req.json().catch(() => null)) as { action?: unknown; accountId?: unknown; cuenta?: unknown; pixel?: unknown } | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false, error: 'cuerpo inválido' }, { status: 400 });
  try {
    if (body.action === 'guardar') {
      if (typeof body.accountId !== 'string') return NextResponse.json({ ok: false, error: 'falta la conexión' }, { status: 400 });
      const r = await guardarConexionMetaPorZernio(c.ws, body.accountId, c.autor);
      return NextResponse.json({ ok: true, estado: r.estado, conflictos: r.conflictos });
    }
    if (body.action === 'elegir') {
      const cuenta = typeof body.cuenta === 'string' ? body.cuenta : null;
      const pixel = typeof body.pixel === 'string' ? body.pixel : null;
      if (!cuenta && !pixel) return NextResponse.json({ ok: false, error: 'nada para elegir' }, { status: 400 });
      return NextResponse.json({ ok: true, estado: await elegirMetaPorZernio(c.ws, { cuenta, pixel }, c.autor) });
    }
    return NextResponse.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e) {
    if (e instanceof MetaZernioError) return NextResponse.json({ ok: false, error: e.message });
    console.error(`[api:meta-zernio] ${String(body.action)} ws${c.ws}: ${msg(e).slice(0, 300)}`);
    return NextResponse.json({ ok: false, error: 'No pude guardar tu conexión de Facebook.' }, { status: 500 });
  }
}
