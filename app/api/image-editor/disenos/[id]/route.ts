// =============================================================================
// /api/image-editor/disenos/<id> — abrir, guardar y eliminar un diseño
// =============================================================================
// GET    → el diseño con su documento y su versión.
// PATCH  → { version, titulo?, doc? }: compare-and-set; 409 con `versionActual` si otra pestaña guardó.
// DELETE → lo saca de la lista (la fila queda).
// La puerta y el trabajo con la base: lib/image-editor/server.ts.

import { borrarDiseno, guardarDiseno, leerDiseno, mal, puerta } from '@/lib/image-editor/server';
import type { PedidoGuardar } from '@/lib/image-editor/tipos';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const { status, ...r } = await leerDiseno(p.ws, (await params).id);
  return Response.json(r, { status: status ?? 200 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const cuerpo = (await req.json().catch(() => null)) as PedidoGuardar | null;
  if (!cuerpo || typeof cuerpo !== 'object') return mal('Pedido inválido');
  const { status, ...r } = await guardarDiseno(p.ws, (await params).id, cuerpo);
  return Response.json(r, { status: status ?? 200 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const { status, ...r } = await borrarDiseno(p.ws, (await params).id);
  return Response.json(r, { status: status ?? 200 });
}
