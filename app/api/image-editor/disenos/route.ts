// =============================================================================
// /api/image-editor/disenos — la lista de diseños del workspace y crear uno
// =============================================================================
// GET  → los diseños sin el documento (inicio y «Proyectos»).
// POST → { titulo?, doc, id? } crea uno; con `id` (un diseño que estaba en el navegador) es idempotente.
// La puerta, el trabajo con la base y el contrato: lib/image-editor/{server,tipos}.ts.

import { crearDiseno, listarDisenos, mal, puerta } from '@/lib/image-editor/server';
import type { PedidoCrear } from '@/lib/image-editor/tipos';

export const dynamic = 'force-dynamic';

export async function GET() {
  const p = await puerta();
  if (p instanceof Response) return p;
  const r = await listarDisenos(p.ws);
  return Response.json(r, { status: r.ok ? 200 : 500 });
}

export async function POST(req: Request) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const cuerpo = (await req.json().catch(() => null)) as PedidoCrear | null;
  if (!cuerpo || typeof cuerpo !== 'object') return mal('Pedido inválido');
  const { status, ...r } = await crearDiseno(p.ws, p.quien, cuerpo);
  return Response.json(r, { status: status ?? (r.ok ? 200 : 400) });
}
