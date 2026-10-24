// =============================================================================
// /api/operaciones/lectura?que=… — las LECTURAS del Ops Center por GET, no por server action (23/10/2026)
// =============================================================================
// Martín, 23/10/2026: «cuando entro a Second Brain tarda muchísimo… lo mismo si abro "USO de IA", no hay un loader».
// La causa: Next corre las server actions DE A UNA por cliente. Al abrir el Centro salía `pushesCentroAction`, que espera a la
// API de Vercel hasta 8 s, y `fotoCentroAction` cada 2,5-8 s: la Ticketera y el Uso quedaban en la cola detrás. Un GET no
// hace cola: van en paralelo.
//
// Cada lectura es la MISMA función de siempre (la acción, que chequea al super admin con su segundo factor): esta ruta sólo
// cambia el camino. Las ESCRITURAS siguen siendo acciones. Del lado del cliente: app/admin/operaciones/lectura-centro.ts.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { computadorasDelNegocioAction, pedidosDelChatAction, creditoApiAction, fotoCentroAction, pushesCentroAction, turnosCentroAction } from '@/app/admin/operaciones/acciones';
import { leerBandejaAction } from '@/app/tickets/bandeja/acciones';
import { LECTURAS_CENTRO, type LecturaCentro } from '@/app/admin/operaciones/lectura-centro';

export const dynamic = 'force-dynamic';

const LEER: Record<LecturaCentro, (req: NextRequest) => Promise<unknown>> = {
  pushes: () => pushesCentroAction(),
  foto: () => fotoCentroAction(),
  credito: () => creditoApiAction(),
  // Las de UN negocio, para su ficha en Clientes (23/10/2026): ya no las de todos (lib/ia-pc.ts → listarPcDelNegocio).
  computadoras: (req) => computadorasDelNegocioAction(Number(req.nextUrl.searchParams.get('ws'))),
  bandeja: (req) => leerBandejaAction(req.nextUrl.searchParams.get('vista') === '1'),
  // Los chats (`l`, repetido) y la dirección del chat (`dir`) para su borrador y sus marcas.
  turnos: (req) => turnosCentroAction(req.nextUrl.searchParams.getAll('l'), req.nextUrl.searchParams.get('dir') ?? undefined),
  // Los pedidos terminados viejos de un chat (`id`, repetido), al abrirlo.
  pedidos: (req) => pedidosDelChatAction(req.nextUrl.searchParams.getAll('id')),
};

export async function GET(req: NextRequest) {
  const que = req.nextUrl.searchParams.get('que') ?? '';
  if (!(LECTURAS_CENTRO as readonly string[]).includes(que)) {
    return NextResponse.json({ ok: false, error: 'Esa lectura no existe.' }, { status: 400 });
  }
  return NextResponse.json(await LEER[que as LecturaCentro](req), { headers: { 'cache-control': 'no-store' } });
}
