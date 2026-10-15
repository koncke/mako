// =============================================================================
// /admin/operaciones — el Centro de Operaciones (sólo Martín)
// =============================================================================
// Pedido de Martín (15/10/2026): «continua y termina el centro de operaciones, es lo que más me
// interesa ahora». Desde acá se dejan pedidos firmados para los chats de Claude Code de la PC; los
// entrega el cartero (scripts/operaciones/cartero.mjs). Diseño: docs/diseno-centro-de-operaciones.md.
//
// ⚠️ TRES CERROJOS: el proxy cierra /admin/* (SOLO_ADMIN), esta página pide `puedeOperar` (admin
// global + workspace de la plataforma + segundo factor de verdad), y cada acción vuelve a
// preguntar. La ruta NO está en PUBLICOS; la que sí está es /api/operaciones/cartero, que es otra
// puerta, con su token.

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { wsSuperAdmin } from '@/lib/workspace';
import { ErrorState, Pagina, PermissionState } from '@/app/_ui';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { leerCarteros, listarPedidos } from '@/lib/operaciones';
import CentroOperaciones from './CentroOperaciones';

export const dynamic = 'force-dynamic';

export default async function OperacionesPage() {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  if (!puedeOperar(admin, await wsSuperAdmin())) {
    return <Pagina><PermissionState motivo="rol" que="el Centro de Operaciones" /></Pagina>;
  }
  try {
    const [pedidos, carteros] = await Promise.all([listarPedidos(), leerCarteros()]);
    return <CentroOperaciones sub={admin.sub} pedidosIniciales={pedidos} carterosIniciales={carteros} />;
  } catch (e) {
    return <Pagina><ErrorState titulo="No pude leer la cola" detalle={e instanceof Error ? e.message : undefined} /></Pagina>;
  }
}
