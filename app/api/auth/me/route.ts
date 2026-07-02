// =============================================================================
// /api/auth/me — identidad + workspace del request (para el sidebar y el banner)
// =============================================================================
// El sidebar lo usa para: (a) decidir qué shell mostrar (admin vs cliente),
// (b) pintar el banner de impersonación "estás viendo a <cliente>".

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspace, IMPERSONATE_COOKIE } from '@/lib/workspace';
import { leerImpersonacion } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: true, autenticado: false });

  // ¿Un admin está "viendo como" un cliente?
  let impersonando = false;
  let clienteNombre: string | null = null;
  let clienteWs: number | null = null;
  if (sesion.rol === 'admin') {
    const ws = leerImpersonacion((await cookies()).get(IMPERSONATE_COOKIE)?.value);
    if (ws) {
      clienteWs = ws;
      impersonando = true;
      try { clienteNombre = (await getWorkspace(ws))?.nombre ?? `Workspace ${ws}`; } catch { clienteNombre = `Workspace ${ws}`; }
    }
  }

  return NextResponse.json({
    ok: true,
    autenticado: true,
    email: sesion.email,
    nombre: sesion.nombre,
    rol: sesion.rol,
    legacy: sesion.sub === 'legacy',
    impersonando,
    clienteNombre,
    clienteWs,
  });
}
