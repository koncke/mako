// =============================================================================
// /api/image-editor/subidos — «Subidos» de Canva: la lista y subir un archivo
// =============================================================================
// GET  ?clase=imagen|audio&q= → los archivos del workspace.
// POST { accion: 'firmar', tipo, tamano }  → URL firmada para que el NAVEGADOR suba directo al
//      bucket (una función de Vercel corta el cuerpo en ~4,5 MB).
// POST { accion: 'registrar', path, nombre, ancho, alto } → verifica, muda y anota (si no da, borra).
// La puerta y el trabajo con la base: lib/image-editor/server.ts.

import { firmarSubida, listarSubidos, mal, puerta, registrarSubida } from '@/lib/image-editor/server';
import type { PedidoSubidos } from '@/lib/image-editor/tipos';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const u = new URL(req.url);
  const c = u.searchParams.get('clase');
  const r = await listarSubidos(p.ws, c === 'audio' || c === 'imagen' ? c : null, u.searchParams.get('q') ?? '');
  return Response.json(r, { status: r.ok ? 200 : 500 });
}

export async function POST(req: Request) {
  const p = await puerta();
  if (p instanceof Response) return p;
  const cuerpo = (await req.json().catch(() => null)) as PedidoSubidos | null;
  if (!cuerpo || typeof cuerpo !== 'object') return mal('Pedido inválido');
  if (cuerpo.accion === 'firmar') {
    const { status, ...r } = await firmarSubida(p.ws, cuerpo);
    return Response.json(r, { status: status ?? 200 });
  }
  if (cuerpo.accion === 'registrar') {
    const { status, ...r } = await registrarSubida(p.ws, cuerpo);
    return Response.json(r, { status: status ?? 200 });
  }
  return mal('Acción desconocida');
}
