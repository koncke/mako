// =============================================================================
// /api/auth/me — identidad + workspace del request (para el sidebar y el banner)
// =============================================================================
// El sidebar lo usa para: (a) decidir qué shell mostrar (admin vs cliente),
// (b) pintar el banner de impersonación "estás viendo a <cliente>".

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getWorkspace, getWorkspaceActual, getRolWsEfectivo, estaImpersonando } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: true, autenticado: false });

  // ¿Un admin está "viendo como" un cliente, EN ESTA PESTAÑA?
  //
  // Antes esto leía la cookie de impersonación a mano. Ya no: el workspace puede
  // venir del `?ws=` de la pestaña, y con dos fuentes hay que preguntarle a quien
  // sabe combinarlas. Copiar la lógica acá era garantizar que un día el banner
  // dijera un cliente y los datos fueran de otro.
  const ws = await getWorkspaceActual();
  const impersonando = await estaImpersonando();
  let clienteNombre: string | null = null;
  const clienteWs = impersonando ? ws : null;
  if (clienteWs) {
    try { clienteNombre = (await getWorkspace(clienteWs))?.nombre ?? `Workspace ${clienteWs}`; } catch { clienteNombre = `Workspace ${clienteWs}`; }
  }

  return NextResponse.json({
    ok: true,
    autenticado: true,
    email: sesion.email,
    nombre: sesion.nombre,
    rol: sesion.rol,
    // Rol dentro del negocio + workspace efectivo (para que el Sidebar filtre tabs).
    rolWs: await getRolWsEfectivo(),
    ws,
    // Capa que compró el cliente (lib/capas.ts): el Sidebar esconde lo que no
    // incluye. Es cosmético — el enforcement real es requireCapa server-side.
    capa: await getCapaActual(),
    legacy: sesion.sub === 'legacy',
    impersonando,
    clienteNombre,
    clienteWs,
  });
}
