// =============================================================================
// GET /api/recibos-negocio/ejemplo?plantilla=clasico|compacto|marca — «Ver ejemplo en PDF» de la tarjeta «Emitir recibo»
// =============================================================================
// El PDF de la plantilla con los datos de ESTE negocio («Facturado por» o su nombre) y un pago de muestra, sin número y con la
// marca EJEMPLO (lib/recibos-negocio.ts, `ejemploDeRecibo`). Quien ve Automations (la tab de la tarjeta): el admin y el setter
// (sus `rolesWs`, app/_components/nav.ts), en positivo. Sólo lee: no emite ni manda nada.
// =============================================================================

import { tabEnCapa } from '@/lib/capas';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { ejemploDeRecibo } from '@/lib/recibos-negocio';
import { esPlantillaRecibo } from '@/lib/recibo-negocio-reglas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const rol = await getRolWsEfectivo();
  if (rol == null) return Response.json({ error: 'Sin sesión: vuelve a entrar' }, { status: 401 });
  if (rol !== 'admin' && rol !== 'setter') return Response.json({ error: 'No es de tu rol' }, { status: 403 });
  if (!tabEnCapa('setting', await getCapaActual())) return Response.json({ error: 'No existe' }, { status: 404 });
  const ws = await getWorkspaceActual();
  if (ws == null) return Response.json({ error: 'Sin negocio' }, { status: 401 });
  const p = new URL(req.url).searchParams.get('plantilla') ?? 'clasico';
  if (!esPlantillaRecibo(p)) return Response.json({ error: 'Esa plantilla no existe' }, { status: 400 });
  const pdf = await ejemploDeRecibo(ws, p);
  return new Response(Buffer.from(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Recibo de ejemplo - ${p}.pdf"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
